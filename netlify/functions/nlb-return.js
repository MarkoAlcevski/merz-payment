"use strict";

/**
 * GET/POST /api/nlb-return
 * Browser return from the bank (or the simulated demo). Verifies the
 * signature + amount server-side, confirms the booking, then 302-redirects
 * the visitor to a friendly result page. A redirect alone NEVER confirms a
 * booking — confirmation only happens after server-side verification here.
 */

var http = require("./lib/http");
var store = require("./lib/store");
var nlb = require("./lib/nlb");
var cfg = require("./lib/config");
var bookingLib = require("./lib/booking");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return http.preflight(event);

  var params = Object.assign({}, event.queryStringParameters || {}, http.parseBody(event));
  var site = cfg.siteUrl();
  var ref = String(params.reference || params.orderId || params.ref || "").trim();

  function resultPage(result) {
    var url = (site || "") + "/booking-result.html?provider=nlb&result=" + encodeURIComponent(result) +
      "&ref=" + encodeURIComponent(ref);
    return http.redirect(event, url);
  }

  try {
    var r = nlb.parseAndVerifyReturn(params);

    if (r.result !== "success") {
      var b0 = ref ? await store.getBookingByRef(ref) : null;
      if (b0 && b0.booking_status === "awaiting_payment") {
        await store.updateBooking(b0.id, {
          booking_status: r.result === "cancel" ? "cancelled" : "payment_failed",
          payment_status: "payment_failed"
        }).catch(function () {});
      }
      return resultPage(r.result);
    }

    // Success path must verify the signature (live). Placeholder demo HMAC
    // is valid by construction; a real NLB signature requires wiring the
    // official algorithm in lib/nlb.js before live success is accepted.
    if (!r.signatureValid) {
      console.error("nlb-return: signature verification failed for", ref);
      return resultPage("failure");
    }

    var conf = await bookingLib.confirmPaidBooking(ref, {
      method: "nlb",
      providerRef: params.transactionId || params.tranId || ref,
      amount: r.demo ? null : r.amount,
      currency: r.demo ? null : r.currency
    });

    if (!conf.ok && conf.reason === "conflict") return resultPage("conflict");
    if (!conf.ok && conf.reason === "mismatch") return resultPage("failure");
    return resultPage("success");
  } catch (e) {
    console.error("nlb-return error", e && e.message);
    return resultPage("failure");
  }
};
