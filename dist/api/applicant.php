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
function signed_in_applicant(): array {
    $q = db()->prepare('SELECT * FROM applicants WHERE id = ?');
    $q->execute([$_SESSION['applicant'] ?? 0]);
    $a = $q->fetch();
    if (!$a) fail('Please sign in again.', 401);
    return $a;
}

// Each stage upload: which statuses accept it, where it goes, and the status it moves the applicant to.
const UPLOAD_STAGES = [
    'certificate' => ['dir' => 'certificates', 'open' => ['certificate_required', 'certificate_submitted'], 'next' => 'certificate_submitted', 'missing' => 'Please choose your certificate.', 'closed' => 'Seudocom is not requesting your certificate at this stage.'],
    'identity' => ['dir' => 'identity', 'open' => ['identity_required', 'identity_submitted'], 'next' => 'identity_submitted', 'missing' => 'Please choose your identity document.', 'closed' => 'Seudocom is not requesting your identity document at this stage.'],
    'affidavit' => ['dir' => 'affidavits', 'open' => ['attestation_required', 'affidavit_submitted'], 'next' => 'affidavit_submitted', 'missing' => 'Please choose your signed, notarized affidavit.', 'closed' => 'Seudocom is not requesting your affidavit at this stage.'],
];
if (isset(UPLOAD_STAGES[$action])) {
    require_own_page();
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) fail('Your file is too large. Please choose a file under 5 MB.', 413);
    $a = signed_in_applicant();
    $stage = UPLOAD_STAGES[$action];
    if (!in_array($a['status'], $stage['open'], true)) fail($stage['closed'], 409);
    if ($action === 'certificate' && clean($_POST, 'issuer', 200) === '') fail('Please enter who issued your certificate.', 422);
    if ($action === 'identity' && ($_POST['consent'] ?? '') !== 'yes') fail('Please confirm your consent to continue.', 422);
    [$stored, $name] = store_upload($action, $stage['dir'], $stage['missing']);
    $previous = $a[$action . '_file'];
    db()->prepare("UPDATE applicants SET {$action}_file = ?, {$action}_name = ?, {$action}_at = ?, status = ?, updated_at = ? WHERE id = ?")
        ->execute([$stored, $name, now(), $stage['next'], now(), $a['id']]);
    if ($action === 'certificate') db()->prepare('UPDATE applicants SET certificate_issuer = ? WHERE id = ?')->execute([clean($_POST, 'issuer', 200), $a['id']]);
    if ($previous && is_file(data_path($stage['dir'] . '/' . basename($previous)))) unlink(data_path($stage['dir'] . '/' . basename($previous)));
    respond(['ok' => true], 201);
}
if ($action === 'interview') {
    $in = json_post();
    $a = signed_in_applicant();
    if (!in_array($a['status'], ['interview', 'interview_submitted'], true)) fail('Your recorded interview is not open at this stage.', 409);
    if (!$a['identity_verified_at']) fail('Seudocom must confirm your identity before you can submit your interview.', 409);
    if (($in['consent'] ?? '') !== 'yes' || ($in['linksShared'] ?? '') !== 'yes') fail('Please complete both confirmations.', 422);
    $links = [];
    foreach ($in as $key => $value) {
        if (!preg_match('/^interview\d{1,2}$/', (string) $key)) continue;
        $url = is_string($value) ? trim($value) : '';
        if (!valid_drive_link($url)) fail('Every answer needs a full Google Drive link.', 422);
        $links[$key] = $url;
    }
    if (!$links) fail('Every answer needs a full Google Drive link.', 422);
    db()->prepare('UPDATE applicants SET interview_answers = ?, interview_at = ?, status = ?, updated_at = ? WHERE id = ?')
        ->execute([json_encode($links), now(), 'interview_submitted', now(), $a['id']]);
    respond(['ok' => true], 201);
}
if ($action === 'push-subscribe') {
    $in = json_post();
    if (empty($_SESSION['applicant'])) fail('Please sign in again.', 401);
    $endpoint = clean($in, 'endpoint', 1001);
    $p256dh = clean($in, 'p256dh', 200);
    $auth = clean($in, 'auth', 100);
    if (!valid_push_endpoint($endpoint) || strlen(b64url_decode($p256dh)) !== 65 || strlen(b64url_decode($auth)) !== 16) fail('This browser could not be set up for notifications.', 422);
    db()->prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')->execute([$endpoint]);
    db()->prepare('INSERT INTO push_subscriptions (applicant_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)')->execute([$_SESSION['applicant'], $endpoint, $p256dh, $auth, now()]);
    // Five devices per applicant; the oldest is dropped.
    db()->prepare('DELETE FROM push_subscriptions WHERE applicant_id = ? AND id NOT IN (SELECT id FROM push_subscriptions WHERE applicant_id = ? ORDER BY id DESC LIMIT 5)')->execute([$_SESSION['applicant'], $_SESSION['applicant']]);
    respond(['ok' => true], 201);
}
if ($action === 'push-unsubscribe') {
    $in = json_post();
    db()->prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND applicant_id = ?')->execute([clean($in, 'endpoint', 1001), $_SESSION['applicant'] ?? 0]);
    respond(['ok' => true]);
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
    'statusMessage' => STATUS_INFO[$a['status']][1] ?? '',
    'step' => STATUS_INFO[$a['status']][0] ?? 1,
    'nationality' => $a['nationality'],
    'appliedAt' => $a['created_at'],
    'assessmentAt' => $a['assessment_at'],
    'canSubmitAssessment' => in_array($a['status'], ['application_received', 'assessment_submitted'], true),
    'affidavitAt' => $a['affidavit_at'],
    'canUploadAffidavit' => in_array($a['status'], UPLOAD_STAGES['affidavit']['open'], true),
    'certificateAt' => $a['certificate_at'],
    'canUploadCertificate' => in_array($a['status'], UPLOAD_STAGES['certificate']['open'], true),
    'identityAt' => $a['identity_at'],
    'identityVerified' => (bool) $a['identity_verified_at'],
    'canUploadIdentity' => in_array($a['status'], UPLOAD_STAGES['identity']['open'], true),
    'interviewAt' => $a['interview_at'],
    'canSubmitInterview' => in_array($a['status'], ['interview', 'interview_submitted'], true) && (bool) $a['identity_verified_at'],
    'pushKey' => vapid_public_key(),
    'updates' => $u->fetchAll(),
]);
