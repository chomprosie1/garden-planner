// Converts between the garden (mm, y up) and the screen (CSS px, y down).
// Pure functions on a small immutable value, so they are easy to test.

import type { Bounds } from '../geometry/polygon';
import type { Point } from '../model/types';

export interface Viewport {
  /** Screen pixels per millimetre. */
  scale: number;
  /** Screen position of the garden's origin (0, 0). */
  ox: number;
  oy: number;
}

export const MIN_SCALE = 0.004; // about 250 m across 1000 px
export const MAX_SCALE = 2; // 2 px per mm

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function toScreen(v: Viewport, p: Point): Point {
  return [v.ox + p[0] * v.scale, v.oy - p[1] * v.scale];
}

export function toWorld(v: Viewport, s: Point): Point {
  return [(s[0] - v.ox) / v.scale, (v.oy - s[1]) / v.scale];
}

/** Zooms by `factor`, keeping the garden point under `at` (screen) where it is. */
export function zoomAt(v: Viewport, factor: number, at: Point): Viewport {
  const scale = clampScale(v.scale * factor);
  const w = toWorld(v, at);
  return { scale, ox: at[0] - w[0] * scale, oy: at[1] + w[1] * scale };
}

export function pan(v: Viewport, dx: number, dy: number): Viewport {
  return { ...v, ox: v.ox + dx, oy: v.oy + dy };
}

/** A view that shows `b` inside a screen of `width` × `height`, with a margin. */
export function fit(b: Bounds | null, width: number, height: number, marginPx = 48): Viewport {
  const box = b && b.maxX > b.minX && b.maxY > b.minY ? b : { minX: 0, minY: 0, maxX: 10000, maxY: 14000 };
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const scale = clampScale(Math.min((width - 2 * marginPx) / w, (height - 2 * marginPx) / h));
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return { scale, ox: width / 2 - cx * scale, oy: height / 2 + cy * scale };
}

/** Grid spacing for the current zoom: the finest step that stays at least `minPx` apart. */
export function gridStep(scale: number, minPx = 14): { minor: number; major: number } {
  const steps = [100, 500, 1000, 5000, 10000, 50000];
  const minor = steps.find((s) => s * scale >= minPx) ?? 50000;
  const major = minor === 100 ? 1000 : minor === 500 ? 5000 : minor === 1000 ? 5000 : minor * 5;
  return { minor, major };
}

/** A round length for the scale bar, about `targetPx` long on screen. */
export function scaleBarLength(scale: number, targetPx = 120): number {
  const nice = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const want = targetPx / scale;
  return nice.reduce((best, n) => (Math.abs(n - want) < Math.abs(best - want) ? n : best), nice[0]!);
}

/** "3.45 m", "850 mm", "12 m". */
export function formatLength(mm: number): string {
  const abs = Math.abs(mm);
  if (abs < 1000) return `${Math.round(mm)} mm`;
  const m = mm / 1000;
  return `${Number.isInteger(Math.round(m * 100) / 100) ? m.toFixed(0) : m.toFixed(2)} m`;
}

export function formatArea(mm2: number): string {
  const m2 = mm2 / 1_000_000;
  return `${m2 < 10 ? m2.toFixed(2) : m2.toFixed(1)} m²`;
}
