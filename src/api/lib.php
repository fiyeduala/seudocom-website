<?php
// Shared backend code for the Seudocom API. Applicant data lives in data_dir, outside the public web root.
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

const STATUSES = [
    'application_received' => 'Application received',
    'assessment_submitted' => 'Assessment submitted',
    'under_review' => 'Under review',
    'attestation_required' => 'Notarized affidavit required',
    'interview' => 'Interview stage',
    'successful' => 'Successful',
    'unsuccessful' => 'Not selected',
];

function config(): array {
    static $c = null;
    if ($c !== null) return $c;
    $parent = dirname(__DIR__, 2);
    $c = [
        'data_dir' => getenv('SEUDOCOM_DATA_DIR') ?: $parent . '/seudocom-data',
        'mail_driver' => PHP_SAPI === 'cli-server' ? 'log' : 'mail',
        'mail_from' => 'contact@seudocom.org',
        'site_url' => 'https://pseudocom.org',
    ];
    if (is_file($parent . '/seudocom-config.php')) $c = array_merge($c, require $parent . '/seudocom-config.php');
    return $c;
}

function data_path(string $name): string { return config()['data_dir'] . '/' . $name; }

function respond(array $body, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body);
    exit;
}

function fail(string $message, int $status = 400): void { respond(['error' => $message], $status); }

// Creates a generated secret file on first use. Used for the code pepper and the setup key.
function secret_file(string $name): string {
    $file = data_path($name);
    if (!is_file($file)) file_put_contents($file, bin2hex(random_bytes(24)), LOCK_EX);
    return trim((string) file_get_contents($file));
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = config()['data_dir'];
    foreach ([$dir, "$dir/resumes", "$dir/affidavits", "$dir/sessions"] as $d) {
        if (!is_dir($d) && !mkdir($d, 0700, true) && !is_dir($d)) fail('The server could not prepare its storage.', 500);
    }
    if (!is_file("$dir/.htaccess")) file_put_contents("$dir/.htaccess", "Require all denied\n");
    $pdo = new PDO('sqlite:' . "$dir/seudocom.sqlite", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('CREATE TABLE IF NOT EXISTS applicants (
        id INTEGER PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
        address TEXT NOT NULL, location TEXT NOT NULL, nationality TEXT NOT NULL, position TEXT NOT NULL, preferred_role TEXT,
        experience TEXT NOT NULL, cover_letter TEXT, resume_file TEXT NOT NULL, resume_name TEXT NOT NULL,
        status TEXT NOT NULL, assessment TEXT, assessment_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS updates (
        id INTEGER PRIMARY KEY, applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        subject TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS attempts (bucket TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS partners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, location TEXT, details TEXT, created_at TEXT NOT NULL)');
    $columns = array_column($pdo->query('PRAGMA table_info(applicants)')->fetchAll(), 'name');
    foreach (['affidavit_file', 'affidavit_name', 'affidavit_at'] as $column) {
        if (!in_array($column, $columns, true)) $pdo->exec("ALTER TABLE applicants ADD COLUMN $column TEXT");
    }
    return $pdo;
}

function now(): string { return gmdate('c'); }

// Counts events per client address; blocks once the limit for the window is reached.
function rate_limited(string $action, int $limit, int $window): bool {
    $bucket = hash('sha256', $action . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
    db()->prepare('DELETE FROM attempts WHERE at < ?')->execute([time() - 86400]);
    $q = db()->prepare('SELECT COUNT(*) FROM attempts WHERE bucket = ? AND at > ?');
    $q->execute([$bucket, time() - $window]);
    return (int) $q->fetchColumn() >= $limit;
}

function record_attempt(string $action): void {
    db()->prepare('INSERT INTO attempts (bucket, at) VALUES (?, ?)')->execute([hash('sha256', $action . '|' . ($_SERVER['REMOTE_ADDR'] ?? '')), time()]);
}

function normalize_code(string $code): string { return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code)); }

function hash_code(string $code): string { return hash_hmac('sha256', normalize_code($code), secret_file('secret.key')); }

// 12 random characters, avoiding ones that are easy to confuse. Only the hash is stored.
function new_code(): string {
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $groups = [];
    for ($g = 0; $g < 3; $g++) {
        $part = '';
        for ($i = 0; $i < 4; $i++) $part .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $groups[] = $part;
    }
    return 'SEU-' . implode('-', $groups);
}

function find_by_code(string $code): ?array {
    $q = db()->prepare('SELECT * FROM applicants WHERE code_hash = ?');
    $q->execute([hash_code($code)]);
    return $q->fetch() ?: null;
}

function start_session(): void {
    db();
    session_save_path(data_path('sessions'));
    session_name('seudocom_sid');
    session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Strict', 'secure' => ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off']);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '7200');
    session_start();
    if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > 3600) { $_SESSION = []; session_regenerate_id(true); }
    $_SESSION['seen'] = time();
}

// Signed-in POSTs must come from our own pages: custom header plus an Origin check.
function require_own_page(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
    if (($_SERVER['HTTP_X_SEUDOCOM'] ?? '') !== '1') fail('Request refused.', 403);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) fail('Request refused.', 403);
}

function json_post(): array {
    require_own_page();
    $data = json_decode((string) file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function clean(array $src, string $key, int $max): string {
    $v = isset($src[$key]) && is_string($src[$key]) ? trim($src[$key]) : '';
    return substr(str_replace("\0", '', $v), 0, $max);
}

function valid_drive_link(string $url): bool {
    if (strlen($url) > 500 || preg_match('/\s/', $url)) return false;
    $parts = parse_url($url);
    return ($parts['scheme'] ?? '') === 'https' && in_array($parts['host'] ?? '', ['drive.google.com', 'docs.google.com'], true) && !isset($parts['user']) && strlen($parts['path'] ?? '') > 1;
}

// Sends one message to one person, so recipients never see each other's addresses.
// Returns true when the mail server accepts it, which does not prove delivery.
function send_mail(string $to, string $subject, string $body): bool {
    $subject = str_replace(["\r", "\n"], ' ', $subject);
    if (config()['mail_driver'] === 'log') {
        return file_put_contents(data_path('mail.log'), "[" . now() . "] To: $to | Subject: $subject\n$body\n\n", FILE_APPEND | LOCK_EX) !== false;
    }
    $from = config()['mail_from'];
    $headers = "From: Seudocom <$from>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    return mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers, "-f$from");
}

function update_email_body(string $body): string {
    return $body . "\n\nView your status on your applicant dashboard: " . config()['site_url'] . "/dashboard\nYou will need your access code. Seudocom will never ask you to send it by email.";
}

function add_update(int $id, string $subject, string $body): void {
    db()->prepare('INSERT INTO updates (applicant_id, subject, body, created_at) VALUES (?, ?, ?, ?)')->execute([$id, $subject, $body, now()]);
}
