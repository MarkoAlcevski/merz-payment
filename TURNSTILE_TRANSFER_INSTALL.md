# Merdz Turnstile Transfer Fix

This patch fixes the previous Turnstile issue and changes the second CAPTCHA location:

- ✅ Launch CAPTCHA when the website opens.
- ✅ Second CAPTCHA before **Request a Transfer** / driver notification.
- ✅ No second CAPTCHA before booking/payment.
- ✅ Netlify support now.
- ✅ PHP helper files included for future Zemi/cPanel migration.

## Why this patch exists

The public GitHub `main` branch currently has the Airport Transfer section in `index.html`, but no dedicated transfer/SMS Netlify function in `main`. This patch therefore does two things:

1. Protects the visible transfer form/button/link in the browser.
2. Injects `turnstileToken` into any transfer/SMS/driver API request using names like:
   - `/api/request-transfer`
   - `/api/transfer-request`
   - `/api/transfer`
   - `/api/transport`
   - `/api/send-driver-sms`
   - any `/api/*transfer*`, `/api/*transport*`, `/api/*driver*`, `/api/*sms*`, `/api/*twilio*`

If your local/private branch has a transfer/SMS Netlify function, the patch script will try to auto-add server-side verification to it.

## Install

Copy everything inside `merz-turnstile-transfer-fix/` into your repo root.

Then run:

```bash
node scripts/fix-turnstile-transfer.js
```

Commit and push:

```bash
git add .
git commit -m "Fix Turnstile for launch and transfer requests"
git push
```

Then redeploy Netlify.

## Netlify environment variables

In Netlify, set:

```env
TURNSTILE_SITE_KEY=your_cloudflare_site_key
TURNSTILE_SECRET_KEY=your_cloudflare_secret_key
TURNSTILE_ENABLED=true
```

Keep your existing booking/payment/admin variables as they are.

## Cloudflare hostname

In Cloudflare Turnstile, make sure the widget allows your exact Netlify hostname, for example:

```text
your-site.netlify.app
```

Do not include `https://`.

## Test

Open the Netlify site in Incognito.

1. Open website → launch Turnstile should appear.
2. Complete it.
3. Go to Airport Transfer.
4. Click/send the transfer request → second Turnstile should appear.
5. Booking flow should NOT show a second Turnstile before payment.

To force the launch CAPTCHA again in the same browser:

```js
sessionStorage.removeItem("MERDZ_TURNSTILE_LAUNCH_OK");
location.reload();
```

## Backend protection for driver SMS endpoints

If the patch script finds a transfer/SMS Netlify function, it attempts to add:

```js
const turnstile = require("./lib/turnstile");

const turnstileCheck = await turnstile.verifyBody(body, event, { action: "transfer" });
if (!turnstileCheck.success) return turnstile.errorResponse(turnstileCheck);
delete body.turnstileToken;
delete body.cfTurnstileToken;
delete body["cf-turnstile-response"];
```

If your function uses unusual parsing and the script cannot auto-patch it, it writes:

```text
.turnstile-transfer-manual-snippet.txt
```

Paste that snippet after your transfer request JSON body is parsed and before any SMS/driver message is sent.

## Important

The frontend gate blocks normal users/bots from clicking the transfer request repeatedly. The strongest protection is backend verification inside the actual SMS-sending function, because direct API abuse must be blocked server-side.

This patch includes the backend helper and auto-patcher. If no SMS function exists in the current branch yet, add the helper snippet when you create that function.
