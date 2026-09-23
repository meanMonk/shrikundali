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
  - Hard-blocked on P0 frontend work + locked CTA verb per
    `docs/prd/frontend-gap-plan.md` notes (line ~124).

- [ ] **Meta Business — create business account + sub-accounts (ad accounts/Pages) and
      launch 10+ ad variants.** ([#59](https://github.com/meanMonk/shrikundali/issues/59))
  - Setup walkthrough: `docs/ads/meta-business-manager-setup.md`.
  - Copy: `docs/ads/meta-ads-copy.md`, `docs/ads/money-debt-sprint-copy.md`.
  - Creatives: `docs/ads/money-debt-creatives/` (`docs/ads/README.md` indexes them).
  - Note in setup doc: prefer **one BM with multiple Pages/ad accounts**, not multiple
    BMs (duplicate-account risk). Produce 10+ distinct creative/copy variants for the
    first campaign.

## C. Product / funnel

- [ ] **Validate the complete end-to-end PDF kundali report flow.** ([#60](https://github.com/meanMonk/shrikundali/issues/60))
  - Flow: form → teaser → Razorpay/Cashfree checkout → webhook → PDF generate →
    store/archive → email + Telegram confirm → `/download/:id`.
  - Backend: `packages/backend/kundaliapi/src/` (`lib/report.ts`, `lib/render.ts`,
    `lib/archive.ts`, `lib/payment.ts`, `routes/webhook.ts`, `routes/download.ts`).
  - See `docs/progress/kundali-launch-checklist.md` and
    `docs/progress/2026-09-21-pdf-quality-review-corrected.md`.
  - Confirm Hindi/Devanagari rendering, 12-page template, watermark, refund path.

- [ ] **Add more buy buttons + B2C conversion/offer copy on every page.** Force the
      purchase click with urgency, offers, and outcome-focused copy. ([#61](https://github.com/meanMonk/shrikundali/issues/61))
  - Every page should carry repeated purchase CTAs with consistent verb (CTA-verb
    decision is an open item, see `docs/prd/frontend-gap-plan.md` issue #42).

- [ ] **Mobile view review — add missing pages / fix responsive layout.** ([#62](https://github.com/meanMonk/shrikundali/issues/62))
  - PRD §7 is mobile-first; current build has minimal `@media` coverage per
    `docs/prd/frontend-gap-plan.md` (item 6).

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
