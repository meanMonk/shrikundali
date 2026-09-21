# Financial Kundali PDF — Quality Review & Task List

**Date:** 2026-09-21
**Inputs reviewed:**
- Competitor (astrovaibhav, ₹49 → upsell ₹129): `~/Desktop/kundali website/sambhai-kundali.pdf` — plain white, no charts, several blank fields, 13 pages
- **Ours** (branded "KundaliAstro", target ₹199 struck from ₹499): `~/Desktop/kundali website/kundali-report-order_TeaMkMFBnr228X.pdf` — dark themed, 12 pages, already includes charts, dignity, numerology, closing page

**Note on the source mix-up:** several sentences in the competitor's PDF ("The panchang (five limbs of time) at your moment of birth sets the subtle tone of your horoscope", "No planets occupy this house, so its results are read chiefly through its sign lord") are **word-for-word identical** to strings in our own `render.ts` (lines 281 and 397). Confirmed by user this PDF is genuinely astrovaibhav's, not a mislabeled dev order — worth keeping an eye on (either a shared template vendor in this niche, or direct copying of our copy), but not an engineering concern.

**Pricing decision (confirmed, unchanged):** flagship stays **₹199, strike-through from ₹499**.

---

## 1. Headline finding: we're already ahead

Once attribution is corrected, the picture flips from "we're behind" to "we're already the more complete product, and the competitor's cheap tier has real gaps we can use as sales copy":

| Section | Competitor (₹49–129) | Ours (₹199) |
|---|---|---|
| Ascendant / Lagna | **Blank** (`—`) | Populated |
| Planetary Positions table | **Empty**, headers only | 9 rows, full data |
| House-by-house analysis | Generic filler repeated 12× ("falls in —, making — the lord") | (verify — see §2) |
| Chart graphics | None | North Indian diamond + South Indian grid + Rashi degree wheel, all three on one page |
| Money/wealth scoring | None | 6-axis "money chakra" donut chart with per-axis driving planets |
| Planetary dignity + retrograde | None | Colour-coded दिग्नीty (नीच/सम/स्वग्रही) + retrograde flags per planet |
| Do/don't guidance per planet | None | Structured cards, weakest-planet callout |
| Numerology | None | Mool/Destiny/Name/Hidden number, each with a money-relevant action box |
| Consolidated warnings page | None | One page, all doshas/yogas with severity tags, before the paywall |
| Closing page | None — PDF just ends | Full blessing/shloka page + disclaimer + astrologer attribution |
| Cover page | Plain title + birth details | Branded, dark, gold accents, "at a glance" strip (lagna/rashi/nakshatra/mool/bhagya) |

**Use this in marketing/landing copy**: "see what a ₹49 report actually contains" is a legitimate, honest comparison angle once you've verified it's reproducible (not a one-off bad sample from them).

- [ ] Grab 1-2 more astrovaibhav sample PDFs (different birth details) before using "their report has blank fields" as a claim anywhere public — confirm it's systemic, not a one-off glitch on their end.

---

## 2. What to verify on our own PDF before calling it done

The sample we have looks strong, but confirm these before shipping at scale:

- [ ] **House-by-house analysis** wasn't fully visible in the pages reviewed — re-check it renders real sign/lord/occupant data (not the same "—" pattern the competitor has), since both PDFs share a lookalike code style in that section and it's the part most likely to break silently if `planets`/houses data is ever incomplete.
- [ ] Confirm the money-axis donut chart's 6 scores and "driving planets" labels are computed from real chart data every time, not partially defaulted when a planet is missing or retrograde-only.
- [ ] Add the smoke test regardless of what's found: generate one report for a fixed birth detail, assert Lagna ≠ `—`, planetary table has 9 rows, all 12 houses have real data, money-axis + numerology + closing sections are present. Cheap insurance against ever shipping a half-empty report like the competitor's.

---

## 3. Polish requests from this conversation: chakra, tables, chart diagrams, Ganesh ji imagery

You asked for: more chakra/tables/"mesh" (chart) diagrams, and Ganesh ji photos to make the PDF feel richer. Mapped against what's already there:

- **Chakra (money chakra donut)** — already present. If you want a *second* chakra visual (e.g. a dasha-timeline wheel or a house-strength radar), that's new work; the money chakra itself doesn't need duplicating.
- **Tables** — already present (birth details, panchang, avakahada chakra, planetary positions, dasha timeline). If you mean *more* tables, the natural next one is a **12-house strength-at-a-glance table** (house | sign | lord | occupants | 1-line verdict) as a single dense reference page — useful because right now house detail is spread across cards/paragraphs with no compact summary a reader can scan in 10 seconds.
- **Chart diagrams ("mesh")** — North Indian diamond, South Indian grid, and Rashi wheel are already on one page. If "mesh" means something more specific (e.g. a Navamsa/D9 chart, which is a standard second chart in full Vedic readings), that's a distinct addition — Navamsa needs no extra ProKerala credits beyond what a detailed chart call already returns, since it's derived from the same planetary degrees.
  - [ ] Confirm with you: is "mesh diagram" = Navamsa (D9) chart, or something else? If Navamsa, add it as a second chart page — it's a legitimate depth signal vs. astrovaibhav (they show none).
- **Ganesh ji imagery** — genuinely missing from both PDFs. Neither has any deity artwork; both use abstract mandala/chakra line-art only. This is a real, cheap addition:
  - [ ] Add a small Ganesh ji illustration (line-art style, matching the existing gold/dark aesthetic — not a photo, a stylized icon) to the cover page and/or the opening blessing page. Keep it tasteful/minimal (a small motif near the "औ​ शुभम" area), not a full-page image — this is a spiritual-trust cue for the target audience, not a decorative filler.
  - [ ] Source or commission a single reusable SVG/vector Ganesh ji motif once — reuse across all report types (Financial, Match, Dosha, etc.) so it becomes a consistent brand mark, not a one-off per report.
  - [ ] Keep any deity imagery respectful/traditional (avoid anything that could read as a cheap stock photo) — this is a place where doing it once, well, and reusing it beats generating per-report.

---

## 4. Priority order

1. Verify house-by-house + money-axis sections are fully populated on our real PDF (§2) — quick check, closes the loop on "are we actually as good as this sample looks."
2. Add the smoke test (§2) — cheap insurance, catches any future regression toward the competitor's blank-field problem.
3. Add Ganesh ji motif to cover/opening page (§3) — one-time asset, reused everywhere.
4. Decide on Navamsa/D9 chart addition (§3) — pending your confirmation of what "mesh diagram" meant.
5. Add 12-house strength-at-a-glance summary table (§3) — nice-to-have density improvement.
6. Optional: gather a couple more astrovaibhav samples to confirm their blank-field problem is systemic before using it in marketing copy (§1).

## Open questions for you
- [ ] Confirm: is "mesh diagram" = Navamsa (D9) chart, or a different chart type you have in mind?
- [ ] Do you want the Ganesh ji motif as a static reusable asset (recommended, near-zero cost) or something generated/varied per report?
