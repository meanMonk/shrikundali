# Go-To-Market Playbook — Launch & First 30 Days

**Product:** Rashi Kundali / ShriKundali — premium Kundli PDF report (single SKU,
no consultations).
**Status when this was written (2026-09-23):** app + domain + payment are live; PDFs
generate and money lands; ads are planned/creative-ready but **not running yet**.

This doc is the operating manual for the day ads switch on. It answers the question
"what do we actually look for — complaints, conversions, PDF formats, or just wait?"

---

## 0. The short answer

**Do not sit idle and wait.** Paid traffic is a live experiment with a clock on the
budget. "Wait for conversions" is only valid for the first ~48-72h per ad set (the data
needs to accumulate). After that you are either scaling, fixing the funnel, or killing
spend. Every day at ₹1,000/day with a broken funnel burns budget you can't recover.

The job after launch splits into **four tracks, in priority order:**

1. **Fulfillment & trust (P0)** — did the customer actually get a good PDF? Any complaint
   or refund is worth more than a lost click. Watch this before anything else.
2. **Conversion funnel (P1)** — where do visitors drop? landing → form → paywall → paid.
3. **Unit economics (P1)** — CAC vs contribution margin, by channel/campaign.
4. **Creative iteration (P2)** — which hook/creative wins; make more of what works.

---

## 1. Pre-spend launch gates (do these BEFORE the first rupee)

Paid spend is blocked until all boxes are ticked. Most are already tracked in
`docs/prd/frontend-gap-plan.md` (P0) and `docs/progress/2026-09-21-analytics-tracking-plan.md`.

- [ ] **Conversion tracking verified end-to-end ourselves** — submit a real test purchase
      and confirm the `payment_success` event lands in GA4 + Meta CAPI + our own DB with
      correct UTM/`gclid`/`fbclid`. If attribution is broken, we're blind on CAC
      (analytics plan, "Gotcha 2").
- [ ] **E2E PDF flow proven** (issue #60) — form → teaser → checkout → webhook → PDF →
      email + Telegram → download, on production config, including Hindi rendering.
- [ ] **A refund/support contact is visible pre-payment** and someone is actually reading
      it (support@ + refund policy live).
- [ ] **Fulfillment failure alerting** works — a paid-but-failed-generation must ping
      Telegram immediately (issue #16), so we can recover/refund within the hour.
- [ ] **Daily funnel query/dashboard available** (issue #55) — at minimum the raw query in
      the analytics plan, run manually each morning.
- [ ] **Landing page is mobile-clean** — most traffic is mobile (PRD §7). Sending spend to
      a broken mobile page is the single most common way to waste a launch budget.
- [ ] **Every ad has the disclaimer** "Astrological guidance, not financial advice".

---

## 2. Launch week — daily operating cadence (15-30 min/day)

Run this every morning (IST), in order:

1. **Fulfillment first:** any `report_failed` / paid-without-report rows in the last 24h?
   Resolve or refund immediately. Check the Telegram sales feed.
2. **Complaints:** check support email/WhatsApp. Categorize: access/PDF-not-received,
   payment problem, content/accuracy, or refund request.
3. **Funnel numbers:** pull the daily funnel query — visits → previews → paywall → paid,
   plus CPC. Compute conversion rate at each step vs yesterday.
4. **Spend decision:** per campaign, apply the scale/hold/kill rules (§6).
5. **Creative note:** record which ads have any purchases attached.

Do **not** make structural changes (new landing page, price change) off one day of data.
Small copy/creative changes are fine.

---

## 3. What to watch, ranked — and the thresholds

### P0 — Fulfillment & trust (watch daily, fix same-hour)
| Signal | Where | Bad looks like | Action |
|---|---|---|---|
| Paid-but-failed generation | `orders.pdf_status`, `report_failed` event, #16 | any occurrence | Recover/refund same day |
| Report latency | `report_generated.duration_ms` | > ~60s consistently | Investigate API/PDF pipeline |
| "Didn't receive PDF" complaints | support channel | ≥1 | Check spam + delivery logs; resend |
| Refund requests | orders/refund log | any | Log reason; if a pattern, fix the promise |
| Hindi/Devanagari PDF breakage | spot-check a real generated PDF | any garbled matras | Block scale until fixed (#7/#29) |

### P1 — Conversion funnel (watch daily)
| Signal | Definition | Healthy direction |
|---|---|---|
| Landing → form started | form_started / landing_view | rising |
| Form started → preview | preview_generated | rising; a cliff here = form friction |
| Preview → paywall | paywall_viewed / preview_generated | should be high (>50%) |
| Paywall → paid | payment_success / paywall_viewed | the money number; watch closely |
| Exact abandonment field | `form_field_error` props | identify the worst field (#53) |
| Device split | mobile vs desktop | mobile should dominate; if its conversion is far worse, mobile is the leak |

If **paywall → paid is near zero** after ~50+ paywall views, stop scaling and fix the
offer/price/trust before spending more.

### P1 — Unit economics (watch daily)
- **AOV** (avg order value) and **tier mix**.
- **CAC by channel/campaign** = spend ÷ purchases (per campaign, from our DB, not the ad
  platform).
- **Contribution margin per order** = price − Prokerala cost − Razorpay fee (~2%) − any PDF cost.
- **Rule of thumb (analytics plan):** scale a channel when CAC < ~60% of AOV for 2-3
  consecutive days **and** fulfillment is clean. Hard ceiling: CAC must stay under
  contribution margin.
- **Noise guard:** below ~30 clicks/day per campaign, don't decide on the numbers.

### P2 — Creative & offer (review every 3 days)
- Which creative variant has purchases attached (not just CTR). Kill zero-purchase ads
  after 3 clean days, make 5-10 variants of the winner.
- Watch frequency/fatigue: rising CPM + falling CTR = refresh creative.

### PDF format / quality (weekly spot-check, plus every complaint)
- Spot-check one real delivered PDF per week: page count, branding/watermark, layout,
  Hindi rendering, correct name/birth details, no placeholder text.
- Any format/content complaint → capture the order ID + page, reproduce, fix template.
- Keep `docs/report-template/` and `docs/progress/2026-09-21-pdf-quality-review-corrected.md`
  as the reference for what "correct" looks like.

---

## 4. Complaint & refund runbook

Every complaint is a signal about a leak in the funnel or the promise. Log it, don't just
answer it.

1. **Classify:** access (can't download / no email) · payment (charged but no report) ·
   content (report wrong/insufficient) · refund request · policy objection.
2. **Resolve within 24h** (refund policy is 24h no-questions).
3. **Fix the class, not just the ticket:** e.g. repeated "no email" → deliverability or
   success-page clarity; repeated "expected more" → copy/promise mismatch, tighten copy.
4. **Track frequency:** a complaint class appearing more than a few times per 100 orders is
   a P0 fix.

Delivery backup: issue #47 (WhatsApp delivery) exists precisely to catch email failures.

---

## 5. Creative & copy iteration loop (3-day cycles)

- Cycle: read winners → make 5-10 variants of the winning hook/creative → relaunch within
  the same campaign/ad set structure.
- Follow `docs/ads/campaign-plan.md` (angle rotation) and
  `docs/ads/money-debt-sprint-copy.md` (10 copy variants).
- Don't rotate the product angle until the current one has a clean 3-5 day read.
- More buy buttons + B2C offer copy on the site is tracked in #61 — ship before scaling
  spend, since it directly lifts paywall → paid.

---

## 6. Scale / hold / kill rules

Per campaign/ad set, after at least 3 days and ≥30 clicks:

- **KILL** — zero purchases and CAC clearly above margin, or fulfillment broken.
- **HOLD** — some purchases but CAC between ~60% and 100% of AOV: optimize creative/landing,
  don't increase budget.
- **SCALE** — CAC < ~60% of AOV for 2-3 consecutive days and fulfillment clean: increase
  budget in steps (e.g. +20-30%), re-check after 2-3 days.

Never scale on a day when there's an unresolved fulfillment failure.

---

## 7. Weekly review (once a week, 30-60 min)

- Funnel table by campaign (visits → paid) + CPC/CAC/AOV/margin.
- Fulfillment: failures, latency, complaints by class, refunds.
- Creative: winners/losers, next 5-10 variants.
- Decide: scale winners, kill losers, one structural experiment for next week.
- Update `TODO.md` and the relevant issues with what changed.

---

## 8. What "just wait and see" would cost

Waiting without a cadence means: (a) you don't notice a broken fulfillment until
complaints/refunds pile up; (b) you keep paying for a leaky paywall; (c) you can't tell a
winner from noise; (d) creative fatigue goes unnoticed. The four-track cadence above is
deliberately light (15-30 min/day + a weekly review) — that's the minimum to make the
spend teach you something.

---

## 9. Owner mapping (open issues)

- #60 validate E2E PDF flow · #16 log paid-but-failed · #7/#29 Hindi QA
- #57 ad params → DB + Telegram · #55 daily funnel/CAC dashboard · #53 sessions/events schema
- #28/#48 analytics + conversion tracking · #54 Clarity heatmaps
- #61 more buy buttons + B2C copy · #37 CTA verb · #38 trust near CTA
- #62 mobile review · #63 design cleanup · #59/#58/#33 ad platform setup
- #47 WhatsApp delivery backup · #2 R2 storage (durability) · #17 UTM discipline
