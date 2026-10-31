<?php
// Receives the careers application and issues the applicant's access code. The code is shown once.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
db();
if (empty($_POST) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) fail('Your upload is too large. Please choose a resume under 5 MB.', 413);
if (rate_limited('apply', 10, 3600)) fail('Too many applications from this connection. Please try again later.', 429);

$f = [
    'fullName' => clean($_POST, 'fullName', 200), 'email' => clean($_POST, 'email', 254), 'phone' => clean($_POST, 'phone', 40),
    'address' => clean($_POST, 'address', 300), 'location' => clean($_POST, 'location', 200), 'nationality' => clean($_POST, 'nationality', 100),
    'position' => clean($_POST, 'position', 60), 'preferredRole' => clean($_POST, 'preferredRole', 200),
    'experience' => clean($_POST, 'experience', 10000), 'coverLetter' => clean($_POST, 'coverLetter', 10000),
];
foreach (['fullName', 'email', 'phone', 'address', 'location', 'nationality', 'position', 'experience'] as $key) {
    if ($f[$key] === '') fail('Please complete every required field.', 422);
}
if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.', 422);
if (!preg_match('/^[a-z0-9-]+$/', $f['position'])) fail('Please choose a valid position.', 422);
if (($_POST['consent'] ?? '') !== 'yes') fail('Please confirm your consent to continue.', 422);

$upload = $_FILES['resume'] ?? null;
if (!$upload || $upload['error'] === UPLOAD_ERR_NO_FILE) fail('Please choose your resume file.', 422);
if (in_array($upload['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $upload['size'] > 5 * 1024 * 1024) fail('Your resume is larger than 5 MB.', 422);
if ($upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name']) || $upload['size'] === 0) fail('Your resume could not be uploaded. Please try again.', 422);
$ext = strtolower(pathinfo($upload['name'], PATHINFO_EXTENSION));
$magic = (string) file_get_contents($upload['tmp_name'], false, null, 0, 4);
if (!(($ext === 'pdf' && $magic === '%PDF') || ($ext === 'docx' && $magic === "PK\x03\x04"))) fail('Please choose a valid PDF or DOCX file.', 422);

$stored = bin2hex(random_bytes(16)) . '.' . $ext;
if (!move_uploaded_file($upload['tmp_name'], data_path('resumes/' . $stored))) fail('Your resume could not be saved. Nothing has been received.', 500);

$code = new_code();
$time = now();
db()->prepare('INSERT INTO applicants (code_hash, full_name, email, phone, address, location, nationality, position, preferred_role, experience, cover_letter, resume_file, resume_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
    hash_code($code), $f['fullName'], $f['email'], $f['phone'], $f['address'], $f['location'], $f['nationality'], $f['position'], $f['preferredRole'],
    $f['experience'], $f['coverLetter'], $stored, substr(basename($upload['name']), 0, 200), 'application_received', $time, $time,
]);
record_attempt('apply');
respond(['ok' => true, 'code' => $code, 'position' => $f['position']], 201);
