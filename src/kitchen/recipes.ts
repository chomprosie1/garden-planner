// From plot to plate: what's cropping this week, recipes that use it, how to
// store and keep each crop, and what the year's picks would have cost in the
// shops. Pure functions; the data (data/kitchen/*.json) is loaded by
// src/kitchen/data.ts, and comes in as an argument.

import { stageIn, timeline } from '../lifecycle/projection';
import { addDays, dayNumber } from '../model/dates';
import type { Garden, Plant } from '../model/types';
import { picksIn } from '../planting/harvest';
import type { Weather } from '../weather/weather';

/** Ways a crop keeps: where, and how it's preserved. */
export const KEEPS = ['fridge', 'cool', 'room', 'ground', 'freeze', 'dry', 'pickle', 'jam', 'chutney', 'sauce'] as const;
export type Keep = (typeof KEEPS)[number];

export const KEEP_LABEL: Record<Keep, string> = {
  fridge: 'Fridge',
  cool: 'Somewhere cool',
  room: 'Room temperature',
  ground: 'Left in the ground',
  freeze: 'Freezes',
  dry: 'Dries',
  pickle: 'Pickles',
  jam: 'Jam or jelly',
  chutney: 'Chutney',
  sauce: 'Sauce',
};

/** A crop in the kitchen: how to store it, keep it and use it, and a rough shop price. */
export interface CropKitchen {
  store: string;
  preserve: string;
  use: string;
  /** About what it costs in the shops, £ a kilo (autumn 2026). */
  kg: number;
  keeps: Keep[];
}

export interface Recipe {
  id: string;
  title: string;
  /** The crops it uses from the garden, the main one first. */
  crops: string[];
  /** Months it's in season, 1 to 12. */
  months: number[];
  minutes: number;
  serves: number;
  ingredients: string[];
  method: string[];
}

export interface Kitchen {
  crops: Record<string, CropKitchen>;
  recipes: Recipe[];
}

/** The crop a plant's kitchen notes and recipes are under: its own id, or for a variety, its parent's. */
export function cropOf(kitchen: Kitchen, id: string, plantOf?: (id: string) => Plant): string | null {
  if (kitchen.crops[id]) return id;
  const parent = plantOf?.(id).varietyOf;
  return parent && kitchen.crops[parent] ? parent : null;
}

/** How far ahead "this week" looks for crops coming ready, and how far back a pick counts. */
const AHEAD_DAYS = 6;
const PICKED_DAYS = 10;

/**
 * What's cropping this week: plantings ready to pick today or in the next few days (from the year's timeline), and
 * crops picked in the last ten days. Plant ids, each once, with the kitchen's crops only.
 */
export function croppingNow(g: Garden, plantOf: (id: string) => Plant, kitchen: Kitchen, today: string, weather: Weather | null = null): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    const crop = cropOf(kitchen, id, plantOf);
    if (crop && !out.includes(crop)) out.push(crop);
  };
  for (const pl of g.plantings) {
    if (pl.removedOn || !cropOf(kitchen, pl.plantId, plantOf)) continue;
    const picked = (pl.picks ?? []).some((k) => k.date <= today && dayNumber(today) - dayNumber(k.date) <= PICKED_DAYS);
    if (picked) {
      add(pl.plantId);
      continue;
    }
    const steps = timeline(plantOf(pl.plantId), pl, g, today, weather);
    if (stageIn(steps, today).stage === 'harvesting' || stageIn(steps, addDays(today, AHEAD_DAYS)).stage === 'harvesting') add(pl.plantId);
  }
  return out;
}

/**
 * Recipes for what's cropping, a few at a time: the ones that use most of it, the main crop counting double, in season
 * first. Each new pick favours crops the others haven't used, so three tomato recipes don't crowd out the beans.
 */
export function recipesFor(crops: string[], month: number, recipes: Recipe[], n = 3): Recipe[] {
  const have = new Set(crops);
  const scored = recipes
    .map((r) => ({ r, used: r.crops.filter((c) => have.has(c)), main: have.has(r.crops[0]!) }))
    .filter((x) => x.used.length > 0);
  const picked: Recipe[] = [];
  const covered = new Set<string>();
  while (picked.length < n) {
    let best: (typeof scored)[number] | null = null;
    let bestScore = -1;
    for (const x of scored) {
      if (picked.includes(x.r)) continue;
      const fresh = x.used.filter((c) => !covered.has(c)).length;
      const score = fresh * 3 + x.used.length + (x.main ? 2 : 0) + (x.r.months.includes(month) ? 2 : 0) - x.r.crops.filter((c) => !have.has(c)).length * 0.5;
      if (score > bestScore || (score === bestScore && best && x.r.title < best.r.title)) {
        best = x;
        bestScore = score;
      }
    }
    if (!best) break;
    picked.push(best.r);
    best.used.forEach((c) => covered.add(c));
  }
  return picked;
}

/** Recipes using a crop: in season first, then where it's the main crop, then by name. */
export function recipesWith(crop: string, recipes: Recipe[], month: number | null = null): Recipe[] {
  const rank = (r: Recipe) => (month !== null && r.months.includes(month) ? 0 : 2) + (r.crops[0] === crop ? 0 : 1);
  return recipes.filter((r) => r.crops.includes(crop)).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

export interface CropWorth {
  plantId: string;
  grams: number;
  pounds: number;
}

/** What a year's picks would have cost in the shops: in all, and crop by crop, most first. */
export function harvestWorth(g: Garden, kitchen: Kitchen, year: number, plantOf?: (id: string) => Plant): { pounds: number; crops: CropWorth[] } {
  const price = (id: string) => kitchen.crops[cropOf(kitchen, id, plantOf) ?? '']?.kg ?? 0;
  const crops = picksIn(g, year)
    .map((t) => ({ plantId: t.plantId, grams: t.grams, pounds: (t.grams / 1000) * price(t.plantId) }))
    .filter((c) => c.pounds > 0)
    .sort((a, b) => b.pounds - a.pounds);
  return { pounds: crops.reduce((a, c) => a + c.pounds, 0), crops };
}

/** "about £143", "about £4", "under £1". */
export function poundsText(pounds: number): string {
  if (pounds < 1) return 'under £1';
  return `about £${Math.round(pounds).toLocaleString('en-GB')}`;
}

/** "20 min", "1 hr 15 min", "3 hr". */
export function minutesText(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}
