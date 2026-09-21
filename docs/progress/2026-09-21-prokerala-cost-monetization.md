# ProKerala Cost Review — Build vs Buy & Quick Revenue Plan

**Date:** 2026-09-21
**Scope:** What we can ship quickly to earn, at what cost, and whether to generate the PDF ourselves or use ProKerala's report API.
**Sources:** ProKerala [pricing](https://api.prokerala.com/pricing), [credits](https://api.prokerala.com/api-credits), [PDF reports](https://api.prokerala.com/pdf-reports), [docs](https://api.prokerala.com/docs) · our PRD `docs/prd/shrikundali-frontend-prd.md` · `docs/progress/kundali-launch-checklist.md`

---

## 1. ProKerala pricing (INR, excl. GST)

| Plan | Price/mo | Credits/mo | Rate limit | Effective ₹/credit |
|---|---|---|---|---|
| Free | ₹0 | 5,000 | 5 req/min | — |
| **Ruby** | **₹999** (50% off ₹1,999) | **100,000** | 60 req/min | **₹0.00999** |
| Emerald | ₹2,499 | 350,000 | 120 req/min | ₹0.00714 |
| Sapphire | ₹4,999 | 1,000,000 | 300 req/min | ₹0.00500 |
| Top-up | ₹2,500 | 100,000 (3-mo validity) | — | ₹0.025 |

So your figure is right: **Ruby = ₹999 for 100,000 credits ≈ ₹0.01/credit.**

---

## 2. Credit cost of the pieces we use (English)

### 2.1 JSON data endpoints (cheap)
| Endpoint | Credits | ₹ @ Ruby |
|---|---|---|
| Kundli Basic | 50 | ₹0.50 |
| Kundli Advanced (includes dasha) | 300 | ₹3.00 |
| Planet Position | 30 | ₹0.30 |
| Panchang Basic | 10 | ₹0.10 |
| Mangal Dosh (basic/adv) | 30 / 100 | ₹0.30 / ₹1.00 |
| Kaal Sarp | 30 | ₹0.30 |
| Sade Sati (basic/adv) | 30 / 150 | ₹0.30 / ₹1.50 |
| Yoga Details | 200 | ₹2.00 |
| Dasha Periods | 200 | ₹2.00 |
| Planet Relationship | 200 | ₹2.00 |
| Sarvashtakavarga | 300 | ₹3.00 |
| Sudharshana Chakra | 100 | ₹1.00 |
| Birth Details | 50 | ₹0.50 |
| Kundali Matching (basic/adv) | 50 / 200 | ₹0.50 / ₹2.00 |
| Advanced Raja Yoga | 20,000 | ₹199.80 |

### 2.2 PDF Report API — **minimum 6,000 credits/request (₹59.94)**
Module prices (Vedic Personal Report): most modules **1,000** each (Birth Details, Rasi & Navamsa Chart, Planet Positions, Mangal Dosha, Yoga, Kaalsarp, Sade Sati, Shodasavarga, Vimsottari Dasha, Papa Dosha, Shodashvarga Table, Shadbala Table, Favourable Periods), some **500** (Planet Relationship, Ashtakavarga, Sudharshanachakra), **2,000** (Sarvashtakavarga), **200** (Bhava Chart).

| Ready-made report | Credits | ₹ @ Ruby | Pages |
|---|---|---|---|
| Single Page Horoscope | 6,000 | ₹59.94 | 1 |
| Guna Milan (compatibility) | 15,000 | ₹149.85 | 18+ |
| Porutham (Kerala/Tamil) | 15,000 | ₹149.85 | 20+ |
| Rahu-Ketu Transit | 200,000 | ₹1,998 | 22+ |
| Saturn Transit | 350,000 | ₹3,496 | 25+ |
| Jupiter Transit | 350,000 | ₹3,496 | 30+ |
| Year Guide | 300,000 | ₹2,997 | 30+ |

### 2.3 Assembled "premium personal report" module sets
| Set | Modules | Credits | ₹ @ Ruby |
|---|---|---|---|
| **Lite** | birth-details, chart, planet-position, yoga, kaalsarp, mangal, sade-sati, dasa (8×1,000) | 8,000 | **₹79.92** |
| **Full** (ProKerala demo set) | lite + sudharshanachakra(500) + planet-relationship(500) + sarvashtakavarga(2,000) + shodashvarga(1,000) + papa-dosha(1,000) | 13,000 | **₹129.87** |

---

## 3. Cost per order: the two options

### Option A — Load ProKerala's PDF report (buy)
- Teaser (lean JSON): **₹0.90** (90 credits)
- Report: **₹60** (min) → **₹80** (lite) → **₹130** (full)
- Our work: ~0 (already integrated). White-label via `brand_name`/`footer`/`template.style`.

### Option B — Generate the PDF ourselves (build)
- Data: advanced(300) + planets(30) + panchang(10) + yoga(200) + dasha(200) + kaal-sarp(30) + sade-sati adv(150) + planet-relationship(200) + sarvashtakavarga(300) ≈ **1,420 credits = ₹14.18**
- Rendering: local `html-pdf-node`, server CPU only (~₹0 marginal)
- Missing vs ProKerala: **actual chart graphics** (Rasi/Navamsa/Shodashvarga/Ashtakavarga images) and professional paragraph depth. Template narrative is weaker.

| | Teaser | Report cost | Per-order contribution @ ₹99 | @ ₹199 | @ ₹299 |
|---|---|---|---|---|---|
| A — ProKerala min (6k) | ₹0.90 | ₹59.94 | ₹36.5 | ₹136.5 | ₹236.5 |
| A — ProKerala lite (8k) | ₹0.90 | ₹79.92 | ₹16.5 | ₹116.5 | ₹216.5 |
| A — ProKerala full (13k) | ₹0.90 | ₹129.87 | **−₹33.4** | ₹66.6 | ₹166.6 |
| A — Guna Milan (15k) | ₹0.90 | ₹149.85 | — | — | ₹146 (₹299) |
| B — Self-generated (1.4k) | ₹0.90 | ₹14.18 | ₹81.5 | ₹181.5 | ₹281.5 |

*(Contribution = price − credits − ~₹2.5 Razorpay fee. Excludes ad CAC, GST, fixed plan.)*

**Key insight:** At ₹99 the *full* ProKerala report **loses money**. At ₹99 only the minimum 6k report (₹60) or self-generation (₹14) are viable. At ₹199–299 the full ProKerala report is fine.

---

## 4. Capacity — what Ruby (100k credits) actually buys

Assuming 500 free teasers/month (45,000 credits) first:

| Report source | Credits left | Reports/mo |
|---|---|---|
| ProKerala full (13k) | 55,000 | **~4** |
| ProKerala min (6k) | 55,000 | **~9** |
| Self-generated (1.4k) | 55,000 | **~39** |

Without teasers, 100k credits = ~7 (full), ~16 (min), ~71 (self-gen) reports.
Emerald (350k): ~23 (full) or ~203 (self-gen) reports after 500 teasers.

**This is the real decision driver:** ProKerala PDF is expensive per unit; self-generation is **~4–8× cheaper** and scales.

---

## 5. Recommendation

**Yes, load ProKerala's PDF report first — but price it at ₹199+, not ₹99.** It gives a genuine 40+ page, chart-rich, paragraph report in days instead of weeks, and is white-labelled to our brand. Then build self-generation for the high-volume ₹99 tier.

Concretely:
1. **Teaser:** keep the lean JSON path (₹0.90). Never use `kundli/advanced` in the teaser.
2. **v1 paid report:** ProKerala PDF, **"Lite" 8k set (₹80)** → sell at **₹199**. Margin ≈ ₹116 before CAC.
3. **Do not** sell the Full 13k report at ₹99 — it's negative.
4. **Build in parallel:** self-generation with chart graphics (₹14/report) → unlock a **₹99 volume SKU** and 4–8× capacity. This is the margin engine.
5. **Reuse charts:** cache by birth-datetime+place so refunds/regenerations don't re-spend credits.

### Capacity plan
| Monthly volume goal | Plan needed (ProKerala PDF @ 8k) | Plan needed (self-gen @ 1.4k) |
|---|---|---|
| ~10 reports + 500 teasers | Ruby ₹999 (tight) | Ruby ₹999 (easy) |
| ~30 reports + 1,000 teasers | Emerald ₹2,499 | Ruby ₹999 |
| ~150 reports + 2,000 teasers | Sapphire ₹4,999 | Emerald ₹2,499 |

---

## 6. What we can offer quickly to make money (ranked)

| # | Product | Source cost | Suggested price | Margin | Effort |
|---|---|---|---|---|---|
| 1 | **Dosha Report** (Mangal + Kaal Sarp + Sade Sati) | ~210 credits ≈ ₹2 | **₹49–99** | ~95% | Low — data + local render, already have renderer |
| 2 | **Numerology Report** (10 numbers) | ~1,500 credits ≈ ₹15 | **₹49–99** | ~85% | Low — data endpoints only |
| 3 | **Financial Kundali** (already built) | ₹80 (ProKerala lite) | **₹199** | ~58% | Done — flip source + price |
| 4 | **Career Kundali** (landing exists) | ₹80 | **₹199** | ~58% | Low — same pipeline, new copy |
| 5 | **Match / Guna Milan** | ₹150 (15k) | **₹299–499** | ~50–67% | Medium — 2-person form + compatibility endpoint |
| 6 | Year Guide / Transits | ₹2,000–3,500 | ₹999+ | ~65% | Only at Emerald/Sapphire; defer |

**Fastest cash:** Dosha + Numerology (near-zero API cost, high margin) as impulse SKUs, with Financial/Career Kundali at ₹199 as the flagship.

---

## 7. Cost of putting it all together

**One-time (dev):**
- Payment/report pipeline: ✅ done
- R2 storage + signed URLs: ~2–3 days
- Status page + PDF watermark: ~2 days
- WhatsApp delivery: ~2–3 days
- Self-generation chart graphics + narrative: ~2–3 weeks (only if going Option B)

**Monthly fixed:**
- ProKerala Ruby: ₹999 (start) → Emerald ₹2,499 at scale
- VPS: existing (no new infra)
- Razorpay: ~2.36% per txn (₹2.4 on ₹99, ₹4.7 on ₹199)
- Domain + support inbox: existing

**Per order variable:** credits (§3) + payment fee.

**Break-even example (₹199, ProKerala lite ₹80, ₹2.5 fee):** contribution ₹116.5 → at ₹1,000/day ad spend, need ~9 orders/day to cover ads; any CAC below ₹116 is profitable.

---

## 8. Next action items
- [ ] Flip `PROKERALA_PDF_REPORT=true`, use the **Lite 8k** module set, price flagship at **₹199**.
- [ ] Buy Ruby (₹999) and verify one real report end-to-end (credit cost + page count + branding).
- [ ] Instrument credit spend per order; alert at low balance.
- [ ] Ship **Dosha** + **Numerology** impulse SKUs (self-rendered) within 1 week.
- [ ] Add chart-cache reuse keyed by birth-datetime+place.
- [ ] Decide build (self-gen) vs buy once 2 weeks of order data exist.
