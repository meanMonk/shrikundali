# Implementation Log — Payment, Download & Report Generation

**Date:** 2026-09-21
**Author:** Engineering (opencode)
**Commits:** `9bca4bc` (payment/download fix) · `76481e5` (report + teaser fix)
**Status:** Merged to `main` and pushed to `origin/main`

---

## 1. Problems found

| # | Problem | Root cause | Impact |
|---|---------|-----------|--------|
| 1 | After payment, user sent to `localhost/download` | Razorpay `handler` did `window.location.href = "/download?orderId=..."` — a relative URL, but the Astro site is **static** (`output: "static"`) and has no `/download` route | Users paid and never got the PDF |
| 2 | Webhook never generated the report | `webhook.ts` derived `cacheId` via `orderId.split("_")[1]`, but Razorpay order ids are `order_XXX` (not the receipt `kundali_<cacheId>_<ts>`) | Report never tied to the order |
| 3 | Delivery email went to the wrong address | Teaser cached a placeholder `preview-*@shrikundali.in`; the real email was only sent at checkout | No email delivery |
| 4 | PDF generation failed silently | `html-pdf-node` (puppeteer) hit a transient `TimeoutError: Timed out after 30000 ms while trying to connect to the browser`; no retry existed | Paid order stuck in "processing" |
| 5 | Teaser preview showed `[object Object]` / `N/A` | Field mapping assumed flat strings; ProKerala returns nested objects (`nakshatra.name`, `chandra_rasi.lord.name`, Ascendant in `planet-position`) | Broken preview |
| 6 | Money-axis scores always `5` | `planet_positions` was never fetched (basic `/kundli` has no planets) | Meaningless scores |
| 7 | Report content was hand-authored templates | Interpretations were hardcoded in `render.ts` | Not derived from ProKerala |

---

## 2. What was implemented

### 2.1 Payment → generation → download pipeline
- **`lib/pending.ts`** (new): file-backed store `orderId → {cacheId, email, name, gender, amount, provider, birth, archiveId, downloadUrl, purchaseNotified, downloadNotified}` + exclusive generation lock.
- **`lib/report.ts`** (new): idempotent `generatePaidReport()` shared by the client callback and webhook — renders, archives, emails, and fires Telegram.
- **`routes/checkout.ts`**:
  - persists the pending mapping at checkout (incl. birth details),
  - `POST /payment/verify` — verifies Razorpay HMAC, generates, returns `archiveId`/`downloadUrl`,
  - `GET /payment/order/:orderId` — status polling + **self-heal** (re-confirms payment with Razorpay and generates if missing),
  - `GET /payment/download/:orderId` — streams the PDF and fires the download Telegram once.
- **`routes/webhook.ts`**: rewritten to resolve `cacheId`/email from the pending store (no more order-id parsing); optional `RAZORPAY_WEBHOOK_SECRET` body-signature check; delegates to `generatePaidReport`.
- **`lib/payment.ts`**: added `getRazorpayOrder()` to confirm `status === "paid"` server-side.

### 2.2 Frontend (`KundaliLanding.astro`)
- On Razorpay success: `verify → poll → fetch PDF blob → trigger direct browser download` (no redirect).
- Post-payment **success dialog** with order summary, "what you get", a **disabled "Preparing…" button** that enables to "Download PDF" once ready, plus retry.
- Payment modal now shows a "What you get" list from `/api/config`.
- `Purchase` event fires only **after** payment.

### 2.3 Teaser preview fixes
- Correct object mapping for `nakshatra`, `chandra_rasi`, `lagna` (Ascendant from `planet-position`) and their lords.
- Schema now accepts `name`, `gender`, `place` (frontend was already sending `name`).
- Money-axis scores computed from **house strength** (kendra/trikona/wealth vs dusthana) in shared **`lib/scores.ts`**.

### 2.4 Report generation
- **`lib/render.ts`** rewritten: birth details, panchang, avakahada chakra, lagna & moon sign, planetary positions + per-planet interpretation, 12-house analysis, yogas, doshas, full Vimshottari dasha (antardasha + pratyantardasha), money-axis scores, remedies → HTML (PDF) + markdown.
- **ProKerala PDF Report API** (`POST /v2/report/personal-reading/instant`) added as the **primary content source** (`getPersonalReportPdf()` in `lib/prokerala.ts`), with the local renderer as fallback when disabled or out of credits.
- Birth details stored in the chart cache + pending order so the report can be regenerated after cache expiry.
- `getKundli()` is lean by default (teaser) and `detailed: true` pulls the advanced chart + kaal sarp + sade sati for the fallback report.
- PDF rendering now retries 3× with backoff and safer Chromium args.

---

## 3. Files touched

**Backend** (`packages/backend/kundaliapi/src/`)
- new: `lib/pending.ts`, `lib/report.ts`, `lib/scores.ts`
- modified: `lib/prokerala.ts`, `lib/render.ts`, `lib/cache.ts`, `lib/payment.ts`, `lib/orders.ts`, `lib/telegram.ts`, `lib/email.ts`, `lib/archive.ts`, `routes/checkout.ts`, `routes/webhook.ts`, `routes/teaser.ts`, `routes/kundali.ts`, `html-pdf-node.d.ts`, `.env.example`

**Frontend** (`packages/web/kundaliweb/src/`)
- `components/KundaliLanding.astro`

---

## 4. Verification done
- Backend `pnpm typecheck` ✅ · Web `pnpm build` ✅
- Stuck paid order self-healed: `GET /payment/order/order_TeNqeuNPTNKKEK` → `completed`
- `GET /payment/download/order_TeNqeuNPTNKKEK` → 200, ~86 KB PDF
- `/kundali/pdf` → 200; local report = 28 pages (~166 KB)
- ProKerala report endpoint accepts our payload; returns `403 insufficient credit balance` on the current plan → fallback path exercised and verified (`ProkeralaQuotaError`)

---

## 5. Next action items

### P0 (before any ad spend)
- [ ] **Decide report source** (see `2026-09-21-prokerala-cost-monetization.md`).
- [ ] Set production env: `APP_URL`, `CORS_ORIGINS`, `RAZORPAY_WEBHOOK_SECRET`, `PROKERALA_PDF_REPORT`.
- [ ] Configure Razorpay webhook URL + secret in dashboard (backup path).
- [ ] Move `archive/` to persistent storage / Cloudflare R2 (currently local FS).
- [ ] Hindi PDF verification (Devanagari rendering) end-to-end.
- [ ] Add `archive/` to `.gitignore` (runtime data currently untracked but not ignored).

### P1
- [ ] Real `/report/[order-id]/status` page (PRD §9.3).
- [ ] Add report ID + purchaser email watermark to PDFs (anti-sharing).
- [ ] WhatsApp delivery (PRD says Email/WhatsApp).
- [ ] Cache/reuse charts by birth-datetime+place to avoid re-spending credits.
- [ ] Cost guard: log credits spent per report; alert when balance is low.

### P2
- [ ] Chart graphics (Rasi/Navamsa/Shodashvarga/Ashtakavarga) if self-generating.
- [ ] Countdown timer, social proof, sample-report carousel (PRD §5.3–5.5).

---

## 6. Key references
- ProKerala credits: https://api.prokerala.com/api-credits
- ProKerala pricing: https://api.prokerala.com/pricing
- ProKerala PDF reports: https://api.prokerala.com/pdf-reports
- ProKerala docs: https://api.prokerala.com/docs
