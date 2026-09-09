# Changelog

## 2026-09-09

### Flow Fixes (PRD §6/§6a alignment)
- **Form restructured**: 3-step wizard → single group (Name, Gender, DOB, Time, Birthplace, Language)
- **Email moved to payment modal**: no contact info collected before free teaser preview
- **Live teaser**: POST /teaser returns real Lagna/Rashi/Nakshatra/Dosha, displayed on-page
- **Payment modal**: in-page modal replaces /kundali redirect — email + "Pay ₹[price] Securely"
- **Gender field added**: Male/Female/Other select in birth details form
- **CTA consistency**: "Get My Kundli Report" across hero/footer/sticky
- **Trust elements**: delivery time in hero, micro-trust lines near all CTAs
- **Price alignment**: reads from API config, backend checkout matches config discountPrice (₹99)

### Bug Fixes
- Teaser display: extract `.name` from lagna/rashi/nakshatra objects (were showing [object Object])
- Dosha display: read `mangalDosha` boolean from backend (was looking for nonexistent `doshaFlag`)
- Teaser email: send placeholder to satisfy backend schema (real email collected at payment)
- Checkout price: was hardcoded ₹199, now ₹99 matching config discountPrice

### Backend
- `checkout.ts`: REPORT_PRICE_INR now defaults to 99, configurable via env var
- `.env.example`: added REPORT_PRICE_INR, improved comments for all vars

### Frontend
- `KundaliLanding.astro`: complete rewrite of form + teaser + modal + script sections
- Razorpay SDK loaded for modal checkout
- `.env.example`: improved comments

### Previous (d409b10 — #34)
- Shared KundaliLanding.astro component
- 5 SEO landing pages under /p/
- @lucide/astro icons replacing emoji
- Brand color tokens + fonts (Fraunces/Inter/Noto Sans Devanagari)
- Geocoding: Google Places → Nominatim → static table
- Ayanamsa: 1 (Lahiri) in API payloads
- Refund policy rewritten
