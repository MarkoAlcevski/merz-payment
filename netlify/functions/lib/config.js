"use strict";

/**
 * Central runtime configuration & demo-mode detection.
 * Each subsystem (DB, PayPal, NLB, email, admin) reports whether it is
 * running "live" (credentials present) or in clearly-labelled demo mode.
 */

function env(name, fallback) {
  var v = process.env[name];
  return v === undefined || v === null || v === "" ? fallback : v;
}

var DEFAULTS = {
  price_per_night: 80,
  cleaning_fee: 20,
  additional_fees: 0,
  currency: env("PAYPAL_CURRENCY", env("NLB_CURRENCY", "EUR")),
  maximum_guests: 4,
  minimum_nights: 1,
  hold_duration_minutes: 15
};

function hasSupabase() {
  return !!(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
}
function hasPayPal() {
  return !!(env("PAYPAL_CLIENT_ID") && env("PAYPAL_CLIENT_SECRET"));
}
function hasNLB() {
  return (
    env("NLB_MODE", "test") === "live" &&
    !!(env("NLB_MERCHANT_ID") && env("NLB_SECRET_KEY") && env("NLB_PAYMENT_URL"))
  );
}
function hasResend() {
  return !!env("RESEND_API_KEY");
}
function hasAdminPassword() {
  return !!env("ADMIN_PASSWORD");
}

function siteUrl() {
  var u = env("SITE_URL") || env("URL") || env("DEPLOY_PRIME_URL") || env("DEPLOY_URL") || "";
  return String(u).replace(/\/$/, "");
}

function demoFlags() {
  return {
    database: !hasSupabase(),
    paypal: !hasPayPal(),
    nlb: !hasNLB(),
    email: !hasResend(),
    admin: !hasAdminPassword()
  };
}

module.exports = {
  env: env,
  DEFAULTS: DEFAULTS,
  hasSupabase: hasSupabase,
  hasPayPal: hasPayPal,
  hasNLB: hasNLB,
  hasResend: hasResend,
  hasAdminPassword: hasAdminPassword,
  siteUrl: siteUrl,
  demoFlags: demoFlags
};
