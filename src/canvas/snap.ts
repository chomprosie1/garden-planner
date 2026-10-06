// Where a pointer position lands once snapping is applied. Order of preference:
// an existing corner, then a 45° direction from the last point, then the grid.

import { distance } from '../geometry/polygon';
import type { Point } from '../model/types';

export interface SnapOptions {
  /** Points the pointer can snap onto. */
  vertices: Point[];
  /** The previous point while drawing, for angle snapping. */
  from?: Point;
  gridMm: number;
  /** Snap distance for corners, in mm at the current zoom. */
  toleranceMm: number;
  /** Alt held: no snapping at all. */
  free?: boolean;
  /** Shift held: always lock to 45° from the previous point. */
  forceAngle?: boolean;
}

export type SnapKind = 'vertex' | 'angle' | 'grid' | 'none';

export function snapPoint(p: Point, o: SnapOptions): { point: Point; kind: SnapKind } {
  const round = (q: Point): Point => [Math.round(q[0]), Math.round(q[1])];
  if (o.free) return { point: round(p), kind: 'none' };

  let best: Point | null = null;
  let bestD = o.toleranceMm;
  for (const v of o.vertices) {
    const d = distance(p, v);
    if (d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  if (best) return { point: best, kind: 'vertex' };

  if (o.from) {
    const dx = p[0] - o.from[0];
    const dy = p[1] - o.from[1];
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const angle = Math.atan2(dy, dx);
      const step = Math.PI / 4;
      const snapped = Math.round(angle / step) * step;
      const offBy = Math.abs(angle - snapped);
      if (o.forceAngle || offBy < (4 * Math.PI) / 180) {
        // Keep the direction exact and round the length to the grid.
        const l = Math.max(o.gridMm, Math.round(len / o.gridMm) * o.gridMm);
        return { point: round([o.from[0] + l * Math.cos(snapped), o.from[1] + l * Math.sin(snapped)]), kind: 'angle' };
      }
    }
  }

  const g = o.gridMm;
  return { point: [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g], kind: 'grid' };
}

/** Snap step for the pointer at a given zoom: fine when zoomed in, coarse when zoomed out. */
export function snapStepFor(scale: number): number {
  // Aim for a step of at least ~6 screen pixels.
  const steps = [10, 50, 100, 250, 500, 1000];
  return steps.find((s) => s * scale >= 6) ?? 1000;
}

/** Parses typed lengths: "3450", "3.45m", "345cm", "3450mm". Returns mm, or null. */
export function parseLength(text: string): number | null {
  const m = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? (m[1]!.includes('.') ? 'm' : 'mm');
  const mm = unit === 'm' ? n * 1000 : unit === 'cm' ? n * 10 : n;
  return mm > 0 ? Math.round(mm) : null;
}
