# Implementation Log — Payment, Download & Report Generation

**Date:** 2026-09-21
**Author:** Engineering (opencode)
**Status:** Merged to `main` and pushed to `origin/main`

**Commit trail**

| Commit | Scope |
|--------|-------|
| `9bca4bc` | payment/download fix, direct browser PDF |
| `76481e5` | report + teaser field-mapping fix |
| `361318f` | **Mongo single source of truth for kundali lifecycle + financial teaser** |
| `1f51b67` | telegram startup alert + `TELEGRAM_CHAT_ID` alias |
| `e2e219f` | PDF quality review doc |
| `8f03546` | stop tracking prod creds |
| `588f976` | send sale + download alerts on the real paths (exactly once) |

> Sections §2–§3 were revised on the Mongo migration. The filesystem stores
> (`lib/pending.ts`, `lib/cache.ts`) and Postgres/pg scaffolding described in the
> original log are **removed**; they are kept only in §1/§7 as history.

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
| 8 | **No Telegram alert ever arrived** | Code read `TELEGRAM_ADMIN_CHAT_ID`; deployment `.env` sets `TELEGRAM_CHAT_ID` | All sale/download/bot alerts silently dropped |
| 9 | **Download alert never fired** | Alert was only wired to `/payment/download/:orderId`; the link emailed/returned after payment is `/download/:archiveId/pdf` | Admin never saw downloads |
| 10 | Teaser had no kundali-type flag and the preview hid the money axis | Single financial shape, scores not rendered on the landing page | Preview missed the core value prop |
| 11 | Over-engineered state | Chart cache + pending payments on disk; unused Postgres/pg scaffolding | Multiple sources of truth, cache-expiry refetches |

---

## 2. What was implemented

### 2.1 One Mongo document per kundali (single source of truth)

- **`lib/mongo.ts`** (new): shared connection via `MONGODB_URI` + `DB_NAME` (default `app_kundaliapi`).
- **`lib/store.ts`** (new): collection **`kundalis`** — one document per kundali created by the free teaser and reused through payment and PDF:
  ```
  id (unique)  reportType  reportLabel  email?  name?  gender?  place?
  birth{}  raw  parsed  teaser?  locked?
  status: teaser|ordered|paid|generating|completed
  orderId?  provider?  paymentId?  amount?  archiveId?  downloadUrl?
  purchaseNotified?  downloadNotified?  generatingAt?  createdAt  paidAt?
  ```
  indexes: `id` unique, `orderId`, `email`, `archiveId`, `status`, `createdAt`.
  - `saveKundali`, `getKundali`, `getKundaliByOrderId`, `getKundaliByArchiveId`, `updateKundali`, `updateKundaliByOrderId`.
  - `claimKundaliForReport(id)` — atomic status claim for idempotent generation (5-min stale reclaim).
  - `markKundaliDownloadNotified(id)` — atomic exactly-once download alert.
- **`lib/orders.ts`** — sales ledger collection `orders` (drives Telegram stats), now using the shared `getDb()`; no `DB_TYPE` gate.
- **`lib/db.ts`** — Mongo-only `/db/ping`.

### 2.2 API flow (how the endpoints connect)

1. **`POST /kundali/teaser`** `{ reportType?, cacheId?, birth…, email? }`
   - `cacheId` present → returns the stored teaser (no ProKerala call).
   - otherwise → `getKundli` (kundli + planet-position + panchang) → `buildTeaser(reportType)` → persists a `kundalis` doc (`status: teaser`) → `{ cacheId, reportType, teaser, locked }`.
2. **`POST /payment/checkout`** `{ cacheId, provider, email, name }`
   - loads the doc, creates the Razorpay/Cashfree order, attaches `orderId/provider/amount/email` to the **same** doc (`status: ordered`).
3. **Payment confirmation** — two interchangeable, idempotent triggers:
   - `POST /webhook/razorpay` (`payment.captured`) / `POST /webhook/cashfree`
   - `POST /payment/verify` (client callback, HMAC signature)
   Both mark the doc `paid`, then `generatePaidReport()` claims it atomically and generates from the stored doc → archive PDF+markdown → same doc `status: completed` + `archiveId`/`downloadUrl` → `orders` ledger + Telegram sale + email.
4. **`GET /payment/order/:orderId`** — status polling with self-heal (re-confirms payment, generates if missing).
5. **`GET /payment/download/:orderId`** — streams PDF, fires the download alert once.
6. **`GET /download/:archiveId/:format`** — serves archived pdf/md/json; fires the download alert once for `pdf` (the actual link users receive).
7. **`POST /kundali/{generate,markdown,pdf}`** — also persist a `kundalis` doc (`_kundaliId` / `X-Kundali-Id`).

### 2.3 Teaser by type (financial-first, extendable)

- **`lib/teaser.ts`** (new): `buildTeaser(reportType, parsed, name, birth)` + `LOCKED_SECTIONS` per type.
  - `financial_kundali` → includes `moneyAxisScores` (wealth, career, business, property, investment, stability).
  - `match_kundali` → chart teaser + compatibility locked sections (2nd chart input pending).
- **`routes/teaser.ts`**: `reportType` enum flag (default `financial_kundali`), optional `cacheId` lookup, persists the doc.
- **Frontend `KundaliLanding.astro`**: renders a **Financial Money-Axis Preview** (6 scores + overall strength bar) when `moneyAxisScores` is present; sends `reportType` explicitly.

### 2.4 Report generation

- **`lib/report.ts`**: `generatePaidReport()` is idempotent and reads the stored `kundalis` doc (raw/parsed/birth) — no cache expiry or detailed re-fetch. Primary content is the **ProKerala PDF Report API** (`POST /v2/report/personal-reading/instant`, `getPersonalReportPdf()`); local `render.ts` is the fallback.
- **`lib/render.ts`**: birth details, panchang, avakahada chakra, lagna & moon sign, planetary positions + per-planet interpretation, 12-house analysis, yogas, doshas, full Vimshottari dasha (antardasha + pratyantardasha), money-axis scores, remedies → HTML (PDF) + markdown. PDF retries 3× with backoff.
- **`lib/scores.ts`**: money-axis from **house strength** (kendra/trikona/wealth vs dusthana).

### 2.5 Notifications (Telegram)

- `lib/telegram.ts`: `sendTelegram` now accepts `TELEGRAM_ADMIN_CHAT_ID` **or** `TELEGRAM_CHAT_ID` (comma-separated); `notifyAdminServiceStart()` sends a `🚀 Service Restarted` alert (service, port, env, host, IST) fire-and-forget from `index.ts`.
- Sale alert: `notifySaleOnce()` — once per kundali, retried on a later call if a prior send failed (`purchaseNotified` stays false).
- Download alert: exactly once per kundali via `markKundaliDownloadNotified`, on both download routes.
- Alerts never depend on email: Telegram is attempted independently and before the best-effort email.

### 2.6 Removed (de-over-engineering)

- `lib/pending.ts`, `lib/cache.ts` (filesystem state) — replaced by the `kundalis` doc.
- `pg` / `@types/pg`, `PG_URI` from `.env.example` + `compose.yaml`; db ping is Mongo-only.
- `report.ts` cache-expiry refetch, detailed-chart refetch, file-lock polling.

---

## 3. Files touched

**Backend** (`packages/backend/kundaliapi/src/`)
- new: `lib/mongo.ts`, `lib/store.ts`, `lib/teaser.ts`, `lib/report.ts`, `lib/scores.ts`
- modified: `lib/prokerala.ts`, `lib/render.ts`, `lib/payment.ts`, `lib/orders.ts`, `lib/db.ts`, `lib/telegram.ts`, `lib/email.ts`, `lib/archive.ts`, `routes/checkout.ts`, `routes/webhook.ts`, `routes/teaser.ts`, `routes/kundali.ts`, `routes/download.ts`, `routes/telegram-bot.ts`, `index.ts`, `html-pdf-node.d.ts`, `.env.example`, `compose.yaml`
- deleted: `lib/pending.ts`, `lib/cache.ts`

**Frontend** (`packages/web/kundaliweb/src/`)
- `components/KundaliLanding.astro`

---

## 4. Verification done

- Backend `pnpm typecheck` ✅ · Web `pnpm build` ✅
- Local Mongo connect + `/db/ping` ✅ (`mongo ok: 1 app_kundaliapi`)
- `kundalis` round-trip ✅ (insert → read → by-order lookup → update → delete)
- `markKundaliDownloadNotified` exactly-once ✅ (`first/second: true false`)
- Telegram startup alert delivered ✅ (`TELEGRAM_START_OK true`)
- Stuck paid order self-healed: `GET /payment/order/order_TeNqeuNPTNKKEK` → `completed`
- `GET /payment/download/order_TeNqeuNPTNKKEK` → 200, ~86 KB PDF
- `/kundali/pdf` → 200; local report = 28 pages (~166 KB)
- ProKerala report endpoint accepts our payload; returns `403 insufficient credit balance` on the current plan → fallback path exercised (`ProkeralaQuotaError`)

---

## 5. Known trade-offs

- Because the teaser fetches the **lean** chart, a **local-fallback** PDF will not
  contain dasha/kaal-sarp/sade-sati sections (structured response uses ProKerala's
  full report). Re-enabling a detailed fetch at teaser time would cost extra
  ProKerala credits per free teaser.
- `match_kundali` is schema-ready but needs a second person's birth details to
  produce a real compatibility teaser/report.

---

## 6. Next action items

### P0 (before any ad spend)
- [ ] **Decide report source** (see `2026-09-21-prokerala-cost-monetization.md`).
- [ ] Set production env: `MONGODB_URI`, `APP_URL`, `CORS_ORIGINS`, `RAZORPAY_WEBHOOK_SECRET`, `PROKERALA_PDF_REPORT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- [ ] Configure Razorpay webhook URL + secret in dashboard (backup path).
- [ ] Move `archive/` to persistent storage / Cloudflare R2 (currently local FS).
- [ ] Hindi PDF verification (Devanagari rendering) end-to-end.

### P1
- [ ] Real `/report/[order-id]/status` page (PRD §9.3).
- [ ] Add report ID + purchaser email watermark to PDFs (anti-sharing).
- [ ] WhatsApp delivery (PRD says Email/WhatsApp).
- [ ] Dedupe charts by birth-datetime+place (reuse an existing `kundalis` doc to avoid re-spending credits).
- [ ] Cost guard: log credits spent per report; alert when balance is low.
- [ ] Implement `match_kundali` (second chart input + compatibility teaser/report).

### P2
- [ ] Chart graphics (Rasi/Navamsa/Shodashvarga/Ashtakavarga) if self-generating.
- [ ] Countdown timer, social proof, sample-report carousel (PRD §5.3–5.5).

---

## 7. Key references
- ProKerala credits: https://api.prokerala.com/api-credits
- ProKerala pricing: https://api.prokerala.com/pricing
- ProKerala PDF reports: https://api.prokerala.com/pdf-reports
- ProKerala docs: https://api.prokerala.com/docs
