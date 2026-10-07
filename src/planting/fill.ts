// Dropping a plant into a bed: one plant where it lands, a row across the bed,
// or the whole bed filled at the plant's spacing. The default suits the plant:
// carrots and onions in rows, a courgette on its own, lettuce filling the bed.

import { bounds, pointInPolygon } from '../geometry/polygon';
import type { Feature, Plant, Planting, Point } from '../model/types';
import { blockGrid, plantPositions, rowCount, spreadOf } from './place';

export type Fill = 'one' | 'row' | 'fill';

export const FILL_LABEL: Record<Fill, string> = { one: 'One', row: 'A row', fill: 'Fill the bed' };

/** The usual way to plant this in this bed or pot. */
export function defaultFill(plant: Plant, bed: Feature): Fill {
  const spread = spreadOf(plant);
  const s = plant.size.spacingMm;
  const b = bounds(bed.footprint);
  const narrow = b ? Math.min(b.maxX - b.minX, b.maxY - b.minY) : 0;
  const long = b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) : 0;
  // Big plants, and anywhere with room for only one, get one.
  if (spread >= 600 || plant.category === 'tree' || plant.category === 'shrub' || long < s * 2) return 'one';
  // A window box, trough or narrow bed: one row along it.
  if (narrow < s * 2) return 'row';
  if (bed.kind === 'pot') return 'fill';
  // Roots, onions, leeks, beans and peas are sown or planted in rows.
  const art = plant.art;
  if (art && (art.crop?.kind === 'root' || art.crop?.kind === 'pod' || art.form === 'clump' || art.form === 'climber')) return 'row';
  return 'fill';
}

/** Where a straight line through p, along the bed's longer side, crosses into and out of the bed. */
function rowThrough(bed: Feature, p: Point): [Point, Point] | null {
  const b = bounds(bed.footprint);
  if (!b) return null;
  const across = b.maxX - b.minX >= b.maxY - b.minY;
  const k = across ? p[1] : p[0];
  const hits: number[] = [];
  const pts = bed.footprint;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    const [a1, a2, c1, c2] = across ? [a[1], a[0], c[1], c[0]] : [a[0], a[1], c[0], c[1]];
    if ((a1 <= k && c1 > k) || (c1 <= k && a1 > k)) hits.push(a2 + ((k - a1) / (c1 - a1)) * (c2 - a2));
  }
  hits.sort((x, y) => x - y);
  const along = across ? p[0] : p[1];
  for (let i = 0; i + 1 < hits.length; i += 2) {
    if (along >= hits[i]! - 1 && along <= hits[i + 1]! + 1) {
      const lo = hits[i]!;
      const hi = hits[i + 1]!;
      return across ? [[lo, k], [hi, k]] : [[k, lo], [k, hi]];
    }
  }
  return null;
}

const inside = (bed: Feature, pts: Point[]) => pts.every((q) => pointInPolygon(q, bed.footprint));

/** The planting for a fill, in a bed, from where the plant was dropped. */
export function fillPlanting(plant: Plant, bed: Feature, fill: Fill, at: Point): Pick<Planting, 'layout' | 'x' | 'y'> & Partial<Pick<Planting, 'endPoint' | 'count'>> {
  const one = { layout: 'single' as const, x: Math.round(at[0]), y: Math.round(at[1]) };
  const s = plant.size.spacingMm;
  if (fill === 'row') {
    const line = rowThrough(bed, at);
    if (!line) return one;
    const [a, c] = line;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < s * 1.5) return one;
    // Half a spacing in from each end, so the end plants aren't on the bed's edge.
    const k = s / 2 / len;
    const start: Point = [Math.round(a[0] + (c[0] - a[0]) * k), Math.round(a[1] + (c[1] - a[1]) * k)];
    const end: Point = [Math.round(c[0] - (c[0] - a[0]) * k), Math.round(c[1] - (c[1] - a[1]) * k)];
    return { layout: 'row', x: start[0], y: start[1], endPoint: end, count: rowCount(start, end, s) };
  }
  if (fill === 'fill') {
    const b = bounds(bed.footprint);
    if (!b) return one;
    // The bed's own box, shrunk until every plant is inside it: for curved beds and pots, and beds at an angle.
    for (let shrink = 0; shrink < 40; shrink++) {
      const d = (shrink * s) / 4;
      const min: Point = [Math.round(b.minX + d), Math.round(b.minY + d)];
      const max: Point = [Math.round(b.maxX - d), Math.round(b.maxY - d)];
      if (max[0] - min[0] < s || max[1] - min[1] < s) break;
      const trial: Planting = { id: '', plantId: plant.id, featureId: bed.id, layout: 'block', x: min[0], y: min[1], endPoint: max };
      const { cols, rows } = blockGrid(min, max, s);
      if (cols * rows < 2) break;
      if (inside(bed, plantPositions(trial, plant))) return { layout: 'block', x: min[0], y: min[1], endPoint: max };
    }
    // Too small to fill: one in the middle.
    return { layout: 'single', x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) };
  }
  return one;
}

/** Which fills make sense here: a row needs room for two plants, a fill room for a few. */
export function fillsFor(plant: Plant, bed: Feature): Fill[] {
  const b = bounds(bed.footprint);
  const s = plant.size.spacingMm;
  const long = b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) : 0;
  const short = b ? Math.min(b.maxX - b.minX, b.maxY - b.minY) : 0;
  return (['one', 'row', 'fill'] as Fill[]).filter((f) => f === 'one' || (f === 'row' ? long >= s * 2 : short >= s && long >= s * 2));
}
