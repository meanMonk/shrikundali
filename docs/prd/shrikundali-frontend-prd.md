# ShriKundali — Frontend, Content & Funnel PRD
**Scope:** Single product — Premium Kundli PDF Report (no consultations, no gemstones, no matching, no app). Reference competitors analyzed for CTA wording, funnel structure, trust mechanics, and responsiveness only.

---

## 1. Competitor Teardown

| Site | Funnel shape | Price anchor | CTA wording | Trust signals | Notes |
|---|---|---|---|---|---|
| **AstroIndia.com** | Homepage → Product page with inline multi-step form (name→gender→DOB→time→place→language→WhatsApp) → sticky price bar → "Order Now" → price breakup modal → "Continue to payment" | ₹11,000 struck → ₹1,599 (85% OFF), countdown timer "Offer ends in 00:00:00" | "Get Dhan Yoga Report Now", "Order Now", "Buy now", "Continue to payment", "Add to cart" | ★4.9, 1.5M+ users, 48h delivery, 100% secure, verified experts badges, review carousel with photos+city, WhatsApp deep-link | Very aggressive discount-anchor + countdown urgency. Entire form is embedded on-page (no separate checkout page) — reduces drop-off. Sticky bottom price bar with live total follows scroll. FAQ answers objections ("can I ask follow-up Qs? No") — sets expectation, avoids refund disputes. |
| **AstroArunPandit.org (Premium Kundli)** | Landing hero (video bg) → feature icon row → pricing card w/ CTA → "what's included" checklist → testimonials (Hinglish, named, photo) → FAQ → footer CTA repeat | ₹1,999 struck → ₹499 (Save 75%) | "Unlock My Kundli", "Unlock Your Full Report" | 10 Lakh+ customers, 4.9/5 from 50K+ users, "Featured: Times of India" press badge, celebrity astrologer photo, 53+ years legacy | CTA verb "Unlock" (curiosity/access framing) repeats 3× down the page — same link, multiple entry points. Testimonials mix English + Hinglish for authenticity. Uses outcome-based proof ("got job after 6 months of applying") not just satisfaction. FAQ addresses timeline ("3-5 working days") and delivery channel explicitly. |
| **SriAstroVastu (Kundli Matching)** | Free calculator form (no email/phone yet) → **instant free partial result** (real computed Gun Milan score + table) shown on-page → upsell block → email/phone collected → "Detailed Kundli Report" paywall | ₹298 flat, no strike-through, "One-time payment · Secure checkout" | "Get Detailed Kundli Matching", "Detailed Kundli Report ₹298" | WhatsApp + email in header (always visible), named testimonials with couple names + city, two-column "What You'll Receive / Benefits" split | Note: initial static fetch showed a blank JS-shell (anti-pattern noted below still stands for first paint/SEO) — but the **actual rendered funnel** (per screenshot) is a genuine freemium teaser model, and it's the most conversion-relevant pattern of the three. See Section 3a below. |

### 1a. Freemium Teaser Pattern (SriAstroVastu) — worth adopting in modified form

Unlike AstroIndia/Arun Pandit (full paywall before any output), SriAstroVastu's actual flow lets the user submit birth details **for free**, instantly computes a **real, personalized partial result** (their actual Gun Milan score + a Guna-by-Guna table), and only paywalls the "detailed" version behind a report purchase. Email/phone is captured after this free value is shown, not before.

This is a stronger trust mechanic than a generic blurred "sample report" (what's currently proposed in Section 5.3), because the visitor sees **their own real data partially computed**, not a stranger's mock-up. It proves the engine works before asking for money.

**Recommended adaptation for ShriKundali (report-only, not matching):**
- Let the visitor submit birth details free, and instantly show a small set of *real, computed* teaser facts on-page — e.g. Lagna (Ascendant), Rashi, Nakshatra, and one headline dosha flag (present/absent) — computed live from AstrologyAPI, not canned.
- Lock the rest ("450+ pages incl. full dasha timeline, remedies, career/marriage analysis — Unlock Full Report") behind the paid PDF.
- Capture WhatsApp/email at the point of *unlocking*, not before the free teaser — reduces top-of-funnel friction versus asking for contact details upfront.
- This replaces/supplements the static blurred-sample idea in Section 5.3 — keep static samples as a fallback/secondary trust element, but prioritize the live personalized teaser as the primary hook.

### Cross-cutting patterns worth adopting
- **One dominant CTA verb repeated everywhere** ("Order Now" / "Unlock") — never mix 5 different verbs across a page.
- **Struck-through price + %-off badge** is the universal pricing pattern in this niche — buyers expect it.
- **Sticky bottom bar on mobile** showing price + CTA once user scrolls past hero.
- **Inline multi-step form beats separate checkout page** — every field-group is progressive (2–3 fields per screen/step), with a completion counter ("0/7 completed").
- **Delivery-channel + timeframe stated repeatedly** (WhatsApp/email, 24–48h) — this is the #1 anxiety point before payment.
- **Reviews with name + city + verified tag**, not anonymous stars.
- **FAQ used as objection-handling**, not just information — directly answers "is payment secure", "will you call me", "what if my time of birth is unknown".
- **Trust badge row** (secure payment, private & confidential, verified, 24/7 support) placed directly under/near the CTA button, not buried in footer.

### Patterns to avoid
- Countdown timers that reset on refresh (feels manipulative once noticed) — if used, back it with a real server-side expiry.
- Client-side-only rendering with empty first paint.
- Overloading one page with unrelated upsells (gemstones, consultations, courses) — dilutes focus and adds decision fatigue. **We are explicitly avoiding this**: ShriKundali sells one thing.

---

## 2. Product Definition

- **One SKU:** Premium Kundli PDF Report.
- **One conversion path:** Land → see value/trust → fill birth-detail form → pay → receive PDF (WhatsApp/email/download link).
- **No cart, no account requirement, no multi-product nav.** Every page decision should ask: *does this help someone submit the form and pay in under 3 minutes?*

---

## 3. Brand & Visual Identity

### Positioning
Premium but calm — not fear-based, not overly mystical/cluttered like AstroIndia's Shopify skin, not video-heavy/celebrity-cult like Arun Pandit. ShriKundali should feel like a **modern, trustworthy report product** — closer to a premium fintech/legal-doc product than a "spiritual guru" brand.

### Color Palette (proposed)

| Role | Color | Hex | Use |
|---|---|---|---|
| Primary (brand/CTA) | Deep Saffron-Maroon | `#B5451C` | Primary buttons, price highlights, active states |
| Primary Hover | Burnt Orange | `#D45C2C` | Button hover/press |
| Secondary/Accent | Deep Indigo | `#241E4E` | Headings, header/footer background, dark sections |
| Accent Gold | Muted Gold | `#C9A227` | Icons, dividers, "premium" badges, star ratings |
| Background | Warm Off-White | `#FBF6EF` | Page background (not stark white — feels warmer/premium) |
| Surface | White | `#FFFFFF` | Cards, form panels |
| Text Primary | Charcoal | `#2B2620` | Body copy |
| Text Muted | Warm Gray | `#7A7267` | Secondary text, captions |
| Success/Trust | Forest Green | `#3F6B4C` | Trust badges, "secure", checkmarks |
| Border/Divider | Sand | `#E8DFD1` | Card borders, section dividers |

Rationale: saffron/maroon + indigo + gold reads as "Indian premium/spiritual" without falling into loud red/orange overload (AstroIndia) or generic stock-photo pastel (Arun Pandit). Warm off-white background instead of pure white makes it feel less like a SaaS tool and more like a crafted report product — appropriate since the deliverable itself is a document.

### Typography
- **Headings:** A serif or slab-serif with slight warmth (e.g., "Fraunces", "Lora", or "Tiempos") — signals "detailed report/document," reinforces the PDF-as-product idea.
- **Body/UI:** A clean geometric sans (e.g., "Inter", "Manrope") for form fields, buttons, nav — keeps usability sharp on mobile.
- **Devanagari fallback:** Ensure the sans stack includes a Devanagari-safe font (e.g., "Noto Sans Devanagari") since Hindi-language reports are a stated feature — don't let Hindi text render in a mismatched fallback.

### Iconography
Line icons (not filled/emoji) for feature bullets — thin gold or indigo strokes. Avoid clip-art zodiac wheels/generic stock astrology imagery; use a custom-illustrated birth-chart (kundli square chart) motif as the recurring visual anchor instead — it visually differentiates from competitors who lean on astrologer headshots and stock cosmos imagery.

---

## 4. Information Architecture (single-product site)

```
/ (Home = Landing/Sales page — this IS the product page)
  → #how-it-works
  → #whats-included
  → #sample-report (preview pages)
  → #testimonials
  → #faq
  → #form (sticky CTA scrolls here)
/report/[order-id]/status   (post-payment tracking, optional)
/legal/privacy, /legal/terms, /legal/refund
```

No collections, no blog requirement at launch, no account system. Keep it a **single scrollable conversion page** + a thin post-purchase status page + legal pages (required for Razorpay compliance).

---

## 5. Landing Page — Section by Section

### 5.1 Hero
- **Headline:** Outcome-first, calm tone. e.g. *"Your Complete Kundli, Explained — Not Just Calculated."*
- **Subhead:** *"A detailed, personalised Vedic astrology report — birth chart, doshas, dashas & remedies — delivered as a PDF in 24–48 hours."*
- Small trust strip directly under subhead: `⭐ 4.8 rated  •  Secure Payments  •  PDF delivered in 24–48h  •  Private & Confidential`
- Primary CTA button: **"Get My Kundli Report"** (verb + product, no generic "Submit")
- Visual: a stylized sample chart/report mockup (not a stock astrologer photo) — reinforces "this is a report you'll receive," sets the right expectation up front.

### 5.2 "What's Included" (feature grid, icon + 1 line each)
Mirror competitor pattern but keep to **PDF-only** deliverables — no consultation/call promises:
- Detailed Birth Chart & Divisional Charts
- Dosha Analysis (Mangal, Kaal Sarp, etc.) with plain-language explanation
- Dasha/Bhukti Timeline (career, marriage, finance windows)
- Personalised Remedies (practical, non-fear-based)
- Available in English & Hindi
- 24–48 hour PDF delivery via Email/WhatsApp

### 5.3 Sample Report Preview + Live Free Teaser (primary hook)
Two layers, in priority order:
1. **Live personalized teaser (primary):** After the visitor enters birth details, instantly show real computed basics — Lagna, Rashi, Nakshatra, one dosha flag — directly on the page, before payment (see Section 1a). This is the single strongest trust mechanic seen across competitors and is currently missing from all three PDF-report competitors — a genuine differentiation opportunity.
2. **Static sample pages (secondary/fallback):** 3–4 blurred/watermarked sample PDF pages (chart page, dosha page, remedy page) in a lightbox/carousel, for visitors who don't complete the teaser form. This directly reduces "what am I even paying for" anxiety — the #1 pre-payment objection for an intangible PDF product.

### 5.4 How It Works (3–4 steps, horizontal on desktop / vertical on mobile)
1. Enter your birth details (60 seconds)
2. We generate your report using precise Vedic calculations
3. Receive your PDF on email/WhatsApp within 24–48 hours

### 5.5 Pricing Block
- Struck price + discounted price + "% OFF" badge (proven pattern from both competitors).
- One single price, no tiers/add-ons at launch — avoid the complexity AstroIndia introduces with add-on upsells; that belongs in a v2 experiment, not launch.
- CTA: **"Get My Report — ₹[price]"** (price inside the button reduces surprise/friction at final step).
- Directly below button: trust row — `🔒 Secure Payment (Razorpay) · 🔐 Your birth details stay private · 📄 Instant order confirmation`

### 5.6 Birth Details Form (see Section 6)

### 5.7 Testimonials
- Named + city + short quote, mix of English and natural Hinglish phrasing where authentic.
- Prefer **outcome-based** quotes ("helped me time a decision," "explained my dasha clearly") over vague "very accurate" praise — matches Arun Pandit's stronger pattern.

### 5.8 FAQ (objection-handling, not just info)
Must-include questions based on competitor gaps + our own funnel:
- How accurate is this report and what if my birth time is approximate?
- How will I receive my report, and how long does it take?
- Is my birth data kept private?
- Is payment secure? What payment methods are supported?
- Can I get a refund if something's wrong with my order?
- Is this available in Hindi?
- Do you offer consultations/calls? *(Answer clearly: No — this is a report-only product, sets correct expectation and avoids scope creep in support inbox.)*

### 5.9 Footer CTA repeat
Repeat the pricing CTA once more at the bottom, same wording as hero — consistency over novelty (per Arun Pandit's multi-entry-point pattern).

---

## 6. Birth Details Form — UX Spec

Follow the **inline progressive form** pattern (AstroIndia) rather than a separate checkout page — this is the single highest-leverage funnel decision.

**Structure:** 3 grouped steps within one continuous panel, each revealed as prior group completes. Progress indicator: *"Step 2 of 3 · ~40 seconds left"*.

1. **Who is this for?** — Full Name, Gender
2. **Birth Details** — Date of Birth, Time of Birth (with "Don't know exact time?" fallback → approximate range picker instead of blocking submission), Place of Birth (autocomplete)
3. **Delivery & Language** — Report language (English/Hindi), WhatsApp number and/or Email

**Microcopy rules:**
- Every field gets a one-line reassurance under it where relevant (e.g. Place of Birth: *"Type your city — we'll match it automatically."*; WhatsApp: *"We'll send your PDF and order updates here."*)
- Show a persistent micro-trust line right above the submit button: *"Your birth details are encrypted and never shared."*
- Final button text should describe the next action precisely, not "Submit": **"Continue to Payment"** on the form, then **"Pay ₹[amount] Securely"** on the payment step — matches competitor pattern of never using a bare generic "Submit"/"Next" as the final-step label.
- Include a lightweight price recap (base price, discount, total) directly above the final CTA — this is what AstroIndia's "price breakup" modal does well; don't hide the price until Razorpay opens.

**Validation & error tone:** Friendly, specific, non-blaming: *"That date doesn't look right — try DD Month YYYY, e.g. 12 Aug 1998."* Never a raw "Invalid input."

---

## 7. Mobile Responsiveness Requirements

- **Design mobile-first** — most Indian astrology-purchase traffic is mobile (all 3 competitors optimize primarily for mobile checkout).
- Sticky bottom bar on scroll (mobile only): compressed price + single CTA button, always visible once hero scrolls out of view. This is the single biggest conversion lever seen in AstroIndia's implementation.
- Form steps must be **one field-group per mobile viewport** — no more than 2–3 inputs visible per step on small screens, to avoid the cramped, scroll-heavy feel.
- Tap targets ≥44px, native date/time pickers on mobile (don't roll custom pickers that fight OS keyboards).
- WhatsApp CTA/icon should deep-link (`wa.me/...`) directly into a chat, not just display a number.
- Test Devanagari (Hindi) rendering specifically on mobile widths — font fallback breaking on Hindi text is a common, easy-to-miss bug.
- Images/sample report previews must be lazy-loaded and served responsively (srcset) — avoid the heavy unoptimized asset pattern seen on Arun Pandit's page (large PNGs at multiple breakpoints via Next/Image, but still heavy).
- **Server-render the core landing content** (avoid the SriAstroVastu anti-pattern of a blank client-rendered shell) — critical for both perceived speed and SEO given the existing Playwright/Hono stack already used elsewhere in your projects.

---

## 8. CTA Copy Bank

Pick **one primary verb** and use it consistently across hero, pricing block, and footer. Options, pick one:

| Style | Primary CTA | Secondary/inline CTA |
|---|---|---|
| Direct | "Get My Kundli Report" | "See Sample Report" |
| Curiosity | "Unlock My Complete Kundli" | "Preview a Sample Page" |
| Outcome | "Get My Life Roadmap" | "See What's Inside" |

Recommendation: **"Get My Kundli Report"** — direct, sets correct expectation (a report, not a call/consultation), and doubles as good SEO anchor text.

Payment-step CTA: **"Pay ₹[amount] Securely"** (always show the exact amount in the button — reduces last-step abandonment).

---

## 9. Post-Payment Flow

1. Instant on-screen confirmation: *"Payment received! Your Kundli is being generated."*
2. Immediate email/WhatsApp confirmation with order ID and expected delivery window.
3. Optional lightweight status page (`/report/[order-id]/status`) showing a simple 3-stage progress (Received → Generating → Delivered) — reduces "did it actually work" support queries, a known pain point implied by competitor FAQs.
4. Final delivery: signed PDF download link (R2) + attached/linked copy via email + WhatsApp message.

---

## 10. Trust Elements Checklist (place near every CTA, not just footer)
- [ ] Secure payment badge (Razorpay/UPI/Card logos)
- [ ] "Private & Confidential — birth details encrypted" line
- [ ] Delivery time commitment ("24–48 hours") restated at hero, pricing, and form
- [ ] Star rating + review count (once real reviews exist; don't fabricate)
- [ ] Refund/support contact visible pre-payment, not just in legal footer

---

## 11. Success Metrics for Launch
- Form-start → Form-complete rate (target: identify drop-off step via analytics on the 3-step form)
- Form-complete → Payment-complete rate
- Mobile vs desktop conversion split
- Time-to-first-CTA-click (hero effectiveness)
- Sample-report preview engagement (does showing it correlate with higher conversion?)

---

## 12. Explicit Non-Goals for v1
- No consultations, no astrologer chat/call booking
- No gemstones, books, or other merchandise
- No multi-product navigation or cart system
- No account/login requirement to purchase
- No tiered pricing/add-ons at launch (test post-launch only)

---

## 13. Open Decisions for sk
- Final CTA verb/style (Section 8)
- Whether "Don't know exact birth time" should be a soft-optional field or a hard blocker (competitors allow approximate ranges — recommend following that)
- Whether to show a live/fake countdown timer for the discount (AstroIndia does; recommend either a real server-side expiring offer or skip it entirely — a countdown that resets on refresh erodes trust once noticed)
