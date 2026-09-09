// Birthplace geocoding: Google Places Autocomplete (New) when an API key is configured,
// else a debounced Nominatim (OpenStreetMap) lookup, else a small static fallback table.

export interface GeoResult {
  lat: number;
  lon: number;
  label: string;
}

// Small last-resort table used only if both Google Places and Nominatim are unavailable
// or fail. Mumbai is the ultimate fallback since it is India's most common birth city
// in our funnel's historical traffic.
export const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.7041, lon: 77.1025 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  hyderabad: { lat: 17.385, lon: 78.4867 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  pune: { lat: 18.5204, lon: 73.8567 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  lucknow: { lat: 26.8467, lon: 80.9462 },
  surat: { lat: 21.1702, lon: 72.8311 },
  nagpur: { lat: 21.1458, lon: 79.0882 },
  indore: { lat: 22.7196, lon: 75.8577 },
  bhopal: { lat: 23.2599, lon: 77.4126 },
  patna: { lat: 25.5941, lon: 85.1376 },
  chandigarh: { lat: 30.7333, lon: 76.7794 },
  kanpur: { lat: 26.4499, lon: 80.3319 },
  nashik: { lat: 19.9975, lon: 73.7898 },
  varanasi: { lat: 25.3176, lon: 82.9739 },
};

export const DEFAULT_COORDS = CITY_COORDS.mumbai;

export function staticLookup(query: string): GeoResult | null {
  const key = query.trim().toLowerCase();
  for (const city of Object.keys(CITY_COORDS)) {
    if (key.includes(city)) {
      const { lat, lon } = CITY_COORDS[city];
      return { lat, lon, label: query };
    }
  }
  return null;
}

/** Debounced Nominatim (OpenStreetMap) place search. No API key required. */
export async function nominatimSearch(query: string): Promise<GeoResult[]> {
  if (!query || query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((d) => ({ lat: parseFloat(d.lat), lon: parseFloat(d.lon), label: d.display_name }));
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
