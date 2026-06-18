-- ============================================================
--  Merdz Sky Wellness — booking system database schema
--  Target: Supabase / PostgreSQL
--
--  HOW TO RUN:
--    1. Create a Supabase project (https://supabase.com).
--    2. Open: SQL Editor → New query.
--    3. Paste this entire file and click "Run".
--    4. Copy Project URL + service_role key into Netlify env vars
--       (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
--
--  Re-running is safe: it uses IF NOT EXISTS / ON CONFLICT guards.
-- ============================================================

-- Needed for the no-overlap exclusion constraint on date ranges.
create extension if not exists btree_gist;

-- ------------------------------------------------------------
--  Settings (single editable row, id = 1)
-- ------------------------------------------------------------
create table if not exists booking_settings (
  id                   integer primary key default 1,
  price_per_night      numeric(10,2) not null default 80.00,
  cleaning_fee         numeric(10,2) not null default 20.00,
  additional_fees      numeric(10,2) not null default 0.00,
  currency             text          not null default 'EUR',
  maximum_guests       integer       not null default 4,
  minimum_nights       integer       not null default 1,
  hold_duration_minutes integer      not null default 15,
  updated_at           timestamptz   not null default now(),
  constraint booking_settings_singleton check (id = 1)
);

insert into booking_settings (id) values (1)
on conflict (id) do nothing;

-- ------------------------------------------------------------
--  Bookings
-- ------------------------------------------------------------
-- payment_status:  pending | awaiting_payment | paid | payment_failed | refunded
-- booking_status:  pending | awaiting_payment | confirmed | paid | cancelled | expired | refunded
create table if not exists bookings (
  id                        uuid primary key default gen_random_uuid(),
  public_booking_reference  text unique not null,
  guest_name                text not null,
  guest_email               text not null,
  guest_phone               text,
  guest_country             text,
  adults                    integer not null default 1,
  children                  integer not null default 0,
  check_in                  date not null,
  check_out                 date not null,
  number_of_nights          integer not null,
  price_per_night           numeric(10,2) not null,
  cleaning_fee              numeric(10,2) not null default 0,
  additional_fees           numeric(10,2) not null default 0,
  total_amount              numeric(10,2) not null,
  currency                  text not null default 'EUR',
  payment_method            text,                    -- paypal | nlb | offline
  payment_provider_reference text,                   -- PayPal order/capture id or NLB ref
  payment_status            text not null default 'pending',
  booking_status            text not null default 'pending',
  special_requests          text,
  hold_expires_at           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint bookings_dates_valid check (check_out > check_in),
  constraint bookings_guests_valid check (adults >= 1 and children >= 0)
);

-- Hard guarantee: two CONFIRMED/PAID bookings can never overlap.
-- (Active holds — awaiting_payment — are enforced in application logic,
--  considering hold_expires_at, so expired holds never block new dates.)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap'
  ) then
    alter table bookings
      add constraint bookings_no_overlap
      exclude using gist (
        daterange(check_in, check_out, '[)') with &&
      ) where (booking_status in ('confirmed','paid'));
  end if;
end $$;

create index if not exists bookings_check_in_idx       on bookings (check_in);
create index if not exists bookings_check_out_idx      on bookings (check_out);
create index if not exists bookings_status_idx         on bookings (booking_status);
create index if not exists bookings_hold_idx           on bookings (hold_expires_at);
create index if not exists bookings_reference_idx      on bookings (public_booking_reference);
create index if not exists bookings_email_idx          on bookings (lower(guest_email));

-- ------------------------------------------------------------
--  Manually blocked date ranges (owner blocks dates in admin)
-- ------------------------------------------------------------
create table if not exists blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  date_from  date not null,
  date_to    date not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint blocked_dates_valid check (date_to > date_from)
);
create index if not exists blocked_dates_from_idx on blocked_dates (date_from);
create index if not exists blocked_dates_to_idx   on blocked_dates (date_to);

-- ------------------------------------------------------------
--  updated_at maintenance
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_bookings_updated on bookings;
create trigger trg_bookings_updated
  before update on bookings
  for each row execute function set_updated_at();

drop trigger if exists trg_settings_updated on booking_settings;
create trigger trg_settings_updated
  before update on booking_settings
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
--  Row Level Security
-- ------------------------------------------------------------
-- RLS is ON for all tables and NO public policies are created, so the
-- public/anon key can read NOTHING. The Netlify Functions connect with
-- the service_role key, which BYPASSES RLS. This keeps all reservation
-- data private and only reachable through the server-side API.
alter table bookings        enable row level security;
alter table blocked_dates   enable row level security;
alter table booking_settings enable row level security;

-- (Intentionally no anon/authenticated policies. Add narrowly-scoped
--  policies here only if you later expose a public read use-case.)
