"use strict";

/**
 * HTTP helpers shared by all functions: CORS, JSON responses, body parsing.
 * No secrets are ever placed in responses or logs by these helpers.
 */

function allowedOrigins() {
  var list = [];
  ["SITE_URL", "URL", "DEPLOY_PRIME_URL", "DEPLOY_URL"].forEach(function (k) {
    if (process.env[k]) list.push(String(process.env[k]).replace(/\/$/, ""));
  });
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach(function (o) {
      o = o.trim().replace(/\/$/, "");
      if (o) list.push(o);
    });
  }
  return list;
}

function corsHeaders(event) {
  var origin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || "";
  origin = String(origin).replace(/\/$/, "");
  var allow = allowedOrigins();
  var headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  // Same-origin requests don't send an Origin header and don't need CORS.
  // Cross-origin is only permitted for explicitly allow-listed origins.
  if (origin && allow.indexOf(origin) !== -1) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (allow.length === 0 && origin) {
    // No allow-list configured (pure demo / single site): reflect origin.
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(event, statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: Object.assign(
      { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      corsHeaders(event)
    ),
    body: JSON.stringify(payload === undefined ? {} : payload)
  };
}

function redirect(event, location) {
  return {
    statusCode: 302,
    headers: Object.assign({ Location: location, "Cache-Control": "no-store" }, corsHeaders(event)),
    body: ""
  };
}

function preflight(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: "" };
}

function parseBody(event) {
  if (!event || !event.body) return {};
  var raw = event.body;
  if (event.isBase64Encoded) {
    try { raw = Buffer.from(raw, "base64").toString("utf8"); } catch (e) { return {}; }
  }
  var ctype = (event.headers && (event.headers["content-type"] || event.headers["Content-Type"])) || "";
  try {
    if (ctype.indexOf("application/x-www-form-urlencoded") !== -1) {
      var out = {};
      new URLSearchParams(raw).forEach(function (v, k) { out[k] = v; });
      return out;
    }
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function clientIp(event) {
  var h = (event && event.headers) || {};
  return (
    h["x-nf-client-connection-ip"] ||
    (h["x-forwarded-for"] ? String(h["x-forwarded-for"]).split(",")[0].trim() : "") ||
    "unknown"
  );
}

module.exports = { corsHeaders, json, redirect, preflight, parseBody, clientIp, allowedOrigins };
