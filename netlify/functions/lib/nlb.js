"use strict";

/**
 * ============================================================
 *  NLB Banka card-gateway adapter
 * ============================================================
 *  WHAT IS COMPLETE
 *    - Full booking → payment → return/callback → confirmation flow.
 *    - Server-side amount/currency/reference verification.
 *    - Duplicate-processing protection (handled by the calling function
 *      via idempotent booking status transitions).
 *    - Clearly-labelled TEST mode that simulates the bank redirect so the
 *      entire flow can be exercised end-to-end before going live.
 *
 *  WHAT REQUIRES OFFICIAL NLB DOCUMENTATION (not invented here)
 *    - The EXACT request field names the gateway expects.
 *    - The EXACT signature/MAC algorithm and the order of fields used to
 *      build it (commonly SHA-256 / HMAC / 3DES-MAC per the merchant kit).
 *    - The EXACT success / failure / callback parameter names returned.
 *
 *  >>> PLUG OFFICIAL VALUES IN AT THE THREE @NLB-OFFICIAL MARKERS BELOW. <<<
 *  Do NOT guess production parameters — use the merchant integration PDF
 *  that NLB provides once your e-commerce account is approved.
 * ============================================================
 */

var crypto = require("crypto");
var cfg = require("./config");

function isLive() {
  return cfg.hasNLB(); // NLB_MODE=live AND merchant id/secret/url present
}

/**
 * @NLB-OFFICIAL (1/3) — SIGNATURE GENERATION
 * Replace the body of this function with the exact algorithm and field
 * order from the NLB merchant kit. The placeholder below is an HMAC-SHA256
 * over a deterministic field concatenation — structurally correct, but the
 * field set/order/encoding MUST match NLB's specification to be accepted.
 */
function signRequest(fields, secret) {
  var ordered = ["merchantId", "terminalId", "orderId", "amount", "currency"]
    .map(function (k) { return fields[k] != null ? String(fields[k]) : ""; })
    .join("|");
  return crypto.createHmac("sha256", secret || "demo-secret").update(ordered).digest("hex").toUpperCase();
}

/**
 * @NLB-OFFICIAL (2/3) — RETURN/CALLBACK SIGNATURE VERIFICATION
 * Recompute the signature over the EXACT fields NLB signs in its response
 * and compare. Until the official spec is wired, in TEST mode we verify our
 * own demo HMAC so the simulated flow is still tamper-checked.
 */
function verifyReturnSignature(params, secret) {
  var expected = signReturn(params, secret);
  var got = String(params.signature || params.sig || "");
  if (!expected || !got) return false;
  try {
    var a = Buffer.from(expected), b = Buffer.from(got);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

function signReturn(params, secret) {
  var ordered = ["orderId", "reference", "amount", "currency", "result"]
    .map(function (k) { return params[k] != null ? String(params[k]) : ""; })
    .join("|");
  return crypto.createHmac("sha256", secret || "demo-secret").update(ordered).digest("hex").toUpperCase();
}

/**
 * Build everything the frontend needs to send the customer to the bank.
 *
 * LIVE  -> returns { live:true, actionUrl, fields } so the frontend can
 *          auto-POST a form to the NLB gateway.
 * TEST  -> returns { live:false, redirectUrl } pointing at a simulated bank
 *          result that round-trips through /api/nlb-return (clearly demo).
 */
function buildPaymentRequest(booking, settings, urls) {
  var amount = Number(booking.total_amount).toFixed(2);
  var currency = booking.currency || cfg.env("NLB_CURRENCY", "EUR");
  var orderId = booking.public_booking_reference;

  if (isLive()) {
    /**
     * @NLB-OFFICIAL (3/3) — REQUEST FIELDS
     * Replace the field NAMES below with the exact names from the NLB kit
     * (e.g. AmountToPay, Currency, ClientId, ReturnURL, ...). Keep amounts,
     * currency and orderId server-derived. Do NOT trust client values.
     */
    var fields = {
      merchantId: cfg.env("NLB_MERCHANT_ID"),
      terminalId: cfg.env("NLB_TERMINAL_ID"),
      orderId: orderId,
      amount: amount,
      currency: currency,
      successUrl: cfg.env("NLB_SUCCESS_URL", urls.success),
      failureUrl: cfg.env("NLB_FAILURE_URL", urls.failure),
      cancelUrl: cfg.env("NLB_CANCEL_URL", urls.cancel),
      callbackUrl: cfg.env("NLB_CALLBACK_URL", urls.callback)
    };
    fields.signature = signRequest(fields, cfg.env("NLB_SECRET_KEY"));
    return { live: true, actionUrl: cfg.env("NLB_PAYMENT_URL"), fields: fields };
  }

  // ---- TEST / DEMO: simulate the bank's success redirect (no real charge) ----
  var demoParams = {
    orderId: orderId,
    reference: orderId,
    amount: amount,
    currency: currency,
    result: "success",
    demo: "1"
  };
  demoParams.signature = signReturn(demoParams, cfg.env("NLB_SECRET_KEY"));
  var qs = Object.keys(demoParams).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(demoParams[k]);
  }).join("&");
  return { live: false, redirectUrl: (urls.returnApi || "/api/nlb-return") + "?" + qs };
}

/** Normalize + verify a return/callback from the bank (or the demo). */
function parseAndVerifyReturn(params) {
  var result = String(params.result || params.status || "").toLowerCase();
  var normalized = ["success", "failure", "cancel"].indexOf(result) !== -1 ? result : "failure";
  return {
    result: normalized,
    reference: params.reference || params.orderId || "",
    amount: params.amount != null ? Number(params.amount) : null,
    currency: params.currency || cfg.env("NLB_CURRENCY", "EUR"),
    demo: params.demo === "1" || params.demo === 1 || !isLive(),
    signatureValid: verifyReturnSignature(params, cfg.env("NLB_SECRET_KEY"))
  };
}

module.exports = {
  isLive: isLive,
  buildPaymentRequest: buildPaymentRequest,
  parseAndVerifyReturn: parseAndVerifyReturn,
  signReturn: signReturn,
  verifyReturnSignature: verifyReturnSignature
};
