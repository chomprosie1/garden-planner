// Smooth curves through a shape's corners, for curved beds, lawns and paths.
// The curve passes through every corner (centripetal Catmull-Rom), so dragging
// a corner moves the curve with it, and it never loops or overshoots into cusps.
// The result is a dense polygon in integer mm, which everything else (area,
// plant checks, shadows, sun hours) treats like any other outline.

import { distance } from './polygon';
import type { Point } from '../model/types';

/** About how far apart the curve's points are, mm. */
const STEP_MM = 150;
const MIN_STEPS = 4;
const MAX_STEPS = 24;

/** Points along one span from p1 to p2 (not including p2), with p0 and p3 as its neighbours. */
function span(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  const d = distance(p1, p2);
  if (d < 1) return [p1];
  const steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.ceil(d / STEP_MM)));
  // Centripetal parameterisation: knot gaps are the square root of the distances.
  const knot = (a: Point, b: Point) => Math.max(Math.sqrt(distance(a, b)), 1e-3);
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const lerp = (a: Point, b: Point, ta: number, tb: number, t: number): Point => {
    const k = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const out: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = t1 + ((t2 - t1) * i) / steps;
    const a1 = lerp(p0, p1, t0, t1, t);
    const a2 = lerp(p1, p2, t1, t2, t);
    const a3 = lerp(p2, p3, t2, t3, t);
    const b1 = lerp(a1, a2, t0, t2, t);
    const b2 = lerp(a2, a3, t1, t3, t);
    const c = lerp(b1, b2, t1, t2, t);
    out.push([Math.round(c[0]), Math.round(c[1])]);
  }
  return out;
}

/** Drops repeated points, which make zero-length edges. */
function dedupe(pts: Point[], closed: boolean): Point[] {
  const out = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1]![0] || p[1] !== pts[i - 1]![1]);
  if (closed && out.length > 1 && out[0]![0] === out[out.length - 1]![0] && out[0]![1] === out[out.length - 1]![1]) out.pop();
  return out;
}

/** A smooth closed outline through these corners. */
export function smoothClosed(corners: Point[]): Point[] {
  const pts = dedupe(corners, true);
  const n = pts.length;
  if (n < 3) return pts;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) out.push(...span(pts[(i - 1 + n) % n]!, pts[i]!, pts[(i + 1) % n]!, pts[(i + 2) % n]!));
  return dedupe(out, true);
}

/** A smooth line through these points, from the first to the last. */
export function smoothOpen(points: Point[]): Point[] {
  const pts = dedupe(points, false);
  const n = pts.length;
  if (n < 3) return pts;
  // Mirror the ends, so the curve leaves the first point and reaches the last one heading straight on.
  const before: Point = [2 * pts[0]![0] - pts[1]![0], 2 * pts[0]![1] - pts[1]![1]];
  const after: Point = [2 * pts[n - 1]![0] - pts[n - 2]![0], 2 * pts[n - 1]![1] - pts[n - 2]![1]];
  const all = [before, ...pts, after];
  const out: Point[] = [];
  for (let i = 1; i < all.length - 2; i++) out.push(...span(all[i - 1]!, all[i]!, all[i + 1]!, all[i + 2]!));
  out.push(pts[n - 1]!);
  return dedupe(out, false);
}
