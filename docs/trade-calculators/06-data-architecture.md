# 06 — MVP Data Architecture

**Recommendation: Supabase (managed Postgres + Auth + Storage + Edge Functions).**

Why, for this specific product: Postgres row-level security means the multi-tenant
isolation rules live in the database rather than in application code, which is the right
place for them when the same data is reached by a web client today and a native client
later. Auth, file storage (receipt photos, generated PDFs) and serverless functions come in
one bill at a price that works against £4.99/month. The escape hatch matters too — it is
plain Postgres, so nothing here is locked to the vendor.

**The rule that makes the native wrap cheap: no business logic in the client.** The client
renders; `@trade/engine` calculates; Postgres stores and enforces. A future React Native
app re-implements only the render layer.

---

## Schema

### Reference data (global, read-only to users)

```sql
create table trades (
  id            text primary key,              -- 'decorator', 'plumber', 'landscaper'
  name          text not null,                 -- 'The Decorator's Pricing Calculator'
  status        text not null default 'draft', -- draft | beta | live
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create table trade_packs (
  id            uuid primary key default gen_random_uuid(),
  trade_id      text not null references trades(id),
  version       text not null,                 -- semver '1.4.0'
  spec_version  int  not null,                 -- engine compatibility
  definition    jsonb not null,                -- the whole pack (see doc 02)
  status        text not null default 'draft', -- draft | staged | published | retired
  published_at  timestamptz,
  unique (trade_id, version)
);
create index on trade_packs (trade_id, status);

-- Material catalogue and a time-series of prices. Never overwrite a price: insert a new
-- row. A quote references a price-list date, so historic quotes reprice identically.
create table materials (
  sku           text primary key,              -- 'paint.emulsion.matt.trade'
  trade_id      text references trades(id),    -- null = shared across trades
  name          text not null,
  unit          text not null,                 -- 'L' | 'm2' | 'each' | 'tonne' | 'bag'
  pack_sizes    jsonb not null default '[]',   -- [{size:5,unit:'L'},{size:2.5,unit:'L'}]
  volatility    text not null default 'low',   -- low | medium | high  → price buffer
  attributes    jsonb not null default '{}'    -- coverage, density, weight per unit
);

create table material_prices (
  id            bigserial primary key,
  sku           text not null references materials(sku),
  region        text not null default 'GB',    -- 'GB','GB-LON','GB-SCT'
  pack_size     numeric not null,
  price_pence   int  not null,                 -- integer pence, always
  source        text not null,                 -- 'curated' | 'feed:<supplier>' | 'user'
  effective_from date not null,
  effective_to   date
);
create index on material_prices (sku, region, effective_from desc);

-- Regional labour-rate benchmarks: onboarding defaults and the "you're 20% under your
-- area" nudge. Seeded from published data, refined later from anonymised app usage.
create table labour_benchmarks (
  trade_id      text not null references trades(id),
  region        text not null,
  percentile    int  not null,                 -- 25 | 50 | 75
  hourly_pence  int  not null,
  day_rate_pence int,
  effective_from date not null,
  primary key (trade_id, region, percentile, effective_from)
);
```

### Tenant data

```sql
-- One row per signed-up user, 1:1 with auth.users.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  business_id   uuid not null references businesses(id),
  full_name     text,
  phone         text,
  role          text not null default 'owner', -- owner | member  (multi-user, phase 3)
  created_at    timestamptz not null default now()
);

-- The tenant boundary. Everything below is scoped to business_id — a sole trader is a
-- business of one. Introducing this on day one costs nothing and saves a brutal
-- migration when the first two-person firm signs up.
create table businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  trading_name  text,
  address       jsonb,
  logo_path     text,                          -- Storage path; PDFs are unbranded by default
  vat_registered boolean not null default false,
  vat_number    text,
  registrations jsonb not null default '{}',   -- {gas_safe:'123456', g3:'...', part_p:'...'}
  region        text not null default 'GB',
  created_at    timestamptz not null default now()
);

-- Pricing settings: one row per business per trade. A user can hold two trades
-- (decorator + landscaper is a common pairing) with different rates for each.
create table pricing_settings (
  business_id       uuid not null references businesses(id) on delete cascade,
  trade_id          text not null references trades(id),
  labour_cost_pence int  not null,             -- cost of an hour of work
  target_margin     numeric(4,3) not null default 0.250,
  material_pricing  text not null default 'margin', -- 'margin' | 'markup'
  material_markup   numeric(4,3) not null default 0.200,
  annual_overheads_pence bigint not null default 800000,
  days_per_year     int not null default 220,
  chargeable_hours_per_day numeric(3,1) not null default 6.0,
  min_job_pence     int not null default 15000,
  travel_pence_per_mile int not null default 45,
  free_travel_miles int not null default 10,
  contingency_stance text not null default 'balanced', -- tight | balanced | cautious
  rate_overrides    jsonb not null default '{}',-- {task_id: hours_per_unit}
  updated_at        timestamptz not null default now(),
  primary key (business_id, trade_id)
);
-- Derived, never stored: overhead_rate = annual_overheads / (days_per_year * hours_per_day)

create table clients (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  name          text not null,
  email         text, phone text,
  address       jsonb,
  is_commercial boolean not null default false,-- drives ex-VAT vs inc-VAT presentation
  notes         text,
  created_at    timestamptz not null default now()
);
create index on clients (business_id);

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  client_id     uuid references clients(id) on delete set null,
  trade_id      text not null references trades(id),
  title         text not null,
  site_address  jsonb,
  status        text not null default 'lead',  -- lead|quoted|won|lost|in_progress|complete
  won_at timestamptz, lost_reason text,
  created_at    timestamptz not null default now()
);
create index on jobs (business_id, status);
```

### Quotes — the money tables

```sql
create table quotes (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,
  reference     text not null,                 -- 'Q-2026-0042', per business
  current_version int not null default 1,
  status        text not null default 'draft', -- draft|sent|accepted|declined|expired
  sent_at timestamptz, accepted_at timestamptz, valid_until date,
  created_at    timestamptz not null default now(),
  unique (business_id, reference)
);

-- A quote version is IMMUTABLE once sent. Revising creates a new version. This is the
-- single most important design decision in the schema: a client holding a PDF must be
-- able to have it match the record exactly, months later.
create table quote_versions (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  version       int not null,

  -- Full reproducibility: inputs + the exact pack + the exact prices + the exact settings
  pack_id       uuid not null references trade_packs(id),
  pack_version  text not null,
  price_list_date date not null,
  answers       jsonb not null,                -- raw user answers
  settings_snapshot jsonb not null,            -- pricing_settings AT CALCULATION TIME
  engine_version text not null,

  -- Outputs
  calc_output   jsonb not null,                -- full engine result, every stage
  subtotal_pence int not null,
  vat_pence     int not null default 0,
  total_pence   int not null,
  total_hours   numeric(6,2) not null,
  achieved_margin numeric(5,4) not null,
  estimated_days numeric(4,1),

  pdf_path      text,                          -- Storage path once generated
  created_at    timestamptz not null default now(),
  unique (quote_id, version)
);

-- Denormalised line items. calc_output already contains everything, but flat rows make
-- reporting cheap ("what do I earn per hour on bathrooms?") without unpacking jsonb.
create table quote_lines (
  id              bigserial primary key,
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  sort_order      int not null,
  group_name      text not null,               -- 'Preparation','Walls','Materials'
  kind            text not null,               -- labour|material|plant|disposal|subcontract|extra
  source_id       text,                        -- task/material id from the pack
  description     text not null,               -- client-facing wording
  quantity        numeric(10,3), unit text,
  hours           numeric(8,2),
  cost_pence      int not null,                -- internal
  price_pence     int not null,                -- client-facing
  is_optional     boolean not null default false,
  is_excluded     boolean not null default false
);
create index on quote_lines (quote_version_id);

-- Tokenised public share links for WhatsApp/SMS. Never expose a quote id publicly.
create table quote_shares (
  token         text primary key default encode(gen_random_bytes(16),'hex'),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  expires_at    timestamptz not null default now() + interval '60 days',
  revoked       boolean not null default false,
  view_count    int not null default 0,
  first_viewed_at timestamptz, last_viewed_at timestamptz
);
```

`quote_shares.first_viewed_at` is a small field with outsized value: "your client opened
this quote 3 times" is a genuinely useful nudge to follow up, and follow-up is where trades
win work. It is also a strong retention hook for £4.99/month.

### Receipts and job costing — the feedback loop

```sql
create table receipts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  job_id        uuid references jobs(id) on delete set null,
  supplier      text,
  category      text not null,                 -- materials|fuel|plant_hire|disposal|subcontract|tools|other
  amount_pence  int not null,
  vat_pence     int,
  purchased_on  date not null,
  image_path    text,                          -- Storage; OCR fields land here later
  ocr_status    text default 'none',           -- none|pending|done|failed
  ocr_data      jsonb,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on receipts (business_id, purchased_on desc);
create index on receipts (job_id);

-- Actual hours worked. Quoted vs actual is the whole point.
create table job_time (
  id            bigserial primary key,
  job_id        uuid not null references jobs(id) on delete cascade,
  worked_on     date not null,
  hours         numeric(5,2) not null,
  worker_id     uuid references profiles(id),
  notes         text
);
```

This closes the loop the product is really selling. `quote_versions.total_hours` vs
`sum(job_time.hours)`, and `calc_output` material cost vs `sum(receipts.amount_pence)`,
give a per-job variance. Aggregated across a trade it tells the app that "poor wall
condition" jobs actually run 22% over, not the 15% the pack assumes — a data asset a
competitor cannot copy from the outside, and the justification for a subscription rather
than a one-off sale.

### Billing and telemetry

```sql
create table subscriptions (
  business_id   uuid primary key references businesses(id) on delete cascade,
  stripe_customer_id text, stripe_subscription_id text,
  status        text not null default 'trialing', -- trialing|active|past_due|canceled
  plan          text not null default 'solo',
  trial_ends_at timestamptz, current_period_end timestamptz,
  quotes_used_this_period int not null default 0
);

create table events (                            -- product analytics, not a money table
  id bigserial primary key,
  business_id uuid, user_id uuid,
  name text not null, properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

---

## Row-level security

Every tenant table gets the same shape. Written once as a helper, applied uniformly:

```sql
create or replace function current_business_id() returns uuid
language sql stable security definer as $$
  select business_id from profiles where id = auth.uid()
$$;

alter table quotes enable row level security;
create policy tenant_rw on quotes
  using      (business_id = current_business_id())
  with check (business_id = current_business_id());
```

- Child tables (`quote_versions`, `quote_lines`) check via their parent's `business_id` with
  an `exists` sub-select, or carry a denormalised `business_id` for index-friendly policies.
  **Prefer the denormalised column** — RLS sub-selects on hot paths are a known performance
  trap, and the redundancy is guarded by a trigger.
- Reference tables (`trades`, `trade_packs`, `materials`, `material_prices`,
  `labour_benchmarks`) are `select`-only to `authenticated`, writable only by the service
  role. Unpublished packs are filtered by a `status = 'published'` policy.
- Storage buckets: `receipts` and `quote-pdfs` are private, pathed
  `{business_id}/{...}`, with a storage policy matching the first path segment against
  `current_business_id()`. Client-facing PDFs are served through **signed URLs with a TTL**,
  never a public bucket.
- The public share view (`/q/{token}`) is served by an **edge function using the service
  role**, which resolves the token, checks expiry and revocation, increments the view count
  and returns a redacted payload. The anonymous role gets no direct table access at all.

---

## Where the calculation runs

```
packages/engine     pure TS, zero deps  — the pipeline in doc 01
packages/packs      pack JSON + validator + golden fixtures
apps/web            React/Next PWA — renders, never calculates
supabase/functions  recalculate · generate-pdf · public-quote · stripe-webhook
```

- **Client-side on every keystroke.** Instant feedback, works with no signal. This is the
  UX the product lives on.
- **Server-side authoritatively on send.** The `recalculate` edge function re-runs the
  identical engine against server-held packs, prices and settings, and the result — not the
  client's — is what gets written to `quote_versions`. The client cannot invent a price, an
  entitlement or a pack version. Any divergence beyond a penny is logged as a defect.
- Both import the same package. A parity test asserts identical output across runtimes.

**Money is integer pence everywhere.** Never float, never `numeric` in application code.
`price_pence int`, one rounding point, at Stage 10.

---

## Offline and sync

A tradesperson quotes in a garden, a loft, a basement. **Offline is a requirement, not a
nicety.**

- Packs, the user's settings and a regional price list are cached in IndexedDB on login and
  refreshed opportunistically. A quote can be created and priced fully offline.
- Writes go to a local outbox queue with client-generated UUIDs (so ids are stable across
  sync) and replay on reconnect.
- **Conflict rule: last-write-wins per quote *draft*, because a draft has one author.**
  Sent versions are immutable and therefore cannot conflict — which is another reason for
  the version-immutability design.
- If cached prices are older than 14 days the quote screen shows a "prices may have moved"
  banner and offers a refresh; the PDF is not blocked, because a slightly stale quote in the
  client's hand beats no quote.
- PDF generation runs client-side (`pdf-lib` / `react-pdf`) so it works offline, with the
  edge function as the canonical generator for the shared link and for the stored copy.

## Path to native

Everything above is chosen so the native step is additive, not a rewrite.

1. **Now — PWA.** Installable, offline, Web Share API for the WhatsApp handoff. No app
   store, no review cycle, no 30% cut. This is a competitive advantage for this audience,
   not a compromise.
2. **Later — Capacitor wrap.** Same web bundle, native shell, store presence, push
   notifications, native camera and share sheet. Weeks, not months, *provided* every
   platform capability sits behind an adapter interface from day one:
   `Storage`, `Camera`, `Share`, `FileSave`, `Print`, `Notifications`. Never call
   `navigator.share` or `localStorage` directly from a component.
3. **If ever needed — React Native.** The engine package and the Supabase API are already
   platform-agnostic; only the render layer is rewritten. The API is designed as if a
   native client already existed: no logic behind an HTML form, no session state that isn't
   a token.

Design constraints that keep option 2 and 3 open: no server-rendered-only routes for core
flows, no cookie-dependent auth (JWT in secure storage), no reliance on browser-only file
handling in the calculate→PDF→share path.

## Indexing and scale

At MVP volumes (thousands of businesses, tens of quotes each) Postgres is not the
constraint. The indexes above cover every listing path. Two watch-items:

- `quote_versions.calc_output` jsonb grows to a few KB per version; fine at MVP, but do not
  `select *` on list screens — the quote list reads `quotes` joined to a narrow projection.
- `material_prices` is append-only and will be the largest table once feeds are live. Add a
  covering index on `(sku, region, effective_from desc)` and, later, partition by year.
