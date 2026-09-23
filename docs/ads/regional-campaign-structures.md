# Regional Campaign Structures

One campaign structure per language, built directly from what's actually working in
each market per `regional-language-scan.md` and the main `campaign-plan.md`. All of
these stay **inside the one ad account** from `meta-business-manager-setup.md` — separate
campaigns, not separate accounts, targeted by Meta's audience language + geography
settings.

**Sequencing:** don't launch all of these at once. Finish the current Hindi/Hinglish
money-debt sprint first — it's the cheapest to iterate on and the language most of the
team can QA. Everything below is the plan to execute once that sprint has a winner to
translate, in the order listed (Telugu and Malayalam first — most direct competitive
validation found).

## Creative note: no new images needed per language
Tested generating native-script (Telugu) text directly into a `gpt-image-1` creative —
it came back garbled, not real words (complex Brahmic scripts render far worse than
Devanagari/Latin in current image models; see the removed `F1` entry's comment in
`generate.mjs`). Checked the actual competitor convention instead:
`docs/ads/meta-library-snapshots/mana-sastram-telugu-₹199-direct-competitor.png` — our
closest direct competitor, running in Telugu — has an **English-language image**
("YOUR FULL JATHAKAM REPORT", "ONLY ₹199", "GET YOUR FULL JATHAKAM"). The native
language lives in the ad's caption/primary text around the image, not in the pixels.

**So: reuse `E1`-`E4` as-is in every language below.** No new creative generation
needed — just the native-language primary text under each, which is below per language.

---

## 1. Hindi/Hinglish (current sprint — reference only, see `money-debt-sprint-copy.md`)
- **Keywords people search:** kundli report pdf, financial kundali, karz mukti, dhan yog
- **Winning pattern found:** debt-loop pain point, EMI/Shani framing, ₹49-299 flat-fee
  PDF, WhatsApp or web checkout split roughly evenly
- **Our price:** ₹199 (already shipping)
- **Status:** in flight, don't touch until it has a clean read

## 2. Telugu — highest priority for expansion
- **Keywords people search (from scanned ad copy):** జాతకం (jathakam), డబ్బు యోగం (money
  yog), పూర్తి జాతకం PDF (full jathakam PDF), 25+ పేజీల జాతకం (25+ page jathakam)
- **Messaging framework:** plain-language positioning against "pandits/priests" —
  Mana Sastram's exact line translates to *"You don't need to go to a pandit. Give your
  birth details and get career, money, marriage, health — all on your phone, in Telugu,
  simply."* This is our own "instant, not a call" angle, already proven in this exact
  market at our exact price.
- **Price:** ₹199 flat fee (match Mana Sastram directly) — this is the one language
  where we have a confirmed same-price, same-format competitor, so price-testing is
  lower-priority than creative/targeting testing.
- **Funnel:** website PDF checkout (like us) — Mana Sastram does NOT use WhatsApp
  delivery, unlike most of the rest of this scan. Rani Astro does use WhatsApp delivery
  at ₹149. Worth A/B testing both delivery channels, not assuming WhatsApp wins here.
- **Ad format:** static poster + video both present; AstroLokal's ₹20 near-zero-price
  video ad is the heaviest spender but is a different (consultation) funnel — don't copy
  its price, copy its emotional hook shape for a possible free-teaser variant later.

**Ready-to-run primary text (pair with `E1-anchor-book-cover.png` or
`E2-premium-pdf-template.png` — image stays English, this is the caption):**
> మీ జాతకంలో ఏముందో తెలుసుకోవాలని ఉందా? 🌟 పండితుల దగ్గరికి వెళ్లక్కర్లేదు — మీ పుట్టిన
> వివరాలు ఇస్తే కెరీర్, డబ్బు, పెళ్లి, ఆరోగ్యం, అప్పు గురించి ఇప్పుడే తెలుసుకోండి,
> తెలుగులో, సులభంగా. 25+ పేజీల వ్యక్తిగత జాతకం రిపోర్ట్ — ఒకేసారి ₹199, వెంటనే డౌన్‌లోడ్.
>
> *(EN gloss: Want to know what's in your jathakam? No need to visit a pandit — give
> your birth details and find out about career, money, marriage, health, and debt right
> now, in Telugu, simply. 25+ page personal jathakam report — ₹199 one-time, instant
> download.)*

## 3. Malayalam — second priority
- **Keywords:** ജാതകം (jathakam), പണം (panam/money), സാമ്പത്തിക (saambathika/financial)
- **Messaging framework:** AstroLokal's Manglish line — *"Ethra sampadichittum kayyil
  panam nilkkunnille?"* (No matter how much you earn, money doesn't stay in hand?) — is
  close to a direct translation of our own V2 Hindi copy ("कमाते तो हैं… पैसा बचता
  क्यों नहीं?"). This is the single easiest language to translate our existing winning
  copy into, since the underlying hook already independently converged.
- **Price:** test both ₹199 (our standard) and ₹249 (Navagraha's price, which includes
  their audio add-on — don't match their price without matching their differentiator,
  or we're just more expensive for the same thing).
- **Funnel:** WhatsApp delivery is standard here (Navagraha explicitly promises instant
  WhatsApp delivery); build that as the primary CTA, not a secondary option.
- **Differentiator to consider:** an audio-summary add-on (even a simple 60-90s
  TTS-read summary of the key findings) would be genuinely novel in this market
  specifically — nobody else offers it. Flag as a "if Malayalam launch goes well" idea,
  not a day-1 requirement.

**Ready-to-run primary text (pair with `E1` or `E2`):**
> 💰 എത്ര സമ്പാദിച്ചാലും കയ്യിൽ പണം നിൽക്കുന്നില്ലേ? നിങ്ങളുടെ ജാതകം എന്താണ്
> പറയുന്നതെന്ന് ഇപ്പോൾ തന്നെ അറിയൂ. കരിയർ, പണം, കടം, വിവാഹം, ആരോഗ്യം — എല്ലാം ഒരു
> വ്യക്തിഗത റിപ്പോർട്ടിൽ. ₹199 മാത്രം, WhatsApp വഴി തൽക്ഷണം ലഭിക്കും.
>
> *(EN gloss: No matter how much you earn, money doesn't stay in hand? Find out right
> now what your jathakam says. Career, money, debt, marriage, health — all in one
> personal report. Just ₹199, delivered instantly via WhatsApp.)*

## 4. Tamil — third priority
- **Keywords:** ஜாதகம் (jathakam), பணவரவு (money flow/income), பணம் (money)
- **Messaging framework:** same AstroLokal money-yog hook as Telugu/Malayalam, plus a
  distinct local-practitioner pattern (Bhairava Peedam) that leads with a *named, specific
  problem list* (debt, business stagnation, health, relationship, marriage delay) rather
  than one hook — worth testing a "checklist" version of our ad copy here specifically,
  closer to `E2-premium-pdf-template.png`'s format than a single-pain-point hook.
- **Price:** ₹199, same logic as Telugu — no confirmed same-price direct competitor here,
  so this is more of an open lane; price-test ₹149 vs ₹199.
- **Funnel:** WhatsApp — every Tamil competitor found in this scan (including the ₹1
  InstaAstro first-chat) routes to WhatsApp or an app install, none to a web checkout.
  This is the language where our website-checkout funnel is most different from category
  norms — worth flagging as a risk to watch, not just a fact.
- **Brand-name risk:** Sri Mandir's "Kundli Guide" ad (200+ pages, "Trusted by 3 Lakh+
  Customers") ran in this same search and is a much bigger, better-funded brand than any
  other competitor found in this entire research effort. Don't expect to outspend them —
  compete on the "flat-fee, no upsell, plain language" positioning instead.

**Ready-to-run primary text (pair with `E2-premium-pdf-template.png` — its checklist
format matches the Bhairava Peedam pattern found here):**
> 🔮 உங்க ஜாதகத்தில் என்ன இருக்குனு தெரிஞ்சுக்க ஆசையா? கடன், பணம், வேலை, திருமணம்,
> ஆரோக்கியம் — எல்லாத்துக்கும் பதில் உங்க பிறந்த தேதியில் இருக்கு. ஜோதிடரை நேரடியா
> சந்திக்க வேண்டாம், உங்க முழு ஜாதக ரிப்போர்ட் இப்பவே பெறுங்க. ₹199 மட்டும், PDF ஆக
> உடனே கிடைக்கும்.
>
> *(EN gloss: Want to know what's in your jathakam? Debt, money, job, marriage, health —
> the answers are in your birth date. No need to meet an astrologer in person, get your
> full jathakam report right now. Just ₹199, PDF delivered instantly.)*

## 5. Kannada — fourth priority
- **Keywords:** ಜಾತಕ (jataka), ಹಣ (hana/money)
- **Messaging framework:** thinnest competitive field of any language scanned — mostly
  generic "AI astrologer" apps (Lovish, at ₹3 first-chat) and long-running local
  practitioners, no PDF-report competitor found at all. This is the most open lane of
  any language in this research, but also the least validated — nobody's proven the
  flat-fee-PDF model works here specifically.
- **Price:** treat as an experiment, not a rollout — start with a small budget test
  before committing to a full campaign structure.
- **Funnel:** WhatsApp, matching every other regional market.

**Ready-to-run primary text (pair with `E1` or `E2` — treat as a small-budget test,
not a full rollout, per the price note above):**
> ನಿಮ್ಮ ಜಾತಕದಲ್ಲಿ ಏನಿದೆ ಎಂದು ತಿಳಿಯಬೇಕೇ? 🌟 ಹಣ, ಸಾಲ, ಉದ್ಯೋಗ, ಮದುವೆ, ಆರೋಗ್ಯ — ಎಲ್ಲದಕ್ಕೂ
> ಉತ್ತರ ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕದಲ್ಲೇ ಇದೆ. ಜ್ಯೋತಿಷಿಯ ಬಳಿ ಹೋಗುವ ಅಗತ್ಯವಿಲ್ಲ — ಈಗಲೇ ನಿಮ್ಮ ಸಂಪೂರ್ಣ
> ವರದಿ ಪಡೆಯಿರಿ. ಕೇವಲ ₹199, PDF ತಕ್ಷಣ ಸಿಗುತ್ತದೆ.
>
> *(EN gloss: Want to know what's in your jataka? Money, debt, job, marriage, health —
> the answers are in your birth date. No need to visit an astrologer — get your complete
> report right now. Just ₹199, PDF delivered instantly.)*

## 6. Bengali — lowest priority, different market shape
- **Keywords:** কুষ্ঠি (kushthi), জাতক (jatok)
- **Messaging framework:** this market runs on named, credentialed local
  astrologers/priests (40 years experience, physical address, phone number) and daily
  rashifal content marketing, not flat-fee PDF reports. Copying the Hindi/Telugu
  playbook directly is unlikely to work here without more trust-building — consider a
  content-first approach (a few weeks of genuinely useful free daily-rashifal-style
  posts building a page audience) before running a hard-sell PDF offer, rather than
  going straight to paid conversion ads like the other languages.
- **Price/funnel:** no direct pricing signal available — this is the one language where
  we'd be setting a price with no local flat-fee-PDF comparable at all.

## 7. Marathi — needs Ads Manager targeting, not a translated campaign yet
No usable keyword-search signal (see `regional-language-scan.md`). Recommend: once
Telugu/Malayalam prove the translated-copy approach works, run the same Hindi copy
(Marathi speakers largely read Devanagari-script Hindi comfortably) geo-targeted to
Maharashtra with Meta's Marathi language setting, and see if performance differs from
running pure Hindi nationally — don't invest in a full Marathi translation until that
test says it's worth it.

---

## Cross-language pattern (the actual takeaway)
Every market scanned converges on the same three things: **a single named money
question** (not a feature list) as the hook, **a near-zero or flat-fee entry price**, and
**instant/WhatsApp delivery** as a trust signal. The language-specific work is
translation and channel choice (WhatsApp vs. web checkout), not reinventing the
strategy per market. That's good news for how fast this can move once the Hindi sprint
has a winner — it's translate-and-relaunch, not research-from-scratch, for at least
Telugu and Malayalam.
