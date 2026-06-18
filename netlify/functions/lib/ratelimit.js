"use strict";

/**
 * Best-effort in-memory rate limiter (fixed window) keyed by IP + bucket.
 * Shared per warm container via globalThis. This is a lightweight guard
 * against abuse/bursts; for hard guarantees use a durable store or an
 * edge/WAF rule. Never throws.
 */

function store() {
  if (!globalThis.__MERDZ_RL__) globalThis.__MERDZ_RL__ = {};
  return globalThis.__MERDZ_RL__;
}

/** Returns true if the request is allowed, false if the limit is exceeded. */
function allow(key, max, windowMs) {
  try {
    max = max || 30;
    windowMs = windowMs || 60000;
    var now = Date.now();
    var s = store();
    var rec = s[key];
    if (!rec || now > rec.reset) {
      s[key] = { count: 1, reset: now + windowMs };
      return true;
    }
    rec.count++;
    return rec.count <= max;
  } catch (e) {
    return true;
  }
}

module.exports = { allow: allow };
