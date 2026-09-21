# Financial Report — Simplest Build & Sell Path

**Date:** 2026-09-21
**Scope:** One SKU only — the **Financial Kundali** report — shipped reliably and profitably.
**Reconciles:** `2026-09-21-prokerala-cost-monetization.md` (cost) + `2026-09-21-pdf-quality-review-corrected.md` (quality) + `2026-09-21-payment-report-implementation.md` (pipeline).
**Status:** Proposal. No code changes yet.

---

## 1. The decision in one paragraph

We already have the hard part built: one Mongo document per kundali, a paid pipeline
(teaser → checkout → webhook/verify → PDF → email/Telegram/download). The two reviews
say (a) ProKerala's PDF is too expensive per order below ₹199, and (b) our local
`render.ts` PDF currently **ships broken** (empty planet table, blank Lagna, flat 5/10
scores) and is **70% dasha noise**. So the simplest path is: **keep the pipeline, fix the
local renderer, and sell self-generated financial reports at ₹199.** ProKerala's PDF
stays off (cost) until it can be sold as a separate premium SKU.

**Build (self-gen) wins on simplicity here** because it is ~4–8× cheaper (≈₹14 vs
₹60–130), needs no credits to test, and lets us control exactly what a "financial report"
contains. The catch — and the only real work — is making it correct and financial-first.

---

## 2. Non-negotiables before any ad spend

These are correctness issues, not features. Ship these first or the SKU is unsellable.

1. **Never render a degraded chart.** In `lib/report.ts` / `render.ts`, validate the
   stored doc before generating:
   - `planet_positions` has ≥ 7 planets **and** an `ascendant` row.
   - Lagna sign id resolves (non-zero) and at least one money-axis input planet exists.
   - If validation fails: do **not** produce a PDF. Keep the doc `paid`, alert Telegram,
     send the "processing / team notified" email, and retry. (The existing
     `ProkeralaQuotaError` fallback path is the model.)
2. **Money-axis scores must be derived, never defaulted.** If the six scores would all
   come out equal, treat that as a validation failure (see 1). Flat 5/10 sold as insight
   is worse than no report.
3. **Cut the dasha dump.** Pratyantardasha detail only for the **current** mahadasha
   (± next antardasha). Every other mahadasha gets its antardasha table only. This takes
   the report from ~58 pages to ~15–20.

Items 1–3 also fix the already-shipped bad order (`TeaMkMFBnr228X`).

---

## 3. Minimal financial report structure (target ~16–20 pages)

Financial-first, not a generic horoscope. Reuse the teaser's visual identity.

| # | Section | Source | Notes |
|---|---------|--------|-------|
| 1 | **Branded cover** (name, birth strip: lagna/rashi/nakshatra, report no.) | local | copy the teaser's dark/gold design |
| 2 | Table of contents | local | static |
| 3 | **At-a-glance summary** — lagna, rashi, nakshatra, weakest planet, 6 money-axis scores | local + `scores.ts` | the "one page that sells" |
| 4 | Birth details + panchang + avakahada | kundli + panchang | compact tables |
| 5 | Lagna & Rashi brief | kundli | 2 short paragraphs |
| 6 | Planetary positions table + 9 short per-planet notes | planet-position | guard empty |
| 7 | House analysis, **emphasis on 2, 6, 10, 11** (wealth/career/income) | kundli | 12 brief entries |
| 8 | Yogas — highlight Dhana / Lakshmi / wealth yogas | yoga-details | |
| 9 | Doshas + consolidated remedies | mangal, kaal-sarp, sade-sati | one page |
| 10 | **Dasha — current ± next only**, with a financial-timing note | dasha-periods | see §2.3 |
| 11 | Money-axis narratives (6 axes) | `scores.ts` | explain each score |
| 12 | Conclusion + disclaimer | local | |

Explicitly **out of v1:** chart graphics (donut/diamond/Navamsa — none exist in
`render.ts`, it is a text/table Block model), numerology, match/Guna Milan, year guides.
Those are later SKUs, not part of this one.

---

## 4. Data calls & credit cost (teaser + report)

Teaser stays lean (unchanged): `kundli` (50) + `planet-position` (30) + `panchang` (10)
≈ **90 credits ≈ ₹0.90**, stored once in the `kundalis` doc.

Report reuses the stored `raw`/`parsed` — **no re-fetch for the same doc**. The lean
teaser doc lacks `yoga`/`dasha`/`kaal-sarp`/`sade-sati`, so we fetch just those once at
**first generation** and cache them on the same doc:

| Endpoint | Credits | ₹ @ Ruby |
|---|---|---|
| Yoga Details | 200 | ₹2.00 |
| Dasha Periods | 200 | ₹2.00 |
| Kaal Sarp | 30 | ₹0.30 |
| Mangal Dosha | 30 | ₹0.30 |
| Sade Sati (basic) | 30 | ₹0.30 |
| **Report data total** | **~490** | **~₹4.90** |

Per order (teaser + report) ≈ **580 credits ≈ ₹5.80**. (The cost doc's ₹14 assumes the
advanced/full endpoint set; we only need the five financial-relevant extras above.)

Note: this is the one place we add cost after the teaser. Store the fetched extras on the
`kundalis` doc so reports/regenerations never re-spend.

---

## 5. Render approach (simplest possible)

- Keep `render.ts` HTML → `html-pdf-node` PDF (already wired, with retries).
- Set the report source to **local** (`PROKERALA_PDF_REPORT=false`); ProKerala PDF API is
  not used for this SKU.
- Add: branded cover CSS, TOC, at-a-glance page, weakest-planet callout.
- Trim `buildBlocks()` to the §3 sections and the §2.3 dasha rule.
- No new libraries, no chart engine, no infra changes. Pipeline, Mongo doc, archive
  (MinIO/local), email, Telegram, download all stay as-is.

---

## 6. Price & margin

| Price | Report data | Razorpay (~2.4%) | Contribution |
|---|---|---|---|
| **₹199 (recommended)** | ~₹4.90 | ~₹4.70 | **~₹189** |
| ₹99 (volume tier) | ~₹4.90 | ~₹2.40 | ~₹92 |

At ₹199 self-generation the margin is very healthy; even ₹99 is profitable (unlike the
ProKerala "Full" set, which is negative at ₹99). Keep the flagship at **₹199** to match
`config.ts` (`financial_kundali`) and the teaser's ₹199 upsell CTA.

---

## 7. What we deliberately do NOT do (yet)

- No second SKU (Dosha/Numerology) until one report is correct and selling.
- No ProKerala PDF API for this SKU (cost + it needs credits we do not have loaded).
- No chart graphics.
- No WhatsApp, no status page, no watermark (nice-to-have; not blocking a first sale).
- No schema/pipeline changes — the Mongo doc already carries everything needed.

---

## 8. Execution checklist

**P0 — make it correct (day 1)**
- [ ] Chart validation guard in `report.ts`/`render.ts`; fail loudly, never ship blank data.
- [ ] Fail if all six money-axis scores are equal/defaulted.
- [ ] Dasha: current ± next only.

**P1 — make it financial-first (days 2–3)**
- [ ] Reorder/reduce `buildBlocks()` to the §3 structure.
- [ ] Branded cover + TOC + at-a-glance + weakest-planet summary (reuse teaser styling).
- [ ] Fetch the 5 report-only endpoints once, store on the `kundalis` doc.

**P2 — ship one real report (day 4)**
- [ ] `PROKERALA_PDF_REPORT=false`; regenerate order `TeaMkMFBnr228X` and verify all
      sections populated (Lagna, 9 planets, 12 houses, 6 real scores, remedies, dasha).
- [ ] Page count in the 16–20 range.
- [ ] Sell at ₹199; watch one full live order end-to-end (teaser → pay → email → download →
      Telegram sale + download alerts).

**P3 — after first revenue**
- [ ] R2/durable storage for `archive/`.
- [ ] Cost instrumentation (credits per order, low-balance alert).
- [ ] Then decide on the second SKU / ProKerala premium tier.

---

## 9. Definition of done

A paying customer at ₹199 receives a **branded, ~16–20 page, finance-focused** PDF where
Lagna, the planetary table, all 12 houses, remedies and six derived money-axis scores are
populated and non-uniform — generated from the same Mongo doc the free teaser created,
with no manual step and no broken output.
