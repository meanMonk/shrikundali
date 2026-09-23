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

Meta renamed "Business Manager" to **Business Portfolio** (business.facebook.com). The
key mental model:

> **The Business Portfolio belongs to the company/entity (Vaayu Labs). Pages belong to
> products (Rashi Kundali, Resume, …). Ad accounts belong to the billing entity**
> (usually one or two, not one per product).

```
Business Portfolio: "Vaayu Labs"                 ← the legal entity (KYC/GST/verification)
├── Ad Account: "Vaayu Labs — Core"               ← one shared billing account (INR)
│   ├── Campaign: "ShriKundali — Money Debt Sprint"
│   ├── Campaign: "ShriKundali — Marriage"
│   └── Campaign: "Resume Builder — Launch"       (future product, same account)
├── Page: "Rashi Kundali"                          ← product brand page (ads point here)
├── Page: "Resume Builder"                         ← future product page (free, instant)
├── Pixel / Dataset: "Rashi Kundali Web Pixel"     ← one per *website*, fires payment-complete
└── Shared assets: WhatsApp Business, Instagram, catalog
```

**One Business Portfolio. One core ad account (maybe a second only if a future product
is a separate legal entity / GST / currency). One Page per product brand. One Pixel per
website.**

### Entity vs product — what goes where

| Thing | Owned by | Per product? | Why |
|---|---|---|---|
| Business Portfolio | Legal entity (Vaayu Labs) | ❌ one | Holds KYC/GST/verification once |
| Ad account | Billing entity | ❌ one (per currency/entity) | One payment method, one spend history |
| Page | Product brand | ✅ one per product | "Sponsored by" identity; free to create |
| Pixel / Dataset | Website/domain | ✅ one per site | Conversions are per-site |
| Campaign / Ad set / Ad | Product or angle | ✅ many | Where you actually separate products |
| Instagram account | Brand | ✅ optional | Linked asset for some placements |

Separate products (Rashi Kundali vs Resume) are separated by **campaigns + Pages +
UTMs**, not by new ad accounts or new Business Portfolios.

### Why *not* separate Business Manager accounts per product
- Meta ties ad accounts to a real identity for billing/compliance (India requires GST
  details, business verification for scaled spend). Duplicating that per product means
  duplicating KYC paperwork for no benefit.
- Multiple Business Portfolios under one person/entity running similar ad content is a
  known trigger for Meta's duplicate-account and policy-evasion detection — it can get
  ad accounts disabled, which is far more disruptive than the thing you're trying to
  avoid.
- You get nothing from separate portfolios that separate **Pages** + **campaigns** +
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

## Account health: staying active & avoiding bans

Meta disables accounts for two broad reasons: **payment problems** and **policy /
trust signals**. Most bans are avoidable.

**Do this (trust signals)**
- **Verify the business early** — Business Settings → Business Info / Security Center.
  Upload GST + registration. Verified portfolios scale further and get appeals handled
  faster. Do it *before* you spend, not after a block.
- **One ad account.** Do not create a second "in case this one gets banned" — see below.
- **2FA on every admin personal account** and on the portfolio. Meta flags
  low-security admins.
- **Keep assets consistent**: same legal name, address, phone, domain email across the
  portfolio, Page, and billing. Mismatches look like a fake business.
- **Warm up spend**: start ~₹500–1,000/day, then scale ~20–30% every 2–3 days. Jumping
  from ₹0 to ₹10k/day is a classic auto-restriction trigger.
- **Complete the Page**: profile/cover image, about, contact, and a real website. Link
  the Instagram account.
- **Landing page must match the ad** and carry Privacy, Terms, Refund, and a support
  contact (ours do: `/privacy /terms /refund` + `support@rashikundali.com`).

**Avoid this (policy)**
- No guaranteed/absolute claims: "guaranteed money", "100% accurate", "get rich". For
  astrology, frame as guidance, never certainty.
- No personal-attribute targeting copy ("Are you in debt?", "You are Manglik") — Meta
  treats this as sensitive. Use neutral hooks ("Know your money timing").
- Don't reuse the same creative/landing across multiple accounts or domains — that's the
  duplicate-account signal.
- Don't rapidly create many Pages/ad accounts, or change the domain in the Ads Manager.
- Don't ignore failed payments — repeated billing failures disable the account fastest.
  Keep a valid card/UPI and a buffer.

**Weekly 5-minute hygiene**: Account Quality → Support Inbox → Billing. Clear any notice
the day it arrives.

## Roles & redundancy: never rely on one login

- **Add a second admin** (a trusted teammate — or a second, aged, 2FA-secured personal
  profile you control) with full control over the portfolio, Page, and ad account. If one
  personal profile is locked, the other can still run everything.
- **Never share passwords/login.** Add people via Business Settings → People (roles:
  Admin / Employee) or Partners (agency) with scoped access to specific assets only.
- Keep **one owner account with an active, monitored email** that is not tied to a single
  phone number you might lose.
- Record the **ad account ID, Page ID, Pixel ID, portfolio ID** in a shared vault so any
  admin can act.

## If you get restricted or banned: recovery

1. **Find the reason**: `business.facebook.com/accountquality` (and the Support Inbox).
   Read whether it's the *ad account*, the *Page*, or the *portfolio*.
2. **Appeal once, calmly and factually** — "Request Review" with a short note + evidence
   (business registration, domain ownership, screenshot of the compliant landing page).
   Don't spam repeated appeals; it slows things down.
3. **Do NOT create new accounts to work around it** — that is policy evasion and converts
   a temporary restriction into a permanent ban across the entity.
4. **If one asset is restricted, keep running the others** — e.g. a restricted Page can be
   swapped for a compliant one in a new campaign while the appeal runs.
5. **Escalation**: Business Help Center chat, and Twitter/X `@MetaBusiness` (public, polite,
   with IDs) often gets a human faster than the form.
6. **Legitimate redundancy**: a *second ad account under the same verified portfolio* (not
   a duplicate portfolio) for a different product/billing line is fine and gives you a
   fallback. A second **Business Portfolio** only makes sense if there is a genuinely
   separate verified entity — never as a ban-avoidance tactic.

> Rule of thumb: **one verified entity → one portfolio → one core ad account → many Pages
> and campaigns.** Redundancy comes from *backup admins and clean policy compliance*, not
> from duplicate accounts.

---

## What I need from you to go further
1. **Confirm the portfolio owner**: create/confirm **one** Business Portfolio named after
   the legal entity (**Vaayu Labs**), not per product. If Vaayu Labs already has one from a
   prior project, use that — don't create a second. Products (Rashi Kundali, Resume, …) are
   **Pages + campaigns** under it.
2. **GST/business verification status** — Meta will ask for verification to scale. Flag if
   it's already done for any entity so the ad account can be tied to it.
3. **Backup admin** — nominate a second full-control admin now (teammate or a second
   secured profile), so you're never the single point of failure.
4. Once the ad account + Pixel exist, share read access (or the account ID) and I can draft
   the exact campaign/ad-set JSON structure or a step-by-step Ads Manager click-path doc —
   I can't create or configure the live ad account myself, since that requires accepting
   Meta's advertiser terms and billing setup as you.
