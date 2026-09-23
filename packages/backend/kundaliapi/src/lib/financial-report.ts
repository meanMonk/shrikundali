import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KundliData } from "./prokerala.js";
import { val, str, calculateMoneyAxisScores, flattenYogas, type FlatYoga } from "./scores.js";
import { PLANET_META, HOUSE_META, SIGN_LORDS, signElement, axisInterpretation } from "./render.js";

/**
 * Financial ("Janam Kundali" + Dhan) report PDF — 12-page, self-contained HTML.
 * Gated by reportType === "financial_kundali". Text/tables + inline SVG charts.
 * Brand logo + page watermark: assets/shree_logo.png. Language: "hi" or "en".
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
const ALWAYS_RETRO = new Set(["rahu", "ketu"]);

const MANTRA_GANESH_SHORT = "ॐ गं गणपतये नमः";
const MANTRA_GANESH = "वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ । निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा ॥";
const MANTRA_CLOSING = "सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः । सर्वे भद्राणि पश्यन्तु मा कश्चिद्दुःखभाग्भवेत् ॥";

const TOTAL_PAGES = 12;

/* ── Copy ───────────────────────────────────────────────── */

const COPY = {
  en: {
    brand: "Rashi Kundali",
    footer: "rashikundali.com",
    auspicious: "AUSPICIOUS",
    title: "Janam Kundali Report",
    subtitle: "Personalized Financial Kundali Report",
    tagline: "Dhan Yog · EMI Timing · Career Window · 12-month Outlook",
    preparedFor: "Prepared for",
    reportNo: "Report No.",
    preparedOn: "Generated",
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
    page: "Page",
  },
  hi: {
    brand: "राशि कुंडली",
    footer: "rashikundali.com",
    auspicious: "शुभम्",
    title: "जन्म कुंडली रिपोर्ट",
    subtitle: "वित्तीय कुंडली — धन, कर्ज़, करियर एवं समय",
    tagline: "धन योग · EMI समय · करियर अवसर · 12-माह दृष्टि",
    preparedFor: "तैयार",
    reportNo: "रिपोर्ट क्रमांक",
    preparedOn: "निर्मित",
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
    page: "पृष्ठ",
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
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
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

function lotus(size: number): string {
  return `<svg viewBox="0 0 24 16" width="${size}" height="${(size * 16) / 24}" fill="none" stroke="#C9A227" stroke-width="1">
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
    svg += `<text x="0" y="${y + 13}" font-size="11" fill="#222" font-family="sans-serif">${esc(r.label)}</text>`;
    svg += `<rect x="185" y="${y + 2}" width="230" height="13" fill="#EEEEEE" stroke="#C9A227" rx="3"/>`;
    svg += `<rect x="185" y="${y + 2}" width="${(230 * pct) / 100}" height="13" fill="#C9760B" rx="3"/>`;
    svg += `<text x="${w - 8}" y="${y + 13}" text-anchor="end" font-size="11" fill="#7A1F2B" font-family="sans-serif">${r.score}/10</text>`;
  });
  svg += `</svg>`;
  return svg;
}

/* ── Logo / watermark ───────────────────────────────────── */

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
    join(process.cwd(), "assets", "shree_logo.png"),
    join(process.cwd(), "..", "..", "..", "assets", "shree_logo.png"),
    join(here, "..", "..", "..", "..", "assets", "shree_logo.png"),
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
function heading(title: string, sub: string): string {
  return `<div class="head"><div class="head-title">${esc(title)}</div><div class="head-line"><span class="rule"></span>${lotus(18)}<span class="rule"></span></div><div class="head-sub">${esc(sub)}</div></div>`;
}
function table(headers: string[], rows: (string | number)[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(String(h))}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}
function badge(active: boolean, activeText: string, okText: string): string {
  return `<span class="badge ${active ? "warn" : "ok"}">${esc(active ? activeText : okText)}</span>`;
}
/* ── Build ──────────────────────────────────────────────── */

const SIGN_TRAIT_EN = [
  "bold, initiating and direct — you move first and learn by doing",
  "steady, patient and value-driven — you build lasting comfort and resources",
  "curious, communicative and quick — you thrive on ideas, trade and connection",
  "nurturing, intuitive and protective — you lead through care and emotional intelligence",
  "confident, generous and dignified — you seek recognition and lead from the front",
  "analytical, precise and service-minded — you refine everything you touch",
  "diplomatic, balanced and relationship-oriented — you create harmony and fair deals",
  "intense, strategic and resilient — you transform and go deep where others stop",
  "expansive, optimistic and principled — you aim high and seek meaning",
  "disciplined, ambitious and enduring — you climb steadily and earn authority",
  "inventive, independent and humanitarian — you think ahead of your time",
  "compassionate, imaginative and intuitive — you feel your way and inspire",
];
const SIGN_TRAIT_HI = [
  "साहसी, अग्रणी और स्पष्ट — आप पहल करके सीखते हैं",
  "स्थिर, धैर्यवान और मूल्य-केंद्रित — आप टिकाऊ संसाधन बनाते हैं",
  "जिज्ञासु, संवादी और तेज़ — विचार, व्यापार और संपर्क में सफल",
  "पोषक, सहज-बुद्धि और रक्षात्मक — आप भावनात्मक बुद्धि से नेतृत्व करते हैं",
  "आत्मविश्वासी, दानी और गरिमामय — आप पहचान और नेतृत्व चाहते हैं",
  "विश्लेषणात्मक, सटीक और सेवाभावी — जो छूते हैं उसे निखारते हैं",
  "कूटनीतिक, संतुलित और संबंध-केंद्रित — आप सामंजस्य बनाते हैं",
  "तीव्र, रणनीतिक और लचीले — आप गहराई तक जाकर बदलाव लाते हैं",
  "विस्तारशील, आशावादी और सिद्धांतवादी — ऊँचे लक्ष्य और अर्थ की खोज",
  "अनुशासित, महत्वाकांक्षी और टिकाऊ — आप धीरे-धीरे शिखर चढ़ते हैं",
  "नवाचारी, स्वतंत्र और मानवतावादी — आप समय से आगे सोचते हैं",
  "करुणामय, कल्पनाशील और सहज — आप भाव से समझते और प्रेरित करते हैं",
];

const WEALTH_HOUSES = [2, 6, 10, 11];

export async function buildFinancialReportHTML(data: KundliData, label: string, meta: FinMeta): Promise<string> {
  const lang: Lang = (meta.language ?? "en").toLowerCase().startsWith("hi") ? "hi" : "en";
  const C = COPY[lang];
  const d = data.data ?? {};
  const brand = C.brand;
  const title = lang === "hi" ? C.title : (label || C.title);
  const genDate = fmtDate(new Date().toISOString(), lang);
  const logo = await loadLogo();

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
  const yogas = flattenYogas(d.yoga_details).filter((y) => y.hasYoga);
  const { mool, bhagya } = numerology(meta.datetime);

  const signName = (idx: number) => (lang === "hi" ? SIGNS_HI[idx] : SIGNS_EN[idx]) ?? "—";
  const planetName = (key: string) => (lang === "hi" ? (PLANET_HI[key] ?? key) : key.charAt(0).toUpperCase() + key.slice(1));
  const shortName = (key: string) => (lang === "hi" ? (PLANET_SHORT_HI[key] ?? key) : (PLANET_SHORT[key] ?? key));
  const placeLabel = meta.place || meta.coordinates || "—";
  const genderLabel = meta.gender
    ? ({ male: C.genderMale, female: C.genderFemale, other: C.genderOther } as Record<string, string>)[meta.gender.toLowerCase()] ?? meta.gender
    : "—";
  const ayanamsaLabel = meta.ayanamsa === 3 ? C.ayanamsaRaman : C.ayanamsaLahiri;
  const mark = (p: PlanetRow) => (ALWAYS_RETRO.has(p.name) ? "" : p.retro ? "(R)" : "");
  const traits = lang === "hi" ? SIGN_TRAIT_HI : SIGN_TRAIT_EN;

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

  const houseOf = (p: PlanetRow) => p.house || houseFromSign(p.rasiIdx, ascIdx);
  const moonName = str(val(chandraRasi, "name"), "—");
  const nakName = str(val(nakshatra, "name"), "—");
  const nakLord = str(val(val(nakshatra, "lord"), "name"), "—");
  const rashiLord = str(val(val(chandraRasi, "lord"), "name"), "—");

  const pages: string[] = [];

  /* ── Page 1: Cover (minimal) ── */
  const logoHtml = logo
    ? `<img src="${logo}" alt="${esc(brand)}" style="height:92px;margin:0 auto 6px;display:block"/>`
    : `<div style="font-size:22px;font-weight:700;color:#7A1F2B;letter-spacing:2px">${esc(brand)}</div>`;
  pages.push(`
    <div class="cover">
      ${logoHtml}
      <div style="font-size:10px;letter-spacing:5px;color:#A67C00;margin-top:8px">${esc(C.auspicious)}</div>
      <h1 class="cover-title">${esc(title)}</h1>
      <div class="cover-sub">${esc(C.subtitle)}</div>
      <div class="cover-tag">${esc(C.tagline)}</div>
      <div class="cover-divider"></div>
      <div style="font-size:11px;color:#555;letter-spacing:2px">${esc(C.preparedFor)}</div>
      <div style="font-size:26px;color:#7A1F2B;font-weight:700;margin-top:4px">${esc(meta.name || "—")}</div>
      <div style="font-size:13px;color:#222;margin-top:12px">${esc(fmtBirthDate(meta.datetime, lang))} · ${esc(fmtBirthTime(meta.datetime))}</div>
      <div style="font-size:12px;color:#444">${esc(placeLabel)}</div>
      <div class="small-note" style="margin-top:18px">${esc(C.reportNo)} ${esc(meta.reportNo || "—")} · ${esc(C.preparedOn)} ${esc(genDate)}</div>
    </div>`);

  /* ── Page 2: Birth details + Panchang + Avakahada + numerology ── */
  const birthRows: (string | number)[][] = [
    [C.name, meta.name || "—"],
    [C.gender, genderLabel],
    [C.dob, fmtBirthDate(meta.datetime, lang)],
    [C.tob, fmtBirthTime(meta.datetime)],
    [C.place, placeLabel],
    [C.ayanamsa, ayanamsaLabel],
    [C.lagna, signName(ascIdx)],
    [C.moonSign, moonName],
    [C.nakshatraShort, `${nakName} (${str(val(nakshatra, "pada"), "—")})`],
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
  const avakahadaRows: (string | number)[][] = [];
  if (info) {
    const hiMap: Record<string, string> = {
      deity: "देवता", ganam: "गण", symbol: "प्रतीक", nadi: "नाड़ी", color: "रंग",
      best_direction: "शुभ दिशा", birth_stone: "जन्म रत्न", planet: "ग्रह", animal_sign: "योनि", syllables: "अक्षर",
    };
    for (const k of ["deity", "ganam", "symbol", "nadi", "color", "best_direction", "syllables", "birth_stone", "planet"]) {
      const v = val(info, k);
      if (!v) continue;
      const lbl = k === "birth_stone" ? C.birthStone : lang === "hi" ? (hiMap[k] ?? k) : cap(k.replace(/_/g, " "));
      avakahadaRows.push([lbl, str(v)]);
    }
  }
  const intro = lang === "hi"
    ? `यह रिपोर्ट आपके दिए गए जन्म विवरण से राशि कुंडली की विंशोत्तरी एवं पराशरी पद्धति के अनुसार तैयार की गई है। ${esc(moonName)} राशि एवं ${esc(nakName)} नक्षत्र आपके मन और सहज स्वभाव को दर्शाते हैं; आगे के पृष्ठों में आपके धन, करियर एवं समय-चक्र का विस्तृत विश्लेषण है।`
    : `This report is cast from the birth details you provided, using the Vimshottari and Parashari system followed by Rashi Kundali. Your Moon in ${esc(moonName)} and birth nakshatra ${esc(nakName)} shape your mind and instinct; the pages that follow analyse your wealth, career and planetary timing in detail.`;
  pages.push(
    heading(C.birthDetails, C.birthDetailsSub) +
    `<div class="two-col"><div>${table([C.field, C.value], birthRows)}</div><div>${panchangRows.length ? table([C.field, C.value], panchangRows) : ""}</div></div>` +
    (avakahadaRows.length ? `<div class="sub-head">${esc(lang === "hi" ? "अवकहड़ा चक्र" : "Avakahada Chakra")}</div>` + table([C.field, C.value], avakahadaRows) : "") +
    `<div class="kpi-row">
      <div class="kpi"><span>${esc(C.lagna)}</span><b>${esc(signName(ascIdx))}</b></div>
      <div class="kpi"><span>${esc(C.moonSign)}</span><b>${esc(moonName)}</b></div>
      <div class="kpi"><span>${esc(C.nakshatraShort)}</span><b>${esc(nakName)}</b></div>
      <div class="kpi"><span>${esc(C.mobile)}</span><b>${mool}</b></div>
      <div class="kpi"><span>${esc(C.destiny)}</span><b>${bhagya}</b></div>
      <div class="kpi"><span>${esc(C.ayanamsa)}</span><b>${esc(ayanamsaLabel)}</b></div>
    </div>` +
    `<div class="note">${esc(C.moolankNote)}</div>` +
    `<p class="essay">${intro}</p>`,
  );

  /* ── Page 3: Charts D1 + D9 + Lagna/Rashi/Nakshatra narratives ── */
  pages.push(
    heading(lang === "hi" ? "कुंडली चक्र एवं लग्न-राशि-नक्षत्र" : "Kundali Chakra & Your Signs", lang === "hi" ? "D1/D9 चक्र एवं व्यक्तित्व, मन, सहज स्वभाव" : "D1/D9 charts · personality, mind and instinct") +
    `<div class="chart-pair">
      <div>${northIndianChart(planetsByHouse)}<div class="cap">${esc(C.lagnaChart)} — ${esc(C.lagna)}: ${esc(signName(ascIdx))}</div></div>
      <div>${northIndianChart(d9ByHouse)}<div class="cap">${esc(C.navamsa)} (D9)</div></div>
    </div>` +
    `<p class="essay"><b>${esc(C.lagna)} — ${esc(signName(ascIdx))}:</b> ${esc(lang === "hi"
      ? `आपका लग्न ${esc(signName(ascIdx))} है (${signElement(ascIdx + 1)} राशि, स्वामी ${SIGN_LORDS[ascIdx]}), जो ${traits[ascIdx]}। लग्न स्वामी आपकी कुंडली का स्वामी ग्रह है और उसकी स्थिति पूरे जीवन को रंग देती है।`
      : `You rise in ${signName(ascIdx)} (${signElement(ascIdx + 1)} sign, lord ${SIGN_LORDS[ascIdx]}) — ${traits[ascIdx]}. The Lagna lord becomes the lord of your chart, so where it sits strongly colours your personality and destiny.`)}</p>` +
    `<p class="essay"><b>${esc(C.moonSign)} — ${esc(moonName)}:</b> ${esc(lang === "hi"
      ? `चंद्र ${esc(moonName)} राशि में है, स्वामी ${esc(rashiLord)}। चंद्र मन का ग्रह है, अतः यह बताता है कि आप कैसे महसूस करते हैं — ${traits[Number(val(chandraRasi, "id")) - 1] || ""}।`
      : `Your Moon occupies ${moonName}, ruled by ${rashiLord}. The Moon governs the mind and emotions, so it shows how you feel and where you find comfort — ${traits[Number(val(chandraRasi, "id")) - 1] || ""}. A settled Moon supports calm, resilient decisions.`)}</p>` +
    `<p class="essay"><b>${esc(C.nakshatraShort)} — ${esc(nakName)}:</b> ${esc(lang === "hi"
      ? `आप ${esc(nakName)} नक्षत्र में जन्मे हैं, स्वामी ${esc(nakLord)}। जन्म नक्षत्र सहज प्रवृत्ति, जीवन-पाठ और दशा-क्रम बनाता है। नवमांश (D9) ग्रहों की आंतरिक शक्ति एवं भाग्य दिखाता है।`
      : `You were born in ${nakName} nakshatra, ruled by ${nakLord}. It shapes your instinct, life-lessons and the dasha sequence. The Navamsa (D9) chart above reveals each planet's inner strength and themes of fortune and partnership.`)}</p>`,
  );

  /* ── Page 5: Graha Sthiti (table + per-planet notes) ── */
  const planetRows = grahas.map((p) => {
    const h = houseOf(p);
    const pNak = p.nakshatra !== "—" ? p.nakshatra : (lang === "hi" ? NAKSHATRAS_HI[p.nakIdx] : NAKSHATRAS_EN[p.nakIdx]) ?? "—";
    const retro = ALWAYS_RETRO.has(p.name) ? "—" : p.retro ? `(${C.retro})` : "—";
    return [planetName(p.name), signName(p.rasiIdx), h || "—", `${p.degree.toFixed(1)}°`, p.pada ? `${pNak} (${p.pada})` : pNak, C[dignity(p.name, p.rasiIdx)], retro];
  });
  const planetNotes = grahas.map((p) => {
    const h = houseOf(p);
    const metaP = PLANET_META[p.name];
    const nm = planetName(p.name);
    const hMeta = HOUSE_META[h];
    const dg = dignity(p.name, p.rasiIdx);
    const dgText = dg === "exalted" ? (lang === "hi" ? " यह उच्च है, जिससे इसकी शुभता बढ़ती है।" : " It is exalted here, which strengthens its promise.")
      : dg === "debilitated" ? (lang === "hi" ? " यह नीच है, इसलिए इसके फल प्रयास एवं उपाय माँगते हैं।" : " It is debilitated, so its results need conscious effort and remedies.")
      : dg === "own" ? (lang === "hi" ? " यह स्वग्रही है, जिससे यह स्थिर फल देता है।" : " It sits in its own sign, giving it stability.")
      : "";
    const retro = !ALWAYS_RETRO.has(p.name) && p.retro ? (lang === "hi" ? " यह वक्री है, अतः फल धीरे परिपक्व होते हैं।" : " It is retrograde, so its results mature slowly and often after review.") : "";
    const houseText = hMeta ? (lang === "hi" ? ` भाव ${h} (${hMeta.name}) में यह ${hMeta.signifies} को सक्रिय करता है।` : ` In the ${hMeta.name} it activates ${hMeta.signifies}.`) : "";
    return `<p><b>${esc(nm)} · ${esc(signName(p.rasiIdx))} · H${h || "—"}</b> — ${esc(lang === "hi"
      ? `${esc(nm)} ${esc(metaP?.nature ?? "एक प्रमुख ग्रह")} का कारक है।`
      : `${nm} represents ${metaP?.nature ?? "a key planetary influence"} and governs ${metaP?.karaka ?? "its natural significations"}.`)}${esc(houseText)}${esc(dgText)}${esc(retro)}</p>`;
  }).join("");
  pages.push(
    heading(C.planetTable, C.planetTableSub) +
    table([C.planet, C.rashi, C.house, C.degree, C.nakshatra, C.dignity, C.retro], planetRows) +
    `<div class="sub-head">${esc(lang === "hi" ? "ग्रह-विश्लेषण" : "Planet-wise reading")}</div>` +
    `<div class="notes">${planetNotes}</div>` +
    `<div class="note">${esc(lang === "hi"
      ? "अंश और नक्षत्र मिलकर ग्रह की वास्तविक शक्ति बताते हैं; भाव वह जीवन-क्षेत्र है जहाँ ग्रह सक्रिय होता है।"
      : "Degree and nakshatra together reveal a planet's real strength; the house is the life-area where it acts.")} ${esc(C.retroNote)}</div>`,
  );

  /* ── Page 6: Bhava (house) analysis ── */
  const houseRows: (string | number)[][] = [];
  for (let h = 1; h <= 12; h++) {
    const hMeta = HOUSE_META[h];
    const signIdx = (ascIdx + h - 1) % 12;
    const occ = grahas.filter((p) => houseOf(p) === h);
    houseRows.push([
      h,
      hMeta?.name ?? `House ${h}`,
      signName(signIdx),
      SIGN_LORDS[signIdx] ?? "—",
      occ.length ? occ.map((p) => planetName(p.name)).join(", ") : "—",
    ]);
  }
  const houseParas = Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
    const hMeta = HOUSE_META[h];
    const occ = grahas.filter((p) => houseOf(p) === h);
    const names = occ.map((p) => planetName(p.name)).join(", ");
    const isWealth = WEALTH_HOUSES.includes(h);
    const signIdx = (ascIdx + h - 1) % 12;
    const body = lang === "hi"
      ? `${hMeta?.signifies ?? ""} से जुड़ा है। ${occ.length ? `इसमें ${names} स्थित हैं।` : "कोई ग्रह नहीं है, अतः फल भावेश से पढ़ें।"}`
      : `governs ${hMeta?.signifies ?? "its significations"}. ${occ.length ? `It holds ${names}.` : "It is unoccupied, so read it through its sign lord."}`;
    const extra = isWealth
      ? (lang === "hi" ? " यह धन-भाव है — इसका बल आपकी आय एवं संचय को सीधे प्रभावित करता है।" : " This is a wealth house — its strength directly shapes your income and accumulation.")
      : "";
    return `<p${isWealth ? ' class="wl"' : ""}><b>${esc(hMeta?.name ?? `House ${h}`)} — ${esc(signName(signIdx))}, ${esc(SIGN_LORDS[signIdx] ?? "")}:</b> ${esc(body + extra)}</p>`;
  }).join("");
  pages.push(
    heading(lang === "hi" ? "भाव विश्लेषण" : "Bhava Analysis", lang === "hi" ? "जीवन-क्षेत्र एवं धन-भाव" : "Life-areas with emphasis on wealth houses") +
    table([C.house, lang === "hi" ? "भाव" : "House", C.rashi, lang === "hi" ? "स्वामी" : "Lord", C.planet], houseRows) +
    `<div class="sub-head">${esc(lang === "hi" ? "भाव-अनुसार पठन (धन-भाव 2, 6, 10, 11 पर बल)" : "House-by-house reading (wealth houses 2, 6, 10, 11 emphasised)")}</div>` +
    `<div class="notes">${houseParas}</div>`,
  );

  /* ── Page 7: Yogas (only if present) ── */
  if (yogas.length) {
    const byCat = new Map<string, FlatYoga[]>();
    for (const y of yogas) {
      const list = byCat.get(y.category) ?? [];
      list.push(y);
      byCat.set(y.category, list);
    }
    let yogaHtml = `<p class="essay">${esc(lang === "hi"
      ? "आपकी कुंडली में निम्न शुभ योग बन रहे हैं। ये ग्रहों के संयोजन से बनते हैं और जीवन के विशेष क्षेत्रों को बल देते हैं।"
      : "The following auspicious yogas are formed in your chart. They arise from planetary combinations and lend strength to specific areas of life.")}</p>`;
    for (const [cat, list] of byCat) {
      yogaHtml += `<div class="sub-head">${esc(cat)}</div>`;
      for (const y of list) {
        if (y.name.toLowerCase() === cat.toLowerCase() && !y.description) continue;
        yogaHtml += `<p class="essay"><b>${esc(y.name)}</b>${y.description ? ` — ${esc(y.description)}` : ""}</p>`;
      }
    }
    pages.push(heading(C.yoga, lang === "hi" ? "आपकी कुंडली में शुभ संयोग" : "Auspicious combinations in your chart") + yogaHtml);
  }

  /* ── Page 8: Dosha + Remedies ── */
  const hasMangal = Boolean(val(md, "has_dosha"));
  const hasKaal = Boolean(val(kaalSarp, "has_dosha"));
  const hasSade = Boolean(val(sadeSati, "is_in_sade_sati"));
  const doshaRow = (lbl: string, active: boolean, desc: unknown) =>
    `<div class="dosha"><div class="dosha-head"><b>${esc(lbl)}</b>${badge(active, lang === "hi" ? "सक्रिय" : "Present", lang === "hi" ? "नहीं" : "Not indicated")}</div>` +
    `<div class="dosha-desc">${esc(richText(desc, active ? C.doshaActive : C.doshaAbsent))}</div></div>`;
  const remedies = grahas
    .map((p) => ({ name: planetName(p.name), remedy: PLANET_META[p.name]?.remedy }))
    .filter((r): r is { name: string; remedy: string } => Boolean(r.remedy))
    .map((r) => `<div><b>${esc(r.name)}:</b> ${esc(r.remedy)}</div>`)
    .join("");
  pages.push(
    heading(C.dosha, C.doshaSub) +
    doshaRow(lang === "hi" ? "मंगल दोष" : "Mangal Dosha", hasMangal, val(md, "description")) +
    doshaRow(lang === "hi" ? "कालसर्प दोष" : "Kaal Sarp Dosha", hasKaal, val(kaalSarp, "description")) +
    doshaRow(lang === "hi" ? "साढ़े साती" : "Sade Sati", hasSade, val(sadeSati, "description")) +
    `<div class="sub-head">${esc(lang === "hi" ? "सुझाए गए उपाय" : "Suggested remedies")}</div>` +
    `<div class="remedies">${remedies}</div>`,
  );

  /* ── Dasha data ── */
  const dashas = listOf(d, "dasha_periods");
  const now = Date.now();
  const inRange = (s: unknown, e: unknown) => new Date(String(s)).getTime() <= now && now <= new Date(String(e)).getTime();
  const currentM = dashas.find((m) => inRange(val(m, "start"), val(m, "end")));
  const currentA = currentM ? listOf(currentM, "antardasha").find((a) => inRange(val(a, "start"), val(a, "end"))) : undefined;

  /* ── Page 9: Dasha timeline ── */
  const dashaRows = dashas.map((m) => [
    planetName(str(val(m, "name")).toLowerCase()),
    fmtDate(val(m, "start"), lang),
    fmtDate(val(m, "end"), lang),
    inRange(val(m, "start"), val(m, "end")) ? (lang === "hi" ? "वर्तमान" : "Current") : "",
  ]);
  const adRows = (currentM ? listOf(currentM, "antardasha") : []).slice(0, 6).map((a) => [
    planetName(str(val(a, "name")).toLowerCase()),
    fmtDate(val(a, "start"), lang),
    fmtDate(val(a, "end"), lang),
    inRange(val(a, "start"), val(a, "end")) ? (lang === "hi" ? "वर्तमान" : "Current") : "",
  ]);
  const dashaIntro = lang === "hi"
    ? `आप अभी ${currentM ? planetName(str(val(currentM, "name")).toLowerCase()) : "—"} महादशा में हैं${currentA ? `, अंतर्दशा ${planetName(str(val(currentA, "name")).toLowerCase())}` : ""}। यह अवधि आपके करियर और धन-प्रवाह को दिशा देती है — बड़े निर्णय अनुकूल अंतर्दशा में लें।`
    : `You are living through the ${currentM ? planetName(str(val(currentM, "name")).toLowerCase()) : "—"} mahadasha${currentA ? `, currently in its ${planetName(str(val(currentA, "name")).toLowerCase())} antardasha` : ""}. This window colours your career and cash-flow — time major financial decisions with a favourable sub-period.`;
  pages.push(
    heading(C.dashaTable, C.dashaSub) +
    (dashaRows.length
      ? table([C.mahadasha, C.from, C.to, ""], dashaRows) +
        `<div class="sub-head">${esc(C.currentDasha)}</div>` +
        `<p class="essay"><b>${esc(C.mahadasha)}:</b> ${currentM ? `${esc(planetName(str(val(currentM, "name")).toLowerCase()))} (${esc(fmtDate(val(currentM, "start"), lang))} – ${esc(fmtDate(val(currentM, "end"), lang))})` : "—"} &nbsp; <b>${esc(C.antardasha)}:</b> ${currentA ? `${esc(planetName(str(val(currentA, "name")).toLowerCase()))} (${esc(fmtDate(val(currentA, "start"), lang))} – ${esc(fmtDate(val(currentA, "end"), lang))})` : "—"}</p>` +
        `<p class="essay">${esc(dashaIntro)}</p>` +
        (adRows.length ? table([C.antardasha, C.from, C.to, ""], adRows) : "")
      : `<div class="note">${esc(lang === "hi" ? "दशा डेटा उपलब्ध नहीं।" : "Dasha data not available.")}</div>`),
  );

  /* ── Page 10: 12-month money outlook ── */
  const guidance = (planet: string): string => {
    const benefic = ["jupiter", "venus", "mercury", "moon"];
    const cautious = ["saturn", "rahu", "ketu"];
    const action = ["sun", "mars"];
    if (benefic.includes(planet)) return lang === "hi" ? "निर्णय, बचत और निवेश के लिए अनुकूल।" : "Favourable for decisions, savings and investments.";
    if (cautious.includes(planet)) return lang === "hi" ? "अनुशासन रखें; नया कर्ज़ या सट्टा टालें।" : "Stay disciplined; avoid new debt or speculation.";
    if (action.includes(planet)) return lang === "hi" ? "पहल और कार्य के लिए अच्छा; जल्दबाज़ी न करें।" : "Good for initiative and action; avoid haste.";
    return lang === "hi" ? "स्थिर रहें, बजट की समीक्षा करें।" : "Stay steady; review your budget.";
  };
  const adList = currentM ? listOf(currentM, "antardasha") : [];
  const outlookRows: (string | number)[][] = [];
  const start = new Date();
  start.setDate(1);
  for (let i = 0; i < 12; i++) {
    const mStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const mid = new Date(mStart.getFullYear(), mStart.getMonth(), 15).getTime();
    const ad = adList.find((a) => new Date(String(val(a, "start"))).getTime() <= mid && mid <= new Date(String(val(a, "end"))).getTime());
    const adName = ad ? planetName(str(val(ad, "name")).toLowerCase()) : "—";
    const mLabel = mStart.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "short", year: "numeric" });
    outlookRows.push([mLabel, adName, ad ? guidance(String(val(ad, "name")).toLowerCase()) : (lang === "hi" ? "दशा डेटा पर उपलब्ध" : "Available with dasha data")]);
  }
  pages.push(
    heading(C.outlook, C.outlookSub) +
    table([C.month, C.antardasha, C.guidance], outlookRows) +
    `<p class="essay">${esc(lang === "hi"
      ? "यह दृष्टि आपकी वर्तमान महादशा की अंतर्दशाओं पर आधारित है। जब अंतर्दशा शुभ ग्रह की हो तो बचत, निवेश एवं संपत्ति के निर्णय लें; शनि/राहु/केतु की अंतर्दशा में अनुशासन रखें।"
      : "This outlook follows the antardashas of your current mahadasha. When a benefic planet rules the sub-period, favour savings, investments and asset purchases; under Saturn, Rahu or Ketu, stay disciplined and avoid leverage.")}</p>` +
    `<div class="note">${esc(lang === "hi"
      ? "यह तालिका आपकी वर्तमान महादशा की शेष अंतर्दशाओं पर बनी है; बड़े निर्णय अनुकूल अंतर्दशा में लें।"
      : "This table is built from the remaining antardashas of your current mahadasha; schedule significant decisions inside a favourable sub-period.")}</div>`,
  );

  /* ── Page 11: Dhan & Career insights ── */
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
      .map((g) => `${planetName(g.name)} · ${signName(g.rasiIdx)} H${houseOf(g)}`)
      .join(", ") || "—";
  const barRows = axisKeys.map((k) => ({ label: axisLabel[k] ?? k, score: scores[k] }));
  const moneyRows = axisKeys.map((k) => [axisLabel[k] ?? k, `${scores[k]}/10`, reasonFor(k)]);
  const axisParas = axisKeys.map((k) => `<p class="essay"><b>${esc(axisLabel[k] ?? k)} — ${scores[k]}/10.</b> ${esc(axisInterpretation(k, scores[k]))}</p>`).join("");
  const moneyHouses = grahas.filter((p) => [1, 2, 5, 9, 10, 11].includes(houseOf(p)));
  pages.push(
    heading(C.money, C.moneySub) +
    `<div class="chart-wrap">${barsSVG(barRows)}</div>` +
    table([C.axis, C.score, C.reading], moneyRows) +
    `<div class="notes">${axisParas}</div>` +
    `<div class="note"><b>${esc(C.wealthHouses)}:</b> ${esc(moneyHouses.map((p) => `${planetName(p.name)} (${signName(p.rasiIdx)} H${houseOf(p)})`).join(" · ") || "—")}</div>`,
  );

  /* ── Page 12: Closing (centered) ── */
  const disclaimer = lang === "hi"
    ? "यह रिपोर्ट आपके दिए गए जन्म विवरण पर आधारित है। सटीकता जन्म समय एवं स्थान पर निर्भर करती है। ज्योतिष मार्गदर्शन एवं आत्म-चिंतन हेतु है; यह परिणामों की गारंटी नहीं देता और किसी भी पेशेवर चिकित्सकीय, कानूनी या वित्तीय सलाह का विकल्प नहीं है। महत्वपूर्ण निर्णय योग्य विशेषज्ञों के साथ लें।"
    : "This report is based on the birth details you provided. Accuracy depends on your birth time and place being correct. Astrology is offered as guidance and for personal reflection. It does not guarantee outcomes and is not a substitute for professional medical, legal, or financial advice. Please make important life decisions with qualified professionals.";
  pages.push(
    `<div class="center-fill">
      <div class="mantra" style="font-size:13px">${MANTRA_CLOSING}</div>
      <div style="color:#555;font-size:10px;margin:8px 0 22px">— ${esc(lang === "hi" ? "सभी सुखी हों, सभी निरोग हों।" : "May all be happy. May all be free from illness.")}</div>
      <div class="mantra" style="font-size:14px">${MANTRA_GANESH_SHORT}</div>
      <div class="cover-divider" style="margin:20px auto"></div>
      <div class="disclaimer" style="text-align:left"><b>${esc(C.disclaimerTitle)}</b><br>${esc(disclaimer)}</div>
      <div style="text-align:center;font-size:11px;color:#7A1F2B;margin-top:22px">${esc(brand)} · ${esc(C.footer)}</div>
    </div>`,
  );

  const total = pages.length;
  const body = pages
    .map((inner, i) =>
      `<section class="page">${frame()}<div class="wm"></div><div class="content">${inner}</div>` +
      `<div class="foot"><span>${esc(C.preparedOn)} ${esc(genDate)}</span><span>${esc(brand)} · ${esc(C.footer)}</span><span>${esc(C.page)} ${i + 1} / ${total}</span></div></section>`,
    )
    .join("\n");

  const css = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; color:#222; background:#fff;
      font-family:'Noto Sans Devanagari','Noto Serif Devanagari',Georgia,'Times New Roman',serif; }
    .page { width:210mm; height:297mm; padding:16mm 15mm 14mm; page-break-after:always; position:relative; overflow:hidden; }
    .page:last-child { page-break-after:auto; }
    ${logo ? `.wm { position:absolute; inset:0; z-index:0; background-image:url("${logo}"); background-repeat:no-repeat; background-position:center; background-size:120mm auto; opacity:0.07; }` : ".wm { display:none; }"}
    .frame { position:absolute; inset:7mm; border:3px double #D4A72C; pointer-events:none; z-index:2; }
    .corner { position:absolute; width:9px; height:9px; background:#D4A72C; z-index:2; }
    .corner.tl { top:6mm; left:6mm; } .corner.tr { top:6mm; right:6mm; }
    .corner.bl { bottom:6mm; left:6mm; } .corner.br { bottom:6mm; right:6mm; }
    .content { position:relative; z-index:1; height:100%; }
    h1 { font-family:'Noto Serif Devanagari',Georgia,serif; }
    .head { border-bottom:2px solid #C9760B; padding-bottom:6px; margin-bottom:10px; }
    .head-title { font-size:17px; font-weight:700; color:#7A1F2B; }
    .head-line { display:flex; align-items:center; gap:6px; margin:3px 0; }
    .head-line .rule { flex:0 0 34px; height:1px; background:#D4A72C; }
    .head-sub { font-size:10.5px; color:#555; }
    .sub-head { font-size:12px; font-weight:700; color:#7A1F2B; margin:12px 0 4px; border-left:3px solid #C9760B; padding-left:7px; }
    table { width:100%; border-collapse:collapse; margin:8px 0 12px; font-size:10.2px; }
    th,td { border:1px solid #C8B27A; padding:4px 7px; text-align:left; vertical-align:top; }
    th { background:#F7EFDC; color:#7A1F2B; font-weight:700; }
    tr:nth-child(even) td { background:#FBF7EE; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .cover { height:calc(297mm - 30mm); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
    .cover-title { font-size:28px; color:#7A1F2B; margin:16px 0 4px; }
    .cover-sub { font-size:15px; color:#26327A; font-weight:600; }
    .cover-tag { font-size:11px; color:#6B5410; margin-top:6px; }
    .cover-divider { width:62%; height:2px; background:#C9760B; margin:18px 0; }
    .small-note { font-size:9.5px; color:#555; margin-top:10px; }
    .mantra { color:#7A1F2B; font-size:12px; line-height:1.75; font-family:'Noto Serif Devanagari',serif; }
    .note { background:#F7EFDC; border-left:3px solid #C9760B; padding:7px 10px; font-size:10.2px; margin:8px 0; line-height:1.55; color:#222; }
    .map { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; margin:10px 0 14px; background:#F7EFDC; border:1px solid #E4D6AE; border-radius:6px; padding:12px 14px; }
    .map > div { text-align:center; border-right:1px dashed #E4D6AE; padding:2px 6px; }
    .map > div:nth-child(2n) { border-right:none; }
    .map > div:nth-child(5) { grid-column:1 / -1; border-right:none; border-top:1px dashed #E4D6AE; padding-top:8px; margin-top:2px; }
    .map .m { color:#A67C00; font-size:9px; letter-spacing:1.5px; }
    .map .v { color:#7A1F2B; font-size:14px; font-weight:700; }
    .e-tag { display:inline-block; margin:2px 0 14px; padding:3px 12px; background:#FBF3E0; border:1px solid #E4D6AE; border-radius:12px; color:#8a6d1a; font-size:9.5px; letter-spacing:1px; }
    .essay { font-size:10.6px; line-height:1.68; color:#222; margin:7px 0; text-align:justify; }
    .essay b { color:#7A1F2B; }
    .notes p { margin:5px 0; font-size:10.2px; line-height:1.55; text-align:justify; }
    .notes p b { color:#7A1F2B; }
    .notes p.wl { background:#FBF7EE; border-left:3px solid #C9760B; padding:5px 8px; }
    .kpi-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 12px; margin:10px 0; }
    .kpi { background:#FBF7EE; border:1px solid #E4D6AE; border-radius:6px; padding:7px 10px; }
    .kpi span { display:block; font-size:8.5px; letter-spacing:1px; color:#8a7a4a; text-transform:uppercase; }
    .kpi b { color:#7A1F2B; font-size:13px; }
    .chart-wrap { padding:4px 0 2px; }
    .chart-pair { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:4px 0 8px; }
    .chart-pair .cap { text-align:center; font-size:9.5px; color:#555; margin-top:2px; }
    .dosha { border:1px solid #C8B27A; border-radius:6px; padding:8px 11px; margin:8px 0; }
    .dosha-head { display:flex; justify-content:space-between; align-items:center; color:#7A1F2B; font-size:12px; }
    .dosha-desc { font-size:10.2px; color:#333; margin-top:4px; line-height:1.5; }
    .badge { font-size:9px; padding:2px 8px; border-radius:10px; font-weight:700; }
    .badge.ok { background:#e7f6ec; color:#12691f; }
    .badge.warn { background:#fdeccb; color:#8a5200; }
    .remedies { columns:2; column-gap:16px; font-size:10.2px; line-height:1.5; }
    .remedies div { break-inside:avoid; margin:0 0 6px; }
    .disclaimer { border:1px solid #C8B27A; background:#FBF7EE; padding:12px 14px; font-size:10px; color:#333; line-height:1.6; border-radius:6px; }
    .center-fill { min-height:calc(297mm - 44mm); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; }
    .foot { position:absolute; left:15mm; right:15mm; bottom:8mm; z-index:2; display:flex; justify-content:space-between; font-size:8.5px; color:#7A5B00; letter-spacing:0.4px; }
  `;

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style></head><body>
    ${body}
  </body></html>`;
}
