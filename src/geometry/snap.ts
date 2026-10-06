import type { Point } from '../model/types';
import { distance } from './polygon';

/** Rounds a point to the nearest grid step (mm). */
export function snapToGrid(p: Point, stepMm: number): Point {
  return [Math.round(p[0] / stepMm) * stepMm, Math.round(p[1] / stepMm) * stepMm];
}

/** Keeps the length from `from` to `to` but turns it to the nearest multiple of stepDeg. */
export function snapAngle(from: Point, to: Point, stepDeg = 45): Point {
  const length = distance(from, to);
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to[1] - from[1], to[0] - from[0]) / step) * step;
  return [Math.round(from[0] + length * Math.cos(angle)), Math.round(from[1] + length * Math.sin(angle))];
}

/** The nearest vertex within toleranceMm, or null. */
export function snapToVertex(p: Point, vertices: Point[], toleranceMm: number): Point | null {
  let best: Point | null = null;
  let bestDist = toleranceMm;
  for (const v of vertices) {
    const d = distance(p, v);
    if (d <= bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

/** The point at an exact length from `from`, in the direction of `toward`. Used for typed lengths. */
export function pointAtLength(from: Point, toward: Point, lengthMm: number): Point {
  const d = distance(from, toward);
  if (d === 0) return [Math.round(from[0] + lengthMm), from[1]];
  const k = lengthMm / d;
  return [Math.round(from[0] + (toward[0] - from[0]) * k), Math.round(from[1] + (toward[1] - from[1]) * k)];
}
