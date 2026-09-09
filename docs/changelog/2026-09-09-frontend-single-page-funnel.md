# Changelog

## 2026-09-09 — Single-page funnel, 3-step form, brand tokens, mocked teaser

Frontend pass covering PRD gap-plan P0/P1 items (`docs/prd/frontend-gap-plan.md`), scoped to
`packages/web/kundaliweb/src/`. GitHub issues: meanMonk/shrikundali #19, #20, #21, #22, #23, #24, #26.

**Landing page (`pages/index.astro`):**
- Form is already embedded as `#form-section` on the landing page (no `/kundali` hop for the
  primary path); `/kundali` remains only as the payment step the form redirects to. (#19)
- Converted the flat form into a 3-step progressive UI — Who / Birth Details / Delivery — with a
  step indicator ("Step N of 3 · ~Ns left"), a progress bar, and per-field reassurance microcopy.
  Field IDs were kept unchanged so the existing submit/geocode logic didn't need rewriting. (#21)
- Added a "Don't know exact time?" checkbox that defaults time to 12:00 PM and disables the field
  instead of blocking submission. (#21)
- Added an on-page free preview (Lagna / Rashi / Nakshatra / dosha flag) shown after birth details
  and before the email field is collected. Contact info (email) is only required at the final
  "Unlock My Full Report" step. (#20)
  - **Mocked for now**: the preview is computed with a deterministic client-side placeholder
    (`mockTeaser()`), not a real chart calculation. The `POST /teaser` call in the actual submit
    handler still hits the backend; a fallback in the fetch `catch` synthesizes a mock response so
    the funnel completes end-to-end even if the backend teaser call fails or is unreachable in a
    given environment.
- Added a pricing recap (struck price, discount, total) plus a trust row
  ("Secure Payment · Private · Delivered in 24–48 hours · 24hr refund") directly above the final
  CTA, and unified all CTA copy to "Get My Kundli Report" (hero, bottom, sticky bar). (#24, #26)
- Applied the brand token system from `layouts/Base.astro` (see below) across all inline styles —
  no more ad hoc `#8b4513`/`#d4a373` hex values in `index.astro`/`kundali.astro`. (#23)
- Added `min-height: 44px` to all interactive form controls/buttons for mobile tap targets. (#22)

**Base layout (`layouts/Base.astro`):** (#23)
- Added CSS custom properties for the full brand palette (`--color-primary` `#B5451C`,
  `--color-primary-hover` `#D45C2C`, `--color-secondary` `#241E4E`, `--color-gold` `#C9A227`,
  `--color-bg` `#FBF6EF`, `--color-surface` `#FFFFFF`, `--color-text` `#2B2620`,
  `--color-text-muted` `#7A7267`, `--color-success` `#3F6B4C`, `--color-border` `#E8DFD1`).
- Added Fraunces (headings) + Inter (body) + Noto Sans Devanagari (fallback for Hindi content)
  via Google Fonts.

**Bug fix (both pages):** the inline `<script is:inline>` blocks used
`import.meta.env.VITE_API_URL`, which throws `Cannot use 'import.meta' outside a module` in a
classic (non-module) inline script — this silently broke the entire form/payment script on both
pages. Fixed by resolving `VITE_API_URL` in the Astro frontmatter (server-side, where
`import.meta.env` is valid) and passing it into the script via `define:vars`.

**Decisions recorded (closes #30, #31):**
- CTA verb: **"Get My Kundli Report"**, used identically everywhere. (#30)
- Approximate birth time: soft-optional, non-blocking (see checkbox above). (#30)
- Countdown timer: **not added** — no real server-side expiry exists yet, and a fake/resettable
  timer is called out as an anti-pattern in the PRD. Revisit only if a real expiring offer ships. (#30)
- Place-of-birth input: **kept the static ~50-city list** for v1 — zero marginal cost, no new
  external dependency, and city-level lookup is enough for the free-teaser accuracy this product
  needs. A real geocoding API is a fast follow if conversion data shows meaningful drop-off from
  users outside the top ~50 cities. (#31)

**Not done in this pass (left open, needs backend or asset work beyond `packages/web`):**
- #25 sample-report carousel — needs real sample PDF pages/screenshots to blur/watermark.
- #27 status page — `GET /download/:id/status` already exists per
  `docs/changelog/2026-09-04-payment-flow.md`; a `/report/[order-id]/status` frontend page wiring
  to it is still open.
- #28 analytics — `lib/tracking.ts` exists but isn't imported by either page (dead code) and has
  invalid TypeScript syntax; needs a real pass, not touched here to stay in scope.
- #29 Devanagari/image QA — needs manual visual verification, left for review.
