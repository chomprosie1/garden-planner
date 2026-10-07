// Greenhouses and cold frames as microclimates: warmer by day and at night
// than the garden around them. A planting in one, or in a bed inside one, is
// under cover: it can go in sooner, needs no hardening off and no winter
// protection, gets no rain, and grows faster in the warmth (warmth.ts adds
// the same gains to its growing degree days). Pure functions.

import { pointInPolygon } from '../geometry/polygon';
import type { Climate, Feature, Garden, Planting, Point, ShedPlace } from '../model/types';

export type CoverKind = 'greenhouse' | 'cold-frame';

/**
 * The usual gains, as rough averages for a UK spring: an unheated greenhouse runs about 8 °C warmer than outside on a
 * sunny day and 2 °C on a clear night; a cold frame about half that. A heated greenhouse is kept frost-free.
 */
export const DEFAULT_CLIMATE: Record<CoverKind, Climate> = {
  greenhouse: { heated: false, dayGainC: 8, nightGainC: 2 },
  'cold-frame': { heated: false, dayGainC: 4, nightGainC: 1 },
};

export const isCoverKind = (k: string): k is CoverKind => k === 'greenhouse' || k === 'cold-frame';

/** Greenhouses and cold frames drawn as areas: the things that cover what's in them. */
export const isCover = (f: Feature): boolean => isCoverKind(f.kind) && !f.line && !f.circle && f.footprint.length >= 3;

/** How much warmer a greenhouse or cold frame is: its own, or the usual for its kind. Null for anything else. */
export function climateOf(f: Feature): Climate | null {
  if (!isCover(f)) return null;
  return f.climate ?? DEFAULT_CLIMATE[f.kind as CoverKind];
}

export interface Cover {
  feature: Feature;
  climate: Climate;
}

/** Warmer covers first: heated, then by the night gain, which decides frost. */
const warmth = (c: Climate) => (c.heated ? 100 : 0) + c.nightGainC;

/** The cover over a point: the warmest greenhouse or cold frame it's in (a cold frame inside a greenhouse is both). */
export function microclimateAt(g: Garden, p: Point): Cover | null {
  let best: Cover | null = null;
  for (const f of g.features) {
    const climate = climateOf(f);
    if (!climate || !pointInPolygon(p, f.footprint)) continue;
    if (!best || warmth(climate) > warmth(best.climate)) best = { feature: f, climate };
  }
  return best;
}

/** The cover over a planting: the greenhouse or cold frame it's planted in, or the one its bed sits inside. */
export function microclimateOf(g: Garden, pl: Planting): Cover | null {
  const bed = g.features.find((f) => f.id === pl.featureId);
  const own = bed && climateOf(bed);
  const at = microclimateAt(g, [pl.x, pl.y]);
  if (own && (!at || warmth(own) >= warmth(at.climate))) return { feature: bed, climate: own };
  return at;
}

/**
 * The climate of a place in the Potting Shed: the greenhouse or cold frame it's linked to on the plan, or the usual
 * for a greenhouse bench or cold frame. Shelves, windowsills and propagators are in the house: null.
 */
export function placeClimate(g: Garden, place: ShedPlace): Climate | null {
  const linked = place.featureId ? g.features.find((f) => f.id === place.featureId) : undefined;
  const own = linked && climateOf(linked);
  if (own) return own;
  if (place.kind === 'greenhouse-bench') return DEFAULT_CLIMATE.greenhouse;
  if (place.kind === 'cold-frame') return DEFAULT_CLIMATE['cold-frame'];
  return null;
}

/** The shed place linked to a greenhouse or cold frame, if any. */
export const placeFor = (g: Garden, featureId: string): ShedPlace | undefined => (g.shedPlaces ?? []).find((p) => p.featureId === featureId);

/**
 * How many days sooner a cover's spring is, and how much later its autumn: about a week for each degree warmer at
 * night, which is how fast nights warm in a UK spring. Six weeks for a heated greenhouse, which is kept frost-free.
 */
export function frostShiftDays(c: Climate): number {
  if (c.heated) return 42;
  return Math.max(0, Math.min(42, Math.round(c.nightGainC * 7)));
}

/** "about two weeks", "about a week", "about six weeks". */
export function shiftText(days: number): string {
  const weeks = Math.round(days / 7);
  if (weeks <= 0) return 'a few days';
  if (weeks === 1) return 'about a week';
  const words = ['', '', 'two', 'three', 'four', 'five', 'six'];
  return `about ${words[weeks] ?? weeks} weeks`;
}

const signed = (n: number) => `+${Math.round(n * 10) / 10} °C`;

/** "about +8 °C by day and +2 °C at night", or for a heated one, "heated and kept frost-free, about +8 °C by day". */
export function climateText(c: Climate): string {
  return c.heated ? `heated and kept frost-free, about ${signed(c.dayGainC)} by day` : `about ${signed(c.dayGainC)} by day and ${signed(c.nightGainC)} at night`;
}

/** What being under cover changes, in a sentence. */
export function coverEffects(c: Climate): string {
  const sooner = frostShiftDays(c);
  const go = sooner ? `Plants can go in ${shiftText(sooner)} sooner than outside, and need` : 'Plants need';
  return `${go} no hardening off or winter protection, and crops come on faster in the warmth. Nothing under glass gets rain, so water everything.`;
}
