# Google Ads Transparency Center Scan

Checked [Google's Ads Transparency Center](https://adstransparency.google.com/) (India)
for the same kundali/astrology category. **Important mechanical difference from Meta's
Ad Library: you can't keyword-search "who's advertising about kundali" on Google's
tool** — it only searches by advertiser name or domain you already know. So this scan
worked by testing every competitor domain already found via Meta (`kundaliastro.com`,
`manasastram.com`, `astroarunpandit.org`) plus well-known Indian astrology brands
(`clickastro.com`, `astroyogi.com`, `srimandir.com`), and seeing which of them run
Google Ads at all.

## The headline finding: two different competitor sets on two different platforms

**None of our closest Meta-only flat-fee competitors run Google Search ads.**
`kundaliastro.com`, `manasastram.com`, and `astroarunpandit.org` all returned **zero
results** on Google's Ads Transparency Center — Meta-only advertisers.

**But there is one real flat-fee-PDF competitor running on Google too — Sri Astro
Vastu, at ₹198, one rupee under our price.** So the "Google is a different market than
Meta" read needs a caveat: it's mostly true (the biggest Google spenders run free-lead
funnels, not flat-fee sales) but Sri Astro Vastu proves the flat-fee model does scale to
Google Ads for at least one advertiser — worth treating as the most directly comparable
Google competitor found in this research.

## Who's actually running Google Ads

| Advertiser | Legal entity | Scale | Model |
|---|---|---|---|
| **ClickAstro** | Astro Vision Futuretech Private Limited | **~600 ads** — the largest account found in this entire research effort, on any platform | Free lead magnet: "Instant 100% free kundali - Predictions For Next 25 Years." Sitelinks stack multiple free hooks (Free Online Horoscope, Free 300+ Pg Horoscope Report, Free Marriage Report, Free Career Prediction) plus a discount code ("₹2,100 off Shani Nazar 2025 Report") — the free report is the click-bait, the paid remedy/premium report is the upsell. |
| **Sri Astro Vastu** | (found via `astrovaibhav.com` / `sriastrovastu.com`) | ~200 ads, **the only advertiser found running the same flat-fee-PDF model on Google as our own product** | ₹198 flat fee — "జాతకం రూ. ₹198 మాత్రమే" (*Jathakam, only ₹198*), "100+ page detailed jathakam from qualified astrologers" — nearly identical to Mana Sastram's Meta pitch, but here on Google Display *and* Search *and* Video simultaneously. Search ad uses a "What customers are saying" testimonial extension — a social-proof ad format not seen anywhere else in this research. Also runs a separate free-kundli lead-gen Search ad ("Free Kundli by date of birth"), so it's hedging both models at once. |
| **Sri Mandir** | Firstprinciple AppsForBharat Private Limited | 3 separate landing-page domains, each its own "advertiser" in Google's system (`dosha-calculator-srimandir.com`, `mangal-dosha-srimandir.com`, `srimandir.com`) | Free interactive tool as the hook: "Sri Mandir Dosha Calculator — Get to know your Dosha in Kundli and book relevant puja to get rid of your dosha." The calculator is free; the puja booking is the actual revenue. |
| **AstroYogi** | Netway India Private Limited | 68 ads | Not report-based at all — "Chat Free with Top Gurus... 24x7 expert help... Start free" is a pay-per-minute consultation funnel, plus a separate e-commerce line (gemstone bracelets, prayer malas) unrelated to reports. |

Screenshots saved: `meta-library-snapshots/clickastro-google-search-free-kundali.png`,
`meta-library-snapshots/srimandir-google-search-dosha-calculator.png`,
`meta-library-snapshots/sriastrovastu-telugu-₹198-display-banner.png`,
`meta-library-snapshots/sriastrovastu-google-search-testimonial-extension.png`.

## How long are these running?
Google's tool only exposes a **"Last shown"** date per creative, not a first-seen date
the way Meta shows "Started running on" — so "how long" has to be read differently here.
What it does confirm: ClickAstro, Sri Mandir, and AstroYogi were **still active as of
Sep 22, 2026** (ClickAstro) and Sep 14, 2026 (Sri Mandir) — i.e., currently live, not
stale listings. Sri Mandir running the identical dosha-calculator creative across 3
separate domains simultaneously, and Sri Astro Vastu running the same offer across
Search, Display, and Video formats at once, are the closest signals here to Meta's
"duplicate variants = this is winning" pattern.

## What this means for our own Google Ads plan

1. **We're not competing with the same players on Google that we found on Meta.** The
   Meta field (KundaliAstro, Mana Sastram, Astro Arun Pandit, Surabhi Astrology, etc.)
   is a different, smaller-scale, flat-fee-PDF ecosystem. Google Search is a different
   battlefield — a handful of large, well-capitalized brands running free-to-paid
   funnels. `docs/prd/google-ads-campaign-setup.md`'s existing Campaign 1 (high-intent
   Search) and Campaign 2 (PMax + remarketing) are aimed at the right kind of
   competitor, just worth knowing it's ClickAstro/Sri Mandir-scale spend we're up
   against on Search specifically, not the smaller Meta names.
2. **The free-first pattern shows up here too — third confirmation across three
   completely different research passes** (this scan, the original Meta field scan, and
   the regional-language scan all independently found "something free before the
   paywall" winning). Sri Mandir and ClickAstro both lead with a genuinely free tool/
   report, not just a discount. This is more evidence for prioritizing the PRD's free
   teaser feature (`docs/prd/frontend-gap-plan.md` issue #20) — it's not just a Meta
   tactic, it's the dominant Search pattern too.
3. **Negative-keyword risk is real and specific now.** ClickAstro's ad literally bids on
   "free kundali" — if our Search campaign's negative keyword list (per
   `google-ads-campaign-setup.md`'s cross-campaign requirement #3) doesn't exclude
   "free," we risk showing up as a paid result next to their free-report ad on the exact
   same query, which reads badly for a ₹199 flat-fee positioning.
4. **Sri Mandir's multi-domain structure is a pattern worth knowing about, not copying.**
   Running the same offer from three separate branded subdomains as three separate
   "advertisers" in Google's system is a scale-stage tactic (probably for landing-page
   isolation/testing at volume) — not something to replicate at our current size, but
   useful context if we ever split test landing pages per angle later.
5. **Sri Astro Vastu at ₹198 is the single most directly comparable Google competitor
   found** — nearly our exact price, same "100+ page detailed report" framing. Worth
   periodically checking what's still running there the same way we'd watch Mana Sastram
   on Meta. Their "What customers are saying" Search-ad testimonial extension is worth
   testing ourselves once we have real customer quotes to use — it's a legitimate Google
   Ads review-extension format, not a Meta-style claim slapped into ad copy.
6. **Native-script text works fine in Google's ad images — because these are
   human-designed, not AI-generated.** Sri Astro Vastu's Telugu Display banner renders
   perfectly. This doesn't contradict the finding in
   `regional-campaign-structures.md` that `gpt-image-1` garbles Telugu — it confirms the
   fix is "have a person set the native text in Canva/Figma," not "the script can't be
   used in ad images at all."

## Not done in this pass
Didn't check YouTube or Display-network creative (Google's tool separates by platform
filter) — this scan filtered to Search only, matching what `google-ads-campaign-setup.md`
currently plans to run. Flag if Display/YouTube competitor research would help too.
