import type { KundliData } from "./prokerala.js";
import { val, str } from "./scores.js";
import { PLANET_META, SIGNS, signLord, signName, type Block } from "./render.js";

const ANGLE_REPORTS = new Set([
  "marriage_kundali",
  "career_kundali",
  "dosha_report",
  "health_kundali",
]);

export function isAngleReport(reportType: string): boolean {
  return ANGLE_REPORTS.has(reportType);
}

interface PlanetRow {
  name: string;
  display: string;
  house: number;
  rasiId: number;
  rasiName: string;
}

function listOf(obj: unknown, key: string): Record<string, unknown>[] {
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function planetsOf(d: Record<string, unknown>): PlanetRow[] {
  return listOf(d, "planet_positions")
    .concat(listOf(d, "planets"))
    .filter((p) => str(val(p, "name") ?? val(p, "planet_name")).toLowerCase() !== "ascendant")
    .map((p) => {
      const name = str(val(p, "name") ?? val(p, "planet_name"));
      const rasi = val(p, "rasi") as Record<string, unknown> | undefined;
      const rasiId = Number(val(rasi, "id")) || 0;
      return {
        name,
        display: PLANET_META[name.toLowerCase()]?.display ?? name,
        house: Number(val(p, "position") ?? val(p, "house")) || 0,
        rasiId,
        rasiName: rasiId ? signName(rasiId) : str(val(rasi, "name"), "—"),
      };
    });
}

function ascendantSignId(d: Record<string, unknown>): number {
  const asc =
    listOf(d, "planet_positions").find((p) => str(val(p, "name")).toLowerCase() === "ascendant") ??
    listOf(d, "planets").find((p) => str(val(p, "name")).toLowerCase() === "ascendant");
  const rasi = val(asc, "rasi") as Record<string, unknown> | undefined;
  let id = Number(val(rasi, "id")) || 0;
  if (!id) {
    const name = str(val(rasi, "name")).toLowerCase();
    const idx = SIGNS.findIndex((s) => s.toLowerCase() === name);
    id = idx >= 0 ? idx + 1 : 0;
  }
  if (!id) {
    const a = val(d, "ascendant") as Record<string, unknown> | undefined;
    id = Number(val(val(a, "rasi"), "id")) || 0;
  }
  return id;
}

function houseSignId(ascId: number, house: number): number {
  if (!ascId) return 0;
  return ((ascId - 1 + (house - 1)) % 12) + 1;
}

function houseSignName(ascId: number, house: number): string {
  const id = houseSignId(ascId, house);
  return id ? signName(id) : "—";
}

function houseLordName(ascId: number, house: number): string {
  const id = houseSignId(ascId, house);
  return id ? signLord(id) : "—";
}

function planetsInHouse(planets: PlanetRow[], house: number): PlanetRow[] {
  return planets.filter((p) => p.house === house);
}

function findPlanet(planets: PlanetRow[], name: string): PlanetRow | undefined {
  return planets.find((p) => p.name.toLowerCase() === name);
}

function fmtDate(v: unknown): string {
  const s = str(v, "—");
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface DashaWindow {
  name: string;
  from: string;
  to: string;
  current: boolean;
}

function dashaWindows(d: Record<string, unknown>, lords: string[], limit = 5): DashaWindow[] {
  const now = Date.now();
  const wanted = lords.map((l) => l.toLowerCase()).filter(Boolean);
  return listOf(d, "dasha_periods")
    .filter((m) => wanted.includes(str(val(m, "name")).toLowerCase()))
    .map((m) => {
      const from = str(val(m, "start"));
      const to = str(val(m, "end"));
      const f = new Date(from).getTime();
      const t = new Date(to).getTime();
      return {
        name: str(val(m, "name")),
        from: fmtDate(from),
        to: fmtDate(to),
        current: !isNaN(f) && !isNaN(t) && f <= now && now <= t,
      };
    })
    .slice(0, limit);
}

function windowsTable(windows: DashaWindow[]): Block {
  return {
    t: "table",
    headers: ["Period", "From", "To", "Status"],
    rows: windows.map((w) => [w.name, w.from, w.to, w.current ? "Current" : "Upcoming"]),
  };
}

function placement(p?: PlanetRow): string {
  return p ? `${p.rasiName} (House ${p.house || "—"})` : "—";
}

function occupantsText(planets: PlanetRow[], house: number): string {
  const occ = planetsInHouse(planets, house).map((p) => p.display);
  return occ.length ? occ.join(", ") : "None";
}

/* ── Marriage ─────────────────────────────────────────────── */

function marriageBlocks(d: Record<string, unknown>, planets: PlanetRow[]): Block[] {
  const ascId = ascendantSignId(d);
  const h7Sign = houseSignName(ascId, 7);
  const h7Lord = houseLordName(ascId, 7);
  const venus = findPlanet(planets, "venus");
  const jupiter = findPlanet(planets, "jupiter");
  const windows = dashaWindows(d, [h7Lord, "venus", "jupiter"]);

  const blocks: Block[] = [
    { t: "h1", text: "Marriage & Relationship Focus" },
    {
      t: "p",
      text: `This report reads your chart specifically for marriage timing and partnership. The 7th house is the primary house of marriage; in your chart it falls in ${h7Sign}, so ${h7Lord} becomes the key planet for your married life. Venus (the karaka of love and harmony) and Jupiter (the karaka of husband and tradition) further colour the picture.`,
    },
    {
      t: "table",
      headers: ["Factor", "Placement"],
      rows: [
        ["7th house sign", h7Sign],
        ["7th house lord", h7Lord],
        ["7th house occupants", occupantsText(planets, 7)],
        ["Venus (love karaka)", placement(venus)],
        ["Jupiter (prosperity karaka)", placement(jupiter)],
      ],
    },
    { t: "h2", text: "Favourable marriage-timing periods" },
  ];

  if (windows.length) {
    blocks.push(
      {
        t: "p",
        text: "The Vimshottari periods of your 7th lord, Venus and Jupiter are the windows that typically activate marriage. The strongest windows are:",
      },
      windowsTable(windows),
    );
  } else {
    blocks.push({
      t: "p",
      text: "Detailed dasha windows could not be computed from the available data. Your full report analyses the 7th house and its lord in depth.",
    });
  }

  blocks.push(
    { t: "h2", text: "What to keep in mind" },
    {
      t: "p",
      text: "A delayed 7th lord, an afflicted Venus, or a weak Jupiter more often indicates delay than denial — timing choices and remedies can materially improve outcomes. Read the Dosha and Remedies sections for specifics.",
    },
  );
  return blocks;
}

/* ── Career ───────────────────────────────────────────────── */

function careerBlocks(d: Record<string, unknown>, planets: PlanetRow[]): Block[] {
  const ascId = ascendantSignId(d);
  const h10Sign = houseSignName(ascId, 10);
  const h10Lord = houseLordName(ascId, 10);
  const saturn = findPlanet(planets, "saturn");
  const sun = findPlanet(planets, "sun");
  const mars = findPlanet(planets, "mars");
  const windows = dashaWindows(d, [h10Lord, "saturn", "sun"]);

  const blocks: Block[] = [
    { t: "h1", text: "Career & Profession Focus" },
    {
      t: "p",
      text: `This report reads your chart for career direction and timing. The 10th house is the house of profession and public standing; in your chart it falls in ${h10Sign}, making ${h10Lord} the key planet for your career. Saturn (discipline and long-term rise), the Sun (authority and recognition) and Mars (drive and initiative) shape how quickly responsibility and promotion arrive.`,
    },
    {
      t: "table",
      headers: ["Factor", "Placement"],
      rows: [
        ["10th house sign", h10Sign],
        ["10th house lord", h10Lord],
        ["10th house occupants", occupantsText(planets, 10)],
        ["Saturn (discipline karaka)", placement(saturn)],
        ["Sun (authority karaka)", placement(sun)],
        ["Mars (drive karaka)", placement(mars)],
      ],
    },
    { t: "h2", text: "Job-change & promotion windows" },
  ];

  if (windows.length) {
    blocks.push(
      {
        t: "p",
        text: "The dasha periods of your 10th lord, Saturn and the Sun are the windows that typically activate career movement. The strongest windows are:",
      },
      windowsTable(windows),
    );
  } else {
    blocks.push({
      t: "p",
      text: "Detailed dasha windows could not be computed from the available data. Your full report analyses the 10th house and its lord in depth.",
    });
  }

  blocks.push(
    { t: "h2", text: "Business or job?" },
    {
      t: "p",
      text: "The strength of the 7th house (trade and partnership), Mercury (commerce) and the 3rd house (self-effort) decides how well independent ventures suit you versus salaried growth. Where the 10th lord is strong but the 7th is weak, structured employment tends to outperform early entrepreneurship, and vice versa.",
    },
  );
  return blocks;
}

/* ── Dosha ────────────────────────────────────────────────── */

function doshaBlocks(d: Record<string, unknown>, planets: PlanetRow[]): Block[] {
  const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
  const kaalSarp = val(d, "kaal_sarp_dosha") as Record<string, unknown> | undefined;
  const sadeSati = val(d, "sade_sati") as Record<string, unknown> | undefined;
  const pitra = val(d, "pitra_dosha") as Record<string, unknown> | undefined;

  const mangal = Boolean(val(md, "has_dosha"));
  const kaal = Boolean(val(kaalSarp, "has_dosha"));
  const sade = Boolean(val(sadeSati, "is_in_sade_sati"));
  const pitraPresent = pitra ? Boolean(val(pitra, "has_dosha")) : false;

  const blocks: Block[] = [
    { t: "h1", text: "Dosha Focus" },
    {
      t: "p",
      text: "This report scans your chart for the doshas that most commonly concern families — Mangal (Manglik), Kaal Sarp, Pitra and Shani (Sade Sati) — and pairs each finding with simple, practical remedies. A dosha is a tendency, not a verdict; most are cancelled or softened by other placements.",
    },
    {
      t: "table",
      headers: ["Dosha", "Status"],
      rows: [
        ["Mangal (Manglik) Dosha", mangal ? "Present" : "Not present"],
        ["Kaal Sarp Dosha", kaalSarp ? (kaal ? "Present" : "Not present") : "Not determined"],
        ["Sade Sati", sadeSati ? (sade ? "Currently active" : "Not active") : "Not determined"],
        ["Pitra Dosha", pitra ? (pitraPresent ? "Present" : "Not present") : "Not determined"],
      ],
    },
  ];

  const mars = findPlanet(planets, "mars");
  const saturn = findPlanet(planets, "saturn");

  blocks.push({ t: "h2", text: "Mangal (Manglik) Dosha" });
  blocks.push({
    t: "p",
    text: mangal
      ? `Mars occupies ${placement(mars)}, which triggers Mangal Dosha in the classical reading. Its effect is strongest on marriage and partnerships, and it is commonly cancelled or reduced when Mars is in its own sign, exalted, or aspected by benefics.`
      : "Mars is not placed in the houses (1, 4, 7, 8, 12) that create Mangal Dosha, so this concern does not apply to your chart.",
  });
  if (mars) {
    blocks.push({ t: "p", text: `Remedy: ${PLANET_META.mars?.remedy ?? ""}` });
  }

  if (sadeSati) {
    blocks.push({ t: "h2", text: "Sade Sati / Shani" });
    blocks.push({
      t: "p",
      text: sade
        ? `You are currently within a Sade Sati phase. Saturn is passing over your Moon sign and its neighbouring signs, a period that favours patience, discipline and steady effort over abrupt moves.${saturn ? ` Saturn currently sits in ${placement(saturn)}.` : ""}`
        : "You are not currently within a Sade Sati phase, so Saturn's transit pressure on the Moon is not active for you.",
    });
    blocks.push({ t: "p", text: `Remedy: ${PLANET_META.saturn?.remedy ?? ""}` });
  }

  blocks.push(
    { t: "h2", text: "General guidance" },
    {
      t: "p",
      text: "Remedies work best as steady, humble practice rather than one-off rituals. The full report lists planet-specific remedies tailored to your exact placements, along with the periods in which each dosha is most likely to express itself.",
    },
  );
  return blocks;
}

/* ── Health ───────────────────────────────────────────────── */

function healthBlocks(d: Record<string, unknown>, planets: PlanetRow[]): Block[] {
  const ascId = ascendantSignId(d);
  const lagnaLord = houseLordName(ascId, 1);
  const h6Lord = houseLordName(ascId, 6);
  const h8Lord = houseLordName(ascId, 8);
  const h12Lord = houseLordName(ascId, 12);
  const saturn = findPlanet(planets, "saturn");
  const mars = findPlanet(planets, "mars");
  const windows = dashaWindows(d, [h6Lord, h8Lord, h12Lord, "saturn", "mars"]);

  const blocks: Block[] = [
    { t: "h1", text: "Health & Vitality Focus" },
    {
      t: "p",
      text: `This report reads your chart for vitality and health-sensitive periods. The Lagna (1st house) governs the body and constitution; for you it is ruled by ${lagnaLord}. The 6th house (illness and recovery), 8th (chronic conditions) and 12th (rest and hospitalisation) show where stress tends to accumulate.`,
    },
    {
      t: "table",
      headers: ["Factor", "Placement"],
      rows: [
        ["Lagna lord (constitution)", lagnaLord],
        ["6th house occupants", occupantsText(planets, 6)],
        ["8th house occupants", occupantsText(planets, 8)],
        ["12th house occupants", occupantsText(planets, 12)],
        ["Saturn (chronic/stress)", placement(saturn)],
        ["Mars (inflammation/injury)", placement(mars)],
      ],
    },
    { t: "h2", text: "Health-sensitive periods" },
  ];

  if (windows.length) {
    blocks.push(
      {
        t: "p",
        text: "Periods ruled by the 6th, 8th and 12th lords, or by Saturn and Mars, are when the body is most likely to ask for attention. The key windows are:",
      },
      windowsTable(windows),
    );
  } else {
    blocks.push({
      t: "p",
      text: "Detailed dasha windows could not be computed from the available data. Your full report analyses the health houses in depth.",
    });
  }

  blocks.push(
    { t: "h2", text: "Preventive guidance" },
    {
      t: "p",
      text: "These windows are best used for prevention — regular check-ups, sleep discipline and stress management — rather than worry. A strong Lagna lord and well-placed Jupiter act as protective factors, and the remedies section lists practices that support them.",
    },
  );
  return blocks;
}

const BUILDERS: Record<string, (d: Record<string, unknown>, planets: PlanetRow[]) => Block[]> = {
  marriage_kundali: marriageBlocks,
  career_kundali: careerBlocks,
  dosha_report: doshaBlocks,
  health_kundali: healthBlocks,
};

/** Angle-specific focus blocks injected after the cover of the generic report. */
export function angleIntroBlocks(reportType: string, data: KundliData): Block[] {
  const builder = BUILDERS[reportType];
  if (!builder) return [];
  return builder(data.data as Record<string, unknown>, planetsOf(data.data as Record<string, unknown>));
}
