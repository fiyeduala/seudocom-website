<?php
// Stores the applicant's Google Drive links. The access code identifies the applicant.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
db();
if (rate_limited('code', 10, 900)) fail('Too many incorrect codes. Please try again in 15 minutes.', 429);
$applicant = find_by_code(clean($_POST, 'accessCode', 40));
if (!$applicant) {
    record_attempt('code');
    fail('That access code was not recognized.', 403);
}
if (clean($_POST, 'position', 60) !== $applicant['position']) fail('This assessment is for a different position than your application.', 422);
if (!in_array($applicant['status'], ['application_received', 'assessment_submitted'], true)) fail('Your application has moved past this stage, so the assessment can no longer be changed.', 409);
if (($_POST['consent'] ?? '') !== 'yes' || ($_POST['linksShared'] ?? '') !== 'yes') fail('Please complete both confirmations.', 422);

$links = [];
foreach ($_POST as $key => $value) {
    if (!preg_match('/^(assignment|question)\d{1,2}$/', (string) $key)) continue;
    $url = is_string($value) ? trim($value) : '';
    if (!valid_drive_link($url)) fail('Every answer needs a full Google Drive link.', 422);
    $links[$key] = $url;
}
if (!$links) fail('Every answer needs a full Google Drive link.', 422);

db()->prepare('UPDATE applicants SET assessment = ?, assessment_at = ?, status = ?, updated_at = ? WHERE id = ?')
    ->execute([json_encode($links), now(), 'assessment_submitted', now(), $applicant['id']]);
respond(['ok' => true], 201);
