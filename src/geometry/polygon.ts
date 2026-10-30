import type { Point } from '../model/types';

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Shoelace area: positive when the points run anticlockwise (y up). */
export function signedArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Area in mm². */
export function polygonArea(poly: Point[]): number {
  return Math.abs(signedArea(poly));
}

export function perimeter(poly: Point[]): number {
  let total = 0;
  for (let i = 0; i < poly.length; i++) total += distance(poly[i]!, poly[(i + 1) % poly.length]!);
  return total;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(points: Point[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Area-weighted centre of a polygon; falls back to the average of its points. */
export function centroid(poly: Point[]): Point {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    const k = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * k;
    cy += (y1 + y2) * k;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/** Total length of an open line. */
export function lineLength(line: Point[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distance(line[i - 1]!, line[i]!);
  return total;
}

/** Shortest distance from p to the segment a–b, and the closest point on it. */
/** Whether two lines truly cross: touching or lying along each other doesn't count. */
export function segmentsCross(a: [Point, Point], b: [Point, Point]): boolean {
  const cross = (o: Point, p: Point, q: Point) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(b[0], b[1], a[0]);
  const d2 = cross(b[0], b[1], a[1]);
  const d3 = cross(a[0], a[1], b[0]);
  const d4 = cross(a[0], a[1], b[1]);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Whether a shape goes outside an outline: a point of it out past the edge, a corner of the outline inside it, or their
 * edges crossing, as when a bed spans a notch with all its own corners in. Flush along an edge, within a little, isn't.
 */
export function spillsOver(shape: Point[], outline: Point[], tolerance = 10): boolean {
  const onEdge = (p: Point, poly: Point[]) => poly.some((a, i) => distanceToSegment(p, a, poly[(i + 1) % poly.length]!).distance <= tolerance);
  const edgesOf = (poly: Point[]) => poly.map((p, i): [Point, Point] => [p, poly[(i + 1) % poly.length]!]);
  if (shape.some((p) => !pointInPolygon(p, outline) && !onEdge(p, outline))) return true;
  if (outline.some((p) => pointInPolygon(p, shape) && !onEdge(p, shape))) return true;
  return edgesOf(shape).some((s) => edgesOf(outline).some((o) => segmentsCross(s, o)));
}

export function distanceToSegment(p: Point, a: Point, b: Point): { distance: number; point: Point; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const point: Point = [a[0] + t * dx, a[1] + t * dy];
  return { distance: distance(p, point), point, t };
}

/** Ray-casting test. Points exactly on an edge may fall either way. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
