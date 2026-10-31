<?php
// Admin console API. Everything except session, setup and login requires a signed-in admin.
declare(strict_types=1);
require __DIR__ . '/lib.php';

start_session();
$action = $_GET['action'] ?? 'session';

function admin_count(): int { return (int) db()->query('SELECT COUNT(*) FROM admins')->fetchColumn(); }

if ($action === 'session') {
    $setup = admin_count() === 0;
    if ($setup) secret_file('setup-key.txt');
    respond(['setupRequired' => $setup, 'authenticated' => isset($_SESSION['admin']), 'email' => $_SESSION['admin'] ?? null, 'statuses' => STATUSES]);
}
if ($action === 'setup') {
    $in = json_post();
    if (admin_count() > 0) fail('Setup has already been completed.', 409);
    if (rate_limited('admin', 5, 900)) fail('Too many attempts. Please try again in 15 minutes.', 429);
    if (!hash_equals(secret_file('setup-key.txt'), clean($in, 'key', 100))) {
        record_attempt('admin');
        fail('That setup key is not correct.', 403);
    }
    $email = clean($in, 'email', 254);
    $password = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.', 422);
    if (strlen($password) < 12) fail('Please use a password of at least 12 characters.', 422);
    db()->prepare('INSERT INTO admins (email, pass_hash, created_at) VALUES (?, ?, ?)')->execute([strtolower($email), password_hash($password, PASSWORD_DEFAULT), now()]);
    unlink(data_path('setup-key.txt'));
    session_regenerate_id(true);
    $_SESSION['admin'] = strtolower($email);
    respond(['ok' => true]);
}
if ($action === 'login') {
    $in = json_post();
    if (rate_limited('admin', 5, 900)) fail('Too many attempts. Please try again in 15 minutes.', 429);
    $q = db()->prepare('SELECT * FROM admins WHERE email = ?');
    $q->execute([strtolower(clean($in, 'email', 254))]);
    $admin = $q->fetch();
    $password = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
    if (!$admin || !password_verify($password, $admin['pass_hash'])) {
        record_attempt('admin');
        fail('That email or password is not correct.', 403);
    }
    session_regenerate_id(true);
    $_SESSION['admin'] = $admin['email'];
    respond(['ok' => true]);
}

if (!isset($_SESSION['admin'])) fail('Please sign in.', 401);

function applicant_or_fail(int $id): array {
    $q = db()->prepare('SELECT * FROM applicants WHERE id = ?');
    $q->execute([$id]);
    $a = $q->fetch();
    if (!$a) fail('Applicant not found.', 404);
    return $a;
}

// Applies optional status, position and search filters and returns matching applicants.
function filtered(array $src): array {
    $sql = 'SELECT id, full_name AS name, email, position, nationality, status, created_at AS createdAt, assessment_at AS assessmentAt, affidavit_at AS affidavitAt FROM applicants WHERE 1=1';
    $args = [];
    if (clean($src, 'status', 40) !== '') { $sql .= ' AND status = ?'; $args[] = clean($src, 'status', 40); }
    if (clean($src, 'position', 60) !== '') { $sql .= ' AND position = ?'; $args[] = clean($src, 'position', 60); }
    if (clean($src, 'q', 100) !== '') { $sql .= ' AND (full_name LIKE ? OR email LIKE ?)'; $like = '%' . clean($src, 'q', 100) . '%'; $args[] = $like; $args[] = $like; }
    $q = db()->prepare($sql . ' ORDER BY id DESC');
    $q->execute($args);
    return $q->fetchAll();
}

function send_download(string $file, string $name): void {
    if (!is_file($file)) fail('File not found.', 404);
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $name) . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

switch ($action) {
    case 'logout':
        json_post();
        unset($_SESSION['admin']);
        respond(['ok' => true]);

    case 'list':
        respond(['applicants' => filtered($_GET)]);

    case 'detail':
        $a = applicant_or_fail((int) ($_GET['id'] ?? 0));
        unset($a['code_hash'], $a['resume_file'], $a['affidavit_file']);
        $a['assessment'] = $a['assessment'] ? json_decode($a['assessment'], true) : null;
        $u = db()->prepare('SELECT subject, body, created_at AS createdAt FROM updates WHERE applicant_id = ? ORDER BY id DESC');
        $u->execute([$a['id']]);
        $a['updates'] = $u->fetchAll();
        respond($a);

    case 'resume':
        $a = applicant_or_fail((int) ($_GET['id'] ?? 0));
        send_download(data_path('resumes/' . basename($a['resume_file'])), $a['resume_name']);

    case 'affidavit':
        $a = applicant_or_fail((int) ($_GET['id'] ?? 0));
        if (!$a['affidavit_file']) fail('No affidavit has been uploaded.', 404);
        send_download(data_path('affidavits/' . basename($a['affidavit_file'])), $a['affidavit_name']);

    case 'partner-save':
        $in = json_post();
        $name = clean($in, 'name', 200);
        $url = clean($in, 'url', 500);
        if ($name === '') fail('Please enter the partner name.', 422);
        if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https://#i', $url)) fail('Please enter a full website link starting with https://.', 422);
        $values = [$name, $url, clean($in, 'location', 200), clean($in, 'details', 2000)];
        if ((int) ($in['id'] ?? 0) > 0) {
            $q = db()->prepare('UPDATE partners SET name = ?, url = ?, location = ?, details = ? WHERE id = ?');
            $q->execute([...$values, (int) $in['id']]);
            if ($q->rowCount() === 0) fail('Partner not found.', 404);
        } else {
            db()->prepare('INSERT INTO partners (name, url, location, details, created_at) VALUES (?, ?, ?, ?, ?)')->execute([...$values, now()]);
        }
        respond(['ok' => true]);

    case 'partner-delete':
        $in = json_post();
        db()->prepare('DELETE FROM partners WHERE id = ?')->execute([(int) ($in['id'] ?? 0)]);
        respond(['ok' => true]);

    case 'status':
        $in = json_post();
        $a = applicant_or_fail((int) ($in['id'] ?? 0));
        $status = clean($in, 'status', 40);
        if (!isset(STATUSES[$status])) fail('Unknown status.', 422);
        db()->prepare('UPDATE applicants SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, now(), $a['id']]);
        $note = clean($in, 'note', 5000);
        if ($note !== '') add_update((int) $a['id'], 'Status: ' . STATUSES[$status], $note);
        respond(['ok' => true]);

    case 'new-code':
        $in = json_post();
        $a = applicant_or_fail((int) ($in['id'] ?? 0));
        $code = new_code();
        db()->prepare('UPDATE applicants SET code_hash = ?, updated_at = ? WHERE id = ?')->execute([hash_code($code), now(), $a['id']]);
        respond(['code' => $code]);

    case 'delete':
        $in = json_post();
        $a = applicant_or_fail((int) ($in['id'] ?? 0));
        db()->prepare('DELETE FROM applicants WHERE id = ?')->execute([$a['id']]);
        $file = data_path('resumes/' . basename($a['resume_file']));
        if (is_file($file)) unlink($file);
        if ($a['affidavit_file'] && is_file(data_path('affidavits/' . basename($a['affidavit_file'])))) unlink(data_path('affidavits/' . basename($a['affidavit_file'])));
        respond(['ok' => true]);

    case 'broadcast':
        $in = json_post();
        $subject = clean($in, 'subject', 200);
        $body = clean($in, 'message', 10000);
        if ($subject === '' || $body === '') fail('Please enter a subject and a message.', 422);
        set_time_limit(0);
        $sent = 0;
        $failed = [];
        $people = filtered(['status' => $in['status'] ?? '', 'position' => $in['position'] ?? '']);
        foreach ($people as $p) {
            add_update((int) $p['id'], $subject, $body);
            if (send_mail($p['email'], $subject, update_email_body($body))) $sent++;
            else $failed[] = $p['email'];
        }
        respond(['recipients' => count($people), 'accepted' => $sent, 'failed' => $failed, 'delivery' => config()['mail_driver']]);
}
fail('Unknown action.', 404);
