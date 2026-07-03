#!/usr/bin/env node
"use strict";

/**
 * Applies Cloudflare Turnstile integration to the current Merdz Netlify app.
 * Run from repository root after copying/unzipping this overlay:
 *   node scripts/apply-turnstile-patch.js
 */

var fs = require("fs");
var path = require("path");

function file(p) {
  return path.join(process.cwd(), p);
}

function exists(p) {
  return fs.existsSync(file(p));
}

function read(p) {
  return fs.readFileSync(file(p), "utf8");
}

function write(p, value) {
  fs.writeFileSync(file(p), value);
}

function patchIndex() {
  var p = "index.html";
  if (!exists(p)) throw new Error("index.html not found. Run this from the repo root.");

  var html = read(p);
  var css = '<link rel="stylesheet" href="/assets/turnstile.css">';
  var js = '<script src="/assets/turnstile.js" defer></script>';

  if (!html.includes("assets/turnstile.css")) {
    if (/<link[^>]+assets\/booking\.css[^>]*>/i.test(html)) {
      html = html.replace(/(<link[^>]+assets\/booking\.css[^>]*>)/i, "$1\n  " + css);
    } else {
      html = html.replace(/<\/head>/i, "  " + css + "\n</head>");
    }
  }

  if (!html.includes("assets/turnstile.js")) {
    // Load before booking.js so the fetch wrapper is active before the booking widget calls /api/availability.
    if (/<script[^>]+assets\/booking\.js[^>]*><\/script>/i.test(html)) {
      html = html.replace(/(<script[^>]+assets\/booking\.js[^>]*><\/script>)/i, js + "\n  $1");
    } else {
      html = html.replace(/<\/body>/i, "  " + js + "\n</body>");
    }
  }

  write(p, html);
  console.log("✓ index.html includes Turnstile CSS/JS");
}

function patchCreateBooking() {
  var p = "netlify/functions/create-booking.js";
  if (!exists(p)) throw new Error(p + " not found.");

  var src = read(p);

  if (!src.includes('require("./lib/turnstile")') && !src.includes("require('./lib/turnstile')")) {
    var before = 'var ratelimit = require("./lib/ratelimit");';
    if (!src.includes(before)) {
      throw new Error("Could not locate ratelimit require in create-booking.js. Patch manually using TURNSTILE_INSTALL.md.");
    }
    src = src.replace(before, before + ' var turnstile = require("./lib/turnstile");');
  }

  if (!src.includes("turnstile.verifyBody")) {
    var target = 'var body = http.parseBody(event); var settings = await store.getSettings();';
    var replacement = 'var body = http.parseBody(event); var turnstileCheck = await turnstile.verifyBody(event, body, "booking"); if (!turnstileCheck.ok) { return http.json(event, 403, { error: "turnstile_required", message: "Please complete the security check before creating a reservation.", reason: turnstileCheck.reason || "failed" }); } var settings = await store.getSettings();';
    if (!src.includes(target)) {
      throw new Error("Could not locate body/settings line in create-booking.js. Patch manually using TURNSTILE_INSTALL.md.");
    }
    src = src.replace(target, replacement);
  }

  write(p, src);
  console.log("✓ netlify/functions/create-booking.js verifies Turnstile server-side");
}

function addHostToDirective(csp, directive, host) {
  var re = new RegExp("(" + directive.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s+)([^;\"]*)");
  return csp.replace(re, function (m, prefix, value) {
    if (value.indexOf(host) !== -1) return m;
    return prefix + value.trim() + " " + host;
  });
}

function patchNetlifyToml() {
  var p = "netlify.toml";
  if (!exists(p)) {
    console.log("! netlify.toml not found; skipped CSP patch");
    return;
  }

  var src = read(p);
  if (src.indexOf("Content-Security-Policy") === -1) {
    console.log("! Content-Security-Policy not found in netlify.toml; skipped CSP patch");
    return;
  }

  var host = "https://challenges.cloudflare.com";
  src = addHostToDirective(src, "script-src", host);
  src = addHostToDirective(src, "frame-src", host);
  src = addHostToDirective(src, "connect-src", host);

  write(p, src);
  console.log("✓ netlify.toml CSP allows Cloudflare Turnstile");
}

function patchEnvExample() {
  var p = ".env.example";
  if (!exists(p)) {
    console.log("! .env.example not found; skipped env documentation patch");
    return;
  }

  var src = read(p);
  if (src.includes("TURNSTILE_SITE_KEY")) {
    console.log("✓ .env.example already documents Turnstile");
    return;
  }

  src += '\n\n# ------------------------------------------------------------\n' +
    '# Cloudflare Turnstile CAPTCHA / anti-bot protection\n' +
    '# ------------------------------------------------------------\n' +
    '# Create a free Turnstile widget in Cloudflare and add your Netlify\n' +
    '# preview/domain hostname plus the future production domain.\n' +
    'TURNSTILE_SITE_KEY=\n' +
    'TURNSTILE_SECRET_KEY=\n' +
    '# Optional. Auto-enabled when TURNSTILE_SITE_KEY exists. Set false to disable temporarily.\n' +
    'TURNSTILE_ENABLED=true\n';

  write(p, src);
  console.log("✓ .env.example documents Turnstile env vars");
}

function main() {
  patchIndex();
  patchCreateBooking();
  patchNetlifyToml();
  patchEnvExample();
  console.log("\nDone. Add TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Netlify, then deploy.");
}

try {
  main();
} catch (e) {
  console.error("\nTurnstile patch failed:", e.message);
  process.exit(1);
}
