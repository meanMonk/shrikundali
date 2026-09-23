import { calculateMoneyAxisScores, val, str, type MoneyAxisScores } from "./scores.js";
import type { KundliData } from "./prokerala.js";
import type { BirthDetails, ReportType } from "./store.js";

export interface Teaser {
  name: string;
  birthDetails: { date: string; time: string; location: string };
  lagna: { name: string; lord: string };
  rashi: { name: string; lord: string };
  nakshatra: { name: string; lord: string; pada: number };
  planetSummary: { name: string; sign: string }[];
  moneyAxisScores?: MoneyAxisScores;
  mangalDosha: boolean;
  majorYogas: number;
}

/** Locked sections shown per kundali type. */
export const LOCKED_SECTIONS: Record<ReportType, string[]> = {
  financial_kundali: [
    "Detailed planet positions & degrees",
    "House (Bhava) analysis",
    "Dasha periods & timing",
    "Complete yoga interpretations",
    "Dosha analysis & remedies",
    "Numerology insights",
    "Full PDF report download",
  ],
  marriage_kundali: [
    "7th house & marriage-timing analysis",
    "Venus & Jupiter placement reading",
    "Favourable marriage windows (dasha)",
    "Delay & dosha checks with remedies",
    "Compatibility pointers",
    "Full PDF report download",
  ],
  career_kundali: [
    "10th house & career-path analysis",
    "Saturn, Sun & Mars strength reading",
    "Job-change & promotion windows (dasha)",
    "Business vs. job suitability",
    "Periods to avoid major moves",
    "Full PDF report download",
  ],
  dosha_report: [
    "Manglik (Mangal) dosha check",
    "Kaal Sarp dosha check",
    "Pitra & Shani dosha check",
    "Sade Sati status",
    "Simple, practical remedies",
    "Full PDF report download",
  ],
  match_kundali: [
    "Gun Milan (36 points)",
    "Mental compatibility",
    "Physical compatibility",
    "Financial compatibility",
    "Dosha analysis & remedies",
    "Full PDF report download",
  ],
  health_kundali: [
    "6th house & vitality analysis",
    "Health-sensitive planetary periods",
    "Saturn & Mars affliction reading",
    "Preventive guidance",
    "Simple remedies",
    "Full PDF report download",
  ],
};

/**
 * Build the free teaser for a given kundali type from one chart.
 * `financial_kundali` also exposes the money-axis scores; other types will
 * add their own highlight block here as they are supported.
 */
export function buildTeaser(
  reportType: ReportType,
  parsed: KundliData,
  reportName: string,
  birth: BirthDetails,
): { teaser: Teaser; locked: string[] } {
  const d = parsed.data;
  const nd = val(d, "nakshatra_details") as Record<string, unknown> | undefined;
  const nakshatra = val(nd, "nakshatra") as Record<string, unknown> | undefined;
  const chandraRasi = val(nd, "chandra_rasi") as Record<string, unknown> | undefined;
  const nakLord = val(nakshatra, "lord") as Record<string, unknown> | undefined;
  const rasiLord = val(chandraRasi, "lord") as Record<string, unknown> | undefined;
  const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
  const yogas = (d.yoga_details ?? []) as Record<string, unknown>[];

  const planets = ((d.planet_positions ?? d.planets) ?? []) as Record<string, unknown>[];
  const ascendant = planets.find(
    (p) => str(val(p, "name")).toLowerCase() === "ascendant",
  );
  const ascRasi = val(ascendant, "rasi") as Record<string, unknown> | undefined;
  const ascLord = val(ascRasi, "lord") as Record<string, unknown> | undefined;

  const planetSummary = planets
    .filter((p) => str(val(p, "name")).toLowerCase() !== "ascendant")
    .slice(0, 9)
    .map((p) => {
      const rasi = val(p, "rasi") as Record<string, unknown> | undefined;
      return {
        name: str(val(p, "planet_name") ?? val(p, "name")),
        sign: str(val(rasi, "name") ?? val(p, "sign_name")),
      };
    });

  const teaser: Teaser = {
    name: reportName,
    birthDetails: {
      date: birth.datetime.split("T")[0] ?? "",
      time: birth.datetime.split("T")[1]?.split("+")[0] ?? birth.datetime,
      location: birth.place || birth.coordinates,
    },
    lagna: {
      name: str(val(ascRasi, "name")),
      lord: str(val(ascLord, "name")),
    },
    rashi: {
      name: str(val(chandraRasi, "name")),
      lord: str(val(rasiLord, "name")),
    },
    nakshatra: {
      name: str(val(nakshatra, "name")),
      lord: str(val(nakLord, "name")),
      pada: Number(val(nakshatra, "pada")) || 0,
    },
    planetSummary,
    ...(reportType === "financial_kundali"
      ? { moneyAxisScores: calculateMoneyAxisScores(d as Record<string, unknown>) }
      : {}),
    mangalDosha: Boolean(val(md, "has_dosha")),
    majorYogas: yogas.length,
  };

  return { teaser, locked: LOCKED_SECTIONS[reportType] ?? LOCKED_SECTIONS.financial_kundali };
}
