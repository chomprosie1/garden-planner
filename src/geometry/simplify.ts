// Turns a hand-drawn stroke (hundreds of pointer points) into a few corners
// that keep its shape: the Ramer-Douglas-Peucker method.

import { distanceToSegment } from './polygon';
import type { Point } from '../model/types';

/** Keeps the fewest points so that none of the stroke is further than toleranceMm from the result. */
export function simplify(points: Point[], toleranceMm: number): Point[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  // An explicit stack, so a long stroke can't overflow the call stack.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = toleranceMm;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i]!, points[a]!, points[b]!).distance;
      if (d > worstD) {
        worst = i;
        worstD = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies a closed loop: a stroke drawn round and back to near its start. */
export function simplifyClosed(points: Point[], toleranceMm: number): Point[] {
  if (points.length < 4) return points.slice();
  // Split the loop at the point furthest from the start, so neither half is degenerate.
  let far = 0;
  let farD = -1;
  points.forEach((p, i) => {
    const d = Math.hypot(p[0] - points[0]![0], p[1] - points[0]![1]);
    if (d > farD) {
      far = i;
      farD = d;
    }
  });
  const a = simplify(points.slice(0, far + 1), toleranceMm);
  const b = simplify([...points.slice(far), points[0]!], toleranceMm);
  return [...a, ...b.slice(1, -1)];
}
