"use strict";

/**
 * Shared "confirm a paid booking" logic used by PayPal capture and the
 * NLB return/callback. Idempotent and safe against double bookings.
 */

var store = require("./store");
var util = require("./util");
var email = require("./email");

/**
 * Mark a booking paid+confirmed after a verified payment.
 * @param {string} ref  public booking reference
 * @param {object} opts { method, providerRef, amount, currency }  (amount/currency
 *                       are compared against the stored total when provided)
 * @returns {object} { ok, status, booking?, reason? }
 *   reason ∈ not_found | already | mismatch | conflict | error
 */
async function confirmPaidBooking(ref, opts) {
  opts = opts || {};
  var booking = await store.getBookingByRef(ref);
  if (!booking) return { ok: false, status: "not_found", reason: "not_found" };

  // Idempotency: a duplicate/late callback must not re-process or re-email.
  if (booking.payment_status === "paid" || booking.booking_status === "paid") {
    return { ok: true, status: "already", already: true, booking: booking };
  }

  // Server-side amount/currency verification (live payments only pass values).
  if (opts.amount != null) {
    if (util.money(opts.amount) !== util.money(booking.total_amount)) {
      await safeUpdate(booking.id, { payment_status: "payment_failed" });
      return { ok: false, status: "mismatch", reason: "mismatch" };
    }
  }
  if (opts.currency && booking.currency && String(opts.currency).toUpperCase() !== String(booking.currency).toUpperCase()) {
    await safeUpdate(booking.id, { payment_status: "payment_failed" });
    return { ok: false, status: "mismatch", reason: "mismatch" };
  }

  // Double-booking guard: ensure no OTHER confirmed/paid booking overlaps.
  var overlap = await store.findActiveOverlap(booking.check_in, booking.check_out, booking.id);
  var hardConflict = overlap.filter(function (b) {
    return b.booking_status === "confirmed" || b.booking_status === "paid";
  });
  if (hardConflict.length) {
    await safeUpdate(booking.id, { payment_status: "payment_failed", booking_status: "payment_failed" });
    return { ok: false, status: "conflict", reason: "conflict", booking: booking };
  }

  var updated;
  try {
    updated = await store.updateBooking(booking.id, {
      payment_status: "paid",
      booking_status: "paid",
      payment_method: opts.method || booking.payment_method,
      payment_provider_reference: opts.providerRef || booking.payment_provider_reference,
      hold_expires_at: null
    });
  } catch (e) {
    if (e && e.overlap) {
      await safeUpdate(booking.id, { payment_status: "payment_failed", booking_status: "payment_failed" });
      return { ok: false, status: "conflict", reason: "conflict" };
    }
    return { ok: false, status: "error", reason: "error" };
  }

  // Fire confirmation emails (best effort — never block confirmation on email).
  try { await email.sendBookingEmails(updated); } catch (e) { /* logged in email.js */ }

  return { ok: true, status: "paid", booking: updated };
}

async function safeUpdate(id, patch) {
  try { return await store.updateBooking(id, patch); } catch (e) { return null; }
}

module.exports = { confirmPaidBooking: confirmPaidBooking };
