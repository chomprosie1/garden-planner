// Hours of direct sun across the garden on one day: a grid of cells, sampled
// every 15 minutes from sunrise to sunset. Each sample adds a quarter of an
// hour times the share of light that gets through whatever is in the way.

import { bounds } from '../geometry/polygon';
import { gardenBounds } from '../model/features';
import type { Garden, Point } from '../model/types';
import { sunAt, sunDay } from './position';
import { shadowsAt } from './shadow';

export const GRID_MM = 250;
export const SAMPLE_MINUTES = 15;

export interface SunGrid {
  /** Bottom-left corner of the first cell, mm. */
  x0: number;
  y0: number;
  step: number;
  cols: number;
  rows: number;
  /** Hours of sun per cell, row by row from the bottom. */
  hours: Float32Array;
  /** 1 for cells inside the boundary. */
  inside: Uint8Array;
  month: number;
  /** Most sun any open cell could get that day: sunrise to sunset. */
  maxHours: number;
}

/** Marks every cell whose centre is inside a polygon, by scanning across each row. */
function fillPolygon(poly: Point[], grid: { x0: number; y0: number; step: number; cols: number; rows: number }, mark: (i: number) => void) {
  const b = bounds(poly);
  if (!b) return;
  const { x0, y0, step, cols, rows } = grid;
  const r0 = Math.max(0, Math.ceil((b.minY - y0) / step - 0.5));
  const r1 = Math.min(rows - 1, Math.floor((b.maxY - y0) / step - 0.5));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const cy = y0 + (r + 0.5) * step;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!;
      const [xj, yj] = poly[j]!;
      if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k]! - x0) / step - 0.5));
      const c1 = Math.min(cols - 1, Math.floor((xs[k + 1]! - x0) / step - 0.5));
      for (let c = c0; c <= c1; c++) mark(r * cols + c);
    }
  }
}

/** Sun hours on the 15th of a month, over the garden's boundary (or everything drawn, if there's no boundary yet). */
export function sunHours(g: Garden, month: number, year = new Date().getFullYear(), step = GRID_MM): SunGrid | null {
  const area = g.boundary.length >= 3 ? bounds(g.boundary) : gardenBounds(g);
  if (!area) return null;
  const x0 = Math.floor(area.minX / step) * step;
  const y0 = Math.floor(area.minY / step) * step;
  const cols = Math.max(1, Math.ceil((area.maxX - x0) / step));
  const rows = Math.max(1, Math.ceil((area.maxY - y0) / step));
  const n = cols * rows;
  const grid = { x0, y0, step, cols, rows };

  const inside = new Uint8Array(n);
  if (g.boundary.length >= 3) fillPolygon(g.boundary, grid, (i) => (inside[i] = 1));
  else inside.fill(1);

  // Cells on top of each feature, which its own shadow doesn't cover.
  const own = new Map<string, Uint8Array>();
  for (const f of g.features) {
    if (!f.heightMm || f.footprint.length < 3) continue;
    const m = new Uint8Array(n);
    fillPolygon(f.footprint, grid, (i) => (m[i] = 1));
    own.set(f.id, m);
  }

  const hours = new Float32Array(n);
  const day = sunDay(year, month, 15, g.latitude, g.longitude);
  if (!day.sunrise || !day.sunset) return { ...grid, hours, inside, month, maxHours: 0 };
  const maxHours = (day.sunset.getTime() - day.sunrise.getTime()) / 3_600_000;

  const light = new Float32Array(n);
  const mark = new Uint8Array(n);
  const marked: number[] = [];
  const stepMs = SAMPLE_MINUTES * 60_000;
  for (let t = day.sunrise.getTime() + stepMs / 2; t - stepMs / 2 < day.sunset.getTime(); t += stepMs) {
    const sun = sunAt(new Date(t), g.latitude, g.longitude);
    const weight = Math.min(1, (day.sunset.getTime() - t + stepMs / 2) / stepMs) * (SAMPLE_MINUTES / 60);
    if (sun.altitude <= 0) continue;
    light.fill(1);
    for (const s of shadowsAt(g, sun, month)) {
      const ownCells = own.get(s.featureId);
      for (const poly of s.polygons)
        fillPolygon(poly, grid, (i) => {
          if (!mark[i]) {
            mark[i] = 1;
            marked.push(i);
          }
        });
      // Each feature dims a cell once, however many of its pieces cover it.
      for (const i of marked) {
        mark[i] = 0;
        if (!ownCells?.[i]) light[i]! *= 1 - s.opacity;
      }
      marked.length = 0;
    }
    for (let i = 0; i < n; i++) if (inside[i]) hours[i]! += light[i]! * weight;
  }
  return { ...grid, hours, inside, month, maxHours };
}

/** Sun hours at a point, or null outside the grid or the boundary. */
export function hoursAt(grid: SunGrid, p: Point): number | null {
  const c = Math.floor((p[0] - grid.x0) / grid.step);
  const r = Math.floor((p[1] - grid.y0) / grid.step);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
  const i = r * grid.cols + c;
  return grid.inside[i] ? grid.hours[i]! : null;
}

/** Average sun hours over some points, skipping any off the grid. */
export function averageHours(grid: SunGrid, pts: Point[]): number | null {
  const vals = pts.map((p) => hoursAt(grid, p)).filter((h): h is number => h !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Light the plant likes, as sun hours: full sun 6 or more, part shade 3 to 6, shade under 3. */
export function lightBand(hours: number): 'full-sun' | 'part-shade' | 'shade' {
  return hours >= 6 ? 'full-sun' : hours >= 3 ? 'part-shade' : 'shade';
}

/** Average sun hours over an area, such as a bed, from the cells whose centres fall inside it. */
export function areaHours(grid: SunGrid, poly: Point[]): number | null {
  let sum = 0;
  let count = 0;
  fillPolygon(poly, grid, (i) => {
    if (!grid.inside[i]) return;
    sum += grid.hours[i]!;
    count++;
  });
  return count ? sum / count : null;
}
