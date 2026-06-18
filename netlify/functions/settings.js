"use strict";

/** GET /api/settings — public booking config for the frontend. No secrets. */

var http = require("./lib/http");
var store = require("./lib/store");
var cfg = require("./lib/config");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "GET") return http.json(event, 405, { error: "method_not_allowed" });

  try {
    var s = await store.getSettings();
    var demo = cfg.demoFlags();
    return http.json(event, 200, {
      pricePerNight: Number(s.price_per_night),
      cleaningFee: Number(s.cleaning_fee),
      additionalFees: Number(s.additional_fees || 0),
      currency: s.currency || "EUR",
      maximumGuests: Number(s.maximum_guests),
      minimumNights: Number(s.minimum_nights),
      holdDurationMinutes: Number(s.hold_duration_minutes),
      paypalClientId: cfg.env("PAYPAL_CLIENT_ID", ""), // public by design
      paymentMethods: ["paypal", "nlb"],
      demo: demo // { database, paypal, nlb, email, admin } booleans
    });
  } catch (e) {
    console.error("settings error", e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};
