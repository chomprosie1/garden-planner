// Which things are worth drawing: those near the part of the garden on screen.

import type { Bounds } from '../geometry/polygon';
import { toWorld, type Viewport } from './viewport';

/** How far past the screen (mm) a planting may sit and still be drawn, on top of its own radius. */
export const CULL_PAD_MM = 1000;

/** True when `b`, grown by `padMm` on every side, overlaps `view`. Touching counts. */
export function inView(b: Bounds, view: Bounds, padMm: number): boolean {
  return b.maxX + padMm >= view.minX && b.minX - padMm <= view.maxX && b.maxY + padMm >= view.minY && b.minY - padMm <= view.maxY;
}

/** The garden rectangle (mm) a canvas of `width` x `height` px shows under `v`: the box round its four corners. */
export function viewBounds(v: Viewport, width: number, height: number): Bounds {
  const a = toWorld(v, [0, 0]);
  const b = toWorld(v, [width, 0]);
  const c = toWorld(v, [0, height]);
  const d = toWorld(v, [width, height]);
  return {
    minX: Math.min(a[0], b[0], c[0], d[0]),
    minY: Math.min(a[1], b[1], c[1], d[1]),
    maxX: Math.max(a[0], b[0], c[0], d[0]),
    maxY: Math.max(a[1], b[1], c[1], d[1]),
  };
}
