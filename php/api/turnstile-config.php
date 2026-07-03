<?php
require_once __DIR__ . '/lib/turnstile.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    merdz_json_response(405, ['error' => 'method_not_allowed']);
}

merdz_json_response(200, [
    'enabled' => merdz_turnstile_enabled() && merdz_turnstile_site_key() !== '',
    'siteKey' => merdz_turnstile_site_key(),
]);
