# Money/Debt Sprint — Creatives

**Use the `E` set. Ignore/deprioritize the `D` set.** After the first round shipped, the
feedback was that `D1`-`D6` read as generic AI photography with no real content — true:
`flux-pro/v1.1-ultra` and `recraft-v3` (fal.ai's other two models) don't reliably render
legible in-image text, so those creatives carry no price, no headline, no book title —
just mood photography waiting for text to be added on top. `E1`-`E4` switch to
**`fal-ai/gpt-image-1`** (OpenAI's image model, proxied through the same `FAL_KEY`, no
new key needed) specifically because it renders real, legible text — price tags, book
titles, checklists — directly into the pixels. They also directly replicate two of the
actual scraped competitor layouts (Astro Arun Pandit's anchor-price + book mockup,
Vivahyoga/Clubastro's checklist-badge template) rather than a generic reinterpretation.

Prompts live in `packages/tools/assetgen/generate.mjs` under the `E1`-`E4` entries (and
`D1`-`D6` for the earlier set) — edit there and re-run to regenerate. Full-resolution
copies + request/response logs are also in `packages/tools/assetgen/output/` — these
copies in `docs/ads/` are the ones to ship.

## E set — gpt-image-1, text baked in, ship these

| File | Concept | Replicates | Pairs with copy |
|---|---|---|---|
| `E1-anchor-book-cover.png` | Headline + honest price comparison ("Astrologer consult ₹500+" vs "₹199 Only") + a book titled "YOUR MONEY KUNDALI / Personalized Financial Report", empty CTA bar at bottom | Astro Arun Pandit's ₹299 anchor-price layout | V4 — **the hero ad.** Empty bottom bar is intentional, drop your CTA button there. |
| `E2-premium-pdf-template.png` | Full purple/gold template — headline, "SIRF ₹199 ONLY" badge, 5-item checklist, speed/confidentiality/PDF badges, green "GET YOUR REPORT NOW" button | Vivahyoga/Clubastro's ₹71 template (the one two unrelated advertisers both run) | V4, V6, V8 — this one is close to publish-ready as-is |
| `E3-magazine-cover.png` | Editorial magazine-cover layout — "SHRIKUNDALI" masthead, headline, book photo on a desk, price ribbon | Surabhi Astrology's ₹999 magazine-cover creative | V2, V9 — softer/trust-led tone |
| `E4-book-hero.png` | Clean product shot: closed book titled "YOUR PERSONALIZED MONEY KUNDALI", generous empty space top/bottom | Requested directly — a standalone "book on the front page" asset | Any variant — pair with whichever headline/price text you want to overlay; most flexible of the four |

Real price used throughout: **₹199** (our actual `REPORT_PRICING.financial_kundali`
amount — see `packages/backend/kundaliapi/src/lib/pricing.ts`). `E1`'s "Astrologer
consult: ₹500+" line is a comparison against real competitor pricing we scraped (Surabhi
₹999, Ankit Btra ₹499, Astro Arun Pandit ₹299-499), not a fabricated "was" price on our
own product — safer than an invented strikethrough discount.

## D set — fal flux/recraft, mood photography only, needs text added on top

| File | Concept | Pairs with copy |
|---|---|---|
| `D1-debt-loop.png` | Person at night looking at phone, worried-but-composed | V1, V8 |
| `D2-savings-leak.png` | Line-art piggy bank with a coin escaping | V2 |
| `D3-emi-pressure.png` | Coin stack under a soft indigo "pressure cloud" | V3, V5, V9 |
| `D4-anchor-offer.png` | Price-tag + book icon graphic (no text baked in beyond the ₹499→₹199 tag) | V4, V6 |
| `D5-english-outcome.png` | Person relieved, laptop + coffee | V7 |
| `D6-career-money-fork.png` | Line-art tree with briefcase + ₹ symbol | V10 |

Keep these as optional B-roll/background layers (e.g. `D3`'s coin-pressure photo behind
`E`-style text, if you want a photographic option instead of an illustrated one) rather
than as finished ads.

## Known issues fixed during generation
- First pass at `D4` came back with mosque/lantern imagery (recraft-v3 misread "open
  book icon" as religious iconography) — fixed with an explicit "no religious building"
  negative prompt.
- `D2`/`D6` (recraft-v3, `style: vector_illustration`) returned SVG files saved with a
  `.png` extension — re-exported as real PNG via `rsvg-convert`. If you regenerate any
  `vector_illustration`-style asset, check the file type before shipping.

## Format checklist before spend
- [ ] Crop/export each `E` creative to Meta's actual feed (4:5), Story (9:16), and
      Google PMax (1:1 + 16:9) — these are 1024×1536 portrait masters.
- [ ] `E1` and `E4` both leave empty space for a CTA button — add it before shipping.
- [ ] Run each past the disclaimer requirement: "Astrological guidance, not financial
      advice" somewhere in the ad (comment or landing page, per `meta-ads-copy.md`).
