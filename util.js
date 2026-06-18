"use strict";

/**
 * POST /api/paypal-capture-order  { reference, orderID }
 * Captures the order server-side, verifies status/amount/currency, then
 * confirms the booking. Idempotent: duplicate calls return the same result
 * without re-charging or re-emailing.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var paypal = require("./lib/paypal");
var bookingLib = require("./lib/booking");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });
  if (!ratelimit.allow("ppx:" + http.clientIp(event), 30, 60000)) return http.json(event, 429, { error: "rate_limited" });

  try {
    var body = http.parseBody(event);
    var ref = String(body.reference || "").trim();
    var orderId = String(body.orderID || body.orderId || "").trim();

    var booking = await store.getBookingByRef(ref);
    if (!booking) return http.json(event, 404, { error: "not_found" });

    // Idempotent short-circuit.
    if (booking.payment_status === "paid") {
      return http.json(event, 200, { status: "paid", reference: ref, alreadyProcessed: true });
    }

    var cap = await paypal.captureOrder(orderId || booking.payment_provider_reference);
    if (!cap.ok || cap.status !== "COMPLETED") {
      await store.updateBooking(booking.id, { payment_status: "payment_failed" }).catch(function () {});
      return http.json(event, 402, { status: "payment_failed", message: "Payment was not completed." });
    }

    // Live captures return amount/currency to verify; demo passes booking values.
    var result = await bookingLib.confirmPaidBooking(ref, {
      method: "paypal",
      providerRef: cap.captureId || orderId,
      amount: cap.demo ? null : cap.amount,
      currency: cap.demo ? null : cap.currency
    });

    if (!result.ok) {
      if (result.reason === "conflict") {
        return http.json(event, 409, {
          status: "conflict",
          message: "Payment succeeded but the dates were just confirmed by someone else. We will refund you — please contact us."
        });
      }
      if (result.reason === "mismatch") {
        return http.json(event, 409, { status: "amount_mismatch", message: "Payment amount did not match the booking." });
      }
      return http.json(event, 500, { status: "error", message: "Could not finalize the booking." });
    }

    return http.json(event, 200, {
      status: "paid",
      reference: ref,
      demo: !!cap.demo,
      bookingStatus: result.booking.booking_status,
      paymentStatus: result.booking.payment_status
    });
  } catch (e) {
    console.error("paypal-capture-order error", e && e.message);
    return http.json(event, 502, { error: "paypal_error", message: "Could not capture PayPal payment." });
  }
};
