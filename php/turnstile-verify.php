<?php
require_once __DIR__ . '/turnstile.php';
$body = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$token = $body['token'] ?? '';
$action = $body['action'] ?? 'launch';
$result = merdz_turnstile_verify_token($token, $action);
if (empty($result['success'])) merdz_turnstile_error($result);
merdz_json(200, ['success' => true]);
