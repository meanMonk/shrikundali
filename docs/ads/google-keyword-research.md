# Google Keyword Research — Financial/Money Kundali

Built from three sources: (1) actual competitor ad copy scraped in
`google-ads-transparency-scan.md` and `campaign-plan.md`'s Meta research (what real
advertisers are bidding words around), (2) the existing keyword lists in
`google-ads-copy.md` and `google-ads-campaign-setup.md`, sharpened for the current
debt/money sprint, (3) general search-behavior logic for how someone actually types this
in when they have a specific problem vs. idle curiosity. No live Google Keyword Planner
access yet (needs the Ads account to exist first) — treat search-volume ordering below as
directional, confirm actual volumes once the account is live and Keyword Planner is
available.

## Ad group 1 — Core money/financial kundali (highest intent, fund first)

**Exact/phrase match:**
- `financial kundali`
- `financial kundali report`
- `money kundali`
- `money kundali report`
- `dhan yog kundli`
- `kundli mein dhan yog`
- `kundli report pdf`
- `online kundli report`
- `personalised kundli report`
- `detailed kundli report`

These match `google-ads-copy.md`'s existing Campaign 1 list almost exactly — confirms
that list was already well-built. No change needed here, just confirming it against this
round's research.

## Ad group 2 — Debt/money long-tail (new — matches the current sprint angle)

This is the ad group `google-ads-copy.md` doesn't have yet — it's Search-side of the
Meta money-debt sprint copy. Long-tail, lower volume individually but far higher
purchase-intent, and cheaper CPC than the head terms above:

- `kundli mein karz ka yog kaise pata kare`
- `kundli se paisa rukne ka karan`
- `karz mukti ka sahi samay kundli`
- `emi release timing astrology`
- `shani dhan sthan effect kundli`
- `paisa nahi tikta kundli`
- `debt free kundli remedy`
- `kundli mein loan yog`
- `financial kundali report price`
- `money kundali report pdf download`

**Why these specifically:** every one of them mirrors a phrase that showed up verbatim
or near-verbatim in scraped competitor ad copy (KundaliAstro's "कर्ज़ चुकाने के बाद भी
फिर से कर्ज़ क्यों हो जाता है", Mana Sastram's "career, money, marriage, health" framing,
AstroLokal's "money yog" hook) — these are phrases real advertisers already validated as
worth bidding on, translated into how someone would actually type the English/Hinglish
version into Search rather than say it in a Meta hook.

## Ad group 3 — Adjacent/comparison intent

People comparing us to the free-lead-magnet competitors found in
`google-ads-transparency-scan.md`:

- `kundli report vs free horoscope`
- `paid kundli report worth it`
- `best kundli report website`
- `accurate kundli report online`
- `kundli report without consultation`

Lower volume, but this is where our actual differentiator (flat fee, no upsell call, no
"free" bait-and-switch) gets to argue its case directly against how ClickAstro/Sri
Mandir/AstroYogi are positioned.

## Negative keywords (campaign-level — apply everywhere)

Sharpened from `google-ads-campaign-setup.md`'s existing list, with one addition the
Google research specifically surfaced:

- `free` ← **new, high-priority addition.** ClickAstro's ~600-ad account bids hard on
  "free kundali" / "free horoscope" / "free 300+ pg report." Without this negative, our
  ₹199 ad risks showing up next to a free-report ad on the identical query — a bad look
  for a flat-fee positioning, and wasted spend from clicks that were never going to
  convert against a free offer.
- `app`, `software`, `download crack` (piracy-adjacent, existing)
- `matching`, `marriage matching`, `kundli milan` (different product line — unless
  running the separate ₹299 Kundali Matching campaign, in which case allow it there only)
- `gemstone`, `rudraksha`, `bracelet` (AstroYogi's e-commerce line pollutes this query
  space — exclude)
- `consultation`, `call`, `chat`, `astrologer near me`, `talk to astrologer` (routes to
  the pay-per-minute consultation category, not our flat-fee-report category)
- `course`, `learn astrology`, `astrology classes` (education-intent, not a customer)
- `job`, `vacancy` (unrelated "jyotish" job-search bleed, seen in the original PRD's
  negative list)
- `puja`, `epuja`, `dosha calculator free` (Sri Mandir's funnel — free tool + religious
  service booking, not what we sell)

## What to do with this before spend

1. **Confirm actual search volume once the Ads account exists** — Keyword Planner will
   show real monthly volume per term; this list is ordered by intent/relevance, not
   confirmed volume.
2. **Start Ad Group 2 (debt long-tail) as its own ad group**, not blended into Ad Group
   1 — its headlines should pull directly from `money-debt-sprint-copy.md`'s V1/V3/V9
   (debt loop, EMI timing, karz-mukti), not the generic Campaign 1 headlines, so query
   and ad text stay tightly matched (better Quality Score, cheaper clicks).
3. **Don't bid on competitor brand names** (Mana Sastram, Sri Astro Vastu, ClickAstro) —
   legally allowed in most cases but not a good use of a small starting budget; the
   negative-keyword list above matters far more at this budget size than conquesting
   does.
