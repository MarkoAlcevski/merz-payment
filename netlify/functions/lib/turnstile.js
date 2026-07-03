"use strict";

/**
 * Cloudflare Turnstile verification helper for Netlify Functions.
 * Public site key is returned only by /api/turnstile-config.
 * Secret key stays server-side in Netlify environment variables.
 */

var SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function env(name, fallback) {
  return process.env[name] || fallback || "";
}

function siteKey() {
  return env("TURNSTILE_SITE_KEY") || env("CLOUDFLARE_TURNSTILE_SITE_KEY") || env("CF_TURNSTILE_SITE_KEY");
}

function secretKey() {
  return env("TURNSTILE_SECRET_KEY") || env("CLOUDFLARE_TURNSTILE_SECRET_KEY") || env("CF_TURNSTILE_SECRET_KEY");
}

function enabled() {
  var explicit = String(env("TURNSTILE_ENABLED", "")).toLowerCase();
  if (explicit === "false" || explicit === "0" || explicit === "off") return false;
  if (explicit === "true" || explicit === "1" || explicit === "on") return true;
  return !!siteKey();
}

function clientIp(event) {
  var h = (event && event.headers) || {};
  return String(
    h["x-nf-client-connection-ip"] ||
    (h["x-forwarded-for"] ? String(h["x-forwarded-for"]).split(",")[0].trim() : "") ||
    ""
  );
}

function tokenFromBody(event, body) {
  var h = (event && event.headers) || {};
  return (
    (body && (body.turnstileToken || body.cfTurnstileToken || body["cf-turnstile-response"])) ||
    h["x-turnstile-token"] ||
    h["X-Turnstile-Token"] ||
    ""
  );
}

async function verifyToken(event, token, expectedAction) {
  if (!enabled()) return { ok: true, skipped: true };

  var secret = secretKey();
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  var params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);

  var ip = clientIp(event);
  if (ip) params.append("remoteip", ip);

  var res;
  var data;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, reason: "network_error" };
  }

  if (!data || data.success !== true) {
    return { ok: false, reason: "siteverify_failed", details: data && data["error-codes"] };
  }

  if (expectedAction && data.action && data.action !== expectedAction) {
    return { ok: false, reason: "wrong_action" };
  }

  return {
    ok: true,
    hostname: data.hostname || "",
    action: data.action || "",
    challenge_ts: data.challenge_ts || ""
  };
}

async function verifyBody(event, body, expectedAction) {
  return verifyToken(event, tokenFromBody(event, body), expectedAction);
}

module.exports = {
  enabled: enabled,
  siteKey: siteKey,
  verifyToken: verifyToken,
  verifyBody: verifyBody,
  tokenFromBody: tokenFromBody
};
