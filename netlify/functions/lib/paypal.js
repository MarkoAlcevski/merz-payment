"use strict";

/**
 * PayPal Checkout v2 (official REST API) via fetch.
 * Secret is used only here, server-side, and never returned to the client.
 * When credentials are absent, runs in clearly-labelled DEMO mode:
 * orders are simulated and no money moves.
 */

var cfg = require("./config");

function base() {
  return cfg.env("PAYPAL_ENVIRONMENT", "sandbox") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function accessToken() {
  var id = cfg.env("PAYPAL_CLIENT_ID");
  var secret = cfg.env("PAYPAL_CLIENT_SECRET");
  var auth = Buffer.from(id + ":" + secret).toString("base64");
  var res = await fetch(base() + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  var data = await res.json();
  if (!res.ok) throw new Error("paypal_auth_failed");
  return data.access_token;
}

/** Create a PayPal order for the given amount; returns { id, demo }. */
async function createOrder(opts) {
  if (cfg.demoFlags().paypal) {
    return { id: "DEMO-PP-" + Date.now().toString(36).toUpperCase(), demo: true };
  }
  var token = await accessToken();
  var body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: opts.reference,
        description: (opts.description || "Apartment reservation").slice(0, 127),
        amount: { currency_code: opts.currency, value: Number(opts.amount).toFixed(2) }
      }
    ],
    application_context: {
      brand_name: "Merdz Sky Wellness",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW"
    }
  };
  var res = await fetch(base() + "/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      // Idempotency: PayPal de-dupes order creation per reference.
      "PayPal-Request-Id": "order-" + opts.reference
    },
    body: JSON.stringify(body)
  });
  var data = await res.json();
  if (!res.ok || !data.id) throw new Error("paypal_create_failed");
  return { id: data.id, demo: false };
}

/**
 * Capture an approved order and return a normalized result:
 *   { ok, status, captureId, amount, currency, demo }
 */
async function captureOrder(orderId) {
  if (cfg.demoFlags().paypal || /^DEMO-PP-/.test(String(orderId))) {
    return { ok: true, status: "COMPLETED", captureId: "DEMO-CAP-" + Date.now().toString(36).toUpperCase(), amount: null, currency: null, demo: true };
  }
  var token = await accessToken();
  var res = await fetch(base() + "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "PayPal-Request-Id": "capture-" + orderId
    }
  });
  var data = await res.json();
  if (!res.ok) {
    // 422 with ORDER_ALREADY_CAPTURED -> treat as idempotent success upstream.
    var issue = data && data.details && data.details[0] && data.details[0].issue;
    if (issue === "ORDER_ALREADY_CAPTURED") {
      return { ok: true, status: "COMPLETED", alreadyCaptured: true, demo: false };
    }
    throw new Error("paypal_capture_failed");
  }
  var unit = data.purchase_units && data.purchase_units[0];
  var cap = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  return {
    ok: data.status === "COMPLETED",
    status: data.status,
    captureId: cap ? cap.id : null,
    amount: cap ? cap.amount.value : null,
    currency: cap ? cap.amount.currency_code : null,
    customId: cap ? cap.custom_id : (unit ? unit.custom_id : null),
    demo: false
  };
}

module.exports = { createOrder: createOrder, captureOrder: captureOrder };
