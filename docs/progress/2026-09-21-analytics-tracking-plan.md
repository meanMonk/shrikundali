# Analytics & Attribution Plan (from Claude web discussion, 2026-09-21)

Source: https://claude.ai/share/511c3b16-f9b4-4a69-bf6d-cba73597bf3d

Context: launching financial Kundali report with a ₹10,000 INR total budget (domain ~₹2,000,
rest on Google/Meta ads for the first week). Goal: recover ₹10,000 within 5 days before
reinvesting more aggressively. This doc captures the analytics/attribution decisions from
that discussion so the team can act on them in the next 4 days.

## Stack decisions

- **GA4**: set up. Needed so Google Ads can import Purchase as a conversion and optimize
  toward it (not just clicks/landing views).
- **Meta Pixel + Conversions API**: set up both. Fire the purchase event **server-side** from
  the Razorpay webhook — browser-only events get dropped by ad blockers and UPI app-switching.
- **Microsoft Clarity** (free): session recordings + heatmaps. Fastest way to see where people
  drop off the form or at the paywall.
- **Skip PostHog for week one.** More to maintain than needed right now; revisit post-launch.
- **Our own DB is the source of truth**, not GA/Meta dashboards. Every order stores UTM,
  `gclid`, `fbclid`. Razorpay-backed table is what we trust; ad-platform numbers will be off.

## Event taxonomy (same names frontend + backend)

```
landing_view
form_started
form_field_error        (props: field)
preview_generated
paywall_viewed
tier_selected            (props: tier)
checkout_clicked
payment_success          (backend only)
payment_failed           (backend only, props: reason)
report_requested         (backend)
report_generated         (backend, props: duration_ms, cost_inr)
report_failed            (backend, props: error)
report_delivered
report_downloaded
refund_issued
```

Also capture as dimensions: tier chosen (₹49 vs ₹199/299), language, device type, and the
exact form field where people abandon.

## DB schema (Postgres; adjust types if on SQLite/MySQL)

```sql
create table sessions (
  id            uuid primary key,
  first_seen    timestamptz default now(),
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  gclid         text,
  fbclid        text,
  landing_path  text,
  device        text,
  language      text
);

create table events (
  id          bigserial primary key,
  session_id  uuid references sessions(id),
  order_id    uuid,
  name        text not null,
  props       jsonb default '{}',
  created_at  timestamptz default now()
);
create index on events (name, created_at);
create index on events (session_id);

create table orders (
  id              uuid primary key,
  session_id      uuid references sessions(id),
  tier            text,            -- 'basic_49' | 'full_199' | 'full_299'
  amount_inr      int,
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  status          text,            -- created | paid | failed | refunded
  email           text,
  phone           text,
  prokerala_cost_inr numeric(8,2),
  pdf_status      text,            -- pending | ready | failed
  created_at      timestamptz default now(),
  paid_at         timestamptz
);
```

**Gotcha 1 — PII**: don't store birth details in `events.props`. Keep birth data in a separate
table with its own retention policy.

**Gotcha 2 — test before spending**: verify `gclid`/`fbclid` capture end-to-end yourself before
turning on paid traffic. If attribution breaks, we're flying blind on CAC.

## Wiring

1. On first page load: create `session_id` (UUID, first-party cookie), capture UTMs/`gclid`/
   `fbclid` from URL, `POST /api/session`.
2. Frontend funnel events: `POST /api/event` `{session_id, name, props}`, sent via
   `navigator.sendBeacon` so it survives navigation.
3. When creating the Razorpay order, store `session_id` in the order row and in Razorpay's
   `notes` — this is what links payment back to the ad click.
4. In the Razorpay webhook: mark order paid, write `payment_success`, fire Meta CAPI purchase
   event + GA4 Measurement Protocol purchase event, both server-side.
5. Log every Prokerala call's latency and cost against the order (`prokerala_cost_inr`).

## Daily funnel query

```sql
select
  utm_campaign,
  count(distinct s.id) filter (where e.name='landing_view')      as visits,
  count(distinct s.id) filter (where e.name='preview_generated') as previews,
  count(distinct s.id) filter (where e.name='paywall_viewed')    as paywall,
  count(distinct s.id) filter (where e.name='payment_success')   as paid
from sessions s
join events e on e.session_id = s.id
where s.first_seen > now() - interval '1 day'
group by utm_campaign
order by visits desc;
```

## Founder dashboard (check daily)

- CPC, landing→preview rate, preview→paywall rate, paywall→paid rate
- CAC by channel and campaign, average order value, tier mix
- Contribution margin per order (price − Prokerala cost − Razorpay fee ~2%)
- Fulfillment failures (one broken PDF costs more than a wasted click)

## Scale rule

Scale a channel when CAC is under ~60% of average order value for 2-3 consecutive days **and**
fulfillment is clean. Below ~30 clicks/day per campaign, treat the numbers as noise — don't
decide on them.

## How this maps to existing GitHub issues

Most of the strategic pieces already have open issues; this doc fills in the concrete spec they
were missing:

- #48 (Meta Pixel + CAPI / Google Ads conversion tracking) — now has the exact server-side
  wiring steps + GA4 Measurement Protocol detail above.
- #28 (analytics tracking vs PRD §11 metrics) — now has the full event taxonomy above.
- #17 (UTM discipline) — now has the `sessions` table + capture-before-spend requirement.
- #16 (paid-but-failed generation) — `orders.pdf_status` + `report_failed` event covers the
  logging half of this.

New, not yet tracked anywhere — see issues created from this doc:
- Events/sessions/orders schema + `/api/session` + `/api/event` endpoints (the foundation the
  above issues depend on).
- Microsoft Clarity setup.
- Founder daily funnel/CAC dashboard.
