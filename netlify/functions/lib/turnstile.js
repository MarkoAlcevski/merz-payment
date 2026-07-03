/* ============================================================
   Cloudflare Turnstile helpers for Merdz Netlify Functions
   ============================================================ */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function isEnabled() {
  return String(process.env.TURNSTILE_ENABLED || "").toLowerCase() === "true" &&
    !!process.env.TURNSTILE_SITE_KEY &&
    !!process.env.TURNSTILE_SECRET_KEY;
}

function publicConfig() {
  return {
    enabled: isEnabled(),
    siteKey: isEnabled() ? process.env.TURNSTILE_SITE_KEY : ""
  };
}

function getIp(event) {
  const h = (event && event.headers) || {};
  const forwarded = h["x-forwarded-for"] || h["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || h["client-ip"] || h["Client-Ip"] || "";
}

async function verifyToken(token, event, options = {}) {
  if (!isEnabled()) {
    return { success: true, skipped: true, reason: "turnstile_disabled" };
  }

  if (!token || typeof token !== "string") {
    return { success: false, reason: "turnstile_required", message: "Security check is required." };
  }

  const params = new URLSearchParams();
  params.set("secret", process.env.TURNSTILE_SECRET_KEY);
  params.set("response", token);

  const ip = getIp(event);
  if (ip) params.set("remoteip", ip);

  let cf;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    cf = await res.json();
  } catch (err) {
    return { success: false, reason: "turnstile_unavailable", message: "Security check could not be verified." };
  }

  if (!cf || !cf.success) {
    return {
      success: false,
      reason: "turnstile_failed",
      message: "Security check failed.",
      errors: (cf && cf["error-codes"]) || []
    };
  }

  if (options.action && cf.action && cf.action !== options.action) {
    return {
      success: false,
      reason: "turnstile_action_mismatch",
      message: "Security check action mismatch."
    };
  }

  return { success: true, cf };
}

async function verifyBody(body, event, options = {}) {
  const token = body && (body.turnstileToken || body.cfTurnstileToken || body["cf-turnstile-response"]);
  return verifyToken(token, event, options);
}

function errorResponse(result) {
  return json(403, {
    error: result.reason || "turnstile_failed",
    message: result.message || "Security check failed. Please try again."
  });
}

module.exports = {
  isEnabled,
  publicConfig,
  verifyToken,
  verifyBody,
  errorResponse,
  json
};
