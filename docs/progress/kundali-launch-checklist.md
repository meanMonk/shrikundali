# Kundali Report — End-to-End Launch Checklist

Start with **Financial Kundali only**. Don't build Match/Janm/Gun Milan/Gruh until report #1 has a positive ROAS for 2+ weeks straight.

## Current Status Summary (Sept 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Prokerala API Integration | ✅ Done | Auth + kundli endpoint working |
| JSON Generation | ✅ Done | `/generate` endpoint, archived |
| Markdown Generation | ✅ Done | `/markdown` endpoint, archived |
| PDF Generation | ✅ Done | `/pdf` endpoint via html-pdf-node |
| HTML Rendering | ✅ Done | Intermediate step, not stored separately |
| Local Archive | ✅ Done | `archive/uploads/{id}/` structure |
| Chart Cache | ✅ Done | 60min TTL, stores email + label |
| Payment Integration | ✅ Done | Razorpay + Cashfree, webhook-driven |
| Email Delivery | ✅ Done | Zoho SMTP, fire-and-forget |
| Telegram Notifications | ✅ Done | Admin sale alerts + stats bot |
| Orders Collection | ✅ Done | MongoDB, stats aggregation |
| Backend Config | ✅ Done | `/api/config/:reportType` for frontend |
| Frontend Config Fetch | ✅ Done | kundali.astro fetches from backend |
| Production Data | ⚠️ Blocked | Sandbox tier returns limited fields |
| Cloud Storage (R2) | ❌ Not started | Currently local filesystem only |
| Landing Page | 🔄 In Progress | Building now |
| Static Pages | 🔄 In Progress | Building now |

## 1. API / Data Layer
- [x] Primary provider finalized: **Prokerala** (integrated in `packages/backend/kundaliapi/src/lib/prokerala.ts`)
- [ ] Map ₹/credit cost per report → confirm true unit economics before setting price
- [ ] Pick a **fallback provider** (AstrologyAPI or similar) and stub the same interface so you can swap with one env var
- [ ] Add retry + timeout + circuit breaker around the API call (don't let a slow astrology API block checkout)
- [x] Cache raw chart JSON per birth-datetime+location so repeat/refund/regeneration doesn't re-spend credits — **DONE via `src/lib/cache.ts` (60min TTL)**
- [ ] Decide narrative layer: static templates keyed by planet/house/dosha combos vs LLM-generated — templates are cheaper and more predictable for v1
- [ ] **Verify Prokerala plan**: Current sandbox/test tier returns limited data (nakshatra, mangal dosha, yogas only). Production tier needed for: planet positions, dasha periods, house positions, numerology

## 2. PDF Generation
- [x] PDF generation implemented via `html-pdf-node` (html→pdf approach) in `packages/backend/kundaliapi/src/lib/render.ts`
- [x] Markdown renderer working (`renderMarkdown()`) with birth details, doshas, yogas
- [x] HTML renderer working (`renderHTML()`) with styled template
- [ ] Test render with full Hindi text (matras, conjuncts, retrograde symbols) before going live — this is your actual differentiation vs competitors
- [x] **Storage gap fixed**: Webhook now stores PDF/MD via `archiveRaw()` on payment confirmation
- [ ] Move from local filesystem (`archive/uploads/`) to Cloudflare R2 for production (signed, expiring download URLs)
- [ ] Add report ID + purchase email watermark/footer (anti-sharing, plus support traceability)

## 3. Frontend / Landing Page
- [x] One-hop funnel: free teaser (locked scores) → single payment → full report. No second paywall after payment — **DONE via `/teaser` → `/payment/checkout` → webhook → `/download`**
- [x] Birth data form with email field (required) — **DONE in `kundali.astro`**
- [x] Mobile-first — responsive grid, single column on mobile
- [ ] Loading/generating state (astrology API + PDF render will take a few seconds — don't let it feel broken)
- [x] Post-payment download page + email delivery as backup — **DONE via `/download/:id` + Zoho SMTP**
- [x] Backend config drives price, CTA, features — **DONE via `/api/config/financial_kundali`**
- [ ] Add countdown timer for urgency (configurable via backend)
- [ ] Add social proof section (testimonials, stats)

## 4. Payment
- [x] Razorpay integrated — **DONE in `src/lib/payment.ts`**
- [x] Cashfree as fallback — **DONE in `src/lib/payment.ts`**
- [x] Payment **before** generation trigger — **DONE: webhook confirms → PDF generated**
- [x] Refund/webhook handler — **DONE: `/webhook/razorpay` + `/webhook/cashfree`**
- [x] Refund policy text — **DONE in config endpoint** (24hr no-questions refund)
- [x] Orders stored in MongoDB — **DONE via `src/lib/orders.ts`**

## 5. Domain & Branding
- [ ] Buy a dedicated domain per report category is overkill for v1 — one domain, path-based reports (`/finance`, `/match`, `/gun-milan` later)
- [ ] Keep brand name distinct from Vaayu Labs — separate consumer-astrology brand identity, don't cross-contaminate your B2B SaaS reputation
- [ ] Consistent brand across: domain, Meta Business Page, Ad Account name, Razorpay business name, PDF footer, support email — mismatched names between ad and checkout page is a common trust-killer and can also trigger Meta review flags

## 6. Social + Ads Account Setup (separate from your main accounts)
- [ ] New dedicated Facebook Page for this brand (not personal or Vaayu Labs page)
- [ ] New Meta Business Manager (separate BM, not just a new page under existing BM) — keeps ban blast radius contained if this account gets flagged
- [ ] New ad account under that BM, funded independently
- [ ] Use a separate payment method for this ad account if possible (different card) — isolates billing disputes from your main business
- [ ] Warm up the Page for a few days (some organic posts, profile completion) before first ad spend — cold pages with day-1 ad spend get flagged more
- [ ] Keep domain, pixel, and page all under the same new BM from day one — don't verify domain under your personal/agency BM

## 7. Ads / Meta Policy Compliance
- [ ] Astrology/spiritual products sit in a Meta grey zone — avoid "personal attributes" targeting language and health/financial-outcome claims in ad copy (no "guaranteed," no implied medical/financial promises)
- [ ] Prepare 3-4 creative variants day one (video hook, static teaser-score screenshot, testimonial-style, curiosity-headline) — expect some to get rejected, don't launch with only one
- [ ] Budget: start small (₹1,000-1,500/day range) across 2-3 ad sets to find winning creative before scaling spend — don't front-load your full budget into one ad set
- [ ] Set a hard CAC ceiling before launch (CAC must stay under your ₹199 margin minus API/Razorpay/PDF costs) and kill underperforming ads fast

## 8. Deployment
- [ ] Deploy API/backend on your existing Contabo VPS or Cloudflare Workers (whichever already hosts your n8n/other tools — don't add new infra to manage)
- [x] Set up basic uptime monitoring + alert (Telegram bot) — **DONE via `/telegram/bot` webhook with /today, /week, /month, /lastmonth commands**
- [ ] Log every paid-but-failed-generation case explicitly so you can manually recover/refund fast

## 9. Analytics / Tracking (easy to forget, costly if missing)
- [ ] Meta Pixel + Conversion API (server-side) both wired — iOS tracking loss makes pixel-only unreliable
- [ ] Track funnel steps: landing view → form submit → payment initiated → payment success → PDF downloaded (so you know where drop-off actually happens)
- [ ] UTM discipline from day one (you're already doing this per the ad link you shared — keep it consistent)

## 10. Legal / Trust Basics
- [x] Refund policy page — **BUILDING NOW**
- [x] Simple disclaimer footer on every PDF — **DONE in email template + config**
- [x] Privacy policy covering birth data storage/usage — **BUILDING NOW**
- [x] About page — **BUILDING NOW**
- [x] Terms page — **BUILDING NOW**

## 11. Scale Path (only after Financial Kundali proves out)
- [ ] Reuse same chart-JSON cache to add Match/Gun Milan/Janm/Gruh reports without new API integration work — just new PDF templates + new narrative mapping
- [ ] Each new report type = new landing page + new PDF template, same backend/payment/PDF pipeline
- [ ] Consider bundle pricing (e.g., Finance + Match together) once 2+ reports exist, as an upsell — but keep it a *single* checkout step, not a second paywall after purchase
