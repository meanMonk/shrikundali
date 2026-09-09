# Google Ads Campaign Setup — 2 Campaigns

**Product:** Premium Kundli PDF Report (single SKU, no consultations/upsells — PRD §2,
§12). **Landing target:** `/` (single scrollable page with embedded form once
`docs/prd/frontend-gap-plan.md` issue #19 lands) — do not launch ads pointed at a
separate `/kundali` page once the merge ships, to avoid the extra funnel hop PRD flags.
**Creative assets:** pull from `docs/prd/ai-image-generation-prompts.md` §C (5 campaign
creative variants) once generated.

**Prerequisite decision:** final CTA verb (see frontend-gap-plan.md decision issue) must
be locked before ad copy below is finalized verbatim — copy here uses the PRD's
recommended **"Get My Kundli Report"** as the working default; swap consistently across
both campaigns if a different verb is chosen.

---

## Campaign 1 — Search: High-Intent Keyword Capture

**Goal:** capture people already searching for a kundli/astrology report — lowest-funnel,
highest-intent traffic. This is the primary campaign; fund it first.

| Setting | Value |
|---|---|
| Campaign type | Search |
| Campaign subtype | Standard (not Dynamic Search Ads at launch — single SKU doesn't need it) |
| Goal | Sales / Leads (conversion action = payment-complete event, see tracking note below) |
| Bidding strategy | **Maximize Conversions**, no target CPA for first 2 weeks (needs ~15-30 conversions to have enough data) → switch to **Target CPA** once CAC ceiling is known (PRD launch-checklist references a hard CAC ceiling tied to the ₹199 margin) |
| Budget | ₹800–1,200/day to start (matches launch-checklist guidance to split budget across ad sets rather than front-loading one) |
| Networks | Google Search only — **uncheck Search Partners and Display Network** (avoids low-intent placement bleed on a tight budget) |
| Locations | India — start national, but exclude/deprioritize regions with no Hindi/English report language support if any exist; consider starting Tier-1 + Tier-2 cities only if budget is very tight, then expand |
| Languages | English, Hindi |
| Ad schedule | All days; consider dayparting toward evening hours (7pm-midnight IST) if early data shows better conversion then — astrology/self-reflection browsing skews evening per general category behavior, validate with your own data before hard-committing |
| Devices | No device exclusion at launch, but bid adjustments favor mobile once conversion data confirms it (PRD §7: most traffic is mobile) |

### Ad groups & keywords

**Ad Group 1a — "Kundli Report" (core intent)**
- Exact/Phrase match: `[kundli report]`, `[online kundli report]`, `"detailed kundli report"`, `"kundli report pdf"`, `"personalised kundli report"`
- Negative keywords (campaign-level, apply to both ad groups): `free`, `app`, `software`, `matching`, `marriage matching`, `gemstone`, `consultation`, `call`, `job`, `download crack` — protects budget from mismatched intent (PRD is explicit: no matching/consultations/gemstones product, §12).

**Ad Group 1b — "Vedic Astrology Report" (adjacent intent)**
- Exact/Phrase match: `[vedic astrology report]`, `"birth chart report online"`, `"janam kundli pdf"`, `"detailed horoscope report"`, `[kundli pdf download]`

### Responsive Search Ad (per ad group, ≤30-char headlines / ≤90-char descriptions)

**Headlines (aim for 10-12 pinned/unpinned mix):**
1. Get My Kundli Report
2. Detailed Vedic Kundli PDF
3. Your Complete Birth Chart
4. Kundli Report in 24-48 Hrs
5. Dosha & Dasha Analysis
6. Available in Hindi & English
7. Private & Confidential
8. Secure Payment · Instant Order
9. Real Vedic Calculations
10. Delivered on Email/WhatsApp
11. Not Just Calculated — Explained
12. Report Only — No Sales Calls

**Descriptions (aim for 4):**
1. A detailed, personalised Vedic astrology report — birth chart, doshas, dashas & remedies. PDF delivered in 24-48 hours.
2. See your real Lagna, Rashi & Nakshatra free before you pay. Full report unlocks after.
3. Secure Razorpay payment. Your birth details stay private and encrypted. No calls, no upsells.
4. Available in English and Hindi. Delivered straight to your WhatsApp or email.

**Sitelinks:** How It Works · Sample Report · FAQ · Refund Policy
**Callouts:** 24-48 Hour Delivery · Secure Payment · Private & Confidential · English & Hindi
**Structured snippets (type: Service catalog):** Birth Chart Analysis, Dosha Analysis, Dasha Timeline, Personalised Remedies

**Final URL:** landing page `/` anchored to `#form-section` (post form-merge); UTM
`?utm_source=google&utm_medium=cpc&utm_campaign=search_kundli_core`

---

## Campaign 2 — Performance Max / Remarketing: Broad Reach + Teaser Completers

**Goal:** two jobs bundled under one campaign structure since this is a single-SKU
funnel — (a) broaden reach beyond exact-match search volume via Performance Max, and
(b) remarket to visitors who completed the **live free teaser** (PRD §1a) but didn't
pay, since they're a warm, proven-intent audience once that feature ships (frontend-
gap-plan.md issue #20).

| Setting | Value |
|---|---|
| Campaign type | Performance Max |
| Goal | Sales, with an explicit "payment-complete" conversion action set as primary; "teaser-complete" set as a secondary (not bid-optimized) conversion signal so PMax learns from it without treating it as the target |
| Budget | ₹500-800/day (smaller than Campaign 1 — this is reach/remarketing, not core intent) |
| Audience signals | 1) Custom segment: people who searched astrology/kundli/horoscope terms recently; 2) Website remarketing: visitors who reached `#form-section` but didn't complete payment (needs the tracking events from frontend-gap-plan.md issue #28); 3) Optional: lookalike from existing customer list once enough real conversions exist |
| Asset groups | One asset group per creative angle from `ai-image-generation-prompts.md` §C — you can run all 5 image variants as separate assets *within* one asset group and let PMax rotate, but tag each with distinct headline/description pairs matching its angle (see below) so reporting can attribute performance per angle |
| Final URL | Same as Campaign 1 (`/#form-section`), UTM `?utm_source=google&utm_medium=pmax&utm_campaign=pmax_remarketing` |

### Asset group copy (one headline/description pair per creative angle, C1-C5)

| Creative | Headline | Description |
|---|---|---|
| C1 Pain-point | "Confused About Your Career Path?" | "Get clarity with a detailed Vedic report covering career, finance & timing — see your real chart free first." |
| C2 Outcome | "Know What's Coming Next" | "A personalised report explaining your dasha timeline in plain language — not just numbers." |
| C3 Trust/authority | "A Report You Can Actually Trust" | "Real Vedic calculations, not guesswork. See your Lagna, Rashi & Nakshatra free before you pay." |
| C4 Seasonal | "{{Season}} Is the Right Time to Look Ahead" | "Get your complete Kundli report — birth chart, doshas, dasha timeline & remedies — in 24-48 hours." |
| C5 Offer | "Get My Kundli Report — ₹[price]" | "One-time payment. Secure checkout. Delivered on email/WhatsApp within 24-48 hours." |

**Headline/description char limits for PMax:** headlines ≤30 chars (short) with up to 5
long headlines ≤90 chars also allowed — write a long-form variant of each row above if
time permits; descriptions ≤60/90 chars per Google's short/long description slots.

**Logo/business name assets:** needs a square (1:1, min 128×128) and landscape (4:1)
brand logo — not covered by the image-prompt doc (that doc is content imagery, not
logo); flag as a separate small asset need if a logo doesn't already exist.

---

## Cross-campaign requirements (blocks launch if missing)

1. **Conversion tracking must fire on "payment-complete," not "form-submit."** Confirm
   `lib/tracking.ts` (frontend-gap-plan.md issue #28) sends a Google Ads conversion event
   tied to actual Razorpay success, not just form completion — otherwise both campaigns
   will optimize toward the wrong signal.
2. **Teaser-complete signal** (for Campaign 2's remarketing audience) depends on the live
   teaser feature (frontend-gap-plan.md issue #20) actually shipping and firing a
   trackable event — Campaign 2's remarketing audience is empty/inert until then.
3. **Negative keyword list must be shared/synced** across both campaigns to avoid budget
   leaking into matching/consultation/gemstone searches, which this product explicitly
   does not offer (PRD §12).
4. **Landing page must point to the merged single-page funnel** (frontend-gap-plan.md
   issue #19) before spend scales — sending paid traffic through the old two-page hop
   wastes budget on a funnel step the PRD identifies as unnecessary friction.
5. **CAC ceiling check:** per the launch checklist, CAC must stay under the ₹199 margin
   minus API/Razorpay/PDF costs — set a manual campaign-level budget cap and check daily
   for the first week rather than trusting automated bidding immediately, since Maximize
   Conversions can overspend during the learning phase.

## Open decisions (flag before launch spend)

- [ ] Confirm final report price to bake into ad copy (C5/Campaign 2 offer row uses
      `[price]` placeholder) — must match whatever the pricing-block issue
      (frontend-gap-plan.md) finalizes.
- [ ] Confirm whether Hindi-language ad copy variants are needed for the Hindi-report
      audience, or whether English ad copy funneling to a language-choice-in-form is
      sufficient for launch.
- [ ] Decide festival/seasonal cue for Campaign 2's C4 asset row (`{{Season}}`) based on
      actual launch date.
