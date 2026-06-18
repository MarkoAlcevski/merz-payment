"use strict";

var util = require("./util");

/**
 * Validate the requested stay against the booking settings.
 * Returns { ok, code, message, nights }. `code` is a stable machine key
 * the frontend maps to a localized message; `message` is a safe fallback.
 */
function validateStay(input, settings) {
  var checkIn = util.cleanStr(input.checkIn, 10);
  var checkOut = util.cleanStr(input.checkOut, 10);
  var adults = parseInt(input.adults, 10);
  var children = parseInt(input.children, 10);
  if (isNaN(adults)) adults = 0;
  if (isNaN(children)) children = 0;

  var ci = util.parseISODate(checkIn);
  var co = util.parseISODate(checkOut);
  if (!ci || !co) return fail("invalid_dates", "Please choose valid check-in and check-out dates.");

  var today = util.todayUTC();
  if (ci.getTime() < today.getTime()) return fail("past_date", "Check-in cannot be in the past.");
  if (co.getTime() <= ci.getTime()) return fail("checkout_before_checkin", "Check-out must be after check-in.");

  var nights = util.nightsBetween(checkIn, checkOut);
  var minNights = parseInt(settings.minimum_nights, 10) || 1;
  if (nights < minNights) {
    return fail("min_nights", "Minimum stay is " + minNights + " night(s).", { nights: nights, minNights: minNights });
  }

  if (adults < 1) return fail("no_adults", "At least one adult is required.");
  var guests = adults + (children > 0 ? children : 0);
  var maxGuests = parseInt(settings.maximum_guests, 10) || 1;
  if (guests > maxGuests) {
    return fail("max_guests", "Maximum " + maxGuests + " guests allowed.", { maxGuests: maxGuests });
  }

  return { ok: true, nights: nights, adults: adults, children: children > 0 ? children : 0, checkIn: checkIn, checkOut: checkOut };

  function fail(code, message, extra) {
    return Object.assign({ ok: false, code: code, message: message, nights: nights || 0 }, extra || {});
  }
}

/**
 * Authoritative price computation. ALWAYS run on the server; the browser
 * total is never trusted. Returns a breakdown in the settings currency.
 */
function computePrice(settings, nights) {
  var ppn = util.money(settings.price_per_night);
  var cleaning = util.money(settings.cleaning_fee || 0);
  var additional = util.money(settings.additional_fees || 0);
  var nightsTotal = util.money(ppn * nights);
  var total = util.money(nightsTotal + cleaning + additional);
  return {
    currency: settings.currency || "EUR",
    nights: nights,
    pricePerNight: ppn,
    nightsTotal: nightsTotal,
    cleaningFee: cleaning,
    additionalFees: additional,
    total: total
  };
}

module.exports = { validateStay: validateStay, computePrice: computePrice };
