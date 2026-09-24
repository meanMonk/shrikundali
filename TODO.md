# ShriKundali / Rashi Kundali — Master TODO

Single source of truth for open work. **Read this file at the start of every session**
(see `CLAUDE.md` / `AGENTS.md`). Update statuses in place; add new items at the bottom of
the relevant section. Reference existing docs instead of duplicating them.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## A. Ads attribution & Telegram reporting

- [~] **Persist all ads params (UTM + click IDs) to DB and report via Telegram.** ([#57](https://github.com/meanMonk/shrikundali/issues/57))
  - Frontend captures attribution in
    `packages/web/kundaliweb/src/lib/attribution.ts` (utm_source/medium/campaign/content/term,
    gclid, gbraid, wbraid, fbclid, fbp, fbc, ga_client_id, landing_page, referrer) and sends it
    on teaser + checkout.
  - Backend stores it on `kundalis.attribution` (teaser) and `orders.attribution` (checkout, which
    also merges client_ip + user_agent) and feeds the conversion APIs (`lib/report.ts`).
  - **Done:** Telegram attribution reporting via `lib/attribution-stats.ts` +
    `/sources`, `/campaigns` (30d) and `/sources_all`, `/campaigns_all` (all-time) — leads ×
    orders × paid × revenue per UTM value. Verified live: orders/kundalis carry the attribution
    object (no UTM values yet because traffic has been direct — will populate once ads run).
  - **Still open:** share-report action in the bot.


## B. Paid acquisition

- [ ] **Google Ads — build campaigns from the existing structure, automate via Claude,
      and resolve credentials.** ([#58](https://github.com/meanMonk/shrikundali/issues/58))
  - Structure/copy already drafted: `docs/prd/google-ads-campaign-setup.md`,
    `docs/ads/google-ads-copy.md`, `docs/ads/google-keyword-research.md`,
    `docs/ads/google-ads-transparency-scan.md`.
  - Decide auth path: Google Ads API service account vs. MCC OAuth; document which creds
    are needed and where they live (never commit secrets).
  - **Unblocked (2026-09-23):** P0 frontend work is done (see
    `docs/prd/frontend-gap-plan.md`). Only the CTA-verb lock (#42/#37) remains open.

- [ ] **Meta Business — create business account + sub-accounts (ad accounts/Pages) and
      launch 10+ ad variants.** ([#59](https://github.com/meanMonk/shrikundali/issues/59))
  - **Founder priority (on Sahil's plate).** Quick direction:
    `docs/ads/meta-business-manager-setup.md` (account/BM walkthrough),
    `docs/ads/meta-ads-copy.md` + `docs/ads/money-debt-sprint-copy.md` (copy),
    `docs/ads/money-debt-creatives/` (creatives; `docs/ads/README.md` indexes them).
  - Note in setup doc: prefer **one BM with multiple Pages/ad accounts**, not multiple
    BMs (duplicate-account risk). Produce 10+ distinct creative/copy variants for the
    first campaign.

## C. Product / funnel

- [x] **Dynamic report pricing (Mongo + API + no-deploy script).** Prices live in the Mongo
      `pricing` collection with static `REPORT_PRICING` as fallback. Read via
      `GET /api/pricing[/:reportType]` and the DB-backed `GET /api/config/:reportType`;
      update via `PUT /api/pricing/:reportType` (`x-admin-token` when `ADMIN_TOKEN` is set),
      the script `pnpm --filter kundaliapi pricing:set test|actual|show`, or the Telegram bot
      (`/current-pricing`, `/test-price`, `/actual-price`). The script writes to whatever
      `MONGODB_URI` resolves to (defaults to the package `.env`), so use
      `MONGODB_URI=mongodb://localhost:27017/app_kundaliapi` for local. Code:
      `src/lib/pricing-store.ts`, `src/lib/pricing-presets.ts`, `src/routes/pricing.ts`,
      `scripts/set-pricing.ts`. Payment modal also made compact/responsive with trust badges.


- [x] **Post-payment support tickets.** Success-modal chips (download failed / paid no
      report / paid twice) → `POST /support/ticket` → Mongo `support_tickets` (enriched from
      the kundali/order) + email to `SUPPORT_EMAIL` + customer ack + Telegram ping;
      `/tickets` on the bot. Code: `lib/support.ts`, `routes/support.ts`. ([#73](https://github.com/meanMonk/shrikundali/issues/73))

- [x] **Daily founder digest (07:30 IST) — Telegram + email.** In-process scheduler
      (`lib/digest.ts` → `startDailyDigestScheduler`) builds day/7d/30d/all-time orders +
      revenue, today's funnel, top sources (30d), open tickets and stuck reports, and sends
      to Telegram + `FOUNDER_EMAIL` (default `sahil.k@vaayulabs.com`). Manual trigger
      `POST /digest/run`, preview `GET /digest/preview` (both `x-admin-token` when
      `ADMIN_TOKEN` is set). Disable with `DIGEST_ENABLED=false`.

- [ ] **Live E2E validation with a real payment, then review in ~4 days.** Run the full
      funnel on production (form → teaser → Razorpay → webhook → PDF → email/Telegram →
      download → support path), then check back and decide next steps. ([#60](https://github.com/meanMonk/shrikundali/issues/60))
      - After the 4-day review: **create the next batch of ad campaigns** (Google + Meta).

- [ ] **Enable Cashfree as a fallback payment gateway.** `lib/payment.ts` already implements
      Cashfree create/verify — set `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` /
      `CASHFREE_ENV` and surface it as a fallback if Razorpay is unavailable. ([#66](https://github.com/meanMonk/shrikundali/issues/66))

- [~] **Validate the complete end-to-end PDF kundali report flow.** ([#60](https://github.com/meanMonk/shrikundali/issues/60))
  - Flow: form → teaser → Razorpay/Cashfree checkout → webhook → PDF generate →
    store/archive → email + Telegram confirm → `/download/:id`.
  - Backend: `packages/backend/kundaliapi/src/` (`lib/report.ts`, `lib/render.ts`,
    `lib/archive.ts`, `lib/payment.ts`, `routes/webhook.ts`, `routes/download.ts`).
  - See `docs/progress/kundali-launch-checklist.md` and
    `docs/progress/2026-09-21-pdf-quality-review-corrected.md`.
  - Confirm Hindi/Devanagari rendering, 12-page template, watermark, refund path.

- [x] **Fixed P0: ascendant-merge bug stalling paid financial reports (2026-09-23).**
      Root cause + fix in `lib/prokerala.ts`/`lib/report.ts` — see commits `8e5d4a8`,
      `769d216`. **Blocked separately by ProKerala account credit exhaustion** —
      confirmed directly against their API (`insufficient credit balance` on every
      endpoint); needs a top-up on the ProKerala dashboard before any report,
      paid or free, can generate again. Also shipped: payment-confirmed +
      report-failure Telegram alerts (previously only success notified), a
      Telegram `/retry <orderId>` command, and a daily (06:30 IST) in-process
      cron (`lib/auto-resolve.ts`) that auto-regenerates any paid-but-stuck
      report with no manual step. Also trimmed free-teaser ProKerala credit usage
      (3→2 calls; match_kundali no longer fetches an unused solo chart) and
      removed the orphaned, unpaid `/kundali/generate,markdown,pdf` dev routes.

- [x] **Fixed: auto-resolve cron burned through ProKerala's 5000 credits (2026-09-24).**
      Root cause: the cron added in `02d9f8f` retried every paid-but-stuck order
      every 2 hours over a 14-day lookback, with no attempt cap — since some
      orders were permanently broken (the ascendant bug + the credit exhaustion
      above), the same orders got re-billed ~6-7 ProKerala calls per retry,
      indefinitely. Fix in `lib/auto-resolve.ts`/`lib/store.ts`: lookback cut to
      24h, and each order now gets exactly **one** auto-resolve attempt ever —
      a new `autoResolveAttempted` flag is set on the doc after the attempt
      (win or lose) so it's never picked up by the cron again. Manual Telegram
      `/retry <orderId>` is unaffected — still a single-call retry per
      invocation, callable on demand as many times as needed. See
      [#82](https://github.com/meanMonk/shrikundali/issues/82).

### Integration test — local end-to-end (2026-09-23) `[~]`

Ran the app locally: Astro dev `:3000` + Hono dev `:3400` + local Mongo
(`app_kundaliapi`), walked every page and the funnel in a real browser (Chrome)
plus direct API calls. Backend had to be started with overrides
`MONGODB_URI=mongodb://localhost:27017/app_kundaliapi MINIO_ENDPOINT=false`
(the repo `.env` is docker-oriented — see blocker below).

**Pages — all HTTP 200, correct `<title>` + Rashi Kundali brand + footer domain:**

| Page | Form | `#form-section` CTAs | Notes |
| --- | --- | --- | --- |
| `/` | ✅ | 3 | money angle |
| `/p/marriage-kundali/` | ✅ | 3 | angle copy + `reportType` |
| `/p/career-kundali/` | ✅ | 3 | |
| `/p/dosha-report/` | ✅ | 3 | |
| `/p/kundali-matching/` | ✅ | 3 | dual form (2 person cards) |
| `/p/health-kundali/` | ✅ | 3 | |
| `/about/ /privacy/ /terms/ /refund/ /disclaimer/ /sitemap/` | — | 0 | content renders, no form |
| `/kundali/` | — | 0 | legacy checkout; redirects to `/` without `cacheId`+`email` |

**Funnel — validated:**
- Financial teaser → free preview (lagna/rashi/nakshatra/dosha + 6 money scores) ✅
- Matching teaser (dual) → Guna Milan score + band rendered ✅
- Checkout → order created, amount per `reportType` (₹199 / ₹299) ✅
- Razorpay modal opens from the UI ✅ (live keys — payment cannot complete locally)
- Attribution persisted on the kundali doc (`utm_source`, `utm_campaign`, `user_agent`) ✅
- Report generation (invoked directly, bypassing payment): financial **11-page** PDF
  + match **3-page** PDF, archived + downloadable ✅
- Download routes `/download/:archiveId/pdf` and `/payment/download/:orderId` → 200 PDF ✅

**Blockers / gaps found (tracked below):**
- Local dev needs env overrides (docker-oriented `.env`: `mongo` host, MinIO, prod CORS).
- Payment cannot complete locally (live Razorpay keys) → webhook/report/email/telegram
  untestable through the real flow.
- Matching preview silently hides when the ProKerala matching call fails/rate-limits.
- Razorpay `checkout.js` loads on every page (`checkout-static-next.razorpay.com/build/undefined`
  → `ERR_BLOCKED_BY_ORB`) even when not checking out.

- [ ] **Local dev env overrides.** Add a `dev` script (or `.env.local`) that sets
      `MONGODB_URI=mongodb://localhost:27017/app_kundaliapi`, `MINIO_ENDPOINT=false`, and
      localhost in `CORS_ORIGINS`, so `pnpm dev` works without manual overrides. (Added
      `http://localhost:3000` to `CORS_ORIGINS` in the local `.env` during this test.)
- [ ] **Razorpay test mode for local/dev.** Use `rzp_test_*` keys (or a dev "mark paid"
      bypass) so payment → webhook → report → email/telegram → download can be exercised
      end-to-end without a real charge.
- [ ] **Matching preview fallback.** When the compatibility call fails/rate-limits, show a
      retry/notice instead of silently hiding the Guna Milan score.
- [ ] **Load Razorpay `checkout.js` lazily** on unlock only (kill the per-page console noise).
- [ ] **Financial report page completeness.** Template targets 12 pages; generated PDF was
      11 pages — verify no section is silently dropped for lean charts.
- [ ] **Orphaned legacy checkout.** `/kundali/` redirects to `/download?orderId=…`, but no
      `/download` page exists; the live funnel downloads in-modal. Remove or wire it up.
- [ ] **Dead `trackServerEvent`.** `lib/tracking.ts` POSTs to `/track`, which the API does
      not expose. Remove or add the endpoint.

- [x] **Add more buy buttons + B2C conversion/offer copy on every page.** Force the
      purchase click with urgency, offers, and outcome-focused copy. ([#61](https://github.com/meanMonk/shrikundali/issues/61))
  - Every page carries repeated purchase CTAs. Remaining: lock the CTA verb
    (see `docs/prd/frontend-gap-plan.md` issue #42).

- [~] **Mobile view review — add missing pages / fix responsive layout.** ([#62](https://github.com/meanMonk/shrikundali/issues/62))
  - PRD §7 is mobile-first. Modal compacted for mobile + trust badges (2026-09-23); full
    landing/form audit still ongoing per `docs/prd/frontend-gap-plan.md` (item 6).

- [ ] **Multi-language report support (i18n).** ([#81](https://github.com/meanMonk/shrikundali/issues/81))
  - Only `en`/`hi` wired today; ProKerala chart endpoints localize only `en, hi, ta, te, ml`.
  - Plan: shared language registry → dropdown (native names) → clamp `la` before ProKerala →
    localize our templates (ref data + chrome + essays) → per-script PDF fonts.
  - Separate: cover-page (page 1) redesign.

## D. Design

- [ ] **Review home page + other page designs ("Claude design") — make them clean and
      simple.** ([#63](https://github.com/meanMonk/shrikundali/issues/63))
  - Align to the brand system in `docs/prd/shrikundali-frontend-prd.md` §3 (deep
    saffron-maroon / indigo / gold / warm off-white; serif headings + geometric sans).

- [ ] **Decide whether to reuse ad creatives on the website.** ([#64](https://github.com/meanMonk/shrikundali/issues/64))
  - Creatives live in `docs/ads/money-debt-creatives/`; evaluate reuse vs. purpose-built
    site imagery. Can be deferred — mark decision either way.

---

## E. GTM & post-launch operations

- [ ] **Run the launch playbook once ads go live.** ([#65](https://github.com/meanMonk/shrikundali/issues/65))
  - Doc: `docs/gtm/go-to-market-playbook.md`.
  - Don't sit idle: four tracks in priority order — fulfillment/trust (P0), conversion
    funnel, unit economics/CAC, creative iteration.
  - Pre-spend gates: tracking verified E2E, PDF flow proven, support staffed, failure
    alerts working, mobile landing clean.
  - Rules: scale when CAC < ~60% AOV for 2-3 days + clean fulfillment; hold/kill otherwise;
    ignore < ~30 clicks/day per campaign as noise.

---

## Backlog / decisions pending
- CTA verb lock (`docs/prd/frontend-gap-plan.md` #42).
- Cloudflare R2 for PDF storage (currently local filesystem) —
  `docs/progress/kundali-launch-checklist.md`.
