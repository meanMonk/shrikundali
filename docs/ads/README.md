# Ads — Index & How to Launch

Start here. Everything in this folder, what it's for, and the order to actually use it in.

## Where everything lives

```
docs/ads/
├── README.md                          ← you are here
├── campaign-plan.md                   6-week Meta angle rotation (original plan)
├── meta-ads-copy.md                   Original per-angle Meta copy (Money/Marriage/Career/Dosha/Health/Matching)
├── google-ads-copy.md                 Original Google Search copy, same 5 angles
├── money-debt-sprint-copy.md          ★ CURRENT SPRINT — 10 copy variants, ₹99-299, debt/money angle only
├── money-debt-creatives/              ★ CURRENT SPRINT — the actual images to run (see below)
│   ├── E1-anchor-book-cover.png       ← use these 4 (E-set)
│   ├── E2-premium-pdf-template.png
│   ├── E3-magazine-cover.png
│   ├── E4-book-hero.png
│   ├── D1-debt-loop.png through D6    ← optional B-roll only, not finished ads (see README there)
│   └── README.md                      Full mapping: which image pairs with which copy variant
├── meta-library-snapshots/            Real competitor screenshots (not generated) — reference only
│   └── README.md                      What each one is and why it's saved
├── regional-language-scan.md          Tamil/Telugu/Kannada/Malayalam/Bengali competitor research (Meta)
├── regional-campaign-structures.md    Per-language campaign plan + ready-to-run native copy
├── google-ads-transparency-scan.md    Who runs Google Ads in this category, and how
├── google-keyword-research.md         Keyword lists (head + long-tail) + negatives, ready for the Ads account
├── meta-business-manager-setup.md     How to set up the Meta ad account (needs you — see below)
└── faceless-video-ads-plan.md         Parked — video creative proposal, not started
```

## Which creatives to actually use

**Use the 4 `E*-branded.png` files. That's it, for now.** They're the only ones with
real, legible text baked in (headline, price, book title) — generated with `gpt-image-1`
after the first batch (`D1`-`D6`, fal's other models) came back as text-less mood
photography — and now with our real logo (`packages/web/kundaliweb/public/logo.png`)
composited into the top-left corner, done locally, no extra generation cost. `D1`-`D6`
aren't wasted — keep them as optional background/B-roll if you want a photographic
option layered under `E`-style text — but don't ship them as-is.

| File | What's on it | Pair with (from `money-debt-sprint-copy.md`) |
|---|---|---|
| `E1-anchor-book-cover-branded.png` | Logo, headline, "Astrologer consult ₹500+" vs "₹199 Only" price comparison, a book titled "YOUR MONEY KUNDALI — Personalized Financial Report", empty CTA bar at bottom (add your button) | **V4 — the hero ad, start here** |
| `E2-premium-pdf-template-branded.png` | Logo, full template: "MONEY KUNDALI REPORT" headline, "SIRF ₹199 ONLY" badge, 5-item checklist, speed/confidentiality/PDF badges, green "GET YOUR REPORT NOW" button — close to publish-ready as-is | V6, V8 |
| `E3-magazine-cover-branded.png` | Logo, editorial magazine-cover layout, book photo on a desk, price ribbon | V2, V9 |
| `E4-book-hero-branded.png` | Logo, clean standalone book product shot, most flexible — pair with any headline you overlay | Any variant |

## How to actually launch this (step by step)

1. **Set up the Meta ad account** — follow `meta-business-manager-setup.md` end to end.
   This is the one step that needs you directly (account creation, billing, GST/business
   verification) — I can't do this part.
2. **Pick 5 of the 10 copy variants** from `money-debt-sprint-copy.md` for week 1 (the
   doc recommends V1, V2, V4, V5, V8 — mix of price points ₹99/₹199, mix of hook types).
3. **Pair each with its creative** per the table above (or the fuller mapping in
   `money-debt-creatives/README.md`).
4. **Add the CTA button/final price text** where the images leave space (`E1` and `E4`
   both have an intentionally empty zone) — quickest in Canva: crop to 4:5 (feed), 9:16
   (Story), drop in the button, export.
5. **Set the campaign structure** inside the one ad account:
   ```
   Campaign: "Money Debt Sprint — Week 1"
   └── Ad Set: Broad India, 25-45, interests: personal finance / astrology
       ├── Ad: E1 + V4
       ├── Ad: E2 + V8
       ├── Ad: E2 + V6
       ├── Ad: E3 + V2
       └── Ad: E4 + (any) + V1
   ```
   (Exact structure/rationale is in `meta-business-manager-setup.md` §5.)
6. **Budget/kill rule** (already in `campaign-plan.md`): ₹1,000/day split across the 5
   ads, check cost-per-purchase after 3 days, kill what's not converting, double down on
   what is — per week 2 in `money-debt-sprint-copy.md`'s test structure.
7. **Disclaimer**: every ad needs "Astrological guidance, not financial advice" somewhere
   (comment or landing page) — checklist item in `money-debt-creatives/README.md`.

## Can the same campaign run on Google Ads?

**Partially — the creative reuses, but the ad *format* doesn't carry over directly.**
Google Search ads are text-only (headlines + descriptions, no image), so there's nothing
to "port" there — but the money/debt *copy* absolutely reuses:

- `google-ads-copy.md` already has a Money/Financial Kundali campaign (Campaign 1) — the
  headlines there ("Bank Balance Kab Double?", "Money Kundali Report ₹199") are the same
  angle as this sprint, just not yet updated with the sharper debt-specific hooks from
  `money-debt-sprint-copy.md` (V1's "कुंडली में कर्ज़ का योग है?", V9's "Karz-Mukti Ka
  Sahi Samay"). Worth pulling 3-4 of the new debt-specific headlines into a Search
  ad group — that's a copy edit, not new work.
- Where the **images** do carry over: **Performance Max**, not Search. PMax asset groups
  take images the way Meta does — `docs/prd/google-ads-campaign-setup.md`'s Campaign 2
  (PMax + remarketing) already has a slot for exactly this ("Asset groups: one per
  creative angle... tag each with distinct headline/description pairs"). The `E1`-`E4`
  set drops straight into that PMax asset group once it's built.
- **What doesn't transfer:** Google's keyword-intent structure. Meta targets by
  interest/audience; Google Search targets by what people actually typed. See the new
  research below for what that keyword list should be — Search campaigns need their own
  keyword-driven structure, not a copy of the Meta ad-set logic.

Net: yes, reuse the copy and the `E`-set images (via PMax), but Search needs its own
keyword build — see `google-ads-transparency-scan.md` for what competitors are actually
bidding on. Two concrete things that scan surfaced: (1) make sure "free" is in the
Search campaign's negative-keyword list — ClickAstro's ~600-ad account bids hard on
"free kundali," and a ₹199 paid result next to a free-report ad reads badly; (2) Sri
Astro Vastu, the one Google competitor running our exact flat-fee-report model at ₹198,
uses a "What customers are saying" testimonial ad extension — worth testing once we have
real customer quotes to use.
