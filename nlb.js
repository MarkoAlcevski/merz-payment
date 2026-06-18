"use strict";

/**
 * POST /api/create-booking
 * Validates the stay + guest details, RE-CALCULATES the price server-side,
 * re-checks availability, then creates an `awaiting_payment` booking with a
 * temporary hold. The browser-supplied total is ignored entirely.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var pricing = require("./lib/pricing");
var util = require("./lib/util");
var ratelimit = require("./lib/ratelimit");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST") return http.json(event, 405, { error: "method_not_allowed" });

  if (!ratelimit.allow("create:" + http.clientIp(event), 12, 60000)) {
    return http.json(event, 429, { error: "rate_limited", message: "Too many attempts. Please wait a moment." });
  }

  try {
    var body = http.parseBody(event);
    var settings = await store.getSettings();

    // 1) Stay validation (dates, min stay, guests, past dates).
    var v = pricing.validateStay(body, settings);
    if (!v.ok) return http.json(event, 422, { error: "invalid_stay", reason: v.code, message: v.message });

    // 2) Guest field validation.
    var guest = {
      name: util.cleanStr(body.name, 120),
      email: util.cleanStr(body.email, 254),
      phone: util.cleanStr(body.phone, 40),
      country: util.cleanStr(body.country, 80),
      special: util.cleanStr(body.specialRequests, 1000)
    };
    var fieldErrors = {};
    if (!guest.name) fieldErrors.name = "required";
    if (!util.isEmail(guest.email)) fieldErrors.email = "invalid";
    if (!guest.phone || guest.phone.replace(/[^0-9]/g, "").length < 6) fieldErrors.phone = "invalid";
    if (!guest.country) fieldErrors.country = "required";
    if (body.acceptTerms !== true && body.acceptTerms !== "true" && body.acceptTerms !== 1) {
      fieldErrors.acceptTerms = "required";
    }
    if (Object.keys(fieldErrors).length) {
      return http.json(event, 422, { error: "invalid_guest", fields: fieldErrors });
    }

    // 3) Availability re-check (authoritative).
    var overlap = await store.findActiveOverlap(v.checkIn, v.checkOut);
    var blocked = await store.findBlockedOverlap(v.checkIn, v.checkOut);
    if (overlap.length || blocked.length) {
      return http.json(event, 409, { error: "unavailable", message: "Those dates were just taken. Please choose another range." });
    }

    // 4) Authoritative price.
    var price = pricing.computePrice(settings, v.nights);

    // 5) Create the hold.
    var holdMinutes = parseInt(settings.hold_duration_minutes, 10) || 15;
    var holdExpires = new Date(Date.now() + holdMinutes * 60000).toISOString();
    var method = body.paymentMethod === "nlb" ? "nlb" : (body.paymentMethod === "paypal" ? "paypal" : null);

    var record = {
      guest_name: guest.name,
      guest_email: guest.email,
      guest_phone: guest.phone,
      guest_country: guest.country,
      adults: v.adults,
      children: v.children,
      check_in: v.checkIn,
      check_out: v.checkOut,
      number_of_nights: v.nights,
      price_per_night: price.pricePerNight,
      cleaning_fee: price.cleaningFee,
      additional_fees: price.additionalFees,
      total_amount: price.total,
      currency: price.currency,
      payment_method: method,
      payment_status: "awaiting_payment",
      booking_status: "awaiting_payment",
      special_requests: guest.special,
      hold_expires_at: holdExpires
    };

    var created;
    try {
      created = await store.createBooking(record);
    } catch (e) {
      if (e && e.overlap) return http.json(event, 409, { error: "unavailable", message: "Those dates were just taken." });
      throw e;
    }

    return http.json(event, 201, {
      reference: created.public_booking_reference,
      holdExpiresAt: created.hold_expires_at,
      holdMinutes: holdMinutes,
      price: price
    });
  } catch (e) {
    console.error("create-booking error", e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};
