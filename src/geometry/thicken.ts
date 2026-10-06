import type { Point } from '../model/types';

/**
 * Turns a centre line (a fence, wall, hedge or path) into a footprint polygon
 * of the given width, with mitred corners. Sharp corners are capped at 4× the
 * half-width so a near-reversal doesn't throw a spike across the garden.
 */
export function thickenLine(line: Point[], widthMm: number): Point[] {
  if (line.length < 2) return [];
  const h = widthMm / 2;
  const left: Point[] = [];
  const right: Point[] = [];

  const normal = (a: Point, b: Point): [number, number] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };

  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    const nIn = i > 0 ? normal(line[i - 1]!, p) : null;
    const nOut = i < line.length - 1 ? normal(p, line[i + 1]!) : null;
    let ox: number;
    let oy: number;
    if (nIn && nOut) {
      const mx = nIn[0] + nOut[0];
      const my = nIn[1] + nOut[1];
      const mLen = Math.hypot(mx, my);
      if (mLen < 1e-9) {
        // Line doubles back on itself: fall back to the incoming normal.
        [ox, oy] = [nIn[0] * h, nIn[1] * h];
      } else {
        const ux = mx / mLen;
        const uy = my / mLen;
        const scale = Math.min(h / (ux * nIn[0] + uy * nIn[1]), 4 * h);
        [ox, oy] = [ux * scale, uy * scale];
      }
    } else {
      const n = (nIn ?? nOut)!;
      [ox, oy] = [n[0] * h, n[1] * h];
    }
    left.push([Math.round(p[0] + ox), Math.round(p[1] + oy)]);
    right.push([Math.round(p[0] - ox), Math.round(p[1] - oy)]);
  }
  return left.concat(right.reverse());
}
