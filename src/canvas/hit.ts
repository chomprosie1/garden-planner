// What is under the pointer. All distances are in mm.

import { distance, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import { centreLineOf } from '../model/features';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { byHeight, isActive, plantingShape, sizedPlant, spreadOf } from '../planting/place';
import { closest } from '../planting/rules';

function hits(f: Feature, p: Point, toleranceMm: number): boolean {
  if (f.circle) return distance(p, f.circle.centre) <= f.circle.radiusMm + toleranceMm;
  if (f.line) {
    const half = (f.widthMm ?? 100) / 2 + toleranceMm;
    const line = centreLineOf(f);
    for (let k = 1; k < line.length; k++) if (distanceToSegment(p, line[k - 1]!, line[k]!).distance <= half) return true;
    return false;
  }
  return f.footprint.length >= 3 && pointInPolygon(p, f.footprint);
}

/**
 * The topmost feature under p. Features later in the list are drawn on top, except surfaces (lawns, gravel),
 * which are always drawn underneath everything else, so they're picked last.
 */
export function hitFeature(g: Garden, p: Point, toleranceMm: number): Feature | null {
  for (const surfaces of [false, true])
    for (let i = g.features.length - 1; i >= 0; i--) {
      const f = g.features[i]!;
      if ((f.kind === 'surface') === surfaces && hits(f, p, toleranceMm)) return f;
    }
  return null;
}

export function hitVertex(points: Point[], p: Point, toleranceMm: number): number | null {
  let best: number | null = null;
  let bestD = toleranceMm;
  points.forEach((q, i) => {
    const d = distance(p, q);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** The edge nearest p within tolerance: the index of its first point, and the closest point on it. */
export function hitEdge(points: Point[], closed: boolean, p: Point, toleranceMm: number): { index: number; point: Point } | null {
  let best: { index: number; point: Point } | null = null;
  let bestD = toleranceMm;
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const r = distanceToSegment(p, points[i]!, points[(i + 1) % n]!);
    if (r.distance <= bestD) {
      bestD = r.distance;
      best = { index: i, point: [Math.round(r.point[0]), Math.round(r.point[1])] };
    }
  }
  return best;
}

/** The topmost growing planting under p: within half a plant's spread of any of its plants. */
export function hitPlanting(g: Garden, plantOf: (id: string) => Plant, p: Point, toleranceMm: number): Planting | null {
  // In the order they're drawn: the tallest is on top.
  const order = byHeight(g.plantings.filter(isActive), plantOf);
  for (let i = order.length - 1; i >= 0; i--) {
    const pl = order[i]!;
    const plant = sizedPlant(plantOf(pl.plantId), pl);
    if (closest(plantingShape(pl, plant), { kind: 'point', p }).d <= spreadOf(plant) / 2 + toleranceMm) return pl;
  }
  return null;
}
