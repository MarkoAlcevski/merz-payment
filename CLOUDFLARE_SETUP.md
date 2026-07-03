# Cloudflare Pages setup for merz-payment

This patch does not change the existing frontend, Supabase logic, PayPal logic, NLB logic, admin logic, or Netlify functions. It only adds a Cloudflare Pages adapter so `/api/*` calls can run on Cloudflare.

## What to do

1. Copy these files/folders into the root of the existing repo:
   - `functions/api/[[path]].js`
   - `wrangler.toml`
   - `_headers`
   - `_redirects`

2. Commit and push to GitHub.

3. In Cloudflare Pages, set:
   - Framework preset: None
   - Build command: leave empty or `echo "Static site"`
   - Build output directory: `.`

4. Add the same environment variables in Cloudflare Pages → Settings → Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_ENVIRONMENT`
   - `PAYPAL_CURRENCY`
   - `NLB_MODE`
   - `NLB_MERCHANT_ID`
   - `NLB_TERMINAL_ID`
   - `NLB_SECRET_KEY`
   - `NLB_PAYMENT_URL`
   - `NLB_SUCCESS_URL`
   - `NLB_FAILURE_URL`
   - `NLB_CANCEL_URL`
   - `NLB_CALLBACK_URL`
   - `NLB_CURRENCY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `OWNER_EMAIL`
   - `SITE_URL`
   - `ALLOWED_ORIGINS`

5. Redeploy after saving env vars.

## Quick test

Open:

```text
https://your-cloudflare-site.pages.dev/api/settings
```

Then test admin login with the exact `ADMIN_PASSWORD` value.

## Important note

The original Netlify scheduled function `expire-holds` is exposed at `/api/expire-holds`, but Cloudflare Pages does not use the Netlify cron line from `netlify.toml`. If you need automatic scheduled cleanup exactly like Netlify, set up a Cloudflare Cron Trigger/Worker later to call `/api/expire-holds` every 5 minutes.
