import type { Point } from '../model/types';

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (Andrew's monotone chain), anticlockwise, without collinear points. */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * A stroke drawn by hand as a rectangle, squared up: the smallest rectangle round it (at any angle, turned square to the
 * plan when it's within 8° of that), or null when the stroke isn't much like one. It's taken as a rectangle when what
 * it encloses fills 85% or more of that rectangle: a hand-drawn box does, a circle (79%) or a blob doesn't.
 */
export function rectangleOf(stroke: Point[]): Point[] | null {
  const hull = convexHull(stroke);
  if (hull.length < 3) return null;
  const area = (poly: Point[]) => Math.abs(poly.reduce((s, p, i) => s + (p[0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * p[1]), 0)) / 2;
  const enclosed = area(hull);
  if (enclosed <= 0) return null;
  // The smallest box round the hull has a side along one of its edges.
  let best: { angle: number; a: number; lo: Point; hi: Point } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i]!;
    const q = hull[(i + 1) % hull.length]!;
    const angle = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const [c, s] = [Math.cos(-angle), Math.sin(-angle)];
    const turned = hull.map(([x, y]) => [x * c - y * s, x * s + y * c] as Point);
    const xs = turned.map((t) => t[0]);
    const ys = turned.map((t) => t[1]);
    const lo: Point = [Math.min(...xs), Math.min(...ys)];
    const hi: Point = [Math.max(...xs), Math.max(...ys)];
    const a = (hi[0] - lo[0]) * (hi[1] - lo[1]);
    if (!best || a < best.a) best = { angle, a, lo, hi };
  }
  if (!best || enclosed / best.a < 0.85) return null;
  // Square to the plan when it's nearly so: a box drawn by hand is rarely meant at 5°.
  const quarter = Math.PI / 2;
  const off = best.angle - Math.round(best.angle / quarter) * quarter;
  if (Math.abs(off) <= (8 * Math.PI) / 180) {
    const xs = stroke.map((p) => p[0]);
    const ys = stroke.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(Math.round) as [number, number, number, number];
    return [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
  }
  const [c, s] = [Math.cos(best.angle), Math.sin(best.angle)];
  const back = ([x, y]: Point): Point => [Math.round(x * c - y * s), Math.round(x * s + y * c)];
  return [back(best.lo), back([best.hi[0], best.lo[1]]), back(best.hi), back([best.lo[0], best.hi[1]])];
}
