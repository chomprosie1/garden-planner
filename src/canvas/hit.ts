// What is under the pointer. All distances are in mm.

import { distance, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { isActive, plantingShape, spreadOf } from '../planting/place';
import { closest } from '../planting/rules';

/** The topmost feature under p (features later in the list are drawn on top). */
export function hitFeature(g: Garden, p: Point, toleranceMm: number): Feature | null {
  for (let i = g.features.length - 1; i >= 0; i--) {
    const f = g.features[i]!;
    if (f.circle) {
      if (distance(p, f.circle.centre) <= f.circle.radiusMm + toleranceMm) return f;
      continue;
    }
    if (f.line) {
      const half = (f.widthMm ?? 100) / 2 + toleranceMm;
      for (let k = 1; k < f.line.length; k++) if (distanceToSegment(p, f.line[k - 1]!, f.line[k]!).distance <= half) return f;
      continue;
    }
    if (f.footprint.length >= 3 && pointInPolygon(p, f.footprint)) return f;
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
  for (let i = g.plantings.length - 1; i >= 0; i--) {
    const pl = g.plantings[i]!;
    if (!isActive(pl)) continue;
    const plant = plantOf(pl.plantId);
    if (closest(plantingShape(pl, plant), { kind: 'point', p }).d <= spreadOf(plant) / 2 + toleranceMm) return pl;
  }
  return null;
}
