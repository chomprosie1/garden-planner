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
  const t = text.trim().toLowerCase().replace(',', '.').replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  // Feet and inches: "6 ft", "8ft", 6', 5' 6", "6 ft 6 in", "10 inches".
  const feet = t.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?)?$/);
  const inches = t.match(/^(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")$/);
  if (feet || inches) {
    const mm = Math.round(Number(feet?.[1] ?? 0) * 304.8 + Number(feet?.[2] ?? inches?.[1] ?? 0) * 25.4);
    return mm > 0 ? mm : null;
  }
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? (m[1]!.includes('.') ? 'm' : 'mm')).replace(/^met.*/, 'm');
  const mm = unit === 'm' ? n * 1000 : unit === 'cm' ? n * 10 : n;
  return mm > 0 ? Math.round(mm) : null;
}

/**
 * A size typed in a field that's in metres or centimetres, mm: a bare number is in the field's unit, and anything with
 * a unit is read as written ("6 ft", "45 cm"). Null if it can't be read.
 */
export function sizeMm(text: string, unit: 'm' | 'cm'): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  if (/^(\d+\.?\d*|\.\d+)$/.test(t)) {
    const n = Number(t);
    if (n <= 0) return null;
    return Math.round(unit === 'm' ? n * 1000 : n * 10);
  }
  return parseLength(t);
}

/** The biggest a size goes in each unit, mm: a pot past 2 m, or anything past 100 m, is a slip. */
const MOST_MM = { cm: 2000, m: 100000 };

/** A typed size that makes sense, mm, or null: readable, at least 5 cm, and not past the most for its unit. */
export function sensibleSize(text: string, unit: 'm' | 'cm'): number | null {
  const mm = sizeMm(text, unit);
  return mm && mm >= 50 && mm <= MOST_MM[unit] ? mm : null;
}

/** A size as it's shown in a field in this unit: "30" for a pot, "2.4" for a bed. */
export const sizeField = (mm: number, unit: 'm' | 'cm'): string => String(unit === 'cm' ? Math.round(mm / 10) : +(mm / 1000).toFixed(2));

/** What a size field comes to. Left as it was shown, it's the exact size it was: a rounded figure isn't a change. Null if it makes no sense. */
export const typedSize = (text: string, was: number, unit: 'm' | 'cm'): number | null => (text.trim() === sizeField(was, unit) ? was : sensibleSize(text, unit));
