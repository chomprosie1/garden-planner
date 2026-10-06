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
