"use strict";

/**
 * Data access layer.
 *  - If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set  -> Supabase (PostgreSQL).
 *  - Otherwise                                            -> in-memory demo store.
 *
 * The demo store lives on globalThis so it is shared by every bundled
 * function copy within the SAME warm Netlify container. It is NOT
 * persistent and NOT shared across containers — it exists only so the
 * full flow can be exercised before Supabase is connected. Connect
 * Supabase for real, durable storage. (See BOOKING_SETUP.md.)
 */

var crypto = require("crypto");
var cfg = require("./config");
var util = require("./util");

var ACTIVE_CONFIRMED = ["confirmed", "paid"];

/* ----------------------------------------------------------------
 *  Supabase driver
 * ---------------------------------------------------------------- */
var _sb = null;
function sb() {
  if (_sb) return _sb;
  var createClient = require("@supabase/supabase-js").createClient;
  _sb = createClient(cfg.env("SUPABASE_URL"), cfg.env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _sb;
}

function isOverlapError(err) {
  if (!err) return false;
  var code = err.code || "";
  var msg = (err.message || "").toLowerCase();
  return code === "23P01" || code === "23505" || msg.indexOf("overlap") !== -1 || msg.indexOf("exclusion") !== -1;
}

/* ----------------------------------------------------------------
 *  In-memory demo driver
 * ---------------------------------------------------------------- */
function mem() {
  if (!globalThis.__MERDZ_STORE__) {
    globalThis.__MERDZ_STORE__ = {
      settings: Object.assign({ id: 1, updated_at: new Date().toISOString() }, cfg.DEFAULTS),
      bookings: [],
      blocked: []
    };
  }
  return globalThis.__MERDZ_STORE__;
}

function nowISO() { return new Date().toISOString(); }

function holdActive(b) {
  return (
    b.booking_status === "awaiting_payment" &&
    b.hold_expires_at &&
    new Date(b.hold_expires_at).getTime() > Date.now()
  );
}

/* ================================================================
 *  Public API (driver-dispatching)
 * ================================================================ */
var USE_SB = cfg.hasSupabase();

/* ---- Settings ---- */
async function getSettings() {
  if (USE_SB) {
    var r = await sb().from("booking_settings").select("*").eq("id", 1).single();
    if (r.error || !r.data) return Object.assign({ id: 1 }, cfg.DEFAULTS);
    return r.data;
  }
  return Object.assign({}, mem().settings);
}

async function updateSettings(patch) {
  var allowed = ["price_per_night", "cleaning_fee", "additional_fees", "currency", "maximum_guests", "minimum_nights", "hold_duration_minutes"];
  var clean = {};
  allowed.forEach(function (k) { if (patch[k] !== undefined) clean[k] = patch[k]; });
  if (USE_SB) {
    var r = await sb().from("booking_settings").update(clean).eq("id", 1).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  Object.assign(mem().settings, clean, { updated_at: nowISO() });
  return Object.assign({}, mem().settings);
}

/* ---- Bookings ---- */
async function createBooking(rec) {
  rec.public_booking_reference = rec.public_booking_reference || util.bookingReference();
  if (USE_SB) {
    var r = await sb().from("bookings").insert(rec).select().single();
    if (r.error) {
      if (isOverlapError(r.error)) { var e = new Error("overlap"); e.overlap = true; throw e; }
      throw r.error;
    }
    return r.data;
  }
  var b = Object.assign(
    { id: crypto.randomUUID(), created_at: nowISO(), updated_at: nowISO() },
    rec
  );
  mem().bookings.push(b);
  return Object.assign({}, b);
}

async function getBookingByRef(ref) {
  if (USE_SB) {
    var r = await sb().from("bookings").select("*").eq("public_booking_reference", ref).maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }
  var f = mem().bookings.filter(function (b) { return b.public_booking_reference === ref; })[0];
  return f ? Object.assign({}, f) : null;
}

async function getBookingById(id) {
  if (USE_SB) {
    var r = await sb().from("bookings").select("*").eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }
  var f = mem().bookings.filter(function (b) { return b.id === id; })[0];
  return f ? Object.assign({}, f) : null;
}

async function updateBooking(id, patch) {
  if (USE_SB) {
    var r = await sb().from("bookings").update(patch).eq("id", id).select().single();
    if (r.error) {
      if (isOverlapError(r.error)) { var e = new Error("overlap"); e.overlap = true; throw e; }
      throw r.error;
    }
    return r.data;
  }
  var arr = mem().bookings;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) {
      // Mirror the DB exclusion constraint for confirmed/paid in demo mode.
      if (patch.booking_status && ACTIVE_CONFIRMED.indexOf(patch.booking_status) !== -1) {
        var conflict = arr.some(function (b) {
          return (
            b.id !== id &&
            ACTIVE_CONFIRMED.indexOf(b.booking_status) !== -1 &&
            util.rangesOverlap(
              util.parseISODate(arr[i].check_in), util.parseISODate(arr[i].check_out),
              util.parseISODate(b.check_in), util.parseISODate(b.check_out)
            )
          );
        });
        if (conflict) { var er = new Error("overlap"); er.overlap = true; throw er; }
      }
      Object.assign(arr[i], patch, { updated_at: nowISO() });
      return Object.assign({}, arr[i]);
    }
  }
  return null;
}

/** Conflicting bookings for [checkIn,checkOut): confirmed/paid + active holds. */
async function findActiveOverlap(checkInISO, checkOutISO, exceptId) {
  if (USE_SB) {
    var r = await sb()
      .from("bookings")
      .select("*")
      .lt("check_in", checkOutISO)
      .gt("check_out", checkInISO)
      .in("booking_status", ["confirmed", "paid", "awaiting_payment"]);
    if (r.error) throw r.error;
    return (r.data || []).filter(function (b) {
      if (exceptId && b.id === exceptId) return false;
      if (ACTIVE_CONFIRMED.indexOf(b.booking_status) !== -1) return true;
      return holdActive(b);
    });
  }
  var ci = util.parseISODate(checkInISO), co = util.parseISODate(checkOutISO);
  return mem().bookings.filter(function (b) {
    if (exceptId && b.id === exceptId) return false;
    var active = ACTIVE_CONFIRMED.indexOf(b.booking_status) !== -1 || holdActive(b);
    if (!active) return false;
    return util.rangesOverlap(ci, co, util.parseISODate(b.check_in), util.parseISODate(b.check_out));
  }).map(function (b) { return Object.assign({}, b); });
}

async function listBookings(filters) {
  filters = filters || {};
  var rows;
  if (USE_SB) {
    var q = sb().from("bookings").select("*").order("check_in", { ascending: true });
    if (filters.status) q = q.eq("booking_status", filters.status);
    if (filters.from) q = q.gte("check_in", filters.from);
    if (filters.to) q = q.lte("check_in", filters.to);
    var r = await q;
    if (r.error) throw r.error;
    rows = r.data || [];
  } else {
    rows = mem().bookings.slice().sort(function (a, b) {
      return a.check_in < b.check_in ? -1 : 1;
    });
    if (filters.status) rows = rows.filter(function (b) { return b.booking_status === filters.status; });
    if (filters.from) rows = rows.filter(function (b) { return b.check_in >= filters.from; });
    if (filters.to) rows = rows.filter(function (b) { return b.check_in <= filters.to; });
  }
  if (filters.q) {
    var q2 = String(filters.q).toLowerCase();
    rows = rows.filter(function (b) {
      return (
        (b.guest_name || "").toLowerCase().indexOf(q2) !== -1 ||
        (b.guest_email || "").toLowerCase().indexOf(q2) !== -1 ||
        (b.public_booking_reference || "").toLowerCase().indexOf(q2) !== -1
      );
    });
  }
  return rows;
}

/* ---- Blocked dates ---- */
async function listBlockedDates() {
  if (USE_SB) {
    var r = await sb().from("blocked_dates").select("*").order("date_from", { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }
  return mem().blocked.slice();
}

async function findBlockedOverlap(checkInISO, checkOutISO) {
  var all = await listBlockedDates();
  var ci = util.parseISODate(checkInISO), co = util.parseISODate(checkOutISO);
  return all.filter(function (bd) {
    return util.rangesOverlap(ci, co, util.parseISODate(bd.date_from), util.parseISODate(bd.date_to));
  });
}

async function addBlockedDate(rec) {
  if (USE_SB) {
    var r = await sb().from("blocked_dates").insert(rec).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  var row = Object.assign({ id: crypto.randomUUID(), created_at: nowISO() }, rec);
  mem().blocked.push(row);
  return Object.assign({}, row);
}

async function removeBlockedDate(id) {
  if (USE_SB) {
    var r = await sb().from("blocked_dates").delete().eq("id", id);
    if (r.error) throw r.error;
    return true;
  }
  mem().blocked = mem().blocked.filter(function (b) { return b.id !== id; });
  return true;
}

/* ---- Hold expiry ---- */
async function expireHolds() {
  if (USE_SB) {
    var r = await sb()
      .from("bookings")
      .update({ booking_status: "expired", payment_status: "pending" })
      .eq("booking_status", "awaiting_payment")
      .lt("hold_expires_at", nowISO())
      .select("id");
    if (r.error) throw r.error;
    return (r.data || []).length;
  }
  var n = 0;
  mem().bookings.forEach(function (b) {
    if (b.booking_status === "awaiting_payment" && b.hold_expires_at && new Date(b.hold_expires_at).getTime() <= Date.now()) {
      b.booking_status = "expired";
      b.updated_at = nowISO();
      n++;
    }
  });
  return n;
}

module.exports = {
  driver: USE_SB ? "supabase" : "memory",
  getSettings: getSettings,
  updateSettings: updateSettings,
  createBooking: createBooking,
  getBookingByRef: getBookingByRef,
  getBookingById: getBookingById,
  updateBooking: updateBooking,
  findActiveOverlap: findActiveOverlap,
  listBookings: listBookings,
  listBlockedDates: listBlockedDates,
  findBlockedOverlap: findBlockedOverlap,
  addBlockedDate: addBlockedDate,
  removeBlockedDate: removeBlockedDate,
  expireHolds: expireHolds
};
