"use strict";

/**
 * POST /api/nlb-callback
 * Server-to-server confirmation from NLB (if the merchant profile sends one).
 * Verifies the signature, confirms the booking idempotently, and returns a
 * plain-text ack. This is independent of the browser return, so a booking is
 * confirmed even if the customer closes the tab after paying.
 *
 * @NLB-OFFICIAL: adjust the accepted fields / ack body to NLB's spec.
 */

var http = require("./lib/http");
var nlb = require("./lib/nlb");
var bookingLib = require("./lib/booking");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return { statusCode: 405, body: "method_not_allowed" };
  }

  try {
    var params = Object.assign({}, event.queryStringParameters || {}, http.parseBody(event));
    var r = nlb.parseAndVerifyReturn(params);
    var ref = String(params.reference || params.orderId || "").trim();

    if (!ref) return { statusCode: 400, body: "missing_reference" };
    if (!r.signatureValid) {
      console.error("nlb-callback: bad signature for", ref);
      return { statusCode: 400, body: "bad_signature" };
    }

    if (r.result === "success") {
      var conf = await bookingLib.confirmPaidBooking(ref, {
        method: "nlb",
        providerRef: params.transactionId || params.tranId || ref,
        amount: r.demo ? null : r.amount,
        currency: r.demo ? null : r.currency
      });
      // Idempotent + safe responses; never leak internals to the bank.
      return { statusCode: 200, body: conf.ok ? "OK" : "CONFLICT" };
    }
    return { statusCode: 200, body: "OK" };
  } catch (e) {
    console.error("nlb-callback error", e && e.message);
    return { statusCode: 500, body: "error" };
  }
};
