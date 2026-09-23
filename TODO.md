# ShriKundali / Rashi Kundali — Master TODO

Single source of truth for open work. **Read this file at the start of every session**
(see `CLAUDE.md` / `AGENTS.md`). Update statuses in place; add new items at the bottom of
the relevant section. Reference existing docs instead of duplicating them.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## A. Ads attribution & Telegram reporting

- [ ] **Persist all ads params (UTM + click IDs) to DB and report via Telegram.** ([#57](https://github.com/meanMonk/shrikundali/issues/57))
  - Frontend already captures attribution in
    `packages/web/kundaliweb/src/lib/attribution.ts` (utm_*, gclid, gbraid, wbraid,
    fbclid, fbp, fbc, ga_client_id) and sends it on teaser + checkout.
  - Backend already accepts/stores `attribution` on orders (`routes/checkout.ts`,
    `routes/teaser.ts`, `lib/orders.ts`, `lib/store.ts`) and feeds it to the conversion
    APIs (`lib/report.ts`, `lib/conversions.ts`).
  - **Gap to close:** verify every order row actually carries the full set end-to-end;
    add a per-source / per-campaign breakdown to the Telegram bot.
  - Add a `/help` command entry + a **share-report** action in
    `packages/backend/kundaliapi/src/routes/telegram-bot.ts` (existing commands end at
    line ~148). Wire "share report" to the same hooks used by the report pipeline so a
    report can be pushed into Telegram on demand.

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
  - Setup walkthrough: `docs/ads/meta-business-manager-setup.md`.
  - Copy: `docs/ads/meta-ads-copy.md`, `docs/ads/money-debt-sprint-copy.md`.
  - Creatives: `docs/ads/money-debt-creatives/` (`docs/ads/README.md` indexes them).
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


- [~] **Validate the complete end-to-end PDF kundali report flow.** ([#60](https://github.com/meanMonk/shrikundali/issues/60))
  - Flow: form → teaser → Razorpay/Cashfree checkout → webhook → PDF generate →
    store/archive → email + Telegram confirm → `/download/:id`.
  - Backend: `packages/backend/kundaliapi/src/` (`lib/report.ts`, `lib/render.ts`,
    `lib/archive.ts`, `lib/payment.ts`, `routes/webhook.ts`, `routes/download.ts`).
  - See `docs/progress/kundali-launch-checklist.md` and
    `docs/progress/2026-09-21-pdf-quality-review-corrected.md`.
  - Confirm Hindi/Devanagari rendering, 12-page template, watermark, refund path.

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
