# Regional Language Scan — Tamil & Telugu (Meta Ad Library)

You flagged that Tamil/Telugu-language kundali/finance ads are running too — this is a
quick scan of both, same India/active-ads scope as the main field scan. Short version:
**there is a direct ₹199 clone of our exact product already running in Telugu**, and one
advertiser (AstroLokal) is spending heavily on an identical ₹20 money-hook across both
languages, which is a strong signal on what wins regardless of language.

## Tamil (ஜாதகம் = kundali/horoscope)

| Advertiser | Price | Hook | Format |
|---|---|---|---|
| **AstroLokal Tamil** | ₹20 (first chat, 80% off framing) | "💰 பணவரவு அதிகரிக்க என்ன யோகம் இருக்கு? உங்க ஜாதகம் என்ன சொல்லுதுனு இப்பவே தெரிஞ்சிக்கோங்க." (*What yog will increase your income? Find out right now what your chart says.*) | Video, app install |
| **Bodhi** | ₹9 first chat | "கல்யாணம் ஏன் தாமதம்? ஜாதகம் மூலம் தெளிவான பதில் பெறுங்கள்." (*Why is marriage delayed? Get a clear answer through your chart.*) | App install |
| **InstaAstro** | ₹1 first chat | Tanglish, not pure Tamil: "Relationship, kalyanam, kuzhanda — edhu vendumaanalum kelunga. India-vin best jothidargal-oda pesunga." | App install |
| **Bhairava Peedam** (local practitioner) | Consultation, no fixed price | Full pain-point list including debt: "கடன் மற்றும் பண பிரச்சனைகள்" (*debt and money problems*), delivered via foot-line palmistry, phone number + physical address | Call/WhatsApp |
| **Kundli Guide by Sri Mandir** | Not shown (order-now CTA) | "200+ pages... Trusted by 3 Lakh+ Customers... Mahadasha & Antardasha, dosha analysis, next 30 years." | English copy, pan-India, not Tamil-specific — but the biggest brand name in this scan by far |

## Telugu (జాతకం = kundali/horoscope)

| Advertiser | Price | Hook | Format |
|---|---|---|---|
| **AstroLokal తెలుగు** | ₹20 | Same exact hook as the Tamil version, word-for-word translated: "💰 డబ్బు రాబడి పెరగడానికి ఏమైనా యోగం ఉందా? మీ జాతకం ఏమి చెప్తుందో ఇప్పుడే తెలుసుకోండి." | Video, app install — **10+ duplicate ad IDs live simultaneously**, the heaviest single spend pattern in this entire scan across any language |
| **Mana Sastram** | **₹199** — same as our exact price | "మీ జాతకంలో ఏముందో తెలుసుకోవాలని ఉందా? పండితుల దగ్గరికి వెళ్లక్కర్లేదు... కెరీర్, డబ్బు, పెళ్లి, ఆరోగ్యం, గ్రహస్థితి." + English tagline: **"Your full Telugu jathakam in plain words, not chakras. Career, money, marriage, health and your current period. Free chart, Rs. 199 for the complete PDF."** | 25+ page personalized PDF, instant download, free preview chart before paying |
| **Rani Astro** | ₹149 (marked as 80% off, implying ₹199+ list) | "మీ జీవిత రహస్యాలను తెలుసుకోవాలనుకుంటున్నారా?" + 170+ page report, dosha & remedies, delivered via WhatsApp in 1 hour | WhatsApp PDF delivery |

## What this changes

1. **Mana Sastram is the closest direct competitor found in this entire research
   effort** — same price (₹199), same format (PDF report, not consultation), same
   "plain language, not mystical jargon" positioning we're already using
   ("not chakras" in their English tagline is almost exactly our own "instant clarity,
   not a call" angle from `meta-ads-copy.md`). Worth periodically checking their ad
   copy/creative for what's still running/working, since they've clearly validated this
   exact price point in a regional market.
2. **AstroLokal's ₹20 "first chat" hook is the single heaviest-spending creative found
   across this entire scan** (Hindi, Tamil, and Telugu markets all show duplicate
   variants). It's a consultation upsell funnel, not a flat-fee report like ours, so it's
   not a direct copy target — but the pattern (name the money-yog question, price the
   first touch near-zero) is worth testing as a teaser-to-paid funnel once the free
   teaser feature ships (per `docs/prd/frontend-gap-plan.md` issue #20).
3. **Free preview before paying** shows up again here (Mana Sastram: "Free chart, ₹199
   for the complete PDF") — this is the third independent confirmation across Hindi,
   English, and Telugu markets that "see something real for free, pay for the full
   report" outperforms a blind paywall. Our PRD's teaser feature is directionally
   correct; this is more evidence to prioritize shipping it.
4. **Should we localize into Tamil/Telugu ourselves?** Not for the current 2-week money/
   debt sprint — stay focused on Hindi/Hinglish/English per the existing plan. But
   Mana Sastram + Rani Astro proves the ₹149-199 flat-fee PDF model works in at least
   one regional market without a call/consultation upsell, which is useful validation
   to point to later if/when regional-language expansion comes up.

## Not done in this pass
Didn't pull Kannada, Malayalam, Bengali, or Marathi — flag if you want those covered
too; the same keyword-translation approach works (kundali/jathakam/janam patrika in the
relevant script).
