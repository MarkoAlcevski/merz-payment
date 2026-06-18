"use strict";

/**
 * GET /api/booking-status?ref=MERDZ-XXXX
 * Returns a PUBLIC-SAFE subset of a booking for the result page.
 * No private contact data (email/phone/country/special requests) is exposed.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "GET") return http.json(event, 405, { error: "method_not_allowed" });

  if (!ratelimit.allow("status:" + http.clientIp(event), 60, 60000)) {
    return http.json(event, 429, { error: "rate_limited" });
  }

  try {
    var ref = (event.queryStringParameters && event.queryStringParameters.ref) || "";
    ref = String(ref).trim();
    if (!/^MERDZ-[A-Z0-9]{8}$/.test(ref)) return http.json(event, 400, { error: "invalid_reference" });

    var b = await store.getBookingByRef(ref);
    if (!b) return http.json(event, 404, { error: "not_found" });

    return http.json(event, 200, {
      reference: b.public_booking_reference,
      guestFirstName: (b.guest_name || "").split(" ")[0],
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.number_of_nights,
      adults: b.adults,
      children: b.children,
      total: Number(b.total_amount),
      currency: b.currency,
      paymentMethod: b.payment_method,
      paymentStatus: b.payment_status,
      bookingStatus: b.booking_status
    });
  } catch (e) {
    console.error("booking-status error", e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};
