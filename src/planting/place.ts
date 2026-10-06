// Plantings: where plants sit in a bed. A planting is one plant, a row or a
// block of the same plant. Positions are worked out from the plant's spacing,
// so the saved planting stays small however many plants it holds.

import { distance, pointInPolygon } from '../geometry/polygon';
import { currentStage, isGrowingStage, setStage } from '../lifecycle/stages';
import { newId } from '../model/ids';
import type { Feature, FeatureKind, Garden, Plant, Planting, Point, SpacingStyle } from '../model/types';

export type Layout = NonNullable<Planting['layout']>;

/** Features plants can go in. */
export const CONTAINER_KINDS: FeatureKind[] = ['bed', 'greenhouse'];

/** More than this in one planting is almost always a mistake, and slow to draw. */
export const MAX_PLANTS = 5000;

export const isContainer = (f: Feature) => CONTAINER_KINDS.includes(f.kind) && !f.line && !f.circle;

/** The topmost bed or greenhouse under a point. */
export function containerAt(g: Garden, p: Point): Feature | null {
  for (let i = g.features.length - 1; i >= 0; i--) {
    const f = g.features[i]!;
    if (isContainer(f) && f.footprint.length >= 3 && pointInPolygon(p, f.footprint)) return f;
  }
  return null;
}

/** Stand-in for a plant that is no longer in the library or your own plants. */
export function unknownPlant(id: string): Plant {
  return {
    id,
    commonName: 'Unknown plant',
    category: 'vegetable',
    conditions: { light: 'full-sun' },
    size: { spacingMm: 300 },
    verified: false,
    userAdded: false,
  };
}

export const spreadOf = (p: Plant) => p.size.spreadMm ?? p.size.spacingMm;
export const rowSpacingOf = (p: Plant) => p.size.rowSpacingMm ?? p.size.spacingMm;

/** Plants that fit along a row from start to end, one at each end. */
export function rowCount(start: Point, end: Point, spacingMm: number): number {
  return Math.floor(distance(start, end) / spacingMm + 1e-6) + 1;
}

/** Columns and rows of a block, each plant given its spacing all round. */
export function blockGrid(a: Point, b: Point, spacingMm: number): { cols: number; rows: number } {
  const w = Math.abs(b[0] - a[0]);
  const h = Math.abs(b[1] - a[1]);
  return { cols: Math.max(1, Math.floor(w / spacingMm + 1e-6)), rows: Math.max(1, Math.floor(h / spacingMm + 1e-6)) };
}

/** How many plants a planting holds. */
export function plantCount(pl: Planting, plant: Plant): number {
  const end = pl.endPoint ?? [pl.x, pl.y];
  if (pl.layout === 'row') return pl.count ?? rowCount([pl.x, pl.y], end, plant.size.spacingMm);
  if (pl.layout === 'block') {
    const { cols, rows } = blockGrid([pl.x, pl.y], end, plant.size.spacingMm);
    return cols * rows;
  }
  return 1;
}

/** Where each plant in a planting sits. */
export function plantPositions(pl: Planting, plant: Plant): Point[] {
  const start: Point = [pl.x, pl.y];
  const end = pl.endPoint ?? start;
  if (pl.layout === 'row') {
    const n = Math.max(1, plantCount(pl, plant));
    if (n === 1) return [start];
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out.push([Math.round(start[0] + (end[0] - start[0]) * t), Math.round(start[1] + (end[1] - start[1]) * t)]);
    }
    return out;
  }
  if (pl.layout === 'block') {
    // A grid centred in the rectangle, so plants sit half a spacing in from its edges.
    const s = plant.size.spacingMm;
    const { cols, rows } = blockGrid(start, end, s);
    const x0 = Math.min(start[0], end[0]) + (Math.abs(end[0] - start[0]) - (cols - 1) * s) / 2;
    const y0 = Math.min(start[1], end[1]) + (Math.abs(end[1] - start[1]) - (rows - 1) * s) / 2;
    const out: Point[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([Math.round(x0 + c * s), Math.round(y0 + r * s)]);
    return out;
  }
  return [start];
}

/** The outline of the plants themselves: a point, a line, or an upright rectangle. */
export type PlantingShape = { kind: 'point'; p: Point } | { kind: 'segment'; a: Point; b: Point } | { kind: 'rect'; min: Point; max: Point };

export function plantingShape(pl: Planting, plant: Plant): PlantingShape {
  const pts = plantPositions(pl, plant);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (pts.length === 1) return { kind: 'point', p: first };
  if (pl.layout === 'row') return { kind: 'segment', a: first, b: last };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const min: Point = [Math.min(...xs), Math.min(...ys)];
  const max: Point = [Math.max(...xs), Math.max(...ys)];
  if (min[0] === max[0] || min[1] === max[1]) return { kind: 'segment', a: min, b: max };
  return { kind: 'rect', min, max };
}

export const isActive = (pl: Planting) => !pl.removedOn;
export const activePlantings = (g: Garden) => g.plantings.filter(isActive);

// ---------- Edits. Each returns a new Garden, so each is one undo step. ----------

export function makePlanting(plant: Plant, featureId: string, layout: Layout, start: Point, end?: Point, growing = false): Planting {
  const pl: Planting = { id: newId('p'), plantId: plant.id, featureId, x: Math.round(start[0]), y: Math.round(start[1]), layout };
  if (growing) pl.stage = 'transplanted';
  if (layout !== 'single' && end) pl.endPoint = [Math.round(end[0]), Math.round(end[1])];
  if (layout === 'row') pl.count = rowCount(start, end ?? start, plant.size.spacingMm);
  return pl;
}

export const addPlanting = (g: Garden, pl: Planting): Garden => ({ ...g, plantings: [...g.plantings, pl] });

export function updatePlanting(g: Garden, id: string, patch: Partial<Planting>): Garden {
  if (!g.plantings.some((p) => p.id === id)) return g;
  return { ...g, plantings: g.plantings.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

const shiftPoint = (p: Point, dx: number, dy: number): Point => [Math.round(p[0] + dx), Math.round(p[1] + dy)];

export const shiftPlanting = (pl: Planting, dx: number, dy: number): Planting => ({
  ...pl,
  x: Math.round(pl.x + dx),
  y: Math.round(pl.y + dy),
  ...(pl.endPoint ? { endPoint: shiftPoint(pl.endPoint, dx, dy) } : {}),
});

/** Moves a planting. If its first plant lands in a different bed, it now belongs to that bed. */
export function movePlanting(g: Garden, id: string, dx: number, dy: number): Garden {
  if (dx === 0 && dy === 0) return g;
  return {
    ...g,
    plantings: g.plantings.map((p) => {
      if (p.id !== id) return p;
      const moved = shiftPlanting(p, dx, dy);
      const bed = containerAt(g, [moved.x, moved.y]);
      return bed && bed.id !== p.featureId ? { ...moved, featureId: bed.id } : moved;
    }),
  };
}

/** Removes a planting completely, with its notes. For crops you've finished with, use harvestPlantings. */
export function deletePlanting(g: Garden, id: string): Garden {
  const plantings = g.plantings.filter((p) => p.id !== id);
  if (plantings.length === g.plantings.length) return g;
  return { ...g, plantings, notes: g.notes.filter((n) => n.plantingId !== id) };
}

/** Marks plantings as harvested or cleared on a date. They leave the plan but stay in the bed's history. */
export function harvestPlantings(g: Garden, ids: string[], date: string): Garden {
  const set = new Set(ids);
  if (!g.plantings.some((p) => set.has(p.id) && isActive(p))) return g;
  return { ...g, plantings: g.plantings.map((p) => (set.has(p.id) && isActive(p) ? { ...p, removedOn: date } : p)) };
}

/** Puts a harvested planting back on the plan. */
export function restorePlanting(g: Garden, id: string): Garden {
  const p = g.plantings.find((x) => x.id === id);
  if (!p?.removedOn) return g;
  const { removedOn: _gone, ...rest } = p;
  return { ...g, plantings: g.plantings.map((x) => (x.id === id ? rest : x)) };
}

/** Clears a bed: every planting in it is marked harvested today. */
export const clearBed = (g: Garden, featureId: string, date: string): Garden =>
  harvestPlantings(g, g.plantings.filter((p) => p.featureId === featureId).map((p) => p.id), date);

/** A row with a different number of plants; the ends stay where they are. */
export function setRowCount(g: Garden, id: string, count: number): Garden {
  const n = Math.max(1, Math.min(MAX_PLANTS, Math.round(count)));
  return updatePlanting(g, id, { count: n });
}

// ---------- Status: planned, sown, growing, cleared ----------
// A coarse summary of the planting's stage (src/lifecycle/stages.ts), for chips and jobs.

export type Status = 'planned' | 'sown' | 'growing' | 'cleared';

export const STATUS_LABEL: Record<Status, string> = { planned: 'Planned', sown: 'Sown', growing: 'Growing', cleared: 'Cleared' };

/** Where a planting is in its life: planned, sown (up to hardening off), growing (planted out or later), or cleared. */
export function plantingStatus(pl: Planting): Status {
  const s = currentStage(pl);
  if (s === 'planned' || s === 'cleared') return s;
  return isGrowingStage(s) ? 'growing' : 'sown';
}

/** Sets plantings to planned, sown (on a date) or growing (planted out). Clearing has its own edit, harvestPlantings. */
export function setStatus(g: Garden, ids: string[], status: 'planned' | 'sown' | 'growing', date: string): Garden {
  return setStage(g, ids, status === 'growing' ? 'transplanted' : status, date);
}

// ---------- Close or row spacing ----------

/** The garden's spacing style; close planting in beds unless you've chosen rows. */
export const spacingStyle = (g: Garden): SpacingStyle => g.spacing ?? 'close';

/**
 * A plant as this garden grows it. With close spacing, plants are set the close distance apart each way,
 * in rows and blocks alike, and drawn no wider than that, as they touch when grown close.
 * Plants without a close spacing (fruit trees, shrubs) keep their usual spacing.
 */
export function asGrown(plant: Plant, style: SpacingStyle): Plant {
  const close = plant.size.closeSpacingMm;
  if (style !== 'close' || !close) return plant;
  return { ...plant, size: { ...plant.size, spacingMm: close, rowSpacingMm: close, spreadMm: Math.min(plant.size.spreadMm ?? close, close) } };
}
