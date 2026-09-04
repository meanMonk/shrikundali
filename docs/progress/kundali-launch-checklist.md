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
| Production Data | ⚠️ Blocked | Sandbox tier returns limited fields |
| Cloud Storage (R2) | ❌ Not started | Currently local filesystem only |
| Payment Integration | ❌ Not started | |
| Frontend/Landing | ❌ Not started | |

## 1. API / Data Layer
- [x] Primary provider finalized: **Prokerala** (integrated in `packages/backend/kundaliapi/src/lib/prokerala.ts`)
- [ ] Map ₹/credit cost per report → confirm true unit economics before setting price
- [ ] Pick a **fallback provider** (AstrologyAPI or similar) and stub the same interface so you can swap with one env var
- [ ] Add retry + timeout + circuit breaker around the API call (don't let a slow astrology API block checkout)
- [ ] Cache raw chart JSON per birth-datetime+location so repeat/refund/regeneration doesn't re-spend credits
- [ ] Decide narrative layer: static templates keyed by planet/house/dosha combos vs LLM-generated — templates are cheaper and more predictable for v1
- [ ] **Verify Prokerala plan**: Current sandbox/test tier returns limited data (nakshatra, mangal dosha, yogas only). Production tier needed for: planet positions, dasha periods, house positions, numerology

## 2. PDF Generation
- [x] PDF generation implemented via `html-pdf-node` (html→pdf approach) in `packages/backend/kundaliapi/src/lib/render.ts`
- [x] Markdown renderer working (`renderMarkdown()`) with birth details, doshas, yogas
- [x] HTML renderer working (`renderHTML()`) with styled template
- [ ] Test render with full Hindi text (matras, conjuncts, retrograde symbols) before going live — this is your actual differentiation vs competitors
- [ ] **Storage gap**: PDF/Markdown only stored when calling `/pdf` or `/markdown` endpoints directly. `/generate` endpoint only stores JSON. Consider storing all formats on every generation.
- [ ] Move from local filesystem (`archive/uploads/`) to Cloudflare R2 for production (signed, expiring download URLs)
- [ ] Add report ID + purchase email watermark/footer (anti-sharing, plus support traceability)

## 3. Frontend / Landing Page
- [ ] One-hop funnel: free teaser (locked scores) → single payment → full report. No second paywall after payment — this is your main trust edge over KundaliAstro
- [ ] Birth data form (DOB, time, place with geocoding/timezone lookup) with clear validation before hitting the paid API call
- [ ] Mobile-first — this traffic is 90%+ Meta mobile
- [ ] Loading/generating state (astrology API + PDF render will take a few seconds — don't let it feel broken)
- [ ] Post-payment download page + email delivery as backup (people lose tabs)
- [ ] **API routes ready**: `/kundali/generate`, `/kundali/markdown`, `/kundali/pdf` — frontend just needs to call the right one based on user action

## 4. Payment
- [ ] Razorpay — you already have it integrated across projects, reuse it; no reason to switch for v1
- [ ] Payment **before** generation trigger, not before download only — generate only after payment webhook confirms, don't trust client-side redirect alone
- [ ] Add refund/webhook handler (Razorpay webhook → mark order paid → trigger generation), don't rely on frontend polling
- [ ] Decide refund policy text now (KundaliAstro offers 24hr no-questions refund — copy this, it kills objection-handling friction)

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
- [ ] Set up basic uptime monitoring + alert (Telegram bot, since you already use one for admin) for payment webhook and PDF generation failures specifically — silent failures here = lost revenue + refund requests
- [ ] Log every paid-but-failed-generation case explicitly so you can manually recover/refund fast

## 9. Analytics / Tracking (easy to forget, costly if missing)
- [ ] Meta Pixel + Conversion API (server-side) both wired — iOS tracking loss makes pixel-only unreliable
- [ ] Track funnel steps: landing view → form submit → payment initiated → payment success → PDF downloaded (so you know where drop-off actually happens)
- [ ] UTM discipline from day one (you're already doing this per the ad link you shared — keep it consistent)

## 10. Legal / Trust Basics
- [ ] Refund policy page (linked from checkout, not buried)
- [ ] Simple disclaimer footer on every PDF: "for guidance, not a substitute for professional financial/legal/medical advice" — reduces liability and matches industry norm (KundaliAstro has this exact line)
- [ ] Privacy policy covering birth data storage/usage — you're collecting DOB/time/place, treat it as PII

## 11. Scale Path (only after Financial Kundali proves out)
- [ ] Reuse same chart-JSON cache to add Match/Gun Milan/Janm/Gruh reports without new API integration work — just new PDF templates + new narrative mapping
- [ ] Each new report type = new landing page + new PDF template, same backend/payment/PDF pipeline
- [ ] Consider bundle pricing (e.g., Finance + Match together) once 2+ reports exist, as an upsell — but keep it a *single* checkout step, not a second paywall after purchase
