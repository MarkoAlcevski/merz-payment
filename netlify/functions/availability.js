"use strict";

/**
 * POST /api/availability
 * Body: { checkIn, checkOut, adults, children }
 * Returns availability + server-side price. Also (GET or POST) returns the
 * set of unavailable date ranges so the frontend calendar can grey them out.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var pricing = require("./lib/pricing");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);

  try {
    var settings = await store.getSettings();

    // GET -> just the unavailable ranges (for the calendar).
    if (event.httpMethod === "GET") {
      return http.json(event, 200, { unavailable: await unavailableRanges() });
    }
    if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });

    if (!ratelimit.allow("avail:" + http.clientIp(event), 60, 60000)) {
      return http.json(event, 429, { error: "rate_limited" });
    }

    var body = http.parseBody(event);
    var v = pricing.validateStay(body, settings);
    if (!v.ok) {
      return http.json(event, 200, { available: false, reason: v.code, message: v.message, nights: v.nights });
    }

    var overlap = await store.findActiveOverlap(v.checkIn, v.checkOut);
    var blocked = await store.findBlockedOverlap(v.checkIn, v.checkOut);
    if (overlap.length || blocked.length) {
      return http.json(event, 200, {
        available: false,
        reason: "unavailable",
        message: "Those dates are not available. Please choose another range.",
        nights: v.nights,
        unavailable: await unavailableRanges()
      });
    }

    var price = pricing.computePrice(settings, v.nights);
    return http.json(event, 200, { available: true, nights: v.nights, price: price });
  } catch (e) {
    console.error("availability error", e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};

async function unavailableRanges() {
  var out = [];
  var bookings = await store.listBookings({});
  bookings.forEach(function (b) {
    var blocking =
      b.booking_status === "confirmed" ||
      b.booking_status === "paid" ||
      (b.booking_status === "awaiting_payment" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() > Date.now());
    if (blocking) out.push({ from: b.check_in, to: b.check_out });
  });
  (await store.listBlockedDates()).forEach(function (bd) {
    out.push({ from: bd.date_from, to: bd.date_to });
  });
  return out;
}
