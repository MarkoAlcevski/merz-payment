"use strict";

/**
 * Authenticated admin API (Bearer token from /api/admin-login).
 *   GET  /api/admin?action=list|get|settings-get|blocked-list|export
 *   POST /api/admin?action=update|create|block|unblock|settings-put
 * All reservation data here is private and requires a valid admin token.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var auth = require("./lib/auth");
var pricing = require("./lib/pricing");
var util = require("./lib/util");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (!auth.isAuthed(event)) return http.json(event, 401, { error: "unauthorized" });

  var q = event.queryStringParameters || {};
  var body = event.httpMethod === "POST" ? http.parseBody(event) : {};
  var action = (q.action || body.action || "").toLowerCase();

  try {
    switch (action) {
      case "list": return await listAction(event, q);
      case "get": return await getAction(event, q);
      case "settings-get": return http.json(event, 200, { settings: await store.getSettings() });
      case "settings-put": return await settingsPut(event, body);
      case "blocked-list": return http.json(event, 200, { blocked: await store.listBlockedDates() });
      case "update": return await updateAction(event, body);
      case "create": return await createAction(event, body);
      case "block": return await blockAction(event, body);
      case "unblock": return await unblockAction(event, body);
      case "export": return await exportAction(event);
      default: return http.json(event, 400, { error: "unknown_action" });
    }
  } catch (e) {
    console.error("admin error", action, e && e.message);
    return http.json(event, 500, { error: "server_error" });
  }
};

async function listAction(event, q) {
  var rows = await store.listBookings({ status: q.status, q: q.q, from: q.from, to: q.to });
  var today = util.toISODate(util.todayUTC());
  var summary = { total: rows.length, upcoming: 0, awaiting: 0, paid: 0, cancelled: 0, revenue: 0 };
  rows.forEach(function (b) {
    if ((b.booking_status === "paid" || b.booking_status === "confirmed")) {
      if (b.check_out >= today) summary.upcoming++;
      summary.paid++;
      if (b.payment_status === "paid") summary.revenue += Number(b.total_amount) || 0;
    }
    if (b.booking_status === "awaiting_payment") summary.awaiting++;
    if (b.booking_status === "cancelled") summary.cancelled++;
  });
  summary.revenue = util.money(summary.revenue);
  return http.json(event, 200, { bookings: rows, summary: summary });
}

async function getAction(event, q) {
  var ref = String(q.ref || "").trim();
  var b = await store.getBookingByRef(ref);
  if (!b) return http.json(event, 404, { error: "not_found" });
  return http.json(event, 200, { booking: b });
}

async function settingsPut(event, body) {
  var s = body.settings || body;
  var patch = {};
  ["price_per_night", "cleaning_fee", "additional_fees", "maximum_guests", "minimum_nights", "hold_duration_minutes"].forEach(function (k) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== "") {
      var n = Number(s[k]);
      if (!isNaN(n) && n >= 0) patch[k] = n;
    }
  });
  if (s.currency) patch.currency = util.cleanStr(s.currency, 8).toUpperCase();
  var updated = await store.updateSettings(patch);
  return http.json(event, 200, { settings: updated });
}

async function updateAction(event, body) {
  var b = body.ref ? await store.getBookingByRef(String(body.ref)) : (body.id ? await store.getBookingById(String(body.id)) : null);
  if (!b) return http.json(event, 404, { error: "not_found" });

  var patch = {};
  var op = String(body.op || body.statusOp || "").toLowerCase();
  if (op === "mark-paid") { patch.payment_status = "paid"; patch.booking_status = "paid"; patch.hold_expires_at = null; if (!b.payment_method) patch.payment_method = "offline"; }
  else if (op === "cancel") { patch.booking_status = "cancelled"; }
  else if (op === "refund") { patch.booking_status = "refunded"; patch.payment_status = "refunded"; }
  else if (op === "confirm") { patch.booking_status = "confirmed"; }
  else if (body.booking_status) {
    var allowed = ["pending", "awaiting_payment", "confirmed", "paid", "cancelled", "expired", "payment_failed", "refunded"];
    if (allowed.indexOf(body.booking_status) === -1) return http.json(event, 400, { error: "invalid_status" });
    patch.booking_status = body.booking_status;
    if (body.payment_status) patch.payment_status = body.payment_status;
  } else {
    return http.json(event, 400, { error: "no_op" });
  }

  try {
    var updated = await store.updateBooking(b.id, patch);
    return http.json(event, 200, { booking: updated });
  } catch (e) {
    if (e && e.overlap) return http.json(event, 409, { error: "overlap", message: "Those dates conflict with another confirmed booking." });
    throw e;
  }
}

async function createAction(event, body) {
  var settings = await store.getSettings();
  var v = pricing.validateStay(body, settings);
  if (!v.ok) return http.json(event, 422, { error: "invalid_stay", reason: v.code, message: v.message });

  var name = util.cleanStr(body.name, 120);
  var emailAddr = util.cleanStr(body.email, 254);
  if (!name) return http.json(event, 422, { error: "invalid_guest", fields: { name: "required" } });

  var overlap = await store.findActiveOverlap(v.checkIn, v.checkOut);
  var blocked = await store.findBlockedOverlap(v.checkIn, v.checkOut);
  if (!body.force && (overlap.length || blocked.length)) {
    return http.json(event, 409, { error: "unavailable", message: "Those dates overlap an existing booking/block. Re-send with force=true to override." });
  }

  var price = pricing.computePrice(settings, v.nights);
  var paid = body.markPaid === true || body.markPaid === "true";
  var rec = {
    guest_name: name,
    guest_email: emailAddr || "manual@local",
    guest_phone: util.cleanStr(body.phone, 40),
    guest_country: util.cleanStr(body.country, 80),
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
    payment_method: util.cleanStr(body.paymentMethod, 20) || "offline",
    payment_status: paid ? "paid" : "pending",
    booking_status: paid ? "paid" : "confirmed",
    special_requests: util.cleanStr(body.specialRequests, 1000)
  };
  try {
    var created = await store.createBooking(rec);
    return http.json(event, 201, { booking: created });
  } catch (e) {
    if (e && e.overlap) return http.json(event, 409, { error: "overlap" });
    throw e;
  }
}

async function blockAction(event, body) {
  var from = util.cleanStr(body.date_from || body.from, 10);
  var to = util.cleanStr(body.date_to || body.to, 10);
  if (!util.parseISODate(from) || !util.parseISODate(to) || util.nightsBetween(from, to) < 1) {
    return http.json(event, 422, { error: "invalid_range" });
  }
  var row = await store.addBlockedDate({ date_from: from, date_to: to, reason: util.cleanStr(body.reason, 200) });
  return http.json(event, 201, { blocked: row });
}

async function unblockAction(event, body) {
  var id = String(body.id || "").trim();
  if (!id) return http.json(event, 400, { error: "missing_id" });
  await store.removeBlockedDate(id);
  return http.json(event, 200, { ok: true });
}

async function exportAction(event) {
  var rows = await store.listBookings({});
  var cols = ["public_booking_reference", "guest_name", "guest_email", "guest_phone", "guest_country",
    "adults", "children", "check_in", "check_out", "number_of_nights", "price_per_night",
    "cleaning_fee", "additional_fees", "total_amount", "currency", "payment_method",
    "payment_status", "booking_status", "created_at"];
  var lines = [cols.join(",")];
  rows.forEach(function (b) {
    lines.push(cols.map(function (c) { return csv(b[c]); }).join(","));
  });
  return {
    statusCode: 200,
    headers: Object.assign({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="merdz-bookings.csv"',
      "Cache-Control": "no-store"
    }, http.corsHeaders(event)),
    body: lines.join("\n")
  };
}

function csv(v) {
  if (v == null) return "";
  var s = String(v);
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
