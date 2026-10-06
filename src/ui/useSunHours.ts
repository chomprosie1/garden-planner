import { useEffect, useState } from 'preact/hooks';
import type { Garden } from '../model/types';
import { sunHours, type SunGrid } from '../sun/hours';

// Sun hours depend only on what casts shade and where the garden is, so a
// result is kept until one of those changes. Planting things doesn't redo it.
interface Key {
  features: Garden['features'];
  boundary: Garden['boundary'];
  latitude: number;
  longitude: number;
  north: number;
  month: number;
  year: number;
}
interface Entry {
  key: Key;
  grid: SunGrid | null;
}

const cache: Entry[] = [];
const KEEP = 6;
const same = (a: Key, b: Key) =>
  a.features === b.features && a.boundary === b.boundary && a.latitude === b.latitude && a.longitude === b.longitude && a.north === b.north && a.month === b.month && a.year === b.year;

const keyOf = (g: Garden, month: number, year: number): Key => ({
  features: g.features,
  boundary: g.boundary,
  latitude: g.latitude,
  longitude: g.longitude,
  north: g.northRotationDeg,
  month,
  year,
});

/**
 * Sun hours for the 15th of a month. Worked out just after the screen has drawn, so it never holds up a tap.
 * Returns undefined while working, and null when there's nothing to work out.
 */
export function useSunHours(g: Garden, month: number, year: number, enabled: boolean): SunGrid | null | undefined {
  const key = keyOf(g, month, year);
  const [entry, setEntry] = useState<Entry | null>(() => cache.find((c) => same(c.key, key)) ?? null);
  useEffect(() => {
    if (!enabled) return;
    const hit = cache.find((c) => same(c.key, key));
    if (hit) return setEntry(hit);
    const t = setTimeout(() => {
      const made = { key, grid: sunHours(g, month, year) };
      cache.unshift(made);
      cache.length = Math.min(cache.length, KEEP);
      setEntry(made);
    }, 30);
    return () => clearTimeout(t);
  }, [enabled, g.features, g.boundary, g.latitude, g.longitude, g.northRotationDeg, month, year]);
  if (!enabled) return null;
  return entry && same(entry.key, key) ? entry.grid : undefined;
}
