# AI Image Generation Prompts (fal.ai) — Website, PDF, Campaigns

**Purpose:** Generate all premium visual assets via fal.ai (plan already purchased — use
existing API key). Every prompt below is written to be pasted directly into a fal.ai
model call. All specs derive from the brand system in
`docs/prd/shrikundali-frontend-prd.md` §3 (Deep Saffron-Maroon `#B5451C`, Deep Indigo
`#241E4E`, Muted Gold `#C9A227`, Warm Off-White `#FBF6EF`) and the stated positioning:
**"modern, trustworthy report product — closer to a premium fintech/legal-doc product
than a spiritual-guru brand."** Avoid stock-cosmos/zodiac-wheel/astrologer-headshot
imagery throughout (explicitly called out as the pattern competitors overuse — PRD §3
Iconography, §1 competitor teardown).

## Model recommendation

- **Backgrounds / abstract premium textures / document motifs:** `fal-ai/recraft-v3`
  (best for clean vector-adjacent, print-safe, design-system-consistent output; supports
  a `style` param — use `realistic_image` for the campaign photo-style creatives, and
  `vector_illustration` or `digital_illustration` for the chart-motif/background pieces).
- **Photo-realistic human/aspirational scenes (campaign creatives):** `fal-ai/flux-pro/v1.1-ultra`
  (highest fidelity for people/scenes; use for campaigns 2, 4, 5 below).
- Always request **no visible text/typography baked into the image** — all copy is
  overlaid separately in Figma/code, so text-in-image causes localization and Hindi/
  English variant pain later.
- Always specify **negative_prompt** to exclude: `stock photo watermark, cartoonish,
  zodiac wheel clipart, tarot cards, crystal ball, generic cosmic swirl background,
  low quality, blurry, extra fingers, text, logo`.

---

## A. Website assets

### A1. Hero section background / stylized report mockup
**Usage:** `pages/index.astro` hero section, replacing any stock imagery. PRD §5.1:
"a stylized sample chart/report mockup (not a stock astrologer photo) — reinforces
'this is a report you'll receive.'"
**Placement spec:** Desktop hero right-column visual, ~1200×1400px effective crop area;
must also crop cleanly to a 1:1 or 4:5 mobile hero (PRD §7 mobile-first). Needs
transparent or off-white (`#FBF6EF`) background edge so it composites into the hero
without a visible box.

```
Prompt: A premium, minimalist 3D-rendered mockup of an elegant printed astrology report
document floating at a slight angle, cover page visible showing an abstract geometric
Vedic birth chart (kundli square-chart motif, NOT a zodiac wheel) rendered in deep indigo
(#241E4E) linework with muted gold (#C9A227) accent lines on a warm off-white (#FBF6EF)
paper texture. Soft studio lighting, subtle drop shadow, shallow depth of field, clean
negative space around the object suitable for compositing onto a website hero background.
Style: modern fintech/legal-document product photography, premium editorial feel, NOT
mystical or cosmic. No text, no logos, no human figures.
Aspect ratio: 4:5 (portrait), resolution 1536x1920, transparent-friendly plain background.
Negative prompt: zodiac wheel, tarot, crystal ball, cosmic swirl, stars background,
cartoonish, stock photo watermark, text, logo, low quality, cluttered.
Model: fal-ai/recraft-v3, style=realistic_image
```

### A2. Kundli-chart motif — recurring visual anchor (icon-set companion graphic)
**Usage:** Section dividers, "What's Included" background accent, footer background
texture. PRD §3: "custom-illustrated birth-chart (kundli square chart) motif as the
recurring visual anchor."
**Placement spec:** Seamless or near-seamless tile/pattern, exported at 2000×2000px,
low-contrast so it can sit behind text at 8-15% opacity as a section background.

```
Prompt: A subtle, elegant line-art pattern of a Vedic kundli square birth-chart diagram
(North Indian chart style, geometric diamond-and-triangle grid), rendered in thin single-
weight gold (#C9A227) strokes on transparent/warm off-white (#FBF6EF) background, low
contrast, minimal, suitable as a faint decorative background texture behind text.
No numbers, no planetary symbols cluttering it, no text. Clean, premium, editorial —
think fintech annual-report background texture, not mystical poster art.
Aspect ratio: 1:1, resolution 2000x2000, seamless/tileable if possible.
Negative prompt: zodiac wheel, planets illustration, stars, cosmic, cluttered symbols,
text, numbers, bright colors, cartoonish.
Model: fal-ai/recraft-v3, style=vector_illustration
```

### A3. Open Graph / social share image
**Usage:** `<meta property="og:image">` for link previews when the landing page is
shared (WhatsApp/social) — directly supports the "campaign-like" distribution the site
needs to perform well on.
**Placement spec:** Exactly 1200×630px, brand-colored background, must read clearly as a
small thumbnail (avoid fine detail).

```
Prompt: A clean, premium social-share banner background, warm off-white (#FBF6EF) base
with a deep indigo (#241E4E) geometric kundli-chart motif accent in one corner and a thin
muted-gold (#C9A227) divider line, large empty central negative space reserved for
overlaid headline text (added separately, do not render any text). Premium fintech/
document-product aesthetic, not mystical.
Aspect ratio: 1200x630 exactly (OG image standard).
Negative prompt: text, logo, zodiac wheel, cosmic swirl, stock photo, cluttered, low
quality.
Model: fal-ai/recraft-v3, style=digital_illustration
```

---

## B. PDF report — first & last page backgrounds

**Why this matters:** the PDF *is* the product being sold — a premium-feeling cover and
closing page materially affects perceived value and reduces refund requests (PRD §9,
§10). Both must be **print-safe, full-bleed, and leave clear space for dynamic text**
(customer name, date, dasha summary on page 1; thank-you/contact/legal footer on last
page) since these are rendered dynamically per report, not static images.

### B1. Cover page (page 1) full-bleed background
**Placement spec:** A4 portrait, 2480×3508px @ 300dpi (print-safe), full bleed, **must
have a clear, low-clutter zone in the upper-middle third for the report title + customer
name to be overlaid by the PDF generator**, and enough contrast at the bottom third for a
"Prepared exclusively for [Name]" line.

```
Prompt: A premium full-bleed document cover-page background, portrait orientation, deep
indigo (#241E4E) base gradating subtly toward warm off-white (#FBF6EF) at the vertical
center, with a large, elegant, low-opacity gold (#C9A227) line-art Vedic kundli
square-chart motif centered as a watermark-style graphic element — NOT a zodiac wheel,
NOT cluttered with planetary glyphs. A thin gold border/frame line inset from the page
edge. The upper-middle third of the composition must remain visually calm and high-
contrast-safe (for dark indigo text or light text to be legibly overlaid later) — do not
place dense pattern detail there. Aesthetic: premium legal/financial report cover, think
high-end annual report or law-firm document cover, NOT mystical or spiritual poster art.
No text, no numbers, no human figures.
Aspect ratio: A4 portrait, resolution 2480x3508 (300dpi print-ready), full bleed.
Negative prompt: zodiac wheel, tarot cards, crystal ball, stars, cosmic swirl, cartoonish,
cluttered symbols, text, logo, low quality, watermark text.
Model: fal-ai/recraft-v3, style=realistic_image (or vector_illustration — generate both,
pick the cleaner one)
```

### B2. Closing/last page full-bleed background
**Placement spec:** Same A4 print spec as B1, but visually **lighter and calmer** (this
page carries a thank-you message, contact/support info, and refund/legal footer text —
PRD §9 point 2, §10) — should feel like a closing note, not a repeat of the cover's
visual weight.

```
Prompt: A premium full-bleed document closing-page background, portrait orientation,
warm off-white (#FBF6EF) base with a single small, elegant gold (#C9A227) line-art
kundli-chart glyph positioned in the lower corner only (much smaller and lighter-weight
than a cover page would use), rest of the page calm and nearly blank with a very subtle
indigo (#241E4E) thin border frame. Generous open space through the vertical and
horizontal center for a closing message, support contact details, and legal/footer text
to be overlaid later. Aesthetic: premium document closing page, calm, understated,
NOT busy or mystical.
Aspect ratio: A4 portrait, resolution 2480x3508 (300dpi print-ready), full bleed.
Negative prompt: zodiac wheel, cosmic swirl, cluttered pattern, dense graphics, dark
heavy background, text, logo, low quality.
Model: fal-ai/recraft-v3, style=vector_illustration
```

---

## C. Campaign creative set (5 variants)

**Purpose:** ad creatives for the Google Ads campaigns in
`docs/prd/google-ads-campaign-setup.md` and any Meta/WhatsApp-status remarketing use.
Each variant targets a different funnel angle per the competitor teardown (PRD §1
cross-cutting patterns: outcome-based proof, urgency, trust). **All 5 must share the same
color system and typography treatment** so they read as one campaign family, not five
unrelated ads.

**Common export spec for every campaign image below:**
- Square 1:1 at 1080×1080 (Google Display/Meta feed)
- Landscape 1.91:1 at 1200×628 (Google Display/Meta link ad)
- Vertical 9:16 at 1080×1920 (Stories/Reels/WhatsApp Status placement)
- Generate the square version first from the prompt, then request an outpainted/
  reframed version at the other two ratios rather than re-prompting from scratch, to keep
  visual consistency across the ratio set.
- No text baked in — headlines/CTAs are added as a separate overlay per ad platform
  (Google RSA doesn't render text-in-image reliably anyway; text-in-image also blocks the
  "20% text" style limits some ad platforms still soft-enforce).

### C1. Pain-point / hook creative
**Angle:** career/financial confusion — the anxiety hook (PRD competitor teardown notes
pain-point framing converts before offer/discount framing).
```
Prompt: A calm, premium editorial photo of a young Indian professional (late 20s) sitting
at a home desk at night, looking thoughtfully at a laptop screen with a soft warm desk
lamp glow, expression pensive but not distressed — conveying quiet uncertainty about a
career or financial decision, not despair. Warm off-white and deep indigo color grading
matching a premium fintech-brand photoshoot, soft natural shadows, shallow depth of
field. No visible screen content, no on-screen text, no logos, no astrology imagery in
frame (no charts, no zodiac symbols) — this creative is pure emotional-hook photography.
Aspect ratio: 1:1, resolution 1080x1080.
Negative prompt: cartoonish, stock-photo cliché forced-smile, cosmic imagery, zodiac
wheel, text, logo, low quality, overexposed.
Model: fal-ai/flux-pro/v1.1-ultra
```

### C2. Outcome / aspiration creative
**Angle:** the payoff — clarity and confidence after reading the report (mirrors Arun
Pandit's outcome-based testimonial pattern, PRD §1 row 2 and §5.7).
```
Prompt: A premium, warm-toned editorial photo of an Indian professional (late 20s-30s)
smiling with quiet confidence, looking slightly off-camera as if reading good news,
seated in a bright naturally-lit room with warm off-white (#FBF6EF) tones and a hint of
deep indigo (#241E4E) in the wardrobe or background décor for brand color consistency.
Soft, optimistic, aspirational but not exaggerated/theatrical. No text, no logos, no
astrology iconography in frame.
Aspect ratio: 1:1, resolution 1080x1080.
Negative prompt: cartoonish, cosmic imagery, zodiac wheel, tarot, exaggerated expression,
text, logo, low quality.
Model: fal-ai/flux-pro/v1.1-ultra
```

### C3. Trust / authority creative
**Angle:** "this is a real, rigorous report" — product-as-hero, reinforcing the
report-not-mysticism positioning (PRD §3 positioning statement directly).
```
Prompt: A premium flat-lay product photograph of a bound, elegant astrology report
document (matching the cover design described in prompt B1: deep indigo cover with a
subtle gold kundli-chart line-art motif) resting on a warm off-white desk surface next to
a minimalist pen and a cup of tea, soft natural window light, styled like a premium
financial/legal document product shoot. No human figures, no text overlays, no logos.
Aspect ratio: 1.91:1 (landscape) natively, resolution 1200x628.
Negative prompt: cartoonish, cosmic imagery, zodiac wheel, tarot cards, crystal ball,
cluttered desk, text, logo, low quality.
Model: fal-ai/flux-pro/v1.1-ultra (or recraft-v3 realistic_image for a more illustrative
finish — generate both and A/B test)
```

### C4. Cultural/festive relevance creative
**Angle:** seasonal relevance hook (e.g. New Year, Navratri, wedding season timing) — use
whichever upcoming festival/season is closest at campaign launch; this prompt is a
template, swap the `{{SEASONAL_CUE}}` line per campaign flight.
```
Prompt: A warm, premium lifestyle photo of an Indian family or individual at home during
{{SEASONAL_CUE — e.g. "a quiet Diwali evening with soft diya candlelight" or "a New
Year's morning with warm sunrise light through a window"}}, color-graded toward warm
off-white and gold tones consistent with the brand palette (#FBF6EF, #C9A227), calm and
intimate mood, not a loud festival-poster aesthetic. No text, no logos, no astrology
iconography, no zodiac imagery.
Aspect ratio: 9:16 (vertical) natively, resolution 1080x1920.
Negative prompt: loud festival poster style, fireworks clipart, cosmic imagery, zodiac
wheel, text, logo, low quality, oversaturated.
Model: fal-ai/flux-pro/v1.1-ultra
```

### C5. Direct offer / discount creative
**Angle:** price-anchored direct-response ad (PRD §1 cross-cutting pattern: struck-price
+ %-off is the universal expected pattern in this niche) — background-only, since the
actual price/badge is overlaid as text/graphic per PRD §5.5, not baked into the AI image.
```
Prompt: A clean, premium background graphic for a price-offer ad: warm off-white
(#FBF6EF) base, a bold deep-indigo (#241E4E) diagonal ribbon/banner shape in one corner
reserved for a "% OFF" badge overlay (leave that corner visually simple, not detailed —
it will have text added), a single elegant gold (#C9A227) line-art kundli-chart accent
graphic off to one side balancing the composition, generous clean negative space in the
center-lower area for a CTA button overlay. Premium fintech-offer aesthetic, not a loud
e-commerce sale banner.
Aspect ratio: 1:1, resolution 1080x1080.
Negative prompt: cluttered sale-banner clipart, cosmic imagery, zodiac wheel, starburst
shapes, text, logo, low quality, oversaturated red/yellow sale colors.
Model: fal-ai/recraft-v3, style=digital_illustration
```

---

## D. Production checklist

- [ ] Generate A1–A3 (website assets) first — these unblock the brand-identity and
      pricing-block frontend issues.
- [ ] Generate B1–B2 (PDF backgrounds) and hand off to whoever owns PDF generation
      (`packages/backend/kundaliapi`) to confirm the safe-zone placement actually works
      with the real dynamic-text layout before finalizing.
- [ ] Generate C1–C5 (campaign creatives) only after the CTA-verb decision
      (frontend-gap-plan.md, decision issue) is locked, since ad copy overlay depends on
      final CTA wording.
- [ ] Store all finals in a shared asset location (R2/Drive) and record the exact
      fal.ai request params used (model, seed, style) next to each final file so a
      variant can be regenerated consistently later — don't rely on memory of what was
      tweaked.
