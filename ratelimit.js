"use strict";

/**
 * POST /api/nlb-initiate  { reference }
 * Prepares the redirect to NLB Banka.
 *   LIVE -> { live:true, actionUrl, fields }  (frontend auto-POSTs a form)
 *   TEST -> { live:false, redirectUrl }        (simulated bank round-trip)
 */

var http = require("./lib/http");
var store = require("./lib/store");
var nlb = require("./lib/nlb");
var cfg = require("./lib/config");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });
  if (!ratelimit.allow("nlbi:" + http.clientIp(event), 30, 60000)) return http.json(event, 429, { error: "rate_limited" });

  try {
    var body = http.parseBody(event);
    var ref = String(body.reference || "").trim();
    var booking = await store.getBookingByRef(ref);
    if (!booking) return http.json(event, 404, { error: "not_found" });

    if (booking.payment_status === "paid") return http.json(event, 409, { error: "already_paid" });
    if (booking.booking_status !== "awaiting_payment") return http.json(event, 409, { error: "not_payable" });
    if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() < Date.now()) {
      await store.updateBooking(booking.id, { booking_status: "expired" }).catch(function () {});
      return http.json(event, 410, { error: "hold_expired" });
    }

    await store.updateBooking(booking.id, { payment_method: "nlb" }).catch(function () {});

    var site = cfg.siteUrl();
    var settings = await store.getSettings();
    var urls = {
      success: site + "/booking-result.html?provider=nlb&result=success&ref=" + encodeURIComponent(ref),
      failure: site + "/booking-result.html?provider=nlb&result=failure&ref=" + encodeURIComponent(ref),
      cancel: site + "/booking-result.html?provider=nlb&result=cancel&ref=" + encodeURIComponent(ref),
      callback: site + "/api/nlb-callback",
      returnApi: "/api/nlb-return"
    };

    var req = nlb.buildPaymentRequest(booking, settings, urls);
    return http.json(event, 200, Object.assign({ demo: !req.live }, req));
  } catch (e) {
    console.error("nlb-initiate error", e && e.message);
    return http.json(event, 502, { error: "nlb_error", message: "Could not start the bank payment." });
  }
};
