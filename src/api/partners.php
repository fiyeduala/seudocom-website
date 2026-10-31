<?php
// Public list of notarization partners, maintained from the admin console.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed.', 405);
respond(['partners' => db()->query('SELECT id, name, url, location, details FROM partners ORDER BY name COLLATE NOCASE')->fetchAll()]);
