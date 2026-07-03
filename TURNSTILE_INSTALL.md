# Merdz Cloudflare Turnstile overlay

This overlay adds professional Cloudflare Turnstile anti-bot protection to the current **Netlify** app and includes the matching **PHP/cPanel** files for the later Zemi.mk migration.

It protects two places:

1. **Website launch gate** — visitor completes Turnstile before the booking calendar/API loads.
2. **Reservation creation** — a fresh Turnstile token is required before `/api/create-booking` can create a booking hold.

The booking protection is server-side enforced. A bot cannot create a reservation by skipping the frontend widget.

---

## 1) Create Turnstile keys

In Cloudflare:

1. Go to **Turnstile**.
2. Create a new widget.
3. Add the hostname you will use tomorrow, for example:
   - your Netlify deploy domain, e.g. `something.netlify.app`
   - the final client domain later, e.g. `clientdomain.mk`
   - `www.clientdomain.mk` if the site will use `www`
4. Copy:
   - **Site key**
   - **Secret key**

For tomorrow's meeting on Netlify, use the Netlify deploy domain as an allowed hostname.

---

## 2) Install into the current Netlify repo

Unzip this overlay into the root of the repo, so the new files land in:

```text
assets/turnstile.css
assets/turnstile.js
netlify/functions/lib/turnstile.js
netlify/functions/turnstile-config.js
netlify/functions/turnstile-verify.js
scripts/apply-turnstile-patch.js
php/api/...
```

Then run from the repo root:

```bash
node scripts/apply-turnstile-patch.js
```

The patch script updates:

- `index.html` — adds Turnstile CSS/JS.
- `netlify/functions/create-booking.js` — verifies Turnstile server-side before creating a booking.
- `netlify.toml` — allows Cloudflare Turnstile in the CSP.
- `.env.example` — documents the new env vars.

---

## 3) Add Netlify environment variables

In Netlify → Site configuration → Environment variables, add:

```env
TURNSTILE_SITE_KEY=your_cloudflare_site_key
TURNSTILE_SECRET_KEY=your_cloudflare_secret_key
TURNSTILE_ENABLED=true
```

Then redeploy the site.

If `TURNSTILE_SITE_KEY` is not set, the frontend safely disables Turnstile. If the site key is set but the secret key is missing, reservation creation will be blocked, because server verification cannot happen.

---

## 4) Test checklist before the meeting

Test this exact flow:

1. Open the Netlify site in a private/incognito window.
2. You should see the first Turnstile check before entering the site.
3. Complete it.
4. Go to **Reserve**.
5. Select available dates.
6. Fill guest details.
7. Click **Continue to payment**.
8. You should see the second Turnstile check.
9. Complete it.
10. The booking hold should be created and the payment step should open.

Also test bot protection:

- Open DevTools → Network.
- Try calling `/api/create-booking` without `turnstileToken`.
- It should return `403` with `turnstile_required`.

---

## 5) Future Zemi.mk / cPanel PHP migration

The overlay also includes PHP files:

```text
php/api/lib/turnstile.php
php/api/turnstile-config.php
php/api/turnstile-verify.php
php/api/create-booking.turnstile-snippet.php
```

When you later rewrite the backend to PHP/MySQL, copy these into the PHP API folder and add this check at the top of the PHP create-booking endpoint:

```php
require_once __DIR__ . '/lib/turnstile.php';

$body = merdz_request_json();
merdz_turnstile_verify_body_or_exit($body, 'booking');
```

The existing `assets/turnstile.js` already supports both clean Netlify URLs and PHP URLs:

```text
/api/turnstile-config
/api/turnstile-config.php
/api/turnstile-verify
/api/turnstile-verify.php
/api/create-booking
/api/create-booking.php
```

So the frontend can stay the same during the later cPanel migration.

---

## Client-safe explanation

You can tell the client:

> The booking website is protected with Cloudflare Turnstile. Visitors pass a lightweight security check at website entry, and a second server-verified check is required before a reservation can be created. This helps prevent automated spam reservations and bot abuse without annoying users with old-school CAPTCHA puzzles.
