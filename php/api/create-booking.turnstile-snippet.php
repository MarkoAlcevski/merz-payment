<?php
/**
 * Future PHP/cPanel create-booking.php integration snippet.
 * Add this near the top of your PHP create-booking endpoint AFTER you parse
 * the JSON request body and BEFORE you validate/create the booking.
 */

require_once __DIR__ . '/lib/turnstile.php';

$body = merdz_request_json(); // Or use your existing parsed JSON array.
merdz_turnstile_verify_body_or_exit($body, 'booking');

// Continue with your existing booking validation + MySQL transaction here.
