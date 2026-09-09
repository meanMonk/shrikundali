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

## Priority-ordered task list (build order)

### P0 — Funnel-critical, blocks "3-minute purchase" promise
1. Merge form into the landing page as `#form-section` (remove hard nav to `/kundali`
   for the primary path); keep `/kundali` only if needed as a fallback/deep-link target.
2. Build the live free teaser: birth-details → instant on-page Lagna/Rashi/Nakshatra/
   dosha-flag, computed via existing backend teaser logic (or new `/teaser` endpoint) —
   capture WhatsApp/email only at "Unlock Full Report," not before.
3. Convert form to 3-step progressive UI (Who / Birth Details / Delivery+Language) with
   step indicator and per-field reassurance microcopy; add approximate-time fallback
   (range picker, non-blocking).
4. Audit and fix mobile responsiveness end-to-end: one field-group per viewport, ≥44px
   tap targets, native pickers, sticky bottom bar wired to the merged form section,
   WhatsApp `wa.me/` deep link.

### P1 — Trust & conversion mechanics
5. Apply brand system: color tokens (`#B5451C`/`#241E4E`/`#C9A227`/`#FBF6EF`/etc.),
   Fraunces/Lora headings + Inter/Manrope body + Noto Sans Devanagari fallback; replace
   inline `#8b4513`-style ad hoc colors with the token set repo-wide.
6. Pricing block to spec: struck price, %-off badge, trust row under CTA, price recap
   above final "Pay ₹[amount] Securely" button.
7. Static sample-report preview carousel (blurred/watermarked pages) as secondary trust
   element alongside the live teaser.
8. CTA copy consistency pass — one verb everywhere, price inside button on payment step.
9. Trust-elements checklist pass near every CTA (not just footer): secure badges,
   privacy line, delivery time restated at hero/pricing/form, refund/support contact.

### P2 — Post-purchase & analytics completeness
10. Build `/report/[order-id]/status` 3-stage tracking page + `GET` status endpoint.
11. Verify/extend `lib/tracking.ts` to cover all 5 success metrics in PRD §11.
12. Devanagari/Hindi rendering QA pass at mobile widths (font fallback check).
13. Image optimization pass: lazy-load + responsive `srcset` for any report/sample
    imagery.

### P3 — Decisions needed before building (flag to user, don't build blind)
14. Resolve PRD §13 open decisions: final CTA verb (recommend "Get My Kundli Report"),
    approximate-time handling (recommend soft-optional), countdown timer usage
    (recommend skip or real server-side expiry).
15. Decide Place-of-Birth input: keep static 50-city list vs. real geocoding/autocomplete
    API (cost + coverage tradeoff).

## Notes for issue creation
- Each numbered item above → one GitHub issue, labeled by priority (P0/P1/P2/P3) and
  area (frontend/backend/content/decision).
- P0 items should be sequenced 1→2→3→4 since the teaser (2) and step UI (3) both live
  inside the merged form section from (1).
- Issues should each include: what's currently there, exact PRD section reference, and
  acceptance criteria (what "done" looks like), so no re-litigating scope mid-build.
