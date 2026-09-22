# Meta Business Manager — Multi-Product Ad Account Setup

**Why this doc exists:** you asked whether to spin up a separate Meta account per
product. Short answer: **don't create separate personal/Business Manager *accounts* —
create separate ad accounts and Pages inside one Business Manager.** Meta's system is
built for exactly this, and running multiple full Business Manager accounts from one
person creates real risk (see "Why not separate accounts" below).

This is a walkthrough for you to run — creating accounts and accepting Meta's terms
isn't something I can do on your behalf.

---

## The structure that actually works

```
1 Business Manager  ("ShriKundali" / Vaayu Labs)
├── Ad Account: "ShriKundali — Core"        (all campaigns, one shared budget/billing)
├── Page: "ShriKundali"                      (main brand page, used for most ads)
├── Page: "Money Kundali by ShriKundali"     (optional — only if you want angle-specific branding)
├── Pixel: "ShriKundali Web Pixel"           (one pixel, fires on the one funnel)
└── Business assets shared with your ad account: WhatsApp Business number, Instagram account
```

**One Business Manager. One ad account (maybe two, if you later want to separate India
Search-adjacent spend from pure-Meta spend for accounting). Multiple Pages if you want
different product angles to feel like distinct brands — Pages are free and instant to
create, unlike ad accounts.**

### Why not separate Business Manager accounts per product
- Meta ties ad accounts to a real identity for billing/compliance (India requires GST
  details, business verification for scaled spend). Duplicating that per product means
  duplicating KYC paperwork for no benefit.
- Multiple Business Managers under one person/entity running similar ad content is a
  known trigger for Meta's duplicate-account and policy-evasion detection — it can get
  ad accounts disabled, which is far more disruptive than the thing you're trying to
  avoid.
- You get nothing from separate accounts that separate **Pages** + **campaigns** +
  **UTM tags** don't already give you (independent creative, independent reporting,
  independent audience data).

---

## Step-by-step: what to actually do

### 1. Create (or confirm) one Business Manager
- Go to [business.facebook.com](https://business.facebook.com) → Create Account.
- Business name: `ShriKundali` (or your registered entity name if you want ad
  transparency/verification to match a GST-registered business — recommended before
  scaling spend past ~₹500/day, since Meta increasingly requires business verification
  for India advertisers running "special ad categories" or high spend).
- Add your email, confirm.

### 2. Create one ad account inside it
- Business Settings → Accounts → Ad Accounts → Add → Create a new ad account.
- Name it `ShriKundali — Core`. Currency: INR. Time zone: your operating time zone
  (IST).
- Assign a payment method (card, or UPI if Meta offers it for your account type).

### 3. Create your product Page(s)
- Business Settings → Accounts → Pages → Add → Create a new Page.
- Minimum: one Page (`ShriKundali`) is enough — you don't need per-product Pages to run
  per-product ad campaigns; campaigns target the same Page regardless of which product
  page (`/`, `/p/marriage-kundali`, etc.) the ad links to.
- Only create a second Page if you specifically want a product to read as its own brand
  in the ad's "Sponsored by" line — e.g. if you ever want "Money Kundali" to feel
  distinct from "ShriKundali" as a trust play. Not necessary for the current sprint.

### 4. Install the Meta Pixel once
- Events Manager → Connect Data Sources → Web → Meta Pixel → name it
  `ShriKundali Web Pixel`.
- This blocks on the same tracking work already flagged in
  `docs/prd/google-ads-campaign-setup.md` — the pixel needs to fire on
  **payment-complete**, not form-submit, or Meta's optimization will learn the wrong
  signal exactly like the Google Ads doc warns for conversion tracking.
- One pixel is correct even with multiple product angles — they all funnel through the
  same Razorpay checkout event.

### 5. Structure campaigns, not accounts, per product/angle
Inside the one ad account:
```
Campaign: "Money Debt Sprint — Wk1-2"
├── Ad Set: Broad India, 25-45, interests: personal finance / astrology
│   ├── Ad: D1 creative + V1 copy
│   ├── Ad: D3 creative + V3 copy
│   ├── Ad: D4 creative + V4 copy
│   └── Ad: D6 creative + V10 copy
└── Ad Set: (optional 2nd audience test)
```
This is where `docs/ads/money-debt-sprint-copy.md` and the creatives in
`money-debt-creatives/` plug in directly — one campaign, 5 ads (your 5 chosen
variants), Meta's own delivery system splits spend based on performance.

### 6. WhatsApp Business (optional, matches the ₹49-99 competitor pattern)
The field scan found the ₹49-99 tier routes straight to WhatsApp instead of a landing
page. If you want to A/B test that against our current checkout flow (per copy
variant V8), you'll need:
- A WhatsApp Business number (can be a new number or your existing one, upgraded to
  WhatsApp Business App — free).
- Link it in Business Settings → Accounts → WhatsApp Accounts.
- Ads can then use "Click to WhatsApp" as the CTA destination instead of the website.

---

## What I need from you to go further
1. **Confirm the Business Manager exists already or needs creating** — if Vaayu Labs
   already has one from a prior project, tell me and I'll write the campaign/ad-set
   structure against that instead of a fresh setup.
2. **GST/business verification status** — if you want to scale past ~₹500-1,000/day,
   Meta will likely ask for business verification. Flag if that's already done for any
   entity, so the ad account can be tied to it.
3. Once the ad account + pixel exist, share read access (or just the account ID) and I
   can draft the exact campaign/ad-set JSON structure or a step-by-step Ads Manager
   click-path doc — I can't create or configure the live ad account myself, since that
   requires accepting Meta's advertiser terms and billing setup as you.
