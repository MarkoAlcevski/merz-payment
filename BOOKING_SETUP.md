# Merdz Sky Wellness — Booking & Payment System

This document explains the booking/payment system added to the existing
website, how to deploy it on Netlify, and exactly what is production-ready
versus what needs official credentials.

> **Honesty up front.** Out of the box this project runs in **demo mode** —
> the full flow works, but bookings live in an in-memory store, and PayPal /
> NLB / email are **simulated** and clearly labelled. Nothing charges a card
> or sends real email until you add the corresponding credentials.
> **PayPal Live and real NLB card payments are NOT active** until valid
> merchant credentials and (for NLB) the official integration spec are
> supplied — see sections 10–13 and 19.

---

## 1. What was added

- A native **Reserve** section on the site (`#reserve`) with a 3-step flow:
  dates + guests → guest details → review & pay. It reuses the site's design
  tokens, fonts, buttons and animations, and is fully bilingual (EN/MK).
- An elegant **availability calendar** (range picker) that greys out
  unavailable nights, prevents past dates and enforces minimum stay.
- A **Netlify Functions** backend (`/api/*`) for availability, price
  calculation, holds, bookings, PayPal, NLB and admin.
- **PayPal** (official Checkout v2) and an **NLB Banka** adapter.
- A **Supabase/PostgreSQL** schema with a no-double-booking guarantee.
- An **admin panel** at `/admin.html` (login, dashboard, reservations,
  manual bookings, blocking dates, mark-as-paid, cancel, CSV export,
  editable settings).
- A **payment-result page** at `/booking-result.html`.
- **Email confirmations** (Resend) for guest + owner.
- Docs (`BOOKING_SETUP.md`), `.env.example`, SQL migration, `netlify.toml`.

Nothing in the existing site (hero, about, bedrooms, spa, gallery, location,
transport, Sky Wellness partnership content, images, language switch, sliders,
lightbox, sticky CTA, WhatsApp transport form) was removed or redesigned. The
header "Book Now" buttons and a new "Reserve" nav link point to `#reserve`;
the original Airbnb/Booking.com CTA section is kept as-is.

## 2. Project structure

```
index.html                     existing site + new #reserve section + links
admin.html                     admin panel (standalone)
booking-result.html            payment result / verification page
assets/
  booking.css                  reserve widget styles (uses site tokens)
  booking.js                   reserve widget logic (calendar, steps, pay)
  admin.js                     admin panel logic
  images/...                   unchanged
db/schema.sql                  Supabase/PostgreSQL setup
netlify.toml                   redirects, headers, scheduled function
package.json                   functions dependency (@supabase/supabase-js)
.env.example                   every environment variable, documented
netlify/functions/
  lib/                         shared modules (config, store, pricing,
                               paypal, nlb, email, auth, http, util,
                               ratelimit, booking)
  settings.js                  GET public config
  availability.js              POST availability + price; GET unavailable ranges
  create-booking.js            create hold (server-side price recalculation)
  booking-status.js            public-safe status for the result page
  paypal-create-order.js       PayPal order (server-side)
  paypal-capture-order.js      PayPal capture + verify + confirm (idempotent)
  nlb-initiate.js              build bank redirect / demo redirect
  nlb-return.js                browser return -> verify -> confirm -> redirect
  nlb-callback.js              server-to-server confirmation (idempotent)
  admin-login.js               password -> signed token
  admin.js                     authenticated admin API (list/update/etc.)
  expire-holds.js              scheduled: release expired holds (every 5 min)
```

## 3. How the booking flow works

1. **Stay details** — guest picks dates on the calendar and adult/children
   counts. The widget calls `POST /api/availability`, which validates the
   stay and returns a **server-calculated** price.
2. **Guest details** — name, email, phone, country, special requests, and a
   required terms/privacy/cancellation/payment acceptance checkbox. Validated
   on the client and again on the server.
3. **Review & pay** — `POST /api/create-booking` re-validates everything,
   **recomputes the price server-side**, re-checks availability, and creates
   an `awaiting_payment` booking with a temporary **hold**. The guest pays via
   PayPal (inline) or NLB (redirect). Confirmation only happens after
   server-side verification.

The browser-submitted total is **never trusted** — every price is recomputed
from `booking_settings` on the server.

## 4. How availability works

`findActiveOverlap()` checks the requested half-open range `[check_in, check_out)`
against:
- bookings with status `confirmed` or `paid` (always block), and
- `awaiting_payment` bookings whose **hold has not expired** (temporary block), and
- admin **blocked_dates** ranges.

The calendar greys out unavailable nights (fetched from `GET /api/availability`),
but the **authoritative** check is server-side on create/capture — disabled
calendar dates are only a convenience.

## 5. How temporary date holds work

When a booking is created it gets `booking_status = awaiting_payment` and
`hold_expires_at = now + hold_duration_minutes` (default 15). While the hold
is active those dates are blocked for everyone else. If payment is not
completed, the scheduled function `expire-holds` (every 5 minutes) flips the
booking to `expired`, freeing the dates. The widget also shows a live
countdown and resets if the hold lapses.

**Double-booking guarantee:** the database has an `EXCLUDE` constraint that
makes it *impossible* for two `confirmed`/`paid` bookings to overlap. If two
people race to pay the same dates, the second confirmation fails and is marked
`payment_failed` (and flagged for refund) — see `lib/booking.js`.

## 6. Deploy on Netlify

1. Put this whole folder in a Git repo (GitHub/GitLab) **or** drag-and-drop
   the folder in the Netlify UI.
2. New site → connect the repo (or drop the folder).
3. Build settings are read from `netlify.toml`:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
   - No build command needed (static site). Netlify installs the function
     dependency automatically from `package.json`.
4. Deploy. The site works **immediately in demo mode** with no env vars.
5. Add environment variables (section 9) to switch subsystems to live, then
   redeploy (or "Clear cache and deploy").

`/api/*` is redirected to the functions automatically. Scheduled hold expiry
is configured in `netlify.toml`.

## 7. Create and connect Supabase

1. Create a project at https://supabase.com.
2. **SQL Editor → New query** → paste `db/schema.sql` → **Run**.
3. **Project settings → API** → copy:
   - `Project URL` → Netlify env `SUPABASE_URL`
   - `service_role` secret key → Netlify env `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy. The app now stores data in Supabase (durable, multi-user).

Without these two variables the app uses an in-memory demo store that is
**not persistent** and not shared across Netlify containers — fine for a quick
trial, not for real bookings.

## 8. Which SQL file to run

`db/schema.sql` — creates `booking_settings`, `bookings`, `blocked_dates`,
indexes, the `updated_at` triggers, the no-overlap exclusion constraint, and
enables RLS (so only the server-side service key can read/write).

## 9. Environment variables

See `.env.example` for the annotated list. Summary:

| Variable | Purpose | Needed for |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database | Real persistence |
| `ADMIN_PASSWORD` | Admin login | Real admin (else password is `demo`) |
| `ADMIN_SESSION_SECRET` | Token signing | Recommended for production |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal | Real PayPal |
| `PAYPAL_ENVIRONMENT` | `sandbox`/`live` | PayPal |
| `PAYPAL_CURRENCY` | Default `EUR` | PayPal |
| `NLB_MODE` | `test`/`live` | NLB |
| `NLB_MERCHANT_ID`, `NLB_TERMINAL_ID`, `NLB_SECRET_KEY`, `NLB_PAYMENT_URL`, `NLB_*_URL` | NLB gateway | Real NLB |
| `NLB_CURRENCY` | Default `EUR` | NLB |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL` | Email | Real emails |
| `SITE_URL` | Build return URLs | Recommended |
| `ALLOWED_ORIGINS` | Extra CORS origins | Only if cross-domain |

Never put secrets in frontend files. Only `PAYPAL_CLIENT_ID` (public by
design) is sent to the browser.

## 10. Configure PayPal Sandbox

1. https://developer.paypal.com → Dashboard → **Apps & Credentials** →
   **Sandbox** → create an app.
2. Copy **Client ID** and **Secret** into `PAYPAL_CLIENT_ID` /
   `PAYPAL_CLIENT_SECRET`. Set `PAYPAL_ENVIRONMENT=sandbox`.
3. Redeploy. The reserve widget loads the PayPal SDK and shows real PayPal
   buttons. Pay with a sandbox buyer account. Capture is verified server-side
   (status `COMPLETED`, amount + currency must match the booking) before the
   booking is confirmed.

## 11. Switch PayPal to Live

1. Create a **Live** app in the PayPal dashboard, copy its Client ID/Secret.
2. Set `PAYPAL_ENVIRONMENT=live` and the live credentials. Redeploy.
3. Test one real low-value booking end-to-end. ✅ Live PayPal is only active
   once live credentials are present — never before.

## 12. What NLB Banka requires (honest status)

The NLB integration is **architecturally complete** but **cannot process real
cards until you provide official merchant details**, because the exact request
fields and the signature/MAC algorithm are defined by NLB's merchant kit and
must not be guessed. You need:

- an approved **NLB e-commerce merchant account**;
- **Merchant ID** (and Terminal/Store ID if required);
- the **secret/signing key**;
- the **test and production gateway URLs**;
- the official **request, signature and callback parameter** specification.

Until then, `NLB_MODE=test` runs a clearly-labelled simulated bank redirect so
the whole flow (initiate → return → confirm) can be tested.

## 13. Where NLB merchant parameters go

`netlify/functions/lib/nlb.js`, at the three markers:

- **`@NLB-OFFICIAL (1/3)` — `signRequest()`**: replace with NLB's exact
  signature algorithm and field order.
- **`@NLB-OFFICIAL (2/3)` — `verifyReturnSignature()` / `signReturn()`**:
  recompute over the exact fields NLB signs in its response.
- **`@NLB-OFFICIAL (3/3)` — request `fields` in `buildPaymentRequest()`**:
  rename to the exact field names from the merchant kit.

Also set the `NLB_*` env vars (section 9). `nlb-callback.js` may need its ack
body adjusted to what NLB expects. No undocumented production parameters are
invented anywhere.

## 14. How demo mode works

Each subsystem auto-detects missing credentials and falls back to a labelled
simulation:
- **DB** → in-memory store (per-container, non-persistent).
- **PayPal** → a "PayPal · DEMO" button that simulates a successful capture.
- **NLB** → a simulated bank redirect that returns success via `nlb-return`.
- **Email** → not sent; payload logged and returned for inspection.
- **Admin** → password is `demo`.

`GET /api/settings` returns a `demo` object; the widget shows a demo banner and
the result page shows a "DEMO — simulated payment" tag. Demo never looks like a
real processed bank transaction.

## 15. Access and secure the admin panel

- Open `/admin.html`. In demo mode the password is **`demo`**.
- Set `ADMIN_PASSWORD` (and ideally a long random `ADMIN_SESSION_SECRET`) in
  Netlify for real protection. The password is checked server-side; only a
  signed, expiring token (8h) is stored in the browser (sessionStorage). The
  password is never in frontend code.
- `admin.html` is marked `noindex` and `no-store`. For extra protection you
  can add Netlify password protection / Identity in front of it.

## 16. Configure email confirmations

1. Create an account at https://resend.com, verify your sending domain, get an
   API key.
2. Set `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Merdz Sky Wellness
   <bookings@yourdomain.com>`), and `OWNER_EMAIL` (where you receive copies).
3. Redeploy. On confirmed payment the guest gets a reference + stay summary,
   and the owner gets a copy. Without a key, emails are skipped (logged only).

## 17. How to change pricing

Either edit in the **admin panel → Settings** (price per night, cleaning fee,
additional fees, currency, max guests, minimum nights, hold duration), or
change the row in the `booking_settings` table. Defaults (used in demo / before
first edit): €80/night, €20 cleaning, max 4 guests, 1-night minimum, 15-minute
hold. Defaults live in `netlify/functions/lib/config.js` (`DEFAULTS`).

## 18. How to test the complete system

Locally (optional): install the Netlify CLI (`npm i -g netlify-cli`), run
`netlify dev` from this folder, open the printed URL. Or just deploy to a
Netlify preview. Then:

1. Open the site → **Reserve**. Confirm the calendar blocks past dates.
2. Pick a valid range → verify nights + price appear.
3. Try an invalid range (checkout before checkin, below min stay, >max guests)
   → friendly inline messages.
4. Continue → fill guest details → submit (creates a hold; countdown shows).
5. Pay with **PayPal (demo)** → success state + reference. Or pick **NLB** →
   simulated redirect → result page shows confirmed.
6. Open `/admin.html` (password `demo`) → see the booking, mark/cancel, block
   dates, edit settings, export CSV.
7. Re-try the same dates in a second tab → blocked (no double booking).
8. With Supabase connected, repeat to confirm persistence and the DB overlap
   constraint.

## 19. What is NOT production-ready until credentials are provided

- **Real money via PayPal** — needs live PayPal credentials (`PAYPAL_*`,
  `PAYPAL_ENVIRONMENT=live`).
- **Real card payments via NLB** — needs an approved NLB merchant account and
  the official integration spec wired at the `@NLB-OFFICIAL` markers
  (`lib/nlb.js`) plus the `NLB_*` env vars.
- **Durable, multi-user data** — needs Supabase (`SUPABASE_*`). The demo store
  is per-container and non-persistent.
- **Real emails** — need `RESEND_API_KEY` + a verified domain.
- **Secure admin** — set `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`.

The code is structured so each of these is a credentials/redeploy step, not a
rewrite.

## 20. Security recommendations before going live

- Set `ADMIN_PASSWORD` and a strong random `ADMIN_SESSION_SECRET`; consider
  Netlify-level protection on `/admin.html`.
- Connect Supabase so the DB exclusion constraint enforces no double bookings.
- Keep all secrets in Netlify env vars; never commit a filled `.env`.
- Verify the deployed CSP/headers in `netlify.toml` (they allow the inline
  site code and PayPal; tighten by externalising inline JS/CSS if desired).
- Test PayPal in **sandbox** before switching to live; do one small live test.
- Do not store card data (this project never does — cards are entered on
  PayPal/NLB pages, not on this site).
- Review rate limits in `lib/ratelimit.js` (best-effort, per-container).
- Confirm payment is always verified server-side (it is) — never trust a
  success redirect alone.

---

### Notes for the developer

- All money math is recomputed server-side in `lib/pricing.js`.
- Confirmation is idempotent (`lib/booking.js`) so duplicate PayPal/NLB
  callbacks don't double-process or double-email.
- Reservation references are cryptographically generated (`lib/util.js`).
- This project was written without a local Node runtime available, so the
  function code was hand-reviewed rather than executed locally; the **frontend
  (calendar, validation, steps, price preview, language switch, responsive
  layout)** was tested in a browser with the API mocked. Run `netlify dev` or a
  Netlify preview to exercise the live functions before launch.
