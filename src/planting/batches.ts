// Sowing little and often: a row or block split into batches, each sown a few
// weeks after the last, so a crop like lettuce or radish comes in a steady
// trickle rather than all at once. Each batch is its own planting, with the
// date you mean to sow it; the year's projections and the month's jobs follow
// each one. Pure functions: garden in, garden out, so a split is one undo step.

import { addDays } from '../model/dates';
import { newId } from '../model/ids';
import type { Garden, Plant, Planting, Point } from '../model/types';
import { currentStage, perennial } from '../lifecycle/stages';
import { plantCount } from './place';

export const MIN_BATCHES = 2;
export const MAX_BATCHES = 6;

/** Rows and blocks of a plant raised from seed, not sown yet and not already in batches. Perennials stay put. */
export function canSowInBatches(plant: Plant, pl: Planting): boolean {
  if (pl.layout !== 'row' && pl.layout !== 'block') return false;
  if (!plant.sowing?.length || perennial(plant) || pl.batch || pl.removedOn) return false;
  return currentStage(pl) === 'planned';
}

/** The dates each batch is to be sown: the first, then every so many days. */
export const batchDates = (first: string, batches: number, everyDays: number): string[] => Array.from({ length: batches }, (_, i) => addDays(first, i * everyDays));

const lerp = (a: Point, b: Point, t: number): Point => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];

/** The pieces of a row or block, in order from its start: shorter rows, a plant's spacing apart, or strips across a block's longer side. */
export function splitShape(pl: Planting, plant: Plant, batches: number): { start: Point; end: Point; count?: number }[] {
  const a: Point = [pl.x, pl.y];
  const b = pl.endPoint ?? a;
  const out: { start: Point; end: Point; count?: number }[] = [];
  if (pl.layout === 'row') {
    const total = plantCount(pl, plant);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Each batch's share of the plants, the first ones taking any left over.
    for (let i = 0, given = 0; i < batches; i++) {
      const count = Math.max(1, Math.floor(total / batches) + (i < total % batches ? 1 : 0));
      const t0 = length ? given / Math.max(1, total - 1) : 0;
      const t1 = length ? Math.min(1, (given + count - 1) / Math.max(1, total - 1)) : 0;
      out.push({ start: lerp(a, b, t0), end: lerp(a, b, t1), count });
      given += count;
    }
    return out;
  }
  // A block: strips across its longer side.
  const wide = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  for (let i = 0; i < batches; i++) {
    const [t0, t1] = [i / batches, (i + 1) / batches];
    const start: Point = wide ? [Math.round(a[0] + (b[0] - a[0]) * t0), a[1]] : [a[0], Math.round(a[1] + (b[1] - a[1]) * t0)];
    const end: Point = wide ? [Math.round(a[0] + (b[0] - a[0]) * t1), b[1]] : [b[0], Math.round(a[1] + (b[1] - a[1]) * t1)];
    out.push({ start, end });
  }
  return out;
}

/** The most batches a planting can be split into: one plant each for a row, a plant's spacing wide for a block's strips. */
export function maxBatches(pl: Planting, plant: Plant): number {
  const a: Point = [pl.x, pl.y];
  const b = pl.endPoint ?? a;
  const fit = pl.layout === 'row' ? plantCount(pl, plant) : Math.floor(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / plant.size.spacingMm);
  return Math.max(0, Math.min(MAX_BATCHES, fit));
}

/**
 * Splits a row or block into batches, sown `everyDays` apart from `first`. The first batch keeps the planting's id
 * (and its notes); the others are new. Returns the garden unchanged if it can't be split.
 */
export function splitIntoBatches(g: Garden, id: string, plant: Plant, batches: number, everyDays: number, first: string): Garden {
  const pl = g.plantings.find((p) => p.id === id);
  if (!pl || !canSowInBatches(plant, pl)) return g;
  const n = Math.round(batches);
  if (n < MIN_BATCHES || n > maxBatches(pl, plant)) return g;
  const group = newId('b');
  const dates = batchDates(first, n, everyDays);
  const pieces = splitShape(pl, plant, n).map((s, i): Planting => {
    const { count: _c, ...rest } = pl;
    const next: Planting = { ...rest, id: i === 0 ? pl.id : newId('p'), x: s.start[0], y: s.start[1], endPoint: s.end, sowBy: dates[i]!, batch: { group, n: i + 1, of: n } };
    if (s.count !== undefined) next.count = s.count;
    return next;
  });
  const at = g.plantings.indexOf(pl);
  return { ...g, plantings: [...g.plantings.slice(0, at), ...pieces, ...g.plantings.slice(at + 1)] };
}

/** The other batches sown with this one, in order. */
export const batchesOf = (g: Garden, pl: Planting): Planting[] =>
  pl.batch ? g.plantings.filter((p) => p.batch?.group === pl.batch!.group).sort((a, b) => a.batch!.n - b.batch!.n) : [pl];

/** Moves a batch's sowing date. */
export function setSowBy(g: Garden, id: string, date: string): Garden {
  return { ...g, plantings: g.plantings.map((p) => (p.id === id ? { ...p, sowBy: date } : p)) };
}

/** "Batch 2 of 3". */
export const batchLabel = (pl: Planting): string | null => (pl.batch ? `Batch ${pl.batch.n} of ${pl.batch.of}` : null);
