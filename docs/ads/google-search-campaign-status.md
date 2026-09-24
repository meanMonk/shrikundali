# Google Search — Campaign 1 Status & Next Campaigns

Live-state doc for the actual Google Ads account (`ocid=8557669369`, account name "Rashi
Kundali"). `google-ads-campaign-setup.md` (in `docs/prd/`) is the original plan; this doc
tracks what's actually been built and what's queued next. Update this file, not the
original plan doc, as campaigns move through the account.

## Campaign 1 — Search: Debt/Money Kundali

**Status: built, Paused.** Campaign ID `24280391885`. Nothing has spent — budget is
capped and the campaign is off until manually enabled.

| Setting | Value |
|---|---|
| Name | `Search - Debt Money Kundali` |
| Type | Search only (Search Partners + Display Network unchecked) |
| Goal | Purchases → GA4 event `payment_order_created` (existing tag, not a fresh Google Tag install — see note below) |
| Locations / Languages | India; English + Hindi |
| Bidding | Maximize Conversions |
| Budget | **₹500/day hard cap** (Google's own auto-recommendation was ₹4,447/day — overridden down) |
| Final URL | `https://rashikundali.com/?utm_source=google&utm_medium=cpc&utm_campaign=debt_money_kundali` |
| Keywords (16) | financial kundali, money kundali, dhan yog kundli, kundli mein karz ka yog, kundli se paisa rukne ka karan, karz mukti ka sahi samay kundli, emi release timing astrology, shani dhan sthan effect kundli, paisa nahi tikta kundli, debt free kundli remedy, kundli mein loan yog, + price/pdf-download variants — see `google-keyword-research.md` Ad Group 2 |
| Negative keywords (23, campaign-level) | free, app, software, download crack, matching, marriage matching, kundli milan, gemstone, rudraksha, bracelet, consultation, call, chat, astrologer near me, talk to astrologer, course, learn astrology, astrology classes, job, vacancy, puja, epuja, dosha calculator free |
| Ad (RSA) | 11 headlines / 4 descriptions from `money-debt-sprint-copy.md` V1/V3/V9 + the campaign-plan money angle. Ad strength: Average. Price updated to **₹249** (matches `financial_kundali` in `pricing.ts` — the ₹199 in the original copy docs is stale) |
| Sitelinks (3, campaign-level) | How It Works → `/how-it-works`, FAQ → `/faq`, "Bank Balance Kab Double?" → homepage (same UTM'd final URL as the ad) |
| Callouts (6, campaign-level) | Delivered in 2-5 Minutes, Secure Payment, Private & Confidential, English & Hindi, No Astrologer Calls, Vedic Accuracy Guaranteed |

**Google Tag setup — deliberately skipped.** During publish, Google offered to install/
overwrite the site's existing production Google tag (`G-RTLHVMR7DT`, `GT-K54NFR48`) to
wire conversion measurement, with an explicit warning that doing so would overwrite
existing tag settings. Declined — the GA4 `payment_order_created` event was already
correctly linked as the conversion signal, and overwriting risked breaking that for no
clear gain. **Verify actual conversion attribution once real purchases start flowing**;
if someone later runs that "Set up with a Google Tag" flow from Recommendations, confirm
it won't silently overwrite the current config first.

## Scheduling & spend-safety policy

Adopted 2026-09-23, applies to every campaign in this account (this one and all queued
below). Goal: cap worst-case accidental spend, not just daily spend.

1. **Every campaign gets an explicit end date at enable time — a 7-day window from
   when it's turned on**, not an indefinite run. Matches the existing "3-5 day clean
   read" rule in `campaign-plan.md` plus a buffer. When the window lapses, Google
   auto-pauses it — no dependency on someone remembering to check back.
2. **Launch new campaigns sequentially, not in parallel.** Even though each campaign
   carries its own separate ₹500/day budget (so they don't compete for spend), running
   several at once means several things to babysit — a bad ad review, wrong price, or
   broken landing page is easy to miss when attention is split across campaigns. Enable
   one campaign, let its 7-day window run, read CAC, then move to the next.
3. **Set an account-level billing threshold/alert** (payments profile → billing
   preferences) as a backstop independent of per-campaign budgets — sized to roughly
   2-3 campaigns running simultaneously at ₹500/day for a month. This is the safety
   net if a budget field is ever fat-fingered the way Google's ₹4,447/day
   auto-recommendation nearly was on Campaign 1.
4. **Skip ad-schedule/dayparting restrictions for now.** `google-ads-campaign-setup.md`
   floats evening-only delivery (7pm-midnight IST) on a behavioral hypothesis, but at
   ₹500/day there won't be enough hourly volume in a 7-day window to validate it.
   Revisit once a campaign has a full read and hour-level conversion data exists.

Trade-off: sequential rollout with 7-day windows means covering all 5 queued campaigns
takes ~5-6 weeks of calendar time instead of ~1, but caps worst-case unattended burn at
one campaign-week instead of five running simultaneously and unwatched.

## Known gaps carried over from setup

- Budget (₹500/day) is well under Google's own recommendation (₹4,447/day) — expect low
  impression volume at this cap; that's intentional, not a bug, until CAC data exists.
- Auth path for API-driven campaign management (service account vs. MCC OAuth) is still
  undecided — this campaign was built by hand in the browser UI, not via the Ads API.

## What's next — remaining campaigns from the original plans

Two source docs already scoped campaigns beyond this one that haven't been built yet:

1. **`campaign-plan.md`'s 6-week angle rotation** — Marriage Timing, Career (Job vs
   Business), Dosha Report, Kundali Matching, Health Kundali. Each has a landing page,
   price point, and platform assignment already decided (see that doc's table). Money/
   Debt (this campaign) was week 1.
2. **`docs/prd/google-ads-campaign-setup.md`'s Campaign 2** — Performance Max +
   remarketing, using the `E1`-`E4` branded creative set from `money-debt-creatives/`,
   targeting warm visitors who hit the teaser but didn't pay. Blocked until the live free
   teaser fires a trackable "teaser-complete" event (frontend dependency, not an ads-side
   blocker).

GitHub issues opened for each, 5-day target (due 2026-09-28):

- #76 — Marriage Kundali (Search)
- #77 — Career Kundali / Job vs Business (Search)
- #78 — Dosha Report (Search)
- #79 — Kundali Matching (Search)
- #80 — Performance Max + Remarketing (blocked on live-teaser tracking, see issue)

This doc is the reference for what to build when picking one up — each issue points back
here for the settings pattern (budget cap, negative keywords, sitelink/callout reuse,
paused-by-default) established by Campaign 1.
