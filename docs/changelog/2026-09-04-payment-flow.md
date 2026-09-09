# Changelog

## 2026-09-04 — Payment flow + Teaser + Email + Telegram + Config + Stats Bot

Added one-hop payment flow: form → teaser → pay → PDF. No second paywall.

**New endpoints:**
- `POST /teaser` — free preview (lagna, rashi, nakshatra, 6 money-axis scores), requires email
- `POST /payment/checkout` — creates Razorpay/Cashfree order
- `POST /webhook/razorpay` — payment confirmation → triggers PDF gen
- `POST /webhook/cashfree` — payment confirmation → triggers PDF gen
- `GET /download/:id/pdf` — serves PDF post-payment
- `GET /download/:id/status` — check generation status
- `GET /api/config/:reportType` — frontend config (price, CTA, features, etc.)
- `GET /api/config/` — all report configs
- `POST /telegram/bot/` — Telegram bot webhook (handles /today, /week, /month, /lastmonth)

**New files:**
- `src/routes/teaser.ts`
- `src/routes/checkout.ts`
- `src/routes/webhook.ts`
- `src/routes/download.ts`
- `src/routes/config.ts` — backend-driven frontend config
- `src/routes/telegram-bot.ts` — admin stats bot
- `src/lib/payment.ts` — Razorpay + Cashfree unified
- `src/lib/cache.ts` — 60min chart cache (now stores email + label)
- `src/lib/email.ts` — Zoho SMTP, sends PDF + payment receipt
- `src/lib/telegram.ts` — admin sale notification
- `src/lib/orders.ts` — MongoDB orders collection + stats queries

**Key design:**
- Webhook triggers PDF generation from cached chart (no re-fetch of astrology API)
- Email + Telegram fire-and-forget after download link is ready (non-blocking)
- Email is captured at teaser step, stored in cache, used for delivery
- Orders stored in MongoDB for stats/audit
- Telegram bot reads from orders collection for /today, /week, /month, /lastmonth
- Frontend fetches config from backend (no hardcoded prices/CTA)

**Frontend updates:**
- `kundali.astro` now fetches config from `/api/config/financial_kundali`
- Added email field (required) to form
- Price/discount display from backend config
- Email field added to teaser payload

**Env vars added:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `APP_URL`, `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS`, `ZOHO_SMTP_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`

---

## 2026-09-04 — Landing Page + Static Pages + SEO

**Landing page (`index.astro`):**
- Hero with animated CTA (pulse animation)
- Pain points section (4 common financial struggles)
- 6 feature cards (Income, Savings, Loan, Investment, Career, Outlook)
- Free teaser score preview (6 money-axis boxes)
- How it works (3 steps)
- Testimonials (3 cards)
- Full form with geocoding fallback (50+ Indian cities)
- FAQ accordion (5 questions)
- Bottom CTA
- Sticky mobile CTA on scroll
- Responsive grid (single column on mobile)

**Static pages created:**
- `/refund` — 24-hour no-questions refund policy
- `/privacy` — Birth data storage/usage, third-party services
- `/about` — Mission, how it works, privacy-first
- `/terms` — Service terms, payments, IP, liability
- `/disclaimer` — Not financial advice, no guaranteed outcomes

**Layout updates:**
- Footer with links to all static pages
- SEO meta description added
- Mobile-responsive design

**Checklist updated:**
- Payment integration: ✅ Done
- Frontend config: ✅ Done
- Landing page: ✅ Done
- Static pages: ✅ Done
- Telegram notifications: ✅ Done
- Orders collection: ✅ Done

---

## 2026-09-04 — Analytics + Tracking + Domain Setup

**Domain:** shrikundali.in
**Support email:** support@shrikundali.com

**Analytics added:**
- Meta Pixel (client-side PageView, Lead, InitiateCheckout, Purchase, ViewContent)
- Google Analytics 4 (page_view, form_start, form_submit, payment_initiated, payment_success)
- Server-side `/track` endpoint for backend events

**Funnel events tracked:**
1. PageView — landing page load
2. InitiateCheckout — form focus (first interaction)
3. Lead — form submission
4. ViewContent — teaser scores loaded
5. InitiateCheckout — payment button clicked
6. Purchase — payment successful (webhook)
7. ViewContent — PDF download

**Files added:**
- `packages/web/kundaliweb/src/lib/tracking.ts` — client-side tracking utility
- `packages/web/kundaliweb/.env.example` — frontend env vars

**Env vars added:** `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `GA_MEASUREMENT_ID`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_GA_MEASUREMENT_ID`

**Email updated:**
- Support address: support@shrikundali.com
- Footer includes disclaimer link
