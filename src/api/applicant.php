<?php
// Applicant dashboard: sign in with the access code, then read status and updates.
declare(strict_types=1);
require __DIR__ . '/lib.php';

start_session();
$action = $_GET['action'] ?? 'me';

if ($action === 'login') {
    $in = json_post();
    if (rate_limited('code', 10, 900)) fail('Too many incorrect codes. Please try again in 15 minutes.', 429);
    $applicant = find_by_code(clean($in, 'code', 40));
    if (!$applicant) {
        record_attempt('code');
        fail('That access code was not recognized. Check it and try again.', 403);
    }
    session_regenerate_id(true);
    $_SESSION['applicant'] = (int) $applicant['id'];
    respond(['ok' => true]);
}
if ($action === 'logout') {
    json_post();
    unset($_SESSION['applicant']);
    respond(['ok' => true]);
}
if ($action === 'affidavit') {
    require_own_page();
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) fail('Your file is too large. Please choose a file under 5 MB.', 413);
    $q = db()->prepare('SELECT * FROM applicants WHERE id = ?');
    $q->execute([$_SESSION['applicant'] ?? 0]);
    $a = $q->fetch();
    if (!$a) fail('Please sign in again.', 401);
    if ($a['status'] !== 'attestation_required') fail('Seudocom is not requesting your affidavit at this stage.', 409);
    $upload = $_FILES['affidavit'] ?? null;
    if (!$upload || $upload['error'] === UPLOAD_ERR_NO_FILE) fail('Please choose your signed, notarized affidavit.', 422);
    if (in_array($upload['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $upload['size'] > 5 * 1024 * 1024) fail('Your file is larger than 5 MB.', 422);
    if ($upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name']) || $upload['size'] === 0) fail('Your file could not be uploaded. Please try again.', 422);
    $ext = strtolower(pathinfo($upload['name'], PATHINFO_EXTENSION));
    $magic = (string) file_get_contents($upload['tmp_name'], false, null, 0, 4);
    $valid = ($ext === 'pdf' && $magic === '%PDF') || (in_array($ext, ['jpg', 'jpeg'], true) && substr($magic, 0, 3) === "\xFF\xD8\xFF") || ($ext === 'png' && $magic === "\x89PNG");
    if (!$valid) fail('Please choose a valid PDF, JPG or PNG file.', 422);
    $stored = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($upload['tmp_name'], data_path('affidavits/' . $stored))) fail('Your file could not be saved. Please try again.', 500);
    db()->prepare('UPDATE applicants SET affidavit_file = ?, affidavit_name = ?, affidavit_at = ?, updated_at = ? WHERE id = ?')
        ->execute([$stored, substr(basename($upload['name']), 0, 200), now(), now(), $a['id']]);
    if ($a['affidavit_file'] && is_file(data_path('affidavits/' . basename($a['affidavit_file'])))) unlink(data_path('affidavits/' . basename($a['affidavit_file'])));
    respond(['ok' => true], 201);
}
if ($action !== 'me') fail('Unknown action.', 404);

$q = db()->prepare('SELECT * FROM applicants WHERE id = ?');
$q->execute([$_SESSION['applicant'] ?? 0]);
$a = $q->fetch();
if (!$a) respond(['authenticated' => false]);

$u = db()->prepare('SELECT subject, body, created_at AS createdAt FROM updates WHERE applicant_id = ? ORDER BY id DESC');
$u->execute([$a['id']]);
respond([
    'authenticated' => true,
    'name' => $a['full_name'],
    'position' => $a['position'],
    'status' => $a['status'],
    'statusLabel' => STATUSES[$a['status']] ?? $a['status'],
    'appliedAt' => $a['created_at'],
    'assessmentAt' => $a['assessment_at'],
    'canSubmitAssessment' => in_array($a['status'], ['application_received', 'assessment_submitted'], true),
    'affidavitAt' => $a['affidavit_at'],
    'canUploadAffidavit' => $a['status'] === 'attestation_required',
    'updates' => $u->fetchAll(),
]);
