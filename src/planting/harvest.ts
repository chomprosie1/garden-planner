// The harvest log: what's been picked, as a rough size (a handful, a bowl, a
// basket) or weighed, and how much each crop gave this year. Pure functions.

import type { Garden, PickSize } from '../model/types';

/** About how much each size holds, in grams: a handful of beans, a bowl of tomatoes, a basket of potatoes. */
export const PICK_GRAMS: Record<PickSize, number> = { handful: 150, bowl: 500, basket: 2000 };

export const PICK_LABEL: Record<PickSize, string> = { handful: 'A handful', bowl: 'A bowl', basket: 'A basket' };

/** Logs a picking on a planting: a size, or grams if you weighed it. */
export function addPick(g: Garden, plantingId: string, date: string, amount: { size?: PickSize; grams?: number }): Garden {
  const grams = Math.max(0, Math.round(amount.grams ?? (amount.size ? PICK_GRAMS[amount.size] : 0)));
  if (!grams) return g;
  return {
    ...g,
    plantings: g.plantings.map((p) => (p.id === plantingId ? { ...p, picks: [...(p.picks ?? []), { date, grams, ...(amount.size && amount.grams === undefined ? { size: amount.size } : {}) }] } : p)),
  };
}

export interface CropTotal {
  plantId: string;
  grams: number;
  picks: number;
  first: string;
  last: string;
}

/** What each crop gave in a year, most first. */
export function picksIn(g: Garden, year: number): CropTotal[] {
  const by = new Map<string, CropTotal>();
  for (const pl of g.plantings)
    for (const k of pl.picks ?? []) {
      if (Number(k.date.slice(0, 4)) !== year) continue;
      const t = by.get(pl.plantId) ?? { plantId: pl.plantId, grams: 0, picks: 0, first: k.date, last: k.date };
      t.grams += k.grams;
      t.picks++;
      if (k.date < t.first) t.first = k.date;
      if (k.date > t.last) t.last = k.date;
      by.set(pl.plantId, t);
    }
  return [...by.values()].sort((a, b) => b.grams - a.grams || a.plantId.localeCompare(b.plantId));
}

/** "450 g", "6.2 kg". */
export const formatWeight = (grams: number): string => (grams >= 1000 ? `${(Math.round(grams / 100) / 10).toFixed(1)} kg` : `${Math.round(grams)} g`);
