// Finding your garden by a postcode or a place name, so nobody has to know
// their latitude. UK postcodes (whole, or just the first half, like "LS6") go
// to postcodes.io; anything else to Open-Meteo's place search, the same free,
// keyless service the weather comes from. Only what you type is sent, when you
// search.

export interface Place {
  /** "Headingley", "LS6 3AB". */
  name: string;
  /** "Leeds, England". */
  detail: string;
  lat: number;
  lon: number;
}

/** A UK postcode, whole ("LS6 3AB") or its first half ("LS6"). */
export const POSTCODE = /^\s*([A-Z]{1,2}\d[A-Z\d]?)(\s*\d[A-Z]{2})?\s*$/i;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const joined = (...parts: unknown[]) => [...new Set(parts.map(str).filter(Boolean))].join(', ');

/** A whole postcode from postcodes.io: { result: { postcode, latitude, longitude, admin_district, country } }. */
export function parsePostcode(json: unknown): Place[] {
  const r = (json as { result?: Record<string, unknown> } | null)?.result;
  if (!r || !num(r.latitude) || !num(r.longitude)) return [];
  return [{ name: str(r.postcode), detail: joined(r.admin_district, r.country), lat: r.latitude, lon: r.longitude }];
}

/** The first half of a postcode from postcodes.io: { result: { outcode, latitude, longitude, admin_district: [...] } }. */
export function parseOutcode(json: unknown): Place[] {
  const r = (json as { result?: Record<string, unknown> } | null)?.result;
  if (!r || !num(r.latitude) || !num(r.longitude)) return [];
  const district = Array.isArray(r.admin_district) ? r.admin_district[0] : r.admin_district;
  return [{ name: str(r.outcode), detail: joined(district, Array.isArray(r.country) ? r.country[0] : r.country), lat: r.latitude, lon: r.longitude }];
}

/** Places from Open-Meteo's search: { results: [{ name, latitude, longitude, admin2, admin1, country }] }. */
export function parseGeocoding(json: unknown): Place[] {
  const results = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((x) => {
    const r = x as Record<string, unknown>;
    if (!num(r.latitude) || !num(r.longitude) || !str(r.name)) return [];
    return [{ name: str(r.name), detail: joined(r.admin2, r.admin1, r.country), lat: r.latitude, lon: r.longitude }];
  });
}

export function placeUrl(query: string): { url: string; kind: 'postcode' | 'outcode' | 'name' } {
  const q = query.trim();
  const m = POSTCODE.exec(q);
  if (m && m[2]) return { url: `https://api.postcodes.io/postcodes/${encodeURIComponent(q.replace(/\s+/g, ' ').toUpperCase())}`, kind: 'postcode' };
  if (m) return { url: `https://api.postcodes.io/outcodes/${encodeURIComponent(m[1]!.toUpperCase())}`, kind: 'outcode' };
  return { url: `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`, kind: 'name' };
}

/** Places matching what you typed; none if nothing matches. Throws if the search couldn't be made (offline, say). */
export async function searchPlaces(query: string, get: typeof fetch = fetch): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const { url, kind } = placeUrl(query);
  const res = await get(url);
  // postcodes.io says 404 for a postcode it doesn't know: that's no match, not a failure.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`The search said ${res.status}.`);
  const json = await res.json();
  return kind === 'postcode' ? parsePostcode(json) : kind === 'outcode' ? parseOutcode(json) : parseGeocoding(json);
}

/** "Headingley, Leeds": a place's name for the garden, with its district when that adds something. */
export const placeLabel = (p: Place): string => {
  const first = p.detail.split(', ')[0];
  return first && first !== p.name ? `${p.name}, ${first}` : p.name;
};

/** Rounded to about 10 m, as the location button does. */
export const round4 = (n: number) => Math.round(n * 10000) / 10000;
