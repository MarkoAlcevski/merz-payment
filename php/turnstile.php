<?php
/* Cloudflare Turnstile helper for future Zemi/cPanel PHP migration. */
function merdz_turnstile_enabled(): bool {
  $enabled = getenv('TURNSTILE_ENABLED') ?: '';
  return strtolower($enabled) === 'true' && getenv('TURNSTILE_SITE_KEY') && getenv('TURNSTILE_SECRET_KEY');
}

function merdz_json(int $status, array $data) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data);
  exit;
}

function merdz_turnstile_config(): array {
  return [
    'enabled' => merdz_turnstile_enabled(),
    'siteKey' => merdz_turnstile_enabled() ? getenv('TURNSTILE_SITE_KEY') : ''
  ];
}

function merdz_turnstile_verify_token(?string $token, string $action = ''): array {
  if (!merdz_turnstile_enabled()) return ['success' => true, 'skipped' => true];
  if (!$token) return ['success' => false, 'reason' => 'turnstile_required', 'message' => 'Security check is required.'];

  $payload = http_build_query([
    'secret' => getenv('TURNSTILE_SECRET_KEY'),
    'response' => $token,
    'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''
  ]);

  $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
  $raw = curl_exec($ch);
  curl_close($ch);

  $cf = json_decode($raw ?: '{}', true);
  if (empty($cf['success'])) return ['success' => false, 'reason' => 'turnstile_failed', 'message' => 'Security check failed.'];
  if ($action && !empty($cf['action']) && $cf['action'] !== $action) return ['success' => false, 'reason' => 'turnstile_action_mismatch', 'message' => 'Security check action mismatch.'];
  return ['success' => true, 'cf' => $cf];
}

function merdz_turnstile_error(array $result) {
  merdz_json(403, [
    'error' => $result['reason'] ?? 'turnstile_failed',
    'message' => $result['message'] ?? 'Security check failed. Please try again.'
  ]);
}
