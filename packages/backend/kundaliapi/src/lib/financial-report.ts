import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KundliData } from "./prokerala.js";
import { val, str, calculateMoneyAxisScores } from "./scores.js";

/**
 * Financial ("Janam Kundali" + Dhan) report PDF — 12-page, self-contained HTML.
 * Gated by reportType === "financial_kundali". Text/tables + inline SVG charts.
 * Language: "hi" or "en". Brand: Shri Kundali / shrikundali.in.
 */

export interface FinMeta {
  name?: string;
  gender?: string;
  datetime?: string;
  coordinates?: string;
  place?: string;
  ayanamsa?: number;
  language?: string;
  reportNo?: string;
}

type Lang = "en" | "hi";

/* ── Reference data ─────────────────────────────────────── */

const SIGNS_EN = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const SIGNS_HI = [
  "मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या",
  "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन",
];
const NAKSHATRAS_EN = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];
const NAKSHATRAS_HI = [
  "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य", "आश्लेषा",
  "मघा", "पूर्वा फाल्गुनी", "उत्तरा फाल्गुनी", "हस्त", "चित्रा", "स्वाति", "विशाखा", "अनुराधा", "ज्येष्ठा",
  "मूल", "पूर्वाषाढ़ा", "उत्तराषाढ़ा", "श्रवण", "धनिष्ठा", "शतभिषा",
  "पूर्वा भाद्रपद", "उत्तरा भाद्रपद", "रेवती",
];

const PLANET_HI: Record<string, string> = {
  sun: "सूर्य", moon: "चंद्र", mars: "मंगल", mercury: "बुध", jupiter: "गुरु",
  venus: "शुक्र", saturn: "शनि", rahu: "राहु", ketu: "केतु", ascendant: "लग्न",
};
const PLANET_SHORT: Record<string, string> = {
  sun: "Su", moon: "Mo", mars: "Ma", mercury: "Me", jupiter: "Ju",
  venus: "Ve", saturn: "Sa", rahu: "Ra", ketu: "Ke", ascendant: "La",
};
const PLANET_SHORT_HI: Record<string, string> = {
  sun: "सू", moon: "चं", mars: "मं", mercury: "बु", jupiter: "गु",
  venus: "शु", saturn: "श", rahu: "रा", ketu: "के", ascendant: "ल",
};

const EXALT: Record<string, number> = { sun: 0, moon: 1, mars: 9, mercury: 5, jupiter: 3, venus: 11, saturn: 6 };
const OWN: Record<string, number[]> = {
  sun: [4], moon: [3], mars: [0, 7], mercury: [2, 5],
  jupiter: [8, 11], venus: [1, 6], saturn: [9, 10],
};
// Rahu/Ketu have no classical exaltation/own sign.
const ALWAYS_RETRO = new Set(["rahu", "ketu"]);

const MANTRA_GANESH_SHORT = "ॐ गं गणपतये नमः";
const MANTRA_GANESH = "वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ । निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा ॥";
const MANTRA_CLOSING = "सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः । सर्वे भद्राणि पश्यन्तु मा कश्चिद्दुःखभाग्भवेत् ॥";

/* ── Copy ───────────────────────────────────────────────── */

const COPY = {
  en: {
    brand: "Shri Kundali",
    footer: "shrikundali.in",
    auspicious: "AUSPICIOUS",
    title: "Janam Kundali Report",
    subtitle: "Personalized Financial Kundali Report",
    tagline: "Dhan Yog · EMI Timing · Career Window · 12-month Outlook",
    preparedFor: "Prepared for",
    born: "Born",
    reportNo: "Report No.",
    preparedOn: "Prepared",
    birthDetails: "Janma Vivaran",
    birthDetailsSub: "Birth details & Panchang (at birth time)",
    lagnaChart: "Kundali Chakra",
    lagnaChartSub: "North Indian Rashi chart (D1)",
    planetTable: "Graha Sthiti",
    planetTableSub: "Planetary positions with dignity & retrograde flags",
    navamsa: "Navamsa",
    navamsaSub: "D9 chart — inner strength of planets",
    rashiNakshatra: "Rashi & Nakshatra",
    rashiNakshatraSub: "Traits, traditional associations",
    dosha: "Dosha Check",
    doshaSub: "Mangal, Kaal Sarp, Sade Sati",
    dashaTable: "Dasha Table",
    dashaSub: "Vimshottari periods and dates",
    currentDasha: "Current Dasha & Money Timeline",
    currentDashaSub: "The period you are living through",
    money: "Dhan & Career Insights",
    moneySub: "Six money axes derived from your chart",
    outlook: "12-Month Money Outlook",
    outlookSub: "Decision windows for the year ahead",
    closing: "Closing Blessings",
    closingSub: "Auspicious close & disclaimer",
    planet: "Planet",
    rashi: "Rashi",
    house: "House",
    degree: "Degree",
    nakshatra: "Nakshatra",
    dignity: "Dignity",
    retro: "Retro",
    yes: "Yes",
    mobile: "Moolank",
    destiny: "Bhagyank",
    lagna: "Lagna",
    moonSign: "Chandra Rashi",
    nakshatraShort: "Nakshatra",
    field: "Attribute",
    value: "Value",
    name: "Name",
    gender: "Gender",
    dob: "Date of Birth",
    tob: "Time of Birth",
    place: "Place",
    ayanamsa: "Ayanamsa",
    vaara: "Vaara (Weekday)",
    tithi: "Tithi",
    yoga: "Yoga",
    karana: "Karana",
    sunrise: "Sunrise",
    sunset: "Sunset",
    mahadasha: "Mahadasha",
    antardasha: "Antardasha",
    from: "From",
    to: "To",
    axis: "Axis",
    score: "Score",
    reading: "Why",
    strong: "Strong",
    above: "Above average",
    moderate: "Moderate",
    needsSupport: "Needs support",
    wealth: "Long-term wealth",
    career: "Career growth",
    business: "Business & trade",
    property: "Property & assets",
    investment: "Investment instinct",
    stability: "Financial stability",
    exalted: "Exalted",
    debilitated: "Debilitated",
    own: "Own sign",
    neutral: "Neutral",
    retroNote: "Rahu/Ketu are always retrograde; (R) marks other retrograde planets.",
    doshaActive: "This pattern is active in your chart.",
    doshaAbsent: "This pattern is not indicated in your chart.",
    disclaimerTitle: "Disclaimer",
    guard: "Chart data incomplete",
    genderMale: "Male", genderFemale: "Female", genderOther: "Other",
    ayanamsaRaman: "Raman", ayanamsaLahiri: "Lahiri",
    birthStone: "Birth stone (traditional association)",
    moolankNote: "Moolank = day-number (instinct); Bhagyank = full-date number (destiny).",
    month: "Month",
    guidance: "Guidance",
    wealthHouses: "Planets on the wealth houses (1/2/5/9/10/11)",
  },
  hi: {
    brand: "श्री कुंडली",
    footer: "shrikundali.in",
    auspicious: "शुभम्",
    title: "जन्म कुंडली रिपोर्ट",
    subtitle: "वित्तीय कुंडली — धन, कर्ज़, करियर एवं समय",
    tagline: "धन योग · EMI समय · करियर अवसर · 12-माह दृष्टि",
    preparedFor: "तैयार",
    born: "जन्म",
    reportNo: "रिपोर्ट क्रमांक",
    preparedOn: "तैयार दिनांक",
    birthDetails: "जन्म विवरण",
    birthDetailsSub: "जन्म विवरण एवं पंचांग (जन्म समय पर)",
    lagnaChart: "कुंडली चक्र",
    lagnaChartSub: "उत्तर भारतीय राशि चक्र (D1)",
    planetTable: "ग्रह स्थिति",
    planetTableSub: "नवग्रहों की राशि, अंश, नक्षत्र एवं बलाबल",
    navamsa: "नवमांश",
    navamsaSub: "D9 चक्र — ग्रहों की आंतरिक शक्ति",
    rashiNakshatra: "राशि एवं नक्षत्र",
    rashiNakshatraSub: "स्वभाव एवं परंपरागत संकेत",
    dosha: "दोष जाँच",
    doshaSub: "मंगल, कालसर्प, साढ़े साती",
    dashaTable: "दशा तालिका",
    dashaSub: "विंशोत्तरी महादशा एवं तिथियाँ",
    currentDasha: "वर्तमान दशा एवं धन समय-रेखा",
    currentDashaSub: "जिस अवधि से आप गुज़र रहे हैं",
    money: "धन एवं करियर संकेत",
    moneySub: "आपकी कुंडली से निकले छह धन-आयाम",
    outlook: "12-माह धन दृष्टि",
    outlookSub: "आगे के वर्ष के निर्णय-अवसर",
    closing: "आशीर्वाद एवं समापन",
    closingSub: "मंगल समापन एवं अस्वीकरण",
    planet: "ग्रह",
    rashi: "राशि",
    house: "भाव",
    degree: "अंश",
    nakshatra: "नक्षत्र",
    dignity: "स्थिति",
    retro: "वक्री",
    yes: "हाँ",
    mobile: "मूलांक",
    destiny: "भाग्यांक",
    lagna: "लग्न",
    moonSign: "चंद्र राशि",
    nakshatraShort: "नक्षत्र",
    field: "विवरण",
    value: "मान",
    name: "नाम",
    gender: "लिंग",
    dob: "जन्म तिथि",
    tob: "जन्म समय",
    place: "जन्म स्थान",
    ayanamsa: "अयनांश",
    vaara: "वार",
    tithi: "तिथि",
    yoga: "योग",
    karana: "करण",
    sunrise: "सूर्योदय",
    sunset: "सूर्यास्त",
    mahadasha: "महादशा",
    antardasha: "अंतर्दशा",
    from: "से",
    to: "तक",
    axis: "आयाम",
    score: "स्कोर",
    reading: "कारण",
    strong: "मज़बूत",
    above: "औसत से ऊपर",
    moderate: "मध्यम",
    needsSupport: "सहयोग चाहिए",
    wealth: "दीर्घकालिक धन",
    career: "करियर वृद्धि",
    business: "व्यापार",
    property: "संपत्ति",
    investment: "निवेश बुद्धि",
    stability: "आर्थिक स्थिरता",
    exalted: "उच्च",
    debilitated: "नीच",
    own: "स्वग्रही",
    neutral: "सम",
    retroNote: "राहु/केतु सदा वक्री होते हैं; (R) अन्य वक्री ग्रहों का संकेत है।",
    doshaActive: "यह प्रभाव आपकी कुंडली में सक्रिय है।",
    doshaAbsent: "यह प्रभाव आपकी कुंडली में नहीं दिखता।",
    disclaimerTitle: "अस्वीकरण",
    guard: "कुंडली डेटा अपूर्ण",
    genderMale: "पुरुष", genderFemale: "महिला", genderOther: "अन्य",
    ayanamsaRaman: "रामन", ayanamsaLahiri: "लाहिड़ी",
    birthStone: "जन्म रत्न (परंपरागत संबंध)",
    moolankNote: "मूलांक = जन्म तिथि का अंक (सहज प्रवृत्ति); भाग्यांक = पूर्ण तिथि का अंक (भाग्य)।",
    month: "माह",
    guidance: "मार्गदर्शन",
    wealthHouses: "धन-भावों में सक्रिय ग्रह (1/2/5/9/10/11)",
  },
} as const;

/* ── Helpers ────────────────────────────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function listOf(obj: unknown, key: string): Record<string, unknown>[] {
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}
function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmtBirthDate(datetime: string | undefined, lang: Lang): string {
  if (!datetime) return "—";
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtBirthTime(datetime: string | undefined): string {
  if (!datetime) return "—";
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function fmtDate(v: unknown, lang: Lang): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtClock(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
/** Pick the panchang entry whose window contains the birth moment. */
function panchangAt(v: unknown, birthIso?: string): string {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    const t = birthIso ? new Date(birthIso).getTime() : NaN;
    let chosen: unknown = v[0];
    if (!isNaN(t)) {
      const hit = (v as unknown[]).find((e) => {
        const s = new Date(String(val(e, "start"))).getTime();
        const en = new Date(String(val(e, "end"))).getTime();
        return s <= t && t <= en;
      });
      if (hit) chosen = hit;
    }
    const name = str(val(chosen, "name"), "—");
    const paksha = val(chosen, "paksha");
    return paksha ? `${name} (${str(paksha)})` : name;
  }
  if (typeof v === "object") return str(val(v, "name") ?? val(v, "vedic_name") ?? val(v, "value"), "—");
  return String(v);
}

// ProKerala returns panchang labels in English even with la=hi; transliterate.
const PANCHANG_HI: Record<string, string> = {
  Sunday: "रविवार", Monday: "सोमवार", Tuesday: "मंगलवार", Wednesday: "बुधवार",
  Thursday: "गुरुवार", Friday: "शुक्रवार", Saturday: "शनिवार",
  Pratipada: "प्रतिपदा", Dwitiya: "द्वितीया", Tritiya: "तृतीया", Chaturthi: "चतुर्थी",
  Panchami: "पंचमी", Shashthi: "षष्ठी", Saptami: "सप्तमी", Ashtami: "अष्टमी",
  Navami: "नवमी", Dashami: "दशमी", Ekadashi: "एकादशी", Dwadashi: "द्वादशी",
  Trayodashi: "त्रयोदशी", Chaturdashi: "चतुर्दशी", Purnima: "पूर्णिमा", Amavasya: "अमावस्या",
  Shukla: "शुक्ल", Krishna: "कृष्ण", Paksha: "पक्ष",
};
function localizePanchang(s: string, lang: Lang): string {
  if (lang !== "hi") return s;
  let out = s;
  for (const [en, hi] of Object.entries(PANCHANG_HI)) out = out.replace(new RegExp(en, "gi"), hi);
  return out;
}
function richText(v: unknown, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => richText(x, "")).filter(Boolean).join(" ") || fallback;
  if (typeof v === "object") {
    const s = val(v, "description") ?? val(v, "text") ?? val(v, "name") ?? val(v, "value");
    if (typeof s === "string") return s;
    if (s && typeof s === "object") return richText(s, fallback);
  }
  return fallback;
}
function digitsToSingle(n: number): number {
  let x = Math.abs(n);
  while (x > 9) x = String(x).split("").reduce((a, c) => a + Number(c), 0);
  return x;
}
function numerology(datetime?: string): { mool: number; bhagya: number } {
  const d = datetime ? new Date(datetime) : new Date(NaN);
  if (isNaN(d.getTime())) return { mool: 0, bhagya: 0 };
  return {
    mool: digitsToSingle(d.getDate()),
    bhagya: digitsToSingle(d.getDate() + (d.getMonth() + 1) + d.getFullYear()),
  };
}

/* ── Planets ────────────────────────────────────────────── */

interface PlanetRow {
  name: string;
  rasiId: number;
  rasiIdx: number;
  degree: number;
  house: number;
  retro: boolean;
  nakshatra: string;
  nakIdx: number;
  pada: number;
}

function mapPlanet(p: Record<string, unknown>, forcedName?: string): PlanetRow {
  const rasi = val(p, "rasi") as Record<string, unknown> | undefined;
  const rasiId = Number(val(rasi, "id")) || 0;
  const rasiName = str(val(rasi, "name"), "");
  const rawLon = val(p, "longitude");
  const longitude = Number(rawLon);
  let rasiIdx: number;
  if (rawLon != null && Number.isFinite(longitude)) {
    rasiIdx = Math.floor((((longitude % 360) + 360) % 360) / 30) % 12;
  } else {
    const byId = rasiId > 0 && rasiId <= 12 ? rasiId - 1 : -1;
    rasiIdx = byId >= 0 ? byId : SIGNS_EN.findIndex((s) => s.toLowerCase() === rasiName.toLowerCase());
    if (rasiIdx < 0) rasiIdx = 0;
  }
  const nak = val(p, "nakshatra") as Record<string, unknown> | undefined;
  const lon = Number.isFinite(longitude) ? longitude : Number(val(p, "degree")) || 0;
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor((((lon % 360) + 360) % 360) / nakSpan) % 27;
  const derivedPada = Math.floor((((lon % nakSpan) + nakSpan) % nakSpan) / (nakSpan / 4)) + 1;
  return {
    name: (forcedName ?? str(val(p, "name") ?? val(p, "planet_name"))).toLowerCase(),
    rasiId,
    rasiIdx,
    degree: Number(val(p, "degree")) || 0,
    house: Number(val(p, "position") ?? val(p, "house")) || 0,
    retro: Boolean(val(p, "is_retrograde")),
    nakshatra: str(val(nak, "name"), "—"),
    nakIdx,
    pada: Number(val(nak, "pada")) || derivedPada,
  };
}

function buildPlanets(d: Record<string, unknown>): PlanetRow[] {
  const rows = listOf(d, "planet_positions").map((p) => mapPlanet(p));
  if (!rows.some((r) => r.name === "ascendant")) {
    const ascRaw = val(d, "ascendant");
    if (ascRaw && typeof ascRaw === "object") rows.unshift(mapPlanet(ascRaw as Record<string, unknown>, "ascendant"));
  }
  return rows;
}

function dignity(planet: string, rasiIdx: number): keyof typeof COPY.en {
  if (EXALT[planet] === rasiIdx) return "exalted";
  if (EXALT[planet] != null && (EXALT[planet] + 6) % 12 === rasiIdx) return "debilitated";
  if (OWN[planet]?.includes(rasiIdx)) return "own";
  return "neutral";
}
function navamsaIdx(rasiIdx: number, degree: number): number {
  return Math.floor((rasiIdx * 30 + degree) / (30 / 9)) % 12;
}
function houseFromSign(signIdx: number, lagnaIdx: number): number {
  return ((signIdx - lagnaIdx + 12) % 12) + 1;
}

/* ── SVG widgets ────────────────────────────────────────── */

function mandala(size: number, opacity: number): string {
  const c = 100;
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    return `<line x1="${c}" y1="${c}" x2="${(c + 96 * Math.cos(a)).toFixed(1)}" y2="${(c + 96 * Math.sin(a)).toFixed(1)}"/>`;
  }).join("");
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" fill="none" stroke="#B8860B" stroke-width="0.7" style="opacity:${opacity}">
    <circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="78"/><circle cx="100" cy="100" r="58"/>${rays}
    <circle cx="100" cy="100" r="38"/><circle cx="100" cy="100" r="20"/><circle cx="100" cy="100" r="6" fill="#B8860B" stroke="none"/>
  </svg>`;
}
function lotus(size: number): string {
  return `<svg viewBox="0 0 24 16" width="${size}" height="${(size * 16) / 24}" fill="none" stroke="#E0B85A" stroke-width="1">
    <path d="M12 15C6 15 2 11 2 11c3 0 6 1 8 3 0-4 1-8 2-11 1 3 2 7 2 11 2-2 5-3 8-3 0 0-4 4-10 4z"/>
  </svg>`;
}

const HOUSE_POS: Record<number, [number, number]> = {
  1: [150, 74], 2: [74, 40], 3: [40, 74], 4: [74, 150],
  5: [40, 226], 6: [74, 260], 7: [150, 226], 8: [226, 260],
  9: [260, 226], 10: [226, 150], 11: [260, 74], 12: [226, 40],
};

function northIndianChart(planetsByHouse: Record<number, string[]>): string {
  const C = "#2E3A87";
  let svg = `<svg viewBox="0 0 300 300" width="100%" style="max-width:300px;margin:0 auto;display:block">`;
  svg += `<rect x="2" y="2" width="296" height="296" fill="#FFFFFF" stroke="${C}" stroke-width="1.6"/>`;
  svg += `<path d="M2 2L298 298M298 2L2 298M150 2L298 150L150 298L2 150Z" fill="none" stroke="${C}" stroke-width="1.1"/>`;
  for (let h = 1; h <= 12; h++) {
    const [x, y] = HOUSE_POS[h] ?? [150, 150];
    const labels = planetsByHouse[h] ?? [];
    svg += `<text x="${x}" y="${y - 6}" text-anchor="middle" font-size="9" fill="#7A1F2B" font-family="sans-serif">${h}</text>`;
    labels.slice(0, 3).forEach((p, i) => {
      svg += `<text x="${x}" y="${y + 5 + i * 10}" text-anchor="middle" font-size="9" fill="${C}" font-family="sans-serif">${esc(p)}</text>`;
    });
  }
  svg += `</svg>`;
  return svg;
}

function barsSVG(rows: { label: string; score: number }[]): string {
  const w = 460;
  const rowH = 26;
  const h = rows.length * rowH + 8;
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block">`;
  rows.forEach((r, i) => {
    const y = i * rowH + 4;
    const pct = Math.max(0, Math.min(100, r.score * 10));
    svg += `<text x="0" y="${y + 13}" font-size="11" fill="#333" font-family="sans-serif">${esc(r.label)}</text>`;
    svg += `<rect x="185" y="${y + 2}" width="230" height="13" fill="#eee" stroke="#D9C9A8" rx="3"/>`;
    svg += `<rect x="185" y="${y + 2}" width="${(230 * pct) / 100}" height="13" fill="#E07B00" rx="3"/>`;
    svg += `<text x="${w - 8}" y="${y + 13}" text-anchor="end" font-size="11" fill="#7A1F2B" font-family="sans-serif">${r.score}/10</text>`;
  });
  svg += `</svg>`;
  return svg;
}

/* ── Logo ───────────────────────────────────────────────── */

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string> {
  if (cachedLogo !== null) return cachedLogo;
  let here = "";
  try {
    here = fileURLToPath(new URL(".", import.meta.url));
  } catch {
    here = process.cwd();
  }
  const candidates = [
    process.env.LOGO_PATH,
    join(process.cwd(), "public", "logo.png"),
    join(process.cwd(), "packages", "web", "kundaliweb", "public", "logo.png"),
    join(here, "..", "..", "..", "..", "web", "kundaliweb", "public", "logo.png"),
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    try {
      cachedLogo = `data:image/png;base64,${(await readFile(p)).toString("base64")}`;
      return cachedLogo;
    } catch {
      /* next */
    }
  }
  cachedLogo = "";
  return cachedLogo;
}

/* ── HTML scaffolding ───────────────────────────────────── */

function frame(): string {
  return `<div class="frame"></div><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>`;
}
function page(inner: string, footer: string, wm = false): string {
  return `<section class="page">${frame()}${wm ? `<div class="wm">${mandala(430, 0.055)}</div>` : ""}<div class="content">${inner}</div><div class="footer">${esc(footer)}</div></section>`;
}
function heading(title: string, sub: string): string {
  return `<div class="head"><div class="head-title">${esc(title)}</div><div class="head-line"><span class="rule"></span>${lotus(18)}<span class="rule"></span></div><div class="head-sub">${esc(sub)}</div></div>`;
}
function table(headers: string[], rows: (string | number)[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(String(h))}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}
function badge(active: boolean, activeText: string, okText: string): string {
  const cls = active ? "badge warn" : "badge ok";
  return `<span class="${cls}">${esc(active ? activeText : okText)}</span>`;
}

/* ── Build ──────────────────────────────────────────────── */

export async function buildFinancialReportHTML(data: KundliData, label: string, meta: FinMeta): Promise<string> {
  const lang: Lang = (meta.language ?? "en").toLowerCase().startsWith("hi") ? "hi" : "en";
  const C = COPY[lang];
  const d = data.data ?? {};
  const brand = C.brand;
  const title = lang === "hi" ? C.title : (label || C.title);

  const planets = buildPlanets(d);
  const asc = planets.find((p) => p.name === "ascendant");
  const grahas = planets.filter((p) => p.name !== "ascendant");
  if (!asc || grahas.length < 7) {
    throw new Error(`${C.guard}: expected ascendant + planets, got ${grahas.length} planets`);
  }

  const nd = val(d, "nakshatra_details") as Record<string, unknown> | undefined;
  const nakshatra = val(nd, "nakshatra") as Record<string, unknown> | undefined;
  const chandraRasi = val(nd, "chandra_rasi") as Record<string, unknown> | undefined;
  const info = val(nd, "additional_info") as Record<string, unknown> | undefined;
  const panchang = val(d, "panchang") as Record<string, unknown> | undefined;
  const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
  const kaalSarp = val(d, "kaal_sarp_dosha") as Record<string, unknown> | undefined;
  const sadeSati = val(d, "sade_sati") as Record<string, unknown> | undefined;
  const scores = calculateMoneyAxisScores(d);
  const { mool, bhagya } = numerology(meta.datetime);
  const logo = await loadLogo();

  const signName = (idx: number) => (lang === "hi" ? SIGNS_HI[idx] : SIGNS_EN[idx]) ?? "—";
  const planetName = (key: string) => (lang === "hi" ? (PLANET_HI[key] ?? key) : key.charAt(0).toUpperCase() + key.slice(1));
  const shortName = (key: string) => (lang === "hi" ? (PLANET_SHORT_HI[key] ?? key) : (PLANET_SHORT[key] ?? key));
  const placeLabel = meta.place || meta.coordinates || "—";
  const genderLabel = meta.gender
    ? ({ male: C.genderMale, female: C.genderFemale, other: C.genderOther } as Record<string, string>)[meta.gender.toLowerCase()] ?? meta.gender
    : "—";
  const ayanamsaLabel = meta.ayanamsa === 3 ? C.ayanamsaRaman : C.ayanamsaLahiri;
  const mark = (p: PlanetRow) => (ALWAYS_RETRO.has(p.name) ? "" : p.retro ? "(R)" : "");

  const ascIdx = asc.rasiIdx;
  const planetsByHouse: Record<number, string[]> = {};
  for (const p of grahas) {
    const h = p.house || houseFromSign(p.rasiIdx, ascIdx);
    (planetsByHouse[h] ??= []).push(`${shortName(p.name)}${mark(p)}`);
  }
  (planetsByHouse[1] ??= []).unshift(shortName("ascendant"));

  const d9Lagna = navamsaIdx(ascIdx, asc.degree);
  const d9ByHouse: Record<number, string[]> = {};
  for (const p of grahas) {
    const h = houseFromSign(navamsaIdx(p.rasiIdx, p.degree), d9Lagna);
    (d9ByHouse[h] ??= []).push(shortName(p.name));
  }
  (d9ByHouse[1] ??= []).unshift(shortName("ascendant"));

  /* ── Page 1: Cover ── */
  const logoHtml = logo
    ? `<img src="${logo}" alt="${esc(brand)}" style="height:70px;margin:0 auto 6px;display:block"/>`
    : `<div style="font-size:22px;font-weight:700;color:#7A1F2B;letter-spacing:2px;text-align:center">${esc(brand)}</div>`;
  const cover = `
    <div class="cover">
      ${logoHtml}
      <div style="font-size:10px;letter-spacing:5px;color:#B8860B;margin-top:8px">${esc(C.auspicious)}</div>
      <div class="mantra" style="margin-top:14px;font-size:13px">${MANTRA_GANESH_SHORT}</div>
      <h1 class="cover-title">${esc(title)}</h1>
      <div class="cover-sub">${esc(C.subtitle)}</div>
      <div class="cover-tag">${esc(C.tagline)}</div>
      <div class="cover-divider"></div>
      <div style="font-size:11px;color:#999;letter-spacing:2px">${esc(C.preparedFor)}</div>
      <div style="font-size:24px;color:#7A1F2B;font-weight:700;margin-top:2px">${esc(meta.name || "—")}</div>
      <div style="font-size:13px;color:#333;margin-top:10px">${esc(fmtBirthDate(meta.datetime, lang))} · ${esc(fmtBirthTime(meta.datetime))}</div>
      <div style="font-size:12px;color:#666">${esc(placeLabel)}</div>
      <div class="glance">
        <div><span>${esc(C.lagna)}</span><b>${esc(signName(ascIdx))}</b></div>
        <div><span>${esc(C.moonSign)}</span><b>${esc(str(val(chandraRasi, "name"), "—"))}</b></div>
        <div><span>${esc(C.nakshatraShort)}</span><b>${esc(str(val(nakshatra, "name"), "—"))}</b></div>
      </div>
      <div class="small-note">${esc(C.moolankNote)} · ${esc(C.mobile)} ${mool}, ${esc(C.destiny)} ${bhagya}</div>
      <div class="small-note">${esc(C.reportNo)} ${esc(meta.reportNo || "—")} · ${esc(C.preparedOn)} ${esc(fmtDate(new Date().toISOString(), lang))}</div>
      <div class="cover-foot">
        <div class="mantra">${MANTRA_GANESH}</div>
        <div style="color:#aaa;font-size:9px;margin-top:4px">— ${esc(lang === "hi" ? "विघ्नहर्ता इस पठन को शुभ करें।" : "May the remover of obstacles bless this reading.")}</div>
      </div>
    </div>`;

  /* ── Page 2: Birth details + Panchang ── */
  const birthRows: (string | number)[][] = [
    [C.name, meta.name || "—"],
    [C.gender, genderLabel],
    [C.dob, fmtBirthDate(meta.datetime, lang)],
    [C.tob, fmtBirthTime(meta.datetime)],
    [C.place, placeLabel],
    [C.ayanamsa, ayanamsaLabel],
  ];
  const panchangRows: (string | number)[][] = panchang ? [
    [C.vaara, localizePanchang(panchangAt(val(panchang, "vaara"), meta.datetime), lang)],
    [C.tithi, localizePanchang(panchangAt(val(panchang, "tithi"), meta.datetime), lang)],
    [C.nakshatraShort, localizePanchang(panchangAt(val(panchang, "nakshatra"), meta.datetime), lang)],
    [C.yoga, localizePanchang(panchangAt(val(panchang, "yoga"), meta.datetime), lang)],
    [C.karana, localizePanchang(panchangAt(val(panchang, "karana"), meta.datetime), lang)],
    [C.sunrise, fmtClock(val(panchang, "sunrise"))],
    [C.sunset, fmtClock(val(panchang, "sunset"))],
  ] : [];
  const page2 = page(
    heading(C.birthDetails, C.birthDetailsSub) +
    `<div class="two-col"><div>${table([C.field, C.value], birthRows)}</div><div>${panchangRows.length ? table([C.field, C.value], panchangRows) : ""}</div></div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 3: Lagna chart ── */
  const page3 = page(
    heading(C.lagnaChart, C.lagnaChartSub) +
    `<div class="chart-wrap"><div class="wm wm-chart">${mandala(300, 0.06)}</div>${northIndianChart(planetsByHouse)}</div>` +
    `<div class="note"><b>${esc(C.lagna)}: ${esc(signName(ascIdx))}</b> — ${esc(lang === "hi"
      ? "लग्न व्यक्तित्व, शरीर और जीवन-दिशा का बिंदु है। भाव स्थिर रहते हैं, राशियाँ लग्न से घूमती हैं।"
      : "The Lagna anchors the chart: houses are fixed, rashis rotate from it, and each planet colours its house.")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 4: Planet table ── */
  const planetRows = grahas.map((p) => {
    const nakName = p.nakshatra !== "—" ? p.nakshatra : (lang === "hi" ? NAKSHATRAS_HI[p.nakIdx] : NAKSHATRAS_EN[p.nakIdx]) ?? "—";
    const retro = ALWAYS_RETRO.has(p.name) ? "—" : p.retro ? `(${C.retro})` : "—";
    return [
      planetName(p.name),
      signName(p.rasiIdx),
      p.house || "—",
      `${p.degree.toFixed(1)}°`,
      p.pada ? `${nakName} (${p.pada})` : nakName,
      C[dignity(p.name, p.rasiIdx)],
      retro,
    ];
  });
  const page4 = page(
    heading(C.planetTable, C.planetTableSub) +
    table([C.planet, C.rashi, C.house, C.degree, C.nakshatra, C.dignity, C.retro], planetRows) +
    `<div class="note">${esc(lang === "hi"
      ? "अंश और नक्षत्र मिलकर ग्रह की वास्तविक शक्ति बताते हैं; भाव वह जीवन-क्षेत्र है जहाँ ग्रह सक्रिय है।"
      : "Degree and nakshatra together reveal a planet's real strength; the house is the life-area where it acts.")} ${esc(C.retroNote)}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 5: Navamsa ── */
  const page5 = page(
    heading(C.navamsa, C.navamsaSub) +
    `<div class="chart-wrap"><div class="wm wm-chart">${mandala(300, 0.06)}</div>${northIndianChart(d9ByHouse)}</div>` +
    `<div class="note">${esc(lang === "hi"
      ? "नवमांश (D9) विवाह, भाग्य और ग्रहों की आंतरिक शक्ति दिखाता है; यह D1 की पुष्टि करता है।"
      : "The Navamsa (D9) shows the inner strength of planets and themes of marriage and fortune, confirming the D1 chart.")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 6: Rashi & Nakshatra ── */
  const infoRows: (string | number)[][] = [];
  if (info) {
    const hiMap: Record<string, string> = {
      deity: "देवता", ganam: "गण", symbol: "प्रतीक", nadi: "नाड़ी", color: "रंग",
      best_direction: "शुभ दिशा", birth_stone: "जन्म रत्न", planet: "ग्रह",
    };
    for (const k of ["deity", "ganam", "symbol", "nadi", "color", "best_direction", "birth_stone", "planet"]) {
      const v = val(info, k);
      if (!v) continue;
      const label = k === "birth_stone" ? C.birthStone : lang === "hi" ? (hiMap[k] ?? k) : cap(k.replace(/_/g, " "));
      infoRows.push([label, str(v)]);
    }
  }
  const page6 = page(
    heading(C.rashiNakshatra, C.rashiNakshatraSub) +
    `<div class="bigline"><b>${esc(C.moonSign)}:</b> ${esc(str(val(chandraRasi, "name"), "—"))}</div>` +
    `<div class="bigline"><b>${esc(C.nakshatraShort)}:</b> ${esc(str(val(nakshatra, "name"), "—"))} · ${esc(str(val(val(nakshatra, "lord"), "name"), "—"))}</div>` +
    (infoRows.length ? table([C.field, C.value], infoRows) : "") +
    `<div class="note">${esc(lang === "hi"
      ? "चंद्र राशि मन और भावनाओं को, तथा नक्षत्र सहज स्वभाव और जीवन-पाठ को दर्शाता है।"
      : "The Moon sign governs the mind and emotions, while the birth nakshatra shapes instinct and life lessons.")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 7: Dosha (conditional copy, no contradiction) ── */
  const hasMangal = Boolean(val(md, "has_dosha"));
  const hasKaal = Boolean(val(kaalSarp, "has_dosha"));
  const hasSade = Boolean(val(sadeSati, "is_in_sade_sati"));
  const doshaRow = (label: string, active: boolean, desc: unknown) => {
    const text = richText(desc, active ? C.doshaActive : C.doshaAbsent);
    return `<div class="dosha"><div class="dosha-head"><b>${esc(label)}</b>${badge(active, lang === "hi" ? "सक्रिय" : "Present", lang === "hi" ? "नहीं" : "Not indicated")}</div>` +
      `<div class="dosha-desc">${esc(text)}</div></div>`;
  };
  const page7 = page(
    heading(C.dosha, C.doshaSub) +
    doshaRow(lang === "hi" ? "मंगल दोष" : "Mangal Dosha", hasMangal, val(md, "description")) +
    doshaRow(lang === "hi" ? "कालसर्प दोष" : "Kaal Sarp Dosha", hasKaal, val(kaalSarp, "description")) +
    doshaRow(lang === "hi" ? "साढ़े साती" : "Sade Sati", hasSade, val(sadeSati, "description")),
    `${brand} · ${C.footer}`,
  );

  /* ── Dasha data ── */
  const dashas = listOf(d, "dasha_periods");
  const now = Date.now();
  const inRange = (s: unknown, e: unknown) => new Date(String(s)).getTime() <= now && now <= new Date(String(e)).getTime();
  const currentM = dashas.find((m) => inRange(val(m, "start"), val(m, "end")));
  const currentA = currentM ? listOf(currentM, "antardasha").find((a) => inRange(val(a, "start"), val(a, "end"))) : undefined;

  /* ── Page 8: Dasha table ── */
  const dashaRows = dashas.map((m) => [
    planetName(str(val(m, "name")).toLowerCase()),
    fmtDate(val(m, "start"), lang),
    fmtDate(val(m, "end"), lang),
    inRange(val(m, "start"), val(m, "end")) ? (lang === "hi" ? "वर्तमान" : "Current") : "",
  ]);
  const page8 = page(
    heading(C.dashaTable, C.dashaSub) +
    (dashaRows.length ? table([C.mahadasha, C.from, C.to, ""], dashaRows)
      : `<div class="note">${esc(lang === "hi" ? "दशा डेटा उपलब्ध नहीं।" : "Dasha data not available.")}</div>`),
    `${brand} · ${C.footer}`,
  );

  /* ── Page 9: Current dasha + money timeline ── */
  const nextAs = currentM ? listOf(currentM, "antardasha") : [];
  const adRows = nextAs.slice(0, 6).map((a) => [
    planetName(str(val(a, "name")).toLowerCase()),
    fmtDate(val(a, "start"), lang),
    fmtDate(val(a, "end"), lang),
    inRange(val(a, "start"), val(a, "end")) ? (lang === "hi" ? "वर्तमान" : "Current") : "",
  ]);
  const page9 = page(
    heading(C.currentDasha, C.currentDashaSub) +
    `<div class="bigline"><b>${esc(C.mahadasha)}:</b> ${currentM ? `${esc(planetName(str(val(currentM, "name")).toLowerCase()))} (${esc(fmtDate(val(currentM, "start"), lang))} – ${esc(fmtDate(val(currentM, "end"), lang))})` : "—"}</div>` +
    `<div class="bigline"><b>${esc(C.antardasha)}:</b> ${currentA ? `${esc(planetName(str(val(currentA, "name")).toLowerCase()))} (${esc(fmtDate(val(currentA, "start"), lang))} – ${esc(fmtDate(val(currentA, "end"), lang))})` : "—"}</div>` +
    (adRows.length ? table([C.antardasha, C.from, C.to, ""], adRows) : "") +
    `<div class="note">${esc(lang === "hi"
      ? "इस अवधि में निर्णय, निवेश और कर्ज़ को लेकर सजग रहें — समय आपके करियर और धन-प्रवाह को दिशा देता है।"
      : "This window colours your career and cash-flow. Be deliberate with decisions, investments and debt.")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 10: Dhan & Career Insights (merged) ── */
  const axisLabel: Record<string, string> = {
    wealthPotential: C.wealth, careerGrowth: C.career, businessLuck: C.business,
    propertyAssets: C.property, investmentSense: C.investment, financialStability: C.stability,
  };
  const axisKeys = Object.keys(scores) as (keyof typeof scores)[];
  const base: Record<string, string[]> = {
    wealthPotential: ["jupiter", "venus", "moon"], careerGrowth: ["saturn", "sun", "mars"],
    businessLuck: ["mercury", "jupiter", "moon"], propertyAssets: ["venus", "mars", "moon"],
    investmentSense: ["mercury", "saturn"], financialStability: ["jupiter", "saturn", "moon"],
  };
  const reasonFor = (k: string) =>
    (base[k] ?? [])
      .map((n) => grahas.find((g) => g.name === n))
      .filter((g): g is PlanetRow => Boolean(g))
      .slice(0, 2)
      .map((g) => `${planetName(g.name)} · ${signName(g.rasiIdx)} H${g.house || "—"}`)
      .join(", ") || "—";
  const barRows = axisKeys.map((k) => ({ label: axisLabel[k] ?? k, score: scores[k] }));
  const moneyRows = axisKeys.map((k) => [axisLabel[k] ?? k, `${scores[k]}/10`, reasonFor(k)]);
  const moneyHouses = grahas.filter((p) => [1, 2, 5, 9, 10, 11].includes(p.house));
  const page10 = page(
    heading(C.money, C.moneySub) +
    `<div class="chart-wrap">${barsSVG(barRows)}</div>` +
    table([C.axis, C.score, C.reading], moneyRows) +
    `<div class="note"><b>${esc(C.wealthHouses)}:</b> ${esc(moneyHouses.map((p) => `${planetName(p.name)} (${signName(p.rasiIdx)} H${p.house})`).join(" · ") || "—")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 11: 12-month money outlook ── */
  const guidance = (planet: string): string => {
    const benefic = ["jupiter", "venus", "mercury", "moon"];
    const cautious = ["saturn", "rahu", "ketu"];
    const action = ["sun", "mars"];
    if (benefic.includes(planet)) return lang === "hi" ? "निर्णय, बचत और निवेश के लिए अनुकूल।" : "Favourable for decisions, savings and investments.";
    if (cautious.includes(planet)) return lang === "hi" ? "अनुशासन रखें; नया कर्ज़ या सट्टा टालें।" : "Stay disciplined; avoid new debt or speculation.";
    if (action.includes(planet)) return lang === "hi" ? "पहल और कार्य के लिए अच्छा; जल्दबाज़ी न करें।" : "Good for initiative and action; avoid haste.";
    return lang === "hi" ? "स्थिर रहें, बजट की समीक्षा करें।" : "Stay steady; review your budget.";
  };
  const outlookRows: (string | number)[][] = [];
  const adList = currentM ? listOf(currentM, "antardasha") : [];
  const start = new Date();
  start.setDate(1);
  for (let i = 0; i < 12; i++) {
    const mStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const mid = new Date(mStart.getFullYear(), mStart.getMonth(), 15).getTime();
    const ad = adList.find((a) => new Date(String(val(a, "start"))).getTime() <= mid && mid <= new Date(String(val(a, "end"))).getTime());
    const adName = ad ? planetName(str(val(ad, "name")).toLowerCase()) : "—";
    const label = mStart.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "short", year: "numeric" });
    outlookRows.push([label, adName, ad ? guidance(String(val(ad, "name")).toLowerCase()) : (lang === "hi" ? "दशा डेटा पर उपलब्ध" : "Available with dasha data")]);
  }
  const page11 = page(
    heading(C.outlook, C.outlookSub) +
    table([C.month, C.antardasha, C.guidance], outlookRows) +
    `<div class="note">${esc(lang === "hi"
      ? "यह दृष्टि वर्तमान महादशा की अंतर्दशाओं पर आधारित है — बड़े निर्णय अनुकूल अंतर्दशा में लें।"
      : "This outlook follows the antardashas of your current mahadasha — time major decisions with a favourable sub-period.")}</div>`,
    `${brand} · ${C.footer}`,
  );

  /* ── Page 12: Closing + disclaimer ── */
  const disclaimer = lang === "hi"
    ? "यह रिपोर्ट आपके दिए गए जन्म विवरण पर आधारित है। सटीकता जन्म समय एवं स्थान पर निर्भर करती है। ज्योतिष मार्गदर्शन एवं आत्म-चिंतन हेतु है; यह परिणामों की गारंटी नहीं देता और किसी भी पेशेवर चिकित्सकीय, कानूनी या वित्तीय सलाह का विकल्प नहीं है। महत्वपूर्ण निर्णय योग्य विशेषज्ञों के साथ लें।"
    : "This report is based on the birth details you provided. Accuracy depends on your birth time and place being correct. Astrology is offered as guidance and for personal reflection. It does not guarantee outcomes and is not a substitute for professional medical, legal, or financial advice. Please make important life decisions with qualified professionals.";
  const page12 = page(
    heading(C.closing, C.closingSub) +
    `<div class="mantra" style="text-align:center">${MANTRA_CLOSING}</div>` +
    `<div style="text-align:center;color:#aaa;font-size:10px;margin:8px 0 18px">— ${esc(lang === "hi" ? "सभी सुखी हों, सभी निरोग हों।" : "May all be happy. May all be free from illness.")}</div>` +
    `<div class="disclaimer"><b>${esc(C.disclaimerTitle)}</b><br>${esc(disclaimer)}</div>` +
    `<div class="mantra" style="text-align:center;margin-top:20px">${MANTRA_GANESH_SHORT}</div>` +
    `<div style="text-align:center;font-size:11px;color:#7A1F2B;margin-top:6px">${esc(brand)} · ${esc(C.footer)}</div>`,
    `${brand} · ${C.footer}`,
    true,
  );

  const css = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; color:#2a2a2a; background:#fff;
      font-family:'Noto Sans Devanagari','Noto Serif Devanagari',Georgia,'Times New Roman',serif; }
    .page { width:210mm; min-height:297mm; padding:16mm 15mm 13mm; page-break-after:always; position:relative; overflow:hidden; }
    .page:last-child { page-break-after:auto; }
    .frame { position:absolute; inset:7mm; border:3px double #E0B85A; pointer-events:none; }
    .corner { position:absolute; width:9px; height:9px; background:#E0B85A; }
    .corner.tl { top:6mm; left:6mm; } .corner.tr { top:6mm; right:6mm; }
    .corner.bl { bottom:6mm; left:6mm; } .corner.br { bottom:6mm; right:6mm; }
    .content { position:relative; z-index:1; }
    .wm { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:0; }
    .wm-chart { position:absolute; inset:0; }
    h1 { font-family:'Noto Serif Devanagari',Georgia,serif; }
    .head { border-bottom:2px solid #E07B00; padding-bottom:6px; margin-bottom:12px; }
    .head-title { font-size:17px; font-weight:700; color:#7A1F2B; }
    .head-line { display:flex; align-items:center; gap:6px; margin:3px 0; }
    .head-line .rule { flex:0 0 34px; height:1px; background:#E0B85A; }
    .head-sub { font-size:10.5px; color:#888; }
    table { width:100%; border-collapse:collapse; margin:10px 0 14px; font-size:10.5px; }
    th,td { border:1px solid #D9C9A8; padding:5px 7px; text-align:left; vertical-align:top; }
    th { background:#FBF6EC; color:#7A1F2B; font-weight:700; }
    tr:nth-child(even) td { background:#FDFAF3; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .cover { height:calc(297mm - 29mm); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
    .cover-title { font-size:27px; color:#7A1F2B; margin:16px 0 4px; }
    .cover-sub { font-size:15px; color:#2E3A87; font-weight:600; }
    .cover-tag { font-size:11px; color:#8a6d3b; margin-top:6px; }
    .cover-divider { width:62%; height:2px; background:#E07B00; margin:18px 0; }
    .glance { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 14px; margin-top:18px; width:82%; }
    .glance span { display:block; color:#999; font-size:9px; text-transform:uppercase; letter-spacing:1px; }
    .glance b { color:#7A1F2B; font-size:13px; }
    .small-note { font-size:9.5px; color:#aaa; margin-top:10px; }
    .cover-foot { margin-top:22px; max-width:150mm; }
    .mantra { color:#7A1F2B; font-size:12px; line-height:1.75; font-family:'Noto Serif Devanagari',serif; }
    .note { background:#FBF6EC; border-left:3px solid #E07B00; padding:8px 10px; font-size:10.5px; margin:10px 0; line-height:1.6; }
    .bigline { font-size:12px; margin:7px 0; color:#333; }
    .bigline b { color:#7A1F2B; }
    .chart-wrap { position:relative; padding:6px 0 2px; }
    .dosha { border:1px solid #D9C9A8; border-radius:6px; padding:9px 11px; margin:10px 0; }
    .dosha-head { display:flex; justify-content:space-between; align-items:center; color:#7A1F2B; font-size:12px; }
    .dosha-desc { font-size:10.5px; color:#555; margin-top:5px; line-height:1.55; }
    .badge { font-size:9px; padding:2px 8px; border-radius:10px; font-weight:700; }
    .badge.ok { background:#e7f6ec; color:#1a7f37; }
    .badge.warn { background:#fff3d6; color:#a86a00; }
    .disclaimer { border:1px solid #D9C9A8; background:#FAFAF7; padding:12px 14px; font-size:10px; color:#555; line-height:1.65; border-radius:6px; }
    .footer { position:absolute; bottom:8mm; left:0; right:0; text-align:center; font-size:8.5px; color:#b9933f; letter-spacing:1px; }
  `;

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style></head><body>
    ${page(cover, `${brand} · ${C.footer}`, true)}
    ${page2}
    ${page3}
    ${page4}
    ${page5}
    ${page6}
    ${page7}
    ${page8}
    ${page9}
    ${page10}
    ${page11}
    ${page12}
  </body></html>`;
}
