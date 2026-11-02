<?php
// Public list of notarization and certificate partners, maintained from the admin console.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed.', 405);
$sql = 'SELECT id, kind, name, url, location, details, cost, disclosure, country FROM partners';
$kind = $_GET['kind'] ?? '';
if (in_array($kind, ['notary', 'certificate'], true)) {
    $q = db()->prepare($sql . ' WHERE kind = ? ORDER BY name COLLATE NOCASE');
    $q->execute([$kind]);
    respond(['partners' => $q->fetchAll()]);
}
respond(['partners' => db()->query($sql . ' ORDER BY kind, name COLLATE NOCASE')->fetchAll()]);
