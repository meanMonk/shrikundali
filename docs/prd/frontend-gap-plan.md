# ShriKundali Frontend — Gap Analysis & Build Plan (2026-09-09)

Source of truth: `docs/prd/shrikundali-frontend-prd.md`. This doc maps that PRD against the
current code in `packages/web/kundaliweb/src/` and turns the gap into an ordered,
priority-tagged task list. Each task later becomes a GitHub issue.

## Current state (as of this audit)

Files: `pages/index.astro` (444L, landing), `pages/kundali.astro` (251L, separate
form+payment page), `pages/{about,privacy,terms,refund,disclaimer,sitemap}.astro`,
`layouts/Base.astro`, `lib/tracking.ts`.

**What's done:**
- Landing page exists with hero, pain points, feature grid, "how it works", testimonials,
  FAQ accordion, bottom CTA, sticky mobile CTA-on-scroll.
- Legal/static pages present: privacy, terms, refund, about, disclaimer, sitemap.
- Separate `/kundali` page handles form → Razorpay checkout → status messages.
- One `@media (max-width:768px)` block in index.astro; one in kundali.astro for the
  testimonial grid only.
- Backend routes exist for teaser/checkout/download/telegram/mail (per recent commits).

**What's missing or diverges from the PRD — this is the gap the plan below closes:**
1. **Funnel shape mismatch (PRD §4, §6):** PRD specifies ONE scrollable page with an
   inline, progressive, multi-step form embedded in `#form-section`. Current build splits
   this into `index.astro` (marketing) + separate `kundali.astro` (form/payment) — an
   extra navigation/page-load step, which is exactly the "separate checkout page" pattern
   the PRD says to avoid (§6 opening line).
2. **No live free teaser (PRD §1a, §5.3-1):** the single highest-leverage differentiator
   in the PRD — compute Lagna/Rashi/Nakshatra/dosha-flag live and show it before payment —
   is not implemented on the frontend even if a `/teaser` backend route exists.
3. **No progressive step UI (PRD §6):** PRD wants 3 grouped steps (Who/Birth
   Details/Delivery) with a "Step 2 of 3 · ~40s left" indicator and per-field reassurance
   microcopy. Current form appears to be flat/single-shot (needs confirmation once form
   markup is reviewed in detail during ticket work).
4. **Approximate birth time fallback (PRD §6, §13):** "Don't know exact time?" → range
   picker instead of hard-blocking submission — not confirmed present.
5. **Brand/visual identity not applied (PRD §3):** current palette is generic brown/tan
   (`#8b4513`) inline styles, not the specified Deep Saffron-Maroon `#B5451C` / Indigo
   `#241E4E` / Gold `#C9A227` / warm off-white `#FBF6EF` system. No serif heading font
   (Fraunces/Lora) + geometric sans body pairing; no Devanagari-safe fallback confirmed.
6. **Responsiveness is minimal, not mobile-first (PRD §7):** only 2 total `@media` rules
   across both pages. PRD requires: one field-group per mobile viewport in the form,
   ≥44px tap targets, native date/time pickers, WhatsApp deep-link (`wa.me/`), tested
   Devanagari rendering at mobile widths, responsive/lazy-loaded images.
7. **Sample report preview missing (PRD §5.3-2):** no blurred/watermarked sample PDF
   pages carousel as the fallback trust element.
8. **Pricing block not to spec (PRD §5.5):** needs struck price + %-off badge + trust row
   directly under CTA (`🔒 Secure Payment · 🔐 Private · 📄 Instant confirmation`) —
   confirm current pricing markup against this.
9. **Testimonials not outcome-based per PRD wording (PRD §5.7):** current copy already
   leans outcome-based ("loan release timing was accurate") — mostly fine, but needs a
   pass to ensure city+name+verified-tag format and remove any generic "very accurate"-only
   quotes.
10. **Post-payment status page missing (PRD §9.3):** `/report/[order-id]/status` 3-stage
    progress page not present — currently likely just inline status text on `/kundali`.
11. **CTA copy consistency (PRD §8):** need to audit that one verb ("Get My Kundli
    Report") is used identically in hero, pricing block, and footer CTA — currently mixed
    ("Get Your Report Now →", "Get Your Report →").
12. **Trust elements checklist (PRD §10):** confirm secure-payment badges/logos, privacy
    line, delivery time restated at hero+pricing+form, refund/support contact visible
    pre-payment — needs an audit pass, likely partially present via disclaimer text only.
13. **Analytics/success metrics (PRD §11):** `lib/tracking.ts` exists (47L) — needs
    verification it captures: form-start→complete, complete→payment, mobile vs desktop
    split, time-to-first-CTA-click, sample-preview engagement. Likely partial.
14. **API needs (new, to plan for):**
    - `POST /teaser` — compute Lagna/Rashi/Nakshatra/dosha-flag from birth details,
      unauthenticated, rate-limited (used for the live free teaser).
    - `GET /report/:orderId/status` — order status for the post-payment tracking page
      (Received/Generating/Delivered).
    - Confirm existing `checkout`, `download`, `telegram`, `email` routes match the
      unlock-after-teaser flow (contact info captured at unlock, not before).
    - Geocoding/place-autocomplete API for "Place of Birth" — confirm whether this is a
      client-side static city list (50+ Indian cities per commit log) or needs a real
      autocomplete API; PRD says "autocomplete," a static list of 50 cities may be
      insufficient for full India coverage — flag as open decision.

## Priority-ordered task list (build order) — with GitHub issue cross-references

### P0 — Funnel-critical, blocks "3-minute purchase" promise

| # | Task | Issue | Status |
|---|------|-------|--------|
| 1 | Merge form into landing page as `#form-section`, remove `/kundali` from primary path | [#34](https://github.com/meanMonk/shrikundali/issues/34) (scope item 1) | OPEN |
| 2 | Live free teaser — wire to AstrologyAPI, show real Lagna/Rashi/Nakshatra/dosha | [#35](https://github.com/meanMonk/shrikundali/issues/35) | OPEN |
| 3 | Form restructure — single group or 2-step, email moved to payment modal only | [#43](https://github.com/meanMonk/shrikundali/issues/43) | OPEN |
| 3a | Add Gender field to birth details form | [#39](https://github.com/meanMonk/shrikundali/issues/39) | OPEN |
| 4 | Payment modal — replace `/kundali` redirect with in-page modal (PRD §6a) | [#36](https://github.com/meanMonk/shrikundali/issues/36) | OPEN |
| 5 | Mobile responsiveness audit + fixes (sticky bar mobile-only, tap targets, etc.) | [#22](https://github.com/meanMonk/shrikundali/issues/22) + [#40](https://github.com/meanMonk/shrikundali/issues/40) | OPEN |

**Sequencing:** 1 → 3 → 3a → 2 → 4 → 5 (form merge first, then restructure, then teaser, then modal, then mobile)

### P1 — Trust & conversion mechanics

| # | Task | Issue | Status |
|---|------|-------|--------|
| 6 | Apply brand system (color tokens, fonts, Devanagari fallback) | [#34](https://github.com/meanMonk/shrikundali/issues/34) (scope item 5) | OPEN |
| 7 | Pricing block to spec — single source of truth for price | [#41](https://github.com/meanMonk/shrikundali/issues/41) | OPEN |
| 8 | CTA copy consistency — one verb everywhere | [#37](https://github.com/meanMonk/shrikundali/issues/37) | OPEN |
| 9 | Trust elements near every CTA | [#38](https://github.com/meanMonk/shrikundali/issues/38) | OPEN |
| 10 | Static sample-report preview carousel | [#25](https://github.com/meanMonk/shrikundali/issues/25) | OPEN |

### P2 — Post-purchase & analytics completeness

| # | Task | Issue | Status |
|---|------|-------|--------|
| 11 | Build `/report/[order-id]/status` tracking page | [#27](https://github.com/meanMonk/shrikundali/issues/27) | OPEN |
| 12 | Verify/extend analytics tracking for PRD §11 metrics | [#28](https://github.com/meanMonk/shrikundali/issues/28) | OPEN |
| 13 | Devanagari/Hindi rendering QA + responsive image optimization | [#29](https://github.com/meanMonk/shrikundali/issues/29) | OPEN |

### P3 — Decisions needed before building

| # | Task | Issue | Status |
|---|------|-------|--------|
| 14 | Open decisions: CTA verb, birth-time handling, countdown timer, geocoding | [#42](https://github.com/meanMonk/shrikundali/issues/42) | OPEN |

### P1/P2 — Premium visual assets & paid acquisition

| # | Task | Issue | Status |
|---|------|-------|--------|
| 15 | Generate AI image assets (hero, PDF, creatives) | *(not yet created — blocked on brand identity)* | — |
| 16 | Set up Google Ads campaigns (Search + PMax) | [#33](https://github.com/meanMonk/shrikundali/issues/33) | OPEN |

## Notes
- P0 items must be completed before any paid traffic is sent (Google Ads issue #33 is hard-blocked on #35 teaser + #43 form restructure + #37 CTA verb decision)
- Issues #34, #35, #43, #36, #39, #40, #41, #37, #38, #42 were created on 2026-09-09 as part of this gap analysis
- Each issue includes: current state, PRD section reference, scope, and acceptance criteria
