"use strict";

var http = require("./lib/http");
var turnstile = require("./lib/turnstile");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });

  var body = http.parseBody(event);
  var action = body.action === "booking" ? "booking" : "launch";
  var result = await turnstile.verifyToken(event, body.token || body.turnstileToken || "", action);

  if (!result.ok) {
    return http.json(event, 403, {
      success: false,
      error: "turnstile_failed",
      reason: result.reason || "failed"
    });
  }

  return http.json(event, 200, { success: true });
};
