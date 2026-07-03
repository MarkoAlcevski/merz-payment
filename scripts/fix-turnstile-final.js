#!/usr/bin/env node
/*
  Final Merdz Turnstile patch.
  Fixes the actual issue seen on Netlify:
  - index.html was not loading turnstile.css/js
  - netlify.toml CSP did not allow Cloudflare Turnstile
  - old booking captcha logic is replaced by launch + transfer protection
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function ok(msg) { console.log('✓ ' + msg); }

function patchIndex() {
  if (!exists('index.html')) fail('index.html not found. Run this from the repo root.');
  let html = read('index.html');

  // Remove any duplicate/old Turnstile references first.
  html = html
    .replace(/\s*<link\s+[^>]*href=["']\/?assets\/turnstile\.css["'][^>]*>\s*/gi, '\n')
    .replace(/\s*<script\s+[^>]*src=["']\/?assets\/turnstile\.js["'][^>]*><\/script>\s*/gi, '\n');

  const cssTag = '<link rel="stylesheet" href="assets/turnstile.css">';
  const jsTag = '<script src="assets/turnstile.js" defer></script>';

  if (/href=["']assets\/booking\.css["']/i.test(html)) {
    html = html.replace(/(<link\s+[^>]*href=["']assets\/booking\.css["'][^>]*>)/i, `$1\n${cssTag}`);
  } else if (/href=["']\/assets\/booking\.css["']/i.test(html)) {
    html = html.replace(/(<link\s+[^>]*href=["']\/assets\/booking\.css["'][^>]*>)/i, `$1\n<link rel="stylesheet" href="/assets/turnstile.css">`);
  } else if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `  ${cssTag}\n</head>`);
  } else {
    fail('Could not find </head> in index.html');
  }

  // Load before booking.js when possible, so availability waits for launch gate.
  if (/src=["']assets\/booking\.js["']/i.test(html)) {
    html = html.replace(/(<script\s+[^>]*src=["']assets\/booking\.js["'][^>]*><\/script>)/i, `${jsTag}\n$1`);
  } else if (/src=["']\/assets\/booking\.js["']/i.test(html)) {
    html = html.replace(/(<script\s+[^>]*src=["']\/assets\/booking\.js["'][^>]*><\/script>)/i, `<script src="/assets/turnstile.js" defer></script>\n$1`);
  } else if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `  ${jsTag}\n</body>`);
  } else {
    fail('Could not find booking.js or </body> in index.html');
  }

  write('index.html', html);
  ok('index.html now loads Turnstile CSS/JS');
}

function patchToml() {
  if (!exists('netlify.toml')) {
    write('netlify.toml', `
[build]
  publish = "."
  functions = "netlify/functions"
  command = "echo 'Static site - no build step required'"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com https://www.sandbox.paypal.com https://www.sandbox.paypalobjects.com; frame-src 'self' https://challenges.cloudflare.com https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com https://maps.google.com; connect-src 'self' https://challenges.cloudflare.com https://api.callmebot.com https://www.paypal.com https://www.sandbox.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.paypalobjects.com https://www.sandbox.paypalobjects.com; form-action 'self' https:; base-uri 'self'; object-src 'none'"
`);
    ok('netlify.toml created with Turnstile CSP');
    return;
  }

  let toml = read('netlify.toml');

  if (!toml.includes('/api/*')) {
    toml += `\n[[redirects]]\n  from = "/api/*"\n  to = "/.netlify/functions/:splat"\n  status = 200\n  force = true\n`;
  }

  if (!/Content-Security-Policy\s*=/.test(toml)) {
    toml += `\n[[headers]]\n  for = "/*"\n  [headers.values]\n    Content-Security-Policy = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com https://www.sandbox.paypal.com https://www.sandbox.paypalobjects.com; frame-src 'self' https://challenges.cloudflare.com https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com https://maps.google.com; connect-src 'self' https://challenges.cloudflare.com https://api.callmebot.com https://www.paypal.com https://www.sandbox.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.paypalobjects.com https://www.sandbox.paypalobjects.com; form-action 'self' https:; base-uri 'self'; object-src 'none'"\n`;
  } else {
    toml = toml.replace(/Content-Security-Policy\s*=\s*"([^"]*)"/g, (m, csp) => {
      const ensure = (directive, value) => {
        const re = new RegExp(`${directive}([^;]*)`, 'i');
        if (re.test(csp)) {
          csp = csp.replace(re, (dm) => dm.includes(value) ? dm : `${dm} ${value}`);
        } else {
          csp += `; ${directive} 'self' ${value}`;
        }
      };
      ensure('script-src', 'https://challenges.cloudflare.com');
      ensure('frame-src', 'https://challenges.cloudflare.com');
      ensure('connect-src', 'https://challenges.cloudflare.com');
      return `Content-Security-Policy = "${csp}"`;
    });
  }

  write('netlify.toml', toml);
  ok('netlify.toml CSP allows Cloudflare Turnstile');
}

function patchEnvExample() {
  if (!exists('.env.example')) return;
  let env = read('.env.example');
  const block = `\n# Cloudflare Turnstile anti-spam\nTURNSTILE_SITE_KEY=\nTURNSTILE_SECRET_KEY=\nTURNSTILE_ENABLED=true\n`;
  if (!env.includes('TURNSTILE_SITE_KEY')) {
    env += block;
    write('.env.example', env);
    ok('.env.example documented Turnstile variables');
  }
}

function warnIfCreateBookingWasPatched() {
  const p = 'netlify/functions/create-booking.js';
  if (!exists(p)) return;
  const s = read(p);
  if (/turnstile/i.test(s) && /create-booking|booking/i.test(s)) {
    console.warn('! Warning: create-booking.js still contains Turnstile text. If an old patch added booking CAPTCHA, remove that block because this final version protects transfer, not booking/payment.');
  }
}

patchIndex();
patchToml();
patchEnvExample();
warnIfCreateBookingWasPatched();

console.log('\nDone. Commit + push, then redeploy Netlify.');
