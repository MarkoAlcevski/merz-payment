"use strict";

var crypto = require("crypto");

// Matches ASCII control characters (0x00-0x1F and 0x7F). Built via RegExp
// constructor so no literal control bytes appear in this source file.
var CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
var WHITESPACE = new RegExp("\\s+", "g");

/** Cryptographically secure, human-readable booking reference, e.g. MERDZ-7F3K9Q2A. */
function bookingReference() {
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O/1/I)
  var bytes = crypto.randomBytes(8);
  var out = "";
  for (var i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return "MERDZ-" + out;
}

/** Validate an ISO date string (YYYY-MM-DD) and return a UTC Date, or null. */
function parseISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var d = new Date(s + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  // Guard against rollover (e.g. 2026-02-30 -> Mar 2).
  if (d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/** Today at UTC midnight. */
function todayUTC() {
  var n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Whole nights between two ISO dates (check_out - check_in). */
function nightsBetween(checkInISO, checkOutISO) {
  var a = parseISODate(checkInISO);
  var b = parseISODate(checkOutISO);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Half-open range overlap: [aStart,aEnd) intersects [bStart,bEnd). */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Round to 2 decimals, returned as Number. */
function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Trim, collapse whitespace, strip control characters, and cap length. */
function cleanStr(v, max) {
  if (v == null) return "";
  var s = String(v).replace(CONTROL_CHARS, " ").replace(WHITESPACE, " ").trim();
  if (max && s.length > max) s = s.slice(0, max);
  return s;
}

function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 254;
}

/** Constant-time string comparison. */
function safeEqual(a, b) {
  var ba = Buffer.from(String(a));
  var bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba); // keep timing roughly constant, then fail
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  bookingReference: bookingReference,
  parseISODate: parseISODate,
  toISODate: toISODate,
  todayUTC: todayUTC,
  nightsBetween: nightsBetween,
  rangesOverlap: rangesOverlap,
  money: money,
  cleanStr: cleanStr,
  isEmail: isEmail,
  safeEqual: safeEqual
};
