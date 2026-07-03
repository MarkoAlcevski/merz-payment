"use strict";

var http = require("./lib/http");
var turnstile = require("./lib/turnstile");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "GET") return http.json(event, 405, { error: "method_not_allowed" });

  return http.json(event, 200, {
    enabled: turnstile.enabled() && !!turnstile.siteKey(),
    siteKey: turnstile.siteKey() || ""
  });
};
