export interface MoneyAxisScores {
  wealthPotential: number;
  careerGrowth: number;
  businessLuck: number;
  propertyAssets: number;
  investmentSense: number;
  financialStability: number;
}

export function val(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

export function str(v: unknown, fallback = "N/A"): string {
  if (v == null || v === "") return fallback;
  return String(v);
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function avg(...xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Vedic house strength: kendra/trikona/wealth strong, dusthana weak. */
export function houseStrength(house: number): number {
  if (house <= 0) return 0;
  if ([1, 4, 5, 7, 9, 10].includes(house)) return 2;
  if ([2, 11].includes(house)) return 2;
  if ([3, 6].includes(house)) return 1;
  if ([8, 12].includes(house)) return -2;
  return 0;
}

function planetStrength(planets: Record<string, unknown>[], name: string): number {
  const p = planets.find(
    (x) => str(val(x, "name") ?? val(x, "planet_name")).toLowerCase() === name,
  );
  if (!p) return 0;
  const house = Number(val(p, "position") ?? val(p, "house")) || 0;
  return houseStrength(house);
}

export function calculateMoneyAxisScores(data: Record<string, unknown>): MoneyAxisScores {
  const planets = ((data.planet_positions ?? data.planets) ?? []) as Record<string, unknown>[];
  const yogas = (data.yoga_details ?? []) as Record<string, unknown>[];

  const sun = planetStrength(planets, "sun");
  const moon = planetStrength(planets, "moon");
  const mars = planetStrength(planets, "mars");
  const mercury = planetStrength(planets, "mercury");
  const jupiter = planetStrength(planets, "jupiter");
  const venus = planetStrength(planets, "venus");
  const saturn = planetStrength(planets, "saturn");

  const flatYogas = flattenYogas(yogas);
  const hasLakshmiYoga = flatYogas.some((y) => y.name.toLowerCase().includes("lakshmi"));
  const hasDhanaYoga = flatYogas.some((y) => y.name.toLowerCase().includes("dhana"));
  const bonus = (hasLakshmiYoga ? 1 : 0) + (hasDhanaYoga ? 1 : 0);

  const score = (strengths: number[], extra = 0) =>
    clampScore(5 + 1.5 * avg(...strengths) + extra);

  return {
    wealthPotential: score([jupiter, venus, moon], bonus),
    careerGrowth: score([saturn, sun, mars], bonus),
    businessLuck: score([mercury, jupiter, moon], bonus),
    propertyAssets: score([venus, mars, moon]),
    investmentSense: score([mercury, saturn]),
    financialStability: score([jupiter, saturn, moon], bonus),
  };
}

export interface FlatYoga {
  category: string;
  name: string;
  hasYoga: boolean;
  description: string;
}

/** yoga_details is a list of categories, each with a nested yoga_list. */
export function flattenYogas(yogaDetails: unknown): FlatYoga[] {
  const out: FlatYoga[] = [];
  if (!Array.isArray(yogaDetails)) return out;
  for (const cat of yogaDetails as Record<string, unknown>[]) {
    const category = str(val(cat, "name"), "Yogas");
    const list = (val(cat, "yoga_list") ?? []) as Record<string, unknown>[];
    if (Array.isArray(list) && list.length) {
      for (const y of list) {
        out.push({
          category,
          name: str(val(y, "name")),
          hasYoga: Boolean(val(y, "has_yoga")),
          description: str(val(y, "description"), ""),
        });
      }
    } else {
      out.push({
        category,
        name: category,
        hasYoga: true,
        description: str(val(cat, "description"), ""),
      });
    }
  }
  return out;
}
