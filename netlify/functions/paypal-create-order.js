"use strict";

/**
 * POST /api/paypal-create-order  { reference }
 * Creates a PayPal order server-side for the stored booking total.
 * The amount comes from the DB, never from the browser.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var paypal = require("./lib/paypal");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });
  if (!ratelimit.allow("ppc:" + http.clientIp(event), 30, 60000)) return http.json(event, 429, { error: "rate_limited" });

  try {
    var body = http.parseBody(event);
    var ref = String(body.reference || "").trim();
    var booking = await store.getBookingByRef(ref);
    if (!booking) return http.json(event, 404, { error: "not_found" });

    if (booking.payment_status === "paid") {
      return http.json(event, 409, { error: "already_paid", message: "This booking is already paid." });
    }
    if (booking.booking_status !== "awaiting_payment") {
      return http.json(event, 409, { error: "not_payable", message: "This booking can no longer be paid." });
    }
    if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() < Date.now()) {
      await safe(store.updateBooking(booking.id, { booking_status: "expired" }));
      return http.json(event, 410, { error: "hold_expired", message: "Your hold expired. Please start again." });
    }

    var order = await paypal.createOrder({
      amount: booking.total_amount,
      currency: booking.currency,
      reference: booking.public_booking_reference,
      description: "Stay " + booking.check_in + " to " + booking.check_out
    });

    await safe(store.updateBooking(booking.id, {
      payment_method: "paypal",
      payment_provider_reference: order.id
    }));

    return http.json(event, 200, { orderId: order.id, demo: !!order.demo });
  } catch (e) {
    console.error("paypal-create-order error", e && e.message);
    return http.json(event, 502, { error: "paypal_error", message: "Could not start PayPal payment." });
  }
};

function safe(p) { return p.catch(function () { return null; }); }
