<?php
// Shared backend code for the Seudocom API. Applicant data lives in data_dir, outside the public web root.
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

const STATUSES = [
    'application_received' => 'Application received',
    'assessment_submitted' => 'Assessment under review',
    'under_review' => 'Under review',
    'certificate_required' => 'Certificate required',
    'certificate_submitted' => 'Certificate under review',
    'identity_required' => 'Identity check required',
    'identity_submitted' => 'Identity check under review',
    'interview' => 'Recorded interview open',
    'interview_submitted' => 'Interview under review',
    'attestation_required' => 'Notarized affidavit required',
    'affidavit_submitted' => 'Affidavit under review',
    'successful' => 'Hired',
    'unsuccessful' => 'Not moving forward',
];

// Where "Approve" moves an applicant who is waiting for review.
const NEXT_STATUS = [
    'assessment_submitted' => 'certificate_required',
    'under_review' => 'certificate_required',
    'certificate_submitted' => 'identity_required',
    'identity_submitted' => 'interview',
    'interview_submitted' => 'attestation_required',
    'affidavit_submitted' => 'successful',
];

// The step shown on the dashboard, what the applicant is told, and the push notification text.
const STATUS_INFO = [
    'application_received' => [1, 'Complete your assessment and submit your Google Drive links.', 'Complete your assessment to continue.'],
    'assessment_submitted' => [1, 'Seudocom is reviewing your assessment. You do not need to do anything until you are notified.', 'Your assessment is under review.'],
    'under_review' => [1, 'Seudocom is reviewing your application. You do not need to do anything until you are notified.', 'Your application is under review.'],
    'certificate_required' => [2, 'Your assessment was approved. Next, upload your customer support or customer relations certificate.', 'Your assessment was approved. Sign in to upload your certificate.'],
    'certificate_submitted' => [2, 'Seudocom is reviewing your certificate. You do not need to do anything until you are notified.', 'Your certificate is under review.'],
    'identity_required' => [3, 'Your certificate was approved. Next, confirm your identity so you can open your recorded interview.', 'Your certificate was approved. Sign in to complete your identity check.'],
    'identity_submitted' => [3, 'Seudocom is checking your identity document. You do not need to do anything until you are notified.', 'Your identity check is under review.'],
    'interview' => [3, 'Your identity was confirmed. Record your interview answers and submit your Google Drive links.', 'Your identity was confirmed. Sign in to complete your recorded interview.'],
    'interview_submitted' => [3, 'Seudocom is reviewing your interview. You do not need to do anything until you are notified.', 'Your interview is under review.'],
    'attestation_required' => [4, 'Your interview was approved. Next, have the affidavit notarized and upload the signed copy.', 'Your interview was approved. Sign in for your affidavit step.'],
    'affidavit_submitted' => [4, 'Seudocom is reviewing your affidavit. You do not need to do anything until you are notified.', 'Your affidavit is under review.'],
    'successful' => [5, 'Congratulations. Seudocom has selected you for this position. Check your email for next steps.', 'There is an important update on your application. Sign in to your dashboard to view it.'],
    'unsuccessful' => [5, 'After careful review, Seudocom is not able to move forward with your application at this time. Thank you for your interest.', 'There is an update on your application. Sign in to your dashboard to view it.'],
];

function config(): array {
    static $c = null;
    if ($c !== null) return $c;
    $parent = dirname(__DIR__, 2);
    $c = [
        'data_dir' => getenv('SEUDOCOM_DATA_DIR') ?: $parent . '/seudocom-data',
        'mail_driver' => PHP_SAPI === 'cli-server' ? 'log' : 'mail',
        'mail_from' => 'contact@seudocom.org',
        'site_url' => 'https://seudocom.org',
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
    foreach ([$dir, "$dir/resumes", "$dir/affidavits", "$dir/certificates", "$dir/identity", "$dir/sessions"] as $d) {
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
    $pdo->exec('CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY, applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL)');
    $columns = array_column($pdo->query('PRAGMA table_info(applicants)')->fetchAll(), 'name');
    foreach (['affidavit_file', 'affidavit_name', 'affidavit_at', 'certificate_file', 'certificate_name', 'certificate_at', 'certificate_issuer', 'identity_file', 'identity_name', 'identity_at', 'identity_verified_at', 'interview_answers', 'interview_at'] as $column) {
        if (!in_array($column, $columns, true)) $pdo->exec("ALTER TABLE applicants ADD COLUMN $column TEXT");
    }
    $columns = array_column($pdo->query('PRAGMA table_info(partners)')->fetchAll(), 'name');
    foreach (['cost', 'disclosure', 'country'] as $column) {
        if (!in_array($column, $columns, true)) $pdo->exec("ALTER TABLE partners ADD COLUMN $column TEXT");
    }
    if (!in_array('kind', $columns, true)) $pdo->exec("ALTER TABLE partners ADD COLUMN kind TEXT NOT NULL DEFAULT 'notary'");
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

function b64url(string $raw): string { return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }

function b64url_decode(string $text): string { return (string) base64_decode(strtr($text, '-_', '+/'), true); }

// Options for P-256 keys. The small config file is needed on PHP builds that ship without one.
function ec_options(): array {
    $file = data_path('openssl.cnf');
    if (!is_file($file)) file_put_contents($file, "[req]\ndistinguished_name = dn\n[dn]\n", LOCK_EX);
    return ['config' => $file, 'private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'];
}

function ec_public_raw(OpenSSLAsymmetricKey $key): string {
    $ec = openssl_pkey_get_details($key)['ec'];
    return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
}

// The VAPID key pair is created once on the server and kept in data_dir. Changing it would cut off every subscribed device.
function vapid_key(): ?OpenSSLAsymmetricKey {
    $file = data_path('vapid-private.pem');
    $lock = fopen("$file.lock", 'c');
    if (!$lock) return null;
    flock($lock, LOCK_EX);
    if (!is_file($file)) {
        $options = ec_options();
        $new = openssl_pkey_new($options);
        if ($new && openssl_pkey_export($new, $pem, null, $options)) {
            file_put_contents($file, $pem);
            chmod($file, 0600);
        }
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return is_file($file) ? (openssl_pkey_get_private((string) file_get_contents($file)) ?: null) : null;
}

function vapid_public_key(): ?string {
    $key = vapid_key();
    return $key ? b64url(ec_public_raw($key)) : null;
}

// Signs the VAPID token that identifies this site to the browser's push service.
function vapid_header(string $endpoint): ?string {
    $key = vapid_key();
    if (!$key) return null;
    $parts = parse_url($endpoint);
    $claims = ['aud' => $parts['scheme'] . '://' . $parts['host'], 'exp' => time() + 43200, 'sub' => 'mailto:' . config()['mail_from']];
    $unsigned = b64url('{"typ":"JWT","alg":"ES256"}') . '.' . b64url((string) json_encode($claims));
    if (!openssl_sign($unsigned, $der, $key, OPENSSL_ALGO_SHA256)) return null;
    // OpenSSL returns DER; ES256 tokens use the two 32-byte numbers side by side.
    $rLength = ord($der[3]);
    $r = substr($der, 4, $rLength);
    $s = substr($der, 6 + $rLength);
    $signature = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT) . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    return 'vapid t=' . $unsigned . '.' . b64url($signature) . ', k=' . b64url(ec_public_raw($key));
}

// Encrypts a message for one device (RFC 8291, aes128gcm), so the push service cannot read it.
function push_encrypt(string $message, string $p256dh, string $auth): ?string {
    $deviceKey = b64url_decode($p256dh);
    $deviceSecret = b64url_decode($auth);
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $deviceKey;
    $device = openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n");
    $local = openssl_pkey_new(ec_options());
    if (!$device || !$local) return null;
    $shared = openssl_pkey_derive($device, $local, 32);
    if ($shared === false) return null;
    $localPublic = ec_public_raw($local);
    $salt = random_bytes(16);
    $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $deviceKey . $localPublic, $deviceSecret);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $cipher = openssl_encrypt($message . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($cipher === false) return null;
    return $salt . pack('N', 4096) . chr(strlen($localPublic)) . $localPublic . $cipher . $tag;
}

// The server posts to these addresses, so only known browser push services are accepted.
function valid_push_endpoint(string $url): bool {
    if (strlen($url) > 1000) return false;
    $parts = parse_url($url);
    if (($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['port'])) return false;
    $host = strtolower($parts['host'] ?? '');
    return $host === 'fcm.googleapis.com' || (bool) preg_match('/(^|\.)(push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/', $host);
}

// Sends to all of an applicant's devices and returns how many the push services accepted.
// That does not prove the notification was seen. A failed push never blocks the admin's action.
function send_push(int $applicantId, string $title, string $body): int {
    if (!function_exists('curl_init')) return 0;
    $q = db()->prepare('SELECT * FROM push_subscriptions WHERE applicant_id = ?');
    $q->execute([$applicantId]);
    $accepted = 0;
    foreach ($q->fetchAll() as $device) {
        $auth = vapid_header($device['endpoint']);
        $payload = push_encrypt((string) json_encode(['title' => $title, 'body' => $body]), $device['p256dh'], $device['auth']);
        if (!$auth || $payload === null) continue;
        $curl = curl_init($device['endpoint']);
        curl_setopt_array($curl, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 5, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_HTTPHEADER => ["Authorization: $auth", 'Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'TTL: 604800', 'Urgency: normal'],
        ]);
        curl_exec($curl);
        $code = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        if ($code >= 200 && $code < 300) $accepted++;
        if ($code === 404 || $code === 410) db()->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$device['id']]);
    }
    return $accepted;
}

// Lock screens can be seen by others, so a decision is never spelled out in the notification.
function status_push_body(string $status): string { return STATUS_INFO[$status][2] ?? 'There is an update on your application.'; }

function hired_email_body(array $a): string {
    return 'Dear ' . $a['full_name'] . ",\n\nCongratulations. Seudocom has selected you for this position. Seudocom will contact you with your employment details.\n\nSeudocom will never ask you to pay a fee to receive your job offer or to start work.";
}

// Identity documents are kept only until the admin decides, then deleted.
function delete_identity_file(array $a): void {
    if (!$a['identity_file']) return;
    $file = data_path('identity/' . basename($a['identity_file']));
    if (is_file($file)) unlink($file);
    db()->prepare('UPDATE applicants SET identity_file = NULL, identity_name = NULL WHERE id = ?')->execute([$a['id']]);
}

// The one place a status is changed by an admin: records it on the dashboard, notifies, and emails on hire.
function apply_status(array $a, string $status, string $note = ''): array {
    $changed = $status !== $a['status'];
    db()->prepare('UPDATE applicants SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, now(), $a['id']]);
    if ($changed && $a['status'] === 'identity_submitted' && $status === 'interview') {
        db()->prepare('UPDATE applicants SET identity_verified_at = ? WHERE id = ?')->execute([now(), $a['id']]);
    }
    if (!in_array($status, ['identity_required', 'identity_submitted'], true)) delete_identity_file($a);
    $message = $changed ? (STATUS_INFO[$status][1] ?? '') : '';
    $body = trim($message . ($message !== '' && $note !== '' ? "\n\n" : '') . $note);
    if ($body !== '') add_update((int) $a['id'], 'Status: ' . STATUSES[$status], $body);
    $result = ['pushed' => 0, 'emailed' => 0, 'emailFailed' => 0];
    if ($changed) $result['pushed'] = send_push((int) $a['id'], 'Seudocom application update', status_push_body($status));
    elseif ($note !== '') $result['pushed'] = send_push((int) $a['id'], 'Seudocom application update', 'You have a new message. Sign in to your dashboard to view it.');
    if ($changed && $status === 'successful') {
        if (send_mail($a['email'], 'Your Seudocom application: you have been selected', hired_email_body($a))) $result['emailed'] = 1;
        else $result['emailFailed'] = 1;
    }
    return $result;
}

// Validates one applicant upload (PDF, JPG or PNG, up to 5 MB) and stores it under a random name.
function store_upload(string $field, string $dir, string $missing): array {
    $upload = $_FILES[$field] ?? null;
    if (!$upload || $upload['error'] === UPLOAD_ERR_NO_FILE) fail($missing, 422);
    if (in_array($upload['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $upload['size'] > 5 * 1024 * 1024) fail('Your file is larger than 5 MB.', 422);
    if ($upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name']) || $upload['size'] === 0) fail('Your file could not be uploaded. Please try again.', 422);
    $ext = strtolower(pathinfo($upload['name'], PATHINFO_EXTENSION));
    $magic = (string) file_get_contents($upload['tmp_name'], false, null, 0, 4);
    $valid = ($ext === 'pdf' && $magic === '%PDF') || (in_array($ext, ['jpg', 'jpeg'], true) && substr($magic, 0, 3) === "\xFF\xD8\xFF") || ($ext === 'png' && $magic === "\x89PNG");
    if (!$valid) fail('Please choose a valid PDF, JPG or PNG file.', 422);
    $stored = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($upload['tmp_name'], data_path($dir . '/' . $stored))) fail('Your file could not be saved. Please try again.', 500);
    return [$stored, substr(basename($upload['name']), 0, 200)];
}
