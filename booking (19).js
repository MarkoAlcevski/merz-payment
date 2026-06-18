"use strict";

/** POST /api/admin-login { password } -> { token } */

var http = require("./lib/http");
var auth = require("./lib/auth");
var cfg = require("./lib/config");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });

  // Throttle brute force: 10 attempts / 5 min per IP.
  if (!ratelimit.allow("login:" + http.clientIp(event), 10, 5 * 60000)) {
    return http.json(event, 429, { error: "rate_limited", message: "Too many attempts. Try again later." });
  }

  try {
    var body = http.parseBody(event);
    if (!auth.checkPassword(body.password)) {
      return http.json(event, 401, { error: "invalid_credentials", message: "Incorrect password." });
    }
    return http.json(event, 200, {
      token: auth.issueToken(),
      expiresInHours: 8,
      demo: cfg.demoFlags().admin // true => default "demo" password in use
    });
  } catch (e) {
    console.error("admin-login error", e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};
