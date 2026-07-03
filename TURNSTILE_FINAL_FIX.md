# Merdz Turnstile Final Fix

This fixes the actual deployed issue:

- `index.html` was not loading `assets/turnstile.js` / `assets/turnstile.css`.
- `netlify.toml` CSP did not allow `https://challenges.cloudflare.com`.
- The old Turnstile JS still targeted booking/payment; this version targets launch + airport transfer.

## Install

Copy everything inside this folder into the repo root, then run:

```bash
node scripts/fix-turnstile-final.js
```

Commit and push:

```bash
git add .
git commit -m "Fix Turnstile launch and transfer protection"
git push
```

Then redeploy Netlify.

## Netlify env vars

```env
TURNSTILE_SITE_KEY=your_cloudflare_site_key
TURNSTILE_SECRET_KEY=your_cloudflare_secret_key
TURNSTILE_ENABLED=true
```

## Cloudflare hostnames

Add the Netlify hostname exactly, for example:

```text
animated-starlight-ac9b13.netlify.app
```

No `https://`, no path.

## Expected behavior

1. Open site in Incognito: launch Turnstile appears.
2. Complete it: site unlocks.
3. Booking flow: no second CAPTCHA.
4. Airport Transfer > Send request: second Turnstile appears before WhatsApp/SMS/transfer action.

## Force retest

In browser console:

```js
sessionStorage.removeItem('MERDZ_TURNSTILE_LAUNCH_OK');
sessionStorage.removeItem('MERDZ_TURNSTILE_TRANSFER_OK_AT');
location.reload();
```
