#!/usr/bin/env node
/* ============================================================
   Merdz Turnstile Transfer Fix
   - Loads Turnstile CSS/JS in index.html
   - Removes previous create-booking Turnstile enforcement if present
   - Adds Cloudflare CSP allowances
   - Attempts to patch existing transfer/SMS Netlify functions if present
   ============================================================ */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const report = [];

function p(...parts) { return path.join(root, ...parts); }
function exists(file) { return fs.existsSync(file); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content); }
function log(msg) { console.log(msg); report.push(msg); }
function warn(msg) { console.warn(msg); report.push("WARN: " + msg); }

function patchIndex() {
  const file = p("index.html");
  if (!exists(file)) return warn("index.html not found");

  let html = read(file);
  let changed = false;

  if (!html.includes("/assets/turnstile.css") && !html.includes("assets/turnstile.css")) {
    const cssTag = '  <link rel="stylesheet" href="/assets/turnstile.css">\n';
    if (html.includes("</head>")) {
      html = html.replace("</head>", cssTag + "</head>");
      changed = true;
    } else if (html.includes("/assets/booking.css")) {
      html = html.replace(/(<link[^>]+assets\/booking\.css[^>]*>)/, "$1\n" + cssTag.trim());
      changed = true;
    } else {
      warn("Could not find </head> to insert Turnstile CSS");
    }
  }

  if (!html.includes("/assets/turnstile.js") && !html.includes("assets/turnstile.js")) {
    const jsTag = '  <script src="/assets/turnstile.js" defer></script>\n';
    if (html.match(/<script[^>]+assets\/booking\.js[^>]*>/)) {
      html = html.replace(/(<script[^>]+assets\/booking\.js[^>]*>)/, jsTag + "$1");
      changed = true;
    } else if (html.includes("</body>")) {
      html = html.replace("</body>", jsTag + "</body>");
      changed = true;
    } else {
      html += "\n" + jsTag;
      changed = true;
    }
  }

  if (changed) {
    write(file, html);
    log("✓ index.html now loads Turnstile CSS/JS");
  } else {
    log("✓ index.html already loads Turnstile CSS/JS");
  }
}

function patchNetlifyToml() {
  const file = p("netlify.toml");
  if (!exists(file)) {
    const content = `[[redirects]]
from = "/api/*"
to = "/.netlify/functions/:splat"
status = 200

[[headers]]
for = "/*"
  [headers.values]
  Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com; frame-src 'self' https://challenges.cloudflare.com https://www.paypal.com; connect-src 'self' https://challenges.cloudflare.com https://www.paypal.com https://api-m.sandbox.paypal.com https://api-m.paypal.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
`;
    write(file, content);
    log("✓ netlify.toml created with API redirect + Turnstile CSP");
    return;
  }

  let toml = read(file);
  let changed = false;

  if (!toml.includes("from = \"/api/*\"") && !toml.includes("from=\"/api/*\"")) {
    toml += `

[[redirects]]
from = "/api/*"
to = "/.netlify/functions/:splat"
status = 200
`;
    changed = true;
  }

  const cf = "https://challenges.cloudflare.com";
  if (!toml.includes(cf)) {
    if (/Content-Security-Policy\s*=\s*"[^"]*"/s.test(toml)) {
      toml = toml.replace(/Content-Security-Policy\s*=\s*"([^"]*)"/s, (m, policy) => {
        const ensure = (directive, value) => {
          const re = new RegExp(`(${directive}[^;]*)`);
          if (re.test(policy)) {
            policy = policy.replace(re, (d) => d.includes(value) ? d : d + " " + value);
          } else {
            policy += `; ${directive} ${value}`;
          }
        };
        ensure("script-src", cf);
        ensure("frame-src", cf);
        ensure("connect-src", cf);
        return `Content-Security-Policy = "${policy}"`;
      });
      changed = true;
    } else {
      toml += `

[[headers]]
for = "/*"
  [headers.values]
  Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com; frame-src 'self' https://challenges.cloudflare.com https://www.paypal.com; connect-src 'self' https://challenges.cloudflare.com https://www.paypal.com https://api-m.sandbox.paypal.com https://api-m.paypal.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
`;
      changed = true;
    }
  }

  if (changed) {
    write(file, toml);
    log("✓ netlify.toml patched for API redirect/CSP");
  } else {
    log("✓ netlify.toml already allows Turnstile");
  }
}

function stripCreateBookingTurnstile() {
  const file = p("netlify", "functions", "create-booking.js");
  if (!exists(file)) return;
  let s = read(file);
  const before = s;

  // Remove marker blocks from earlier overlay versions.
  s = s.replace(/\n?\s*\/\/\s*MERDZ TURNSTILE CREATE[_ -]?BOOKING START[\s\S]*?\/\/\s*MERDZ TURNSTILE CREATE[_ -]?BOOKING END\s*\n?/gi, "\n");
  s = s.replace(/\n?\s*\/\/\s*TURNSTILE CREATE[_ -]?BOOKING START[\s\S]*?\/\/\s*TURNSTILE CREATE[_ -]?BOOKING END\s*\n?/gi, "\n");

  // Remove common helper import if create-booking no longer needs it.
  s = s.replace(/^\s*(const|let|var)\s+turnstile\s*=\s*require\(["']\.\/lib\/turnstile["']\);\s*\n/gm, "");

  // Remove common verification snippets injected after parsing body.
  s = s.replace(/\n\s*const\s+turnstile(Check|Result)\s*=\s*await\s+turnstile\.verifyBody\([\s\S]*?\);\s*\n\s*if\s*\(!turnstile\1\.success\)\s*return\s+turnstile\.errorResponse\(turnstile\1\);\s*/g, "\n");
  s = s.replace(/\n\s*const\s+turnstile(Check|Result)\s*=\s*await\s+turnstile\.verifyToken\([\s\S]*?\);\s*\n\s*if\s*\(!turnstile\1\.success\)\s*return\s+turnstile\.errorResponse\(turnstile\1\);\s*/g, "\n");

  if (s !== before) {
    write(file, s);
    log("✓ removed previous create-booking/payment CAPTCHA enforcement");
  } else if (/turnstile/i.test(s)) {
    warn("create-booking.js still mentions Turnstile; review it if booking is still blocked");
  } else {
    log("✓ create-booking.js has no Turnstile/payment gate");
  }
}

function listTransferFunctionFiles() {
  const dir = p("netlify", "functions");
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /\.js$/.test(name))
    .filter(name => !/^turnstile-/i.test(name))
    .filter(name => /transfer|transport|driver|sms|twilio/i.test(name))
    .map(name => path.join(dir, name));
}

function patchTransferFunction(file) {
  let s = read(file);
  const before = s;
  const rel = path.relative(root, file);

  if (/turnstile\.verifyBody|turnstile\.verifyToken/.test(s)) {
    log(`✓ ${rel} already verifies Turnstile`);
    return;
  }

  if (!s.includes("./lib/turnstile") && !s.includes("./turnstile")) {
    s = `const turnstile = require("./lib/turnstile");\n` + s;
  }

  const lines = s.split(/\r?\n/);
  let inserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/\b(?:const|let|var)\s+(\w+)\s*=\s*JSON\.parse\((?:event\.body|[^)]*event\.body[^)]*)\)/);
    if (m) {
      const bodyVar = m[1];
      const indent = (line.match(/^\s*/) || [""])[0];
      const snippet = [
        `${indent}const turnstileCheck = await turnstile.verifyBody(${bodyVar}, event, { action: "transfer" });`,
        `${indent}if (!turnstileCheck.success) return turnstile.errorResponse(turnstileCheck);`,
        `${indent}delete ${bodyVar}.turnstileToken;`,
        `${indent}delete ${bodyVar}.cfTurnstileToken;`,
        `${indent}delete ${bodyVar}["cf-turnstile-response"];`
      ];
      lines.splice(i + 1, 0, ...snippet);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    fs.writeFileSync(p(".turnstile-transfer-manual-snippet.txt"), `Paste this after parsing JSON in ${rel}:\n\nconst turnstileCheck = await turnstile.verifyBody(body, event, { action: "transfer" });\nif (!turnstileCheck.success) return turnstile.errorResponse(turnstileCheck);\ndelete body.turnstileToken;\ndelete body.cfTurnstileToken;\ndelete body["cf-turnstile-response"];\n`);
    warn(`${rel}: could not auto-insert backend verification. Wrote .turnstile-transfer-manual-snippet.txt`);
    return;
  }

  s = lines.join("\n");
  if (s !== before) {
    write(file, s);
    log(`✓ patched ${rel} with server-side transfer Turnstile verification`);
  }
}

function patchTransferFunctions() {
  const files = listTransferFunctionFiles();
  if (!files.length) {
    warn("No transfer/SMS Netlify function found in this repo branch. Frontend transfer gate + token injection are installed. If you add a SMS function later, paste the helper snippet from TURNSTILE_TRANSFER_INSTALL.md.");
    return;
  }
  files.forEach(patchTransferFunction);
}

function patchEnvExample() {
  const file = p(".env.example");
  let s = exists(file) ? read(file) : "";
  let changed = false;
  const vars = [
    "TURNSTILE_SITE_KEY=",
    "TURNSTILE_SECRET_KEY=",
    "TURNSTILE_ENABLED=true"
  ];
  vars.forEach(v => {
    const key = v.split("=")[0];
    if (!new RegExp(`^${key}=`, "m").test(s)) {
      s += (s.endsWith("\n") || !s ? "" : "\n") + v + "\n";
      changed = true;
    }
  });
  if (changed) {
    write(file, s);
    log("✓ .env.example updated with Turnstile variables");
  }
}

patchIndex();
patchNetlifyToml();
stripCreateBookingTurnstile();
patchTransferFunctions();
patchEnvExample();

fs.writeFileSync(p(".turnstile-transfer-patch-report.txt"), report.join("\n") + "\n");
console.log("\nDone. Report written to .turnstile-transfer-patch-report.txt");
