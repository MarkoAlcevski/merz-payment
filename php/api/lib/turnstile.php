<?php
/**
 * Cloudflare Turnstile helper for the future Zemi.mk / cPanel PHP port.
 * Keep the secret key server-side only.
 */

function merdz_env($name, $fallback = '') {
    $value = getenv($name);
    if ($value === false || $value === '') return $fallback;
    return $value;
}

function merdz_turnstile_site_key() {
    return merdz_env('TURNSTILE_SITE_KEY') ?: merdz_env('CLOUDFLARE_TURNSTILE_SITE_KEY') ?: merdz_env('CF_TURNSTILE_SITE_KEY');
}

function merdz_turnstile_secret_key() {
    return merdz_env('TURNSTILE_SECRET_KEY') ?: merdz_env('CLOUDFLARE_TURNSTILE_SECRET_KEY') ?: merdz_env('CF_TURNSTILE_SECRET_KEY');
}

function merdz_turnstile_enabled() {
    $explicit = strtolower(merdz_env('TURNSTILE_ENABLED', ''));
    if (in_array($explicit, ['false', '0', 'off'], true)) return false;
    if (in_array($explicit, ['true', '1', 'on'], true)) return true;
    return merdz_turnstile_site_key() !== '';
}

function merdz_json_response($status, $payload) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload);
    exit;
}

function merdz_request_json() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [];
}

function merdz_client_ip() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) return $_SERVER['HTTP_CF_CONNECTING_IP'];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function merdz_turnstile_token_from_body($body) {
    if (!empty($body['turnstileToken'])) return $body['turnstileToken'];
    if (!empty($body['cfTurnstileToken'])) return $body['cfTurnstileToken'];
    if (!empty($body['cf-turnstile-response'])) return $body['cf-turnstile-response'];
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    foreach ($headers as $key => $value) {
        if (strtolower($key) === 'x-turnstile-token') return $value;
    }
    return '';
}

function merdz_turnstile_verify_token($token, $expectedAction = '') {
    if (!merdz_turnstile_enabled()) {
        return ['ok' => true, 'skipped' => true];
    }

    $secret = merdz_turnstile_secret_key();
    if ($secret === '') return ['ok' => false, 'reason' => 'missing_secret'];
    if (!$token) return ['ok' => false, 'reason' => 'missing_token'];

    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'secret' => $secret,
            'response' => $token,
            'remoteip' => merdz_client_ip(),
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 12,
    ]);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $raw === '' || $err) return ['ok' => false, 'reason' => 'network_error'];

    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['success'])) {
        return ['ok' => false, 'reason' => 'siteverify_failed', 'details' => $data['error-codes'] ?? []];
    }

    if ($expectedAction && !empty($data['action']) && $data['action'] !== $expectedAction) {
        return ['ok' => false, 'reason' => 'wrong_action'];
    }

    return [
        'ok' => true,
        'hostname' => $data['hostname'] ?? '',
        'action' => $data['action'] ?? '',
        'challenge_ts' => $data['challenge_ts'] ?? '',
    ];
}

function merdz_turnstile_verify_body_or_exit($body, $expectedAction = 'booking') {
    $result = merdz_turnstile_verify_token(merdz_turnstile_token_from_body($body), $expectedAction);
    if (empty($result['ok'])) {
        merdz_json_response(403, [
            'error' => 'turnstile_required',
            'message' => 'Please complete the security check before creating a reservation.',
            'reason' => $result['reason'] ?? 'failed',
        ]);
    }
    return $result;
}
