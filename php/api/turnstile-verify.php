<?php
require_once __DIR__ . '/lib/turnstile.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    merdz_json_response(405, ['error' => 'method_not_allowed']);
}

$body = merdz_request_json();
$action = (($body['action'] ?? '') === 'booking') ? 'booking' : 'launch';
$token = $body['token'] ?? $body['turnstileToken'] ?? '';
$result = merdz_turnstile_verify_token($token, $action);

if (empty($result['ok'])) {
    merdz_json_response(403, [
        'success' => false,
        'error' => 'turnstile_failed',
        'reason' => $result['reason'] ?? 'failed',
    ]);
}

merdz_json_response(200, ['success' => true]);
