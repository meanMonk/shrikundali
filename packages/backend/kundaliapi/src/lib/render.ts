import type { KundliData } from "./prokerala.js";
import { val, str, calculateMoneyAxisScores, flattenYogas } from "./scores.js";

/* ────────────────────────────────────────────────────────────
   Report metadata
   ──────────────────────────────────────────────────────────── */

export interface ReportMeta {
  name?: string;
  gender?: string;
  datetime?: string;
  coordinates?: string;
  place?: string;
  ayanamsa?: number;
  language?: string;
  reportNo?: string;
}

/* ────────────────────────────────────────────────────────────
   Reference data
   ──────────────────────────────────────────────────────────── */

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
export const SIGN_LORDS = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
];
export const SIGN_ELEMENT = [
  "Fire", "Earth", "Air", "Water", "Fire", "Earth",
  "Air", "Water", "Fire", "Earth", "Air", "Water",
];

export interface PlanetMeta {
  display: string;
  nature: string;
  karaka: string;
  remedy: string;
}

export const PLANET_META: Record<string, PlanetMeta> = {
  sun: { display: "Sun", nature: "the soul, father, authority and vitality", karaka: "leadership, confidence, recognition and health", remedy: "Offer water to the Sun at sunrise and chant the Aditya Hridayam on Sundays." },
  moon: { display: "Moon", nature: "the mind, emotions, mother and nourishment", karaka: "emotional balance, intuition, public life and comfort", remedy: "Wear a pearl in silver and offer milk to Shiva on Mondays." },
  mars: { display: "Mars", nature: "energy, courage, drive and competition", karaka: "ambition, property, siblings and physical strength", remedy: "Chant the Hanuman Chalisa on Tuesdays and donate red lentils." },
  mercury: { display: "Mercury", nature: "intelligence, speech, commerce and analysis", karaka: "communication, trade, learning and calculation", remedy: "Wear an emerald and worship Vishnu on Wednesdays." },
  jupiter: { display: "Jupiter", nature: "wisdom, expansion, fortune and dharma", karaka: "wealth, children, higher knowledge and grace", remedy: "Worship Brihaspati on Thursdays, donate turmeric and yellow cloth." },
  venus: { display: "Venus", nature: "love, beauty, luxury and relationship", karaka: "marriage, wealth, arts and comforts", remedy: "Wear a diamond or white sapphire and worship Lakshmi on Fridays." },
  saturn: { display: "Saturn", nature: "discipline, karma, patience and endurance", karaka: "career, longevity, responsibility and delays", remedy: "Serve the elderly and the needy on Saturdays; chant the Shani mantra." },
  rahu: { display: "Rahu", nature: "ambition, illusion, obsession and sudden gains", karaka: "foreign matters, technology, and unconventional paths", remedy: "Donate black sesame and worship Durga on Saturdays." },
  ketu: { display: "Ketu", nature: "detachment, spirituality, insight and moksha", karaka: "liberation, research, and past-life karma", remedy: "Feed stray dogs and chant Ganesha mantras." },
};

export interface HouseMeta {
  name: string;
  signifies: string;
}

export const HOUSE_META: Record<number, HouseMeta> = {
  1: { name: "First House (Tanu Bhava)", signifies: "self, body, personality, vitality and overall life direction" },
  2: { name: "Second House (Dhana Bhava)", signifies: "wealth, savings, family, speech and accumulated resources" },
  3: { name: "Third House (Sahaja Bhava)", signifies: "courage, siblings, communication, short journeys and effort" },
  4: { name: "Fourth House (Sukha Bhava)", signifies: "home, mother, property, vehicles and emotional peace" },
  5: { name: "Fifth House (Putra Bhava)", signifies: "creativity, children, intelligence, speculation and romance" },
  6: { name: "Sixth House (Shatru Bhava)", signifies: "competition, debts, enemies, health and daily service" },
  7: { name: "Seventh House (Kalatra Bhava)", signifies: "marriage, partnerships, business relationships and public dealings" },
  8: { name: "Eighth House (Ayu Bhava)", signifies: "longevity, inheritance, transformation, occult and sudden events" },
  9: { name: "Ninth House (Dharma Bhava)", signifies: "fortune, dharma, higher learning, father and long journeys" },
  10: { name: "Tenth House (Karma Bhava)", signifies: "career, authority, reputation, karma and public standing" },
  11: { name: "Eleventh House (Labha Bhava)", signifies: "gains, income, friends, networks and fulfilment of desires" },
  12: { name: "Twelfth House (Vyaya Bhava)", signifies: "losses, expenses, foreign lands, spirituality and liberation" },
};

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

export function signName(id: number): string {
  if (id >= 1 && id <= 12) return SIGNS[id - 1] ?? "Unknown";
  return "Unknown";
}
export function signLord(id: number): string {
  if (id >= 1 && id <= 12) return SIGN_LORDS[id - 1] ?? "Unknown";
  return "Unknown";
}
export function signElement(id: number): string {
  if (id >= 1 && id <= 12) return SIGN_ELEMENT[id - 1] ?? "";
  return "";
}

function listOf(obj: unknown, key: string): Record<string, unknown>[] {
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function panchangLabel(v: unknown, birthIso?: string): string {
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
  if (typeof v === "object") {
    return str(val(v, "name") ?? val(v, "vedic_name") ?? val(v, "value"), "—");
  }
  return String(v);
}

function fmtTimeOfDay(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Coerce a value that may be a string, object or array into readable text. */
function richText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const joined = v.map((x) => richText(x)).filter(Boolean).join(" ");
    return joined || fallback;
  }
  if (typeof v === "object") {
    const s = val(v, "description") ?? val(v, "text") ?? val(v, "name") ?? val(v, "value");
    if (typeof s === "string") return s;
    if (s && typeof s === "object") return richText(s, fallback);
    return fallback;
  }
  return String(v);
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function fmtBirthDate(datetime?: string): string {
  if (!datetime) return "—";
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtBirthTime(datetime?: string): string {
  if (!datetime) return "—";
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

/** Human-readable "DD Month YYYY, H:MM AM/PM" for a birth datetime. */
export function formatBirthDateTime(datetime?: string): string {
  if (!datetime) return "—";
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return `${fmtBirthDate(datetime)}, ${fmtBirthTime(datetime)}`;
}

/* ────────────────────────────────────────────────────────────
   Block model
   ──────────────────────────────────────────────────────────── */

export type Block =
  | { t: "h1" | "h2" | "h3" | "p" | "muted"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "table"; headers: string[]; rows: string[][] }
  | { t: "pagebreak" };

/* ────────────────────────────────────────────────────────────
   Content builder
   ──────────────────────────────────────────────────────────── */

interface PlanetRow {
  name: string;
  display: string;
  rasiId: number;
  rasiName: string;
  degree: number;
  house: number;
  retrograde: boolean;
  lord: string;
}

function buildPlanets(d: Record<string, unknown>): PlanetRow[] {
  const map = (p: Record<string, unknown>, forced?: string): PlanetRow => {
    const rasi = val(p, "rasi") as Record<string, unknown> | undefined;
    const rawLon = val(p, "longitude");
    const lon = Number(rawLon);
    let idx: number;
    if (rawLon != null && Number.isFinite(lon)) {
      idx = Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
    } else {
      const byId = Number(val(rasi, "id")) - 1;
      const byName = SIGNS.findIndex((s) => s.toLowerCase() === str(val(rasi, "name")).toLowerCase());
      idx = byId >= 0 && byId <= 11 ? byId : byName >= 0 ? byName : 0;
    }
    const rasiId = idx + 1;
    const name = forced ?? str(val(p, "name") ?? val(p, "planet_name"));
    return {
      name,
      display: PLANET_META[name.toLowerCase()]?.display ?? name,
      rasiId,
      rasiName: signName(rasiId),
      degree: Number(val(p, "degree")) || 0,
      house: Number(val(p, "position") ?? val(p, "house")) || 0,
      retrograde: Boolean(val(p, "is_retrograde")),
      lord: signLord(rasiId),
    };
  };
  const rows = listOf(d, "planet_positions").map((p) => map(p));
  if (!rows.some((r) => r.name.toLowerCase() === "ascendant")) {
    const ascRaw = val(d, "ascendant");
    if (ascRaw && typeof ascRaw === "object") rows.unshift(map(ascRaw as Record<string, unknown>, "Ascendant"));
  }
  return rows;
}

function planetByHouse(planets: PlanetRow[], house: number): PlanetRow[] {
  return planets.filter((p) => p.house === house && p.name.toLowerCase() !== "ascendant");
}

function buildBlocks(
  d: Record<string, unknown>,
  label: string,
  meta: ReportMeta,
  intro: Block[] = [],
): Block[] {
  const blocks: Block[] = [];
  const push = (...b: Block[]) => blocks.push(...b);

  const nd = val(d, "nakshatra_details") as Record<string, unknown> | undefined;
  const nakshatra = val(nd, "nakshatra") as Record<string, unknown> | undefined;
  const chandraRasi = val(nd, "chandra_rasi") as Record<string, unknown> | undefined;
  const sooryaRasi = val(nd, "soorya_rasi") as Record<string, unknown> | undefined;
  const zodiac = val(nd, "zodiac") as Record<string, unknown> | undefined;
  const info = val(nd, "additional_info") as Record<string, unknown> | undefined;
  const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
  const panchang = val(d, "panchang") as Record<string, unknown> | undefined;
  const kaalSarp = val(d, "kaal_sarp_dosha") as Record<string, unknown> | undefined;
  const sadeSati = val(d, "sade_sati") as Record<string, unknown> | undefined;

  const planets = buildPlanets(d);
  const asc = planets.find((p) => p.name.toLowerCase() === "ascendant");
  const ascSignId = asc?.rasiId ?? 0;
  const ascSign = asc?.rasiName ?? "—";
  const ascLord = asc?.lord ?? (ascSignId ? signLord(ascSignId) : "—");

  const yogas = flattenYogas(d.yoga_details);
  const scores = calculateMoneyAxisScores(d);

  /* ── Cover ── */
  push(
    { t: "h1", text: label },
    { t: "p", text: `Prepared for ${meta.name || "the native"}` },
    {
      t: "muted",
      text: `${fmtBirthDate(meta.datetime)} • ${fmtBirthTime(meta.datetime)} • ${meta.coordinates || ""}`,
    },
    { t: "muted", text: `Generated on ${fmtDate(new Date().toISOString())}` },
    { t: "pagebreak" },
  );

  // Angle-specific focus section (marriage / career / dosha / health).
  if (intro.length) push(...intro);

  /* ── Birth details ── */
  push(
    { t: "h1", text: "Birth Details" },
    {
      t: "table",
      headers: ["Field", "Value"],
      rows: [
        ["Name", meta.name || "—"],
        ["Gender", meta.gender || "—"],
        ["Date of Birth", fmtBirthDate(meta.datetime)],
        ["Time of Birth", fmtBirthTime(meta.datetime)],
        ["Place (coordinates)", meta.coordinates || "—"],
        ["Ayanamsa", meta.ayanamsa === 3 ? "Raman" : "Lahiri"],
        ["Nakshatra", str(val(nakshatra, "name"))],
        ["Nakshatra Pada", str(val(nakshatra, "pada"))],
        ["Rashi (Moon Sign)", str(val(chandraRasi, "name"))],
        ["Lagna (Ascendant)", ascSign],
      ],
    },
  );

  /* ── Panchang ── */
  if (panchang) {
    push(
      { t: "pagebreak" },
      { t: "h1", text: "Panchang at Birth" },
      { t: "p", text: "The panchang (five limbs of time) at your moment of birth sets the subtle tone of your horoscope." },
      {
        t: "table",
        headers: ["Element", "Value"],
        rows: [
          ["Vaara (Weekday)", panchangLabel(val(panchang, "vaara"))],
          ["Tithi", panchangLabel(val(panchang, "tithi"), meta.datetime)],
          ["Nakshatra", panchangLabel(val(panchang, "nakshatra"), meta.datetime)],
          ["Yoga", panchangLabel(val(panchang, "yoga"), meta.datetime)],
          ["Karana", panchangLabel(val(panchang, "karana"), meta.datetime)],
          ["Sunrise", fmtTimeOfDay(val(panchang, "sunrise"))],
          ["Sunset", fmtTimeOfDay(val(panchang, "sunset"))],
          ["Moonrise", fmtTimeOfDay(val(panchang, "moonrise"))],
          ["Moonset", fmtTimeOfDay(val(panchang, "moonset"))],
        ],
      },
    );
  }

  /* ── Avakahada Chakra ── */
  if (info) {
    push(
      { t: "pagebreak" },
      { t: "h1", text: "Avakahada Chakra" },
      { t: "p", text: "The Avakahada Chakra maps the finer qualities associated with your birth nakshatra." },
      {
        t: "table",
        headers: ["Attribute", "Value"],
        rows: [
          ["Nakshatra", str(val(nakshatra, "name"))],
          ["Nakshatra Lord", str(val(val(nakshatra, "lord"), "name"))],
          ["Rashi", str(val(chandraRasi, "name"))],
          ["Rashi Lord", str(val(val(chandraRasi, "lord"), "name"))],
          ["Soorya Rashi", str(val(sooryaRasi, "name"))],
          ["Zodiac (Western)", str(val(zodiac, "name"))],
          ["Deity", str(val(info, "deity"))],
          ["Gana", str(val(info, "ganam"))],
          ["Symbol", str(val(info, "symbol"))],
          ["Animal Sign (Yoni)", str(val(info, "animal_sign"))],
          ["Nadi", str(val(info, "nadi"))],
          ["Color", str(val(info, "color"))],
          ["Best Direction", str(val(info, "best_direction"))],
          ["Syllables", str(val(info, "syllables"))],
          ["Birth Stone", str(val(info, "birth_stone"))],
          ["Planet", str(val(info, "planet"))],
          ["Enemy Yoni", str(val(info, "enemy_yoni"))],
        ],
      },
    );
  }

  /* ── Lagna & Rashi ── */
  push(
    { t: "pagebreak" },
    { t: "h1", text: "Lagna & Moon Sign Analysis" },
    { t: "h2", text: `Lagna (Ascendant): ${ascSign}` },
    {
      t: "p",
      text: `Your Ascendant is ${ascSign}, a ${signElement(ascSignId)} sign ruled by ${ascLord}. The Lagna is the most personal point of the chart — it describes your body, temperament, and the lens through which you approach life. With ${ascSign} rising, ${ascLord} becomes the lord of your chart and its placement strongly colours your personality and destiny.`,
    },
    { t: "h2", text: `Rashi (Moon Sign): ${str(val(chandraRasi, "name"))}` },
    {
      t: "p",
      text: `Your Moon occupies ${str(val(chandraRasi, "name"))}, ruled by ${str(val(val(chandraRasi, "lord"), "name"))}. The Moon governs the mind and emotions, so this sign reveals how you feel, react, and seek comfort. A well-placed Moon supports emotional resilience and a calm, resourceful mind.`,
    },
    { t: "h2", text: `Nakshatra: ${str(val(nakshatra, "name"))} (Pada ${str(val(nakshatra, "pada"))})` },
    {
      t: "p",
      text: `You were born in ${str(val(nakshatra, "name"))} nakshatra, ruled by ${str(val(val(nakshatra, "lord"), "name"))}. The birth nakshatra shapes your instinctive nature, your dasha sequence, and the subtle karmic themes you carry into this life.`,
    },
  );

  /* ── Planetary positions ── */
  push(
    { t: "pagebreak" },
    { t: "h1", text: "Planetary Positions" },
    {
      t: "table",
      headers: ["Planet", "Rashi", "Degree", "House", "Retrograde"],
      rows: planets.map((p) => [
        p.display,
        p.rasiName,
        `${p.degree.toFixed(2)}°`,
        p.house ? String(p.house) : "—",
        p.retrograde ? "Yes" : "No",
      ]),
    },
    { t: "p", text: "Each planet below is interpreted through the sign it occupies and the house it activates." },
  );

  for (const p of planets) {
    const metaP = PLANET_META[p.name.toLowerCase()];
    if (!metaP || p.name.toLowerCase() === "ascendant") continue;
    push(
      { t: "h2", text: `${metaP.display} in ${p.rasiName} (House ${p.house || "—"})` },
      {
        t: "p",
        text: `${metaP.display} represents ${metaP.nature}, and is the karaka of ${metaP.karaka}. It occupies ${p.rasiName}, a ${signElement(p.rasiId)} sign ruled by ${p.lord}, and sits in the ${p.house || "—"} house. ` +
          `${p.house ? houseConnection(metaP.display, p.house) : ""} ` +
          `${p.retrograde ? "As it is retrograde, its results tend to mature slowly and often manifest after a period of review and inner reworking. " : ""}` +
          `Overall, this placement asks you to express ${metaP.display}'s energy through the themes of ${p.rasiName}.`,
      },
    );
  }

  /* ── Houses ── */
  push({ t: "pagebreak" }, { t: "h1", text: "House-by-House Analysis" });
  for (let h = 1; h <= 12; h++) {
    const metaH = HOUSE_META[h];
    if (!metaH) continue;
    const signId = ascSignId ? ((ascSignId - 1 + (h - 1)) % 12) + 1 : 0;
    const sName = signId ? signName(signId) : "—";
    const lord = signId ? signLord(signId) : "—";
    const occ = planetByHouse(planets, h);
    const occText = occ.length
      ? `It is occupied by ${occ.map((o) => PLANET_META[o.name.toLowerCase()]?.display ?? o.name).join(", ")}.`
      : "No planets occupy this house, so its results are read chiefly through its sign lord.";
    push(
      { t: "h2", text: metaH.name },
      {
        t: "p",
        text: `The ${metaH.name} governs ${metaH.signifies}. For your chart it falls in ${sName}, making ${lord} the lord of this house. ${occText} ` +
          `When ${lord} is strong and well-placed, the significations of this house flourish; when afflicted, they need conscious effort and remedies.`,
      },
    );
  }

  /* ── Yogas ── */
  if (yogas.length) {
    push({ t: "pagebreak" }, { t: "h1", text: "Yogas in Your Chart" });
    const categories = [...new Set(yogas.map((y) => y.category))];
    for (const cat of categories) {
      const catYogas = yogas.filter((y) => y.category === cat);
      const formed = catYogas.filter((y) => y.hasYoga);
      push(
        { t: "h2", text: cat },
        {
          t: "p",
          text: formed.length
            ? `${formed.length} yoga${formed.length > 1 ? "s" : ""} in this category are present in your chart.`
            : "None of the yogas in this category are formed in your chart.",
        },
      );
      for (const y of formed) {
        push({ t: "h3", text: y.name }, { t: "p", text: y.description });
      }
    }
  }

  /* ── Doshas ── */
  push({ t: "pagebreak" }, { t: "h1", text: "Dosha Analysis" });
  push(
    { t: "h2", text: "Mangal Dosha" },
    {
      t: "p",
      text: md
        ? `${Boolean(val(md, "has_dosha")) ? "Your chart carries Mangal Dosha." : "Your chart does not carry Mangal Dosha."} ${richText(val(md, "description"))}`
        : "Mangal Dosha could not be determined.",
    },
  );
  if (kaalSarp) {
    push(
      { t: "h2", text: "Kaal Sarp Dosha" },
      {
        t: "p",
        text: `${Boolean(val(kaalSarp, "has_dosha")) ? "Kaal Sarp Dosha is present." : "Kaal Sarp Dosha is not present."} ${richText(val(kaalSarp, "description"))}`,
      },
    );
  }
  if (sadeSati) {
    push(
      { t: "h2", text: "Sade Sati" },
      {
        t: "p",
        text: `${Boolean(val(sadeSati, "is_in_sade_sati")) ? "You are currently under Sade Sati." : "You are not currently under Sade Sati."} ${richText(val(sadeSati, "description"))}`,
      },
    );
  }

  /* ── Dasha ── */
  const dashas = listOf(d, "dasha_periods");
  if (dashas.length) {
    const balance = val(d, "dasha_balance") as Record<string, unknown> | undefined;
    push(
      { t: "pagebreak" },
      { t: "h1", text: "Vimshottari Dasha Timeline" },
      {
        t: "p",
        text: "The Vimshottari dasha is the timing system of Vedic astrology. Each planetary period colours the years it rules with that planet's themes.",
      },
    );
    if (balance) {
      push({
        t: "p",
        text: `At birth your dasha balance was ${str(val(balance, "description"))} of ${str(val(val(balance, "lord"), "name"))}.`,
      });
    }
    const now = Date.now();
    for (const m of dashas) {
      const mName = str(val(m, "name"));
      const mStart = val(m, "start");
      const mEnd = val(m, "end");
      const isCurrent = new Date(String(mStart)).getTime() <= now && now <= new Date(String(mEnd)).getTime();
      push(
        { t: "h2", text: `${mName} Mahadasha${isCurrent ? " (current)" : ""} — ${fmtDate(mStart)} to ${fmtDate(mEnd)}` },
      );
      const metaM = PLANET_META[mName.toLowerCase()];
      if (metaM) {
        push({
          t: "p",
          text: `The ${mName} Mahadasha spans ${fmtDate(mStart)} to ${fmtDate(mEnd)}. During these years, the themes of ${metaM.display} — ${metaM.nature} — come to the foreground, especially its karakatwa of ${metaM.karaka}. ${isCurrent ? "This is the period you are living through now, so its promise and its caution both deserve your attention." : ""}`,
        });
      }
      const antars = listOf(m, "antardasha");
      if (antars.length) {
        push({
          t: "table",
          headers: ["Antardasha", "From", "To"],
          rows: antars.map((a) => [
            str(val(a, "name")),
            fmtDate(val(a, "start")),
            fmtDate(val(a, "end")),
          ]),
        });
      }
      // Full pratyantardasha detail for every antardasha in this mahadasha.
      for (const a of antars) {
        const prat = listOf(a, "pratyantardasha");
        if (!prat.length) continue;
        push({ t: "h3", text: `${mName} / ${str(val(a, "name"))} — Pratyantardasha` });
        push({
          t: "table",
          headers: ["Pratyantardasha", "From", "To"],
          rows: prat.map((p) => [
            str(val(p, "name")),
            fmtDate(val(p, "start")),
            fmtDate(val(p, "end")),
          ]),
        });
      }
    }
  }

  /* ── Money axis ── */
  const axisLabels: Record<keyof typeof scores, string> = {
    wealthPotential: "Wealth Potential",
    careerGrowth: "Career Growth",
    businessLuck: "Business Luck",
    propertyAssets: "Property & Assets",
    investmentSense: "Investment Sense",
    financialStability: "Financial Stability",
  };
  push(
    { t: "pagebreak" },
    { t: "h1", text: "Money-Axis Scores" },
    { t: "p", text: "These scores (1–10) summarise the strength of the key wealth-giving factors in your chart." },
    {
      t: "table",
      headers: ["Axis", "Score", "Reading"],
      rows: (Object.keys(scores) as (keyof typeof scores)[]).map((k) => [
        axisLabels[k],
        `${scores[k]}/10`,
        scores[k] >= 8 ? "Strong" : scores[k] >= 6 ? "Above average" : scores[k] >= 4 ? "Moderate" : "Needs support",
      ]),
    },
  );
  for (const k of Object.keys(scores) as (keyof typeof scores)[]) {
    push(
      { t: "h2", text: axisLabels[k] },
      { t: "p", text: axisInterpretation(k, scores[k]) },
    );
  }

  /* ── Remedies ── */
  push({ t: "pagebreak" }, { t: "h1", text: "Personalised Remedies" });
  for (const p of planets) {
    const metaP = PLANET_META[p.name.toLowerCase()];
    if (!metaP) continue;
    push({ t: "h3", text: `${metaP.display}` }, { t: "p", text: metaP.remedy });
  }

  /* ── Conclusion ── */
  push(
    { t: "pagebreak" },
    { t: "h1", text: "Conclusion" },
    {
      t: "p",
      text: "This report is generated from your exact birth details using the Lahiri ayanamsa and classical Parashari principles. Use it as a map, not a mandate: the stars incline, they do not compel. Conscious effort, timing and remedies allow you to make the most of every planetary period.",
    },
    { t: "muted", text: "For guidance only. Not a substitute for professional, medical, legal or financial advice." },
  );

  return blocks;
}

function houseConnection(planet: string, house: number): string {
  const h = HOUSE_META[house];
  if (!h) return "";
  return `In the ${h.name}, it brings ${planet}'s energy to bear on ${h.signifies}.`;
}

export function axisInterpretation(key: string, score: number): string {
  const band = score >= 8 ? "strong" : score >= 6 ? "above average" : score >= 4 ? "moderate" : "in need of conscious support";
  const map: Record<string, string> = {
    wealthPotential: `Your capacity to accumulate and retain wealth is ${band}. This is driven mainly by the strength of Jupiter, Venus and the Moon, and by the wealth-giving houses (2nd, 11th) in your chart.`,
    careerGrowth: `Your professional rise and recognition are ${band}. Saturn, the Sun and Mars shape how quickly responsibility, authority and promotion come to you.`,
    businessLuck: `Your aptitude for independent ventures and trade is ${band}. Mercury and Jupiter indicate how well commerce, negotiation and expansion favour you.`,
    propertyAssets: `Your ability to acquire property, vehicles and tangible assets is ${band}. Venus and Mars, along with the 4th house, determine this axis.`,
    investmentSense: `Your judgement in investments and money management is ${band}. Mercury and Saturn reflect how well you analyse risk and hold a long-term view.`,
    financialStability: `Your long-term financial security is ${band}. Jupiter and Saturn together show how steadily your resources grow and endure.`,
  };
  return map[key] ?? `This axis is ${band}.`;
}

/* ────────────────────────────────────────────────────────────
   Renderers
   ──────────────────────────────────────────────────────────── */

export function renderMarkdown(data: KundliData, label?: string, meta: ReportMeta = {}): string {
  const title = label || "Janam Kundali Report";
  const blocks = buildBlocks(data.data, title, meta);
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "h1": out.push(`\n# ${b.text}\n`); break;
      case "h2": out.push(`\n## ${b.text}\n`); break;
      case "h3": out.push(`\n### ${b.text}\n`); break;
      case "p": out.push(`${b.text}\n`); break;
      case "muted": out.push(`_${b.text}_\n`); break;
      case "ul": out.push(b.items.map((i) => `- ${i}`).join("\n") + "\n"); break;
      case "table":
        out.push(`| ${b.headers.join(" | ")} |`);
        out.push(`| ${b.headers.map(() => "---").join(" | ")} |`);
        for (const r of b.rows) out.push(`| ${r.join(" | ")} |`);
        out.push("");
        break;
      case "pagebreak": out.push("\n---\n"); break;
    }
  }
  out.push(`\n*rashikundali.com*`);
  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderHTML(
  data: KundliData,
  label?: string,
  meta: ReportMeta = {},
  intro: Block[] = [],
): string {
  const title = label || "Janam Kundali Report";
  const blocks = buildBlocks(data.data, title, meta, intro);

  const body: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "h1": body.push(`<h1>${escapeHtml(b.text)}</h1>`); break;
      case "h2": body.push(`<h2>${escapeHtml(b.text)}</h2>`); break;
      case "h3": body.push(`<h3>${escapeHtml(b.text)}</h3>`); break;
      case "p": body.push(`<p>${escapeHtml(b.text)}</p>`); break;
      case "muted": body.push(`<p class="muted">${escapeHtml(b.text)}</p>`); break;
      case "ul": body.push(`<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`); break;
      case "table":
        body.push(
          `<table><thead><tr>${b.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>` +
            b.rows
              .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
              .join("") +
            `</tbody></table>`,
        );
        break;
      case "pagebreak": body.push(`<div class="pagebreak"></div>`); break;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; line-height: 1.7; margin: 0; padding: 0 22mm; font-size: 12pt; }
  h1 { font-size: 22pt; color: #8b4513; border-bottom: 3px solid #d4a373; padding-bottom: 8px; margin: 28px 0 16px; }
  h2 { font-size: 15pt; color: #6b3a0e; margin: 22px 0 8px; }
  h3 { font-size: 12.5pt; color: #8b4513; margin: 16px 0 6px; }
  p { margin: 8px 0; text-align: justify; }
  p.muted { color: #777; font-size: 10.5pt; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 10.5pt; }
  th, td { border: 1px solid #d4a373; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #faf3e8; font-weight: 700; }
  tr:nth-child(even) td { background: #fdf8f0; }
  ul { margin: 8px 0; padding-left: 22px; }
  .pagebreak { page-break-after: always; }
  h1 { page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
</style>
</head>
<body>
${body.join("\n")}
</body>
</html>`;
}

/* ────────────────────────────────────────────────────────────
   PDF (direct puppeteer, singleton browser reused across requests)
   ──────────────────────────────────────────────────────────── */

const PDF_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--font-render-hinting=none",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let browserPromise: ReturnType<typeof launchBrowser> | null = null;

async function launchBrowser() {
  const puppeteer = (await import("puppeteer")).default;
  console.log("[PDF] Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: PDF_ARGS,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });
  browser.on("disconnected", () => {
    console.log("[PDF] Browser disconnected");
    browserPromise = null;
  });
  console.log("[PDF] Browser launched successfully");
  return browser;
}

/** Reuses a single browser instance across requests instead of launching one per PDF. */
async function getBrowser() {
  if (!browserPromise) browserPromise = launchBrowser();
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = launchBrowser();
    return browserPromise;
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  if (browser) await browser.close().catch(() => {});
}

/** Render any HTML string to a PDF buffer (shared by all report templates). */
export async function htmlToPdf(html: string, attempts = 3): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      // Content is a fully self-contained HTML string (no external fetches), so
      // domcontentloaded is sufficient — no need to wait on network idle.
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
      const pdf = await page.pdf({
        format: "A4",
        margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } catch (e) {
      lastError = e;
      console.error(`[PDF] attempt ${attempt}/${attempts} failed:`, e);
      if (attempt < attempts) await sleep(1000 * attempt);
    } finally {
      await page.close().catch(() => {});
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function renderPDF(
  data: KundliData,
  label?: string,
  meta: ReportMeta = {},
  attempts = 3,
): Promise<Buffer> {
  return htmlToPdf(renderHTML(data, label, meta), attempts);
}

/**
 * Type-aware report HTML. `financial_kundali` uses the 12-page branded template
 * (lib/financial-report.ts); anything else falls back to the generic renderer.
 */
export async function renderReportHTML(
  reportType: string,
  data: KundliData,
  label?: string,
  meta: ReportMeta = {},
): Promise<string> {
  if (reportType === "financial_kundali") {
    const { buildFinancialReportHTML } = await import("./financial-report.js");
    return buildFinancialReportHTML(data, label || "Janam Kundali Report", meta);
  }
  const { isAngleReport, angleIntroBlocks } = await import("./angle-report.js");
  if (isAngleReport(reportType)) {
    return renderHTML(data, label, meta, angleIntroBlocks(reportType, data));
  }
  return renderHTML(data, label, meta);
}

/** Type-aware report PDF (see renderReportHTML). */
export async function renderReportPDF(
  reportType: string,
  data: KundliData,
  label?: string,
  meta: ReportMeta = {},
): Promise<Buffer> {
  return htmlToPdf(await renderReportHTML(reportType, data, label, meta));
}
