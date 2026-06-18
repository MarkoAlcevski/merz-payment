"use strict";

/**
 * Stateless admin authentication.
 *  - Password is checked against ADMIN_PASSWORD (or "demo" when unset).
 *  - On success a signed, expiring token is issued: base64(exp).hmac.
 *  - The signing secret is ADMIN_SESSION_SECRET, else derived from
 *    ADMIN_PASSWORD, else a demo secret. The password itself is never
 *    sent to the client.
 */

var crypto = require("crypto");
var cfg = require("./config");
var util = require("./util");

var TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function secret() {
  return cfg.env("ADMIN_SESSION_SECRET") || ("session::" + cfg.env("ADMIN_PASSWORD", "demo"));
}

function expectedPassword() {
  // Demo mode (no ADMIN_PASSWORD): accept "demo" so the panel is testable.
  return cfg.env("ADMIN_PASSWORD", "demo");
}

function checkPassword(pw) {
  return util.safeEqual(String(pw || ""), expectedPassword());
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function issueToken() {
  var exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  var payload = Buffer.from(String(exp)).toString("base64");
  return payload + "." + sign(payload);
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return false;
  var parts = token.split(".");
  var payload = parts[0], mac = parts[1];
  if (!util.safeEqual(mac, sign(payload))) return false;
  var exp;
  try { exp = parseInt(Buffer.from(payload, "base64").toString("utf8"), 10); } catch (e) { return false; }
  return !!exp && exp > Math.floor(Date.now() / 1000);
}

/** Extract + verify the Bearer token from an event. Returns true/false. */
function isAuthed(event) {
  var h = (event && event.headers) || {};
  var raw = h.authorization || h.Authorization || "";
  var m = /^Bearer\s+(.+)$/i.exec(raw);
  return !!(m && verifyToken(m[1]));
}

module.exports = {
  checkPassword: checkPassword,
  issueToken: issueToken,
  verifyToken: verifyToken,
  isAuthed: isAuthed,
  demoMode: cfg.demoFlags().admin
};
