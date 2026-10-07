// Plantings: where plants sit in a bed. A planting is one plant, a row or a
// block of the same plant. Positions are worked out from the plant's spacing,
// so the saved planting stays small however many plants it holds.

import { distance, pointInPolygon } from '../geometry/polygon';
import { currentStage, isGrowingStage, setStage } from '../lifecycle/stages';
import { newId } from '../model/ids';
import type { Feature, FeatureKind, Garden, Material, Plant, PlantSize, Planting, Point, SpacingStyle } from '../model/types';

export type Layout = NonNullable<Planting['layout']>;

/** Features made for growing in: beds and the like. */
export const CONTAINER_KINDS: FeatureKind[] = ['bed', 'greenhouse', 'cold-frame', 'pot', 'planter'];

/** Ground soft enough to plant in, as bulbs go in a lawn. Paving, decking and paths aren't. */
export const SOFT_GROUND: Material[] = ['lawn', 'meadow', 'soil', 'bark', 'gravel'];

/** More than this in one planting is almost always a mistake, and slow to draw. */
export const MAX_PLANTS = 5000;

/** Beds, greenhouses, cold frames and planters hold plants, and so do pots, which are round. */
export const isContainer = (f: Feature) => CONTAINER_KINDS.includes(f.kind) && !f.line && (!f.circle || f.kind === 'pot');

/** A lawn, meadow, gravel, bark or bare soil: somewhere plants can go that isn't a bed. */
export const isSoftGround = (f: Feature) => f.kind === 'surface' && SOFT_GROUND.includes(f.material ?? 'lawn');

/** Anywhere a plant can go: a bed, pot or planter, or soft ground. */
export const canHold = (f: Feature) => isContainer(f) || isSoftGround(f);

/** Things laid over the ground that nothing grows through: a patio on the lawn, a path across it, a shed or a pond. */
const coversGround = (f: Feature) => (f.kind === 'surface' && !isSoftGround(f)) || f.kind === 'path' || f.kind === 'building' || f.kind === 'water';

/**
 * Where a plant dropped at a point goes: a bed, pot or planter there (they're drawn over the ground, so they win
 * wherever they are in the list), or failing that the topmost soft ground, unless a patio, path or shed covers it.
 * Trees, hedges and fences don't cover it: bulbs go under a tree.
 */
export function containerAt(g: Garden, p: Point): Feature | null {
  let ground: Feature | null = null;
  let covered = false;
  for (let i = g.features.length - 1; i >= 0; i--) {
    const f = g.features[i]!;
    if (f.footprint.length < 3 || !pointInPolygon(p, f.footprint)) continue;
    if (isContainer(f)) return f;
    if (isSoftGround(f)) {
      if (!covered) ground ??= f;
    } else if (coversGround(f)) covered = true;
  }
  return ground;
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

// ---------- Sizes: a dwarf apple or a big old one ----------

/** How much smaller or bigger than the library's figures. A small apple is on a dwarf rootstock; a large one is standard. */
export const SIZE_FACTOR: Record<PlantSize, number> = { small: 0.5, medium: 1, large: 1.6 };

export const SIZE_LABEL: Record<PlantSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

/** Plants whose size varies a lot by variety, pruning and age: trees, shrubs and anything a metre or more across. */
export const canResize = (p: Plant) => p.category !== 'weed' && (p.category === 'tree' || p.category === 'shrub' || p.art?.form === 'tree' || p.art?.form === 'shrub' || spreadOf(p) >= 1000);

/**
 * A plant at the size this planting is: its own height and spread if you've typed them, otherwise the library's scaled
 * by small, medium or large. Only a single plant can be resized; rows and blocks keep the plant's spacing.
 */
export function sizedPlant(plant: Plant, pl: Planting): Plant {
  if ((pl.layout ?? 'single') !== 'single' || (!pl.size && !pl.spreadMm && !pl.heightMm)) return plant;
  const k = SIZE_FACTOR[pl.size ?? 'medium'];
  const spread = pl.spreadMm ?? Math.round(spreadOf(plant) * k);
  const height = pl.heightMm ?? (plant.size.heightMm !== undefined ? Math.round(plant.size.heightMm * k) : undefined);
  // A single plant needs room for its own spread, so its spacing grows and shrinks with it.
  const spacing = Math.round(plant.size.spacingMm * (spread / spreadOf(plant)));
  return { ...plant, size: { ...plant.size, spreadMm: spread, spacingMm: Math.max(1, spacing), ...(height !== undefined ? { heightMm: height } : {}) } };
}

/** Sets a planting to small, medium or large, dropping any exact size typed before. */
export function setPlantingSize(g: Garden, id: string, size: PlantSize): Garden {
  if (!g.plantings.some((p) => p.id === id)) return g;
  return {
    ...g,
    plantings: g.plantings.map((p) => {
      if (p.id !== id) return p;
      const { size: _s, spreadMm: _w, heightMm: _h, ...rest } = p;
      return size === 'medium' ? rest : { ...rest, size };
    }),
  };
}

/** Sets a planting's exact spread or height; 0 or less clears it, back to its size. */
export function setPlantingMm(g: Garden, id: string, key: 'spreadMm' | 'heightMm', mm: number): Garden {
  if (!g.plantings.some((p) => p.id === id)) return g;
  return {
    ...g,
    plantings: g.plantings.map((p) => {
      if (p.id !== id) return p;
      const { [key]: _old, ...rest } = p;
      return mm > 0 ? { ...rest, [key]: Math.round(mm) } : rest;
    }),
  };
}

/** A plant lookup that gives each planting's plant at its own size. */
export const sizedOf = (plantOf: (id: string) => Plant) => (pl: Planting) => sizedPlant(plantOf(pl.plantId), pl);

/** Plantings shortest first, so trees and tall plants are drawn over (and picked before) what grows beneath them. Ties keep their order. */
export function byHeight(pls: Planting[], plantOf: (id: string) => Plant): Planting[] {
  const tall = (pl: Planting) => sizedPlant(plantOf(pl.plantId), pl).size.heightMm ?? 300;
  return pls
    .map((pl, i) => ({ pl, i, h: tall(pl) }))
    .sort((a, b) => a.h - b.h || a.i - b.i)
    .map((x) => x.pl);
}

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
  // A weed is already there when you mark it.
  if (growing || plant.category === 'weed') pl.stage = 'transplanted';
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
