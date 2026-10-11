// Planting from the list, for a garden kept as a list: which beds the list
// shows, where a new planting goes in a bed so it doesn't sit on the others
// (rows one after another along the bed, a fill in the room left, one plant in
// the next free spot), and how full each bed is. Pure functions.

import { bounds, pointInPolygon, polygonArea } from '../geometry/polygon';
import { currentStage, perennial } from '../lifecycle/stages';
import { placeLabel } from '../model/features';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { defaultFill, fillPlanting, type Fill } from './fill';
import { isActive, isContainer, isSoftGround, makePlanting, plantCount, plantPositions, rowCount, rowSpacingOf, spreadOf } from './place';
import { isPot, spotInPot } from './pots';

/** A garden kept as a list. */
export const isList = (g: Garden) => g.view === 'list';

/** What the list shows: beds, pots, planters, greenhouses and cold frames; and soft ground with something in it, or added as a patch of ground. */
export function isListed(g: Garden): (f: Feature) => boolean {
  const used = new Set(g.plantings.filter(isActive).map((p) => p.featureId));
  return (f) => !f.nextDoor && (isContainer(f) || (isSoftGround(f) && (f.material === 'soil' || used.has(f.id))));
}

/** The beds and areas the list shows, in their order. */
export const listBeds = (g: Garden): Feature[] => g.features.filter(isListed(g));

/** How many to plant: one of the usual ways, or a number of plants. */
export type ListHow = Fill | number;

/** Where the plants already in a bed are, and how much room each wants. */
function taken(g: Garden, bed: Feature, plantOf: (id: string) => Plant): { p: Point; r: number }[] {
  return g.plantings
    .filter((pl) => pl.featureId === bed.id && isActive(pl))
    .flatMap((pl) => {
      const plant = plantOf(pl.plantId);
      return plantPositions(pl, plant).map((p) => ({ p, r: spreadOf(plant) / 2 }));
    });
}

/** The first point across the bed (away from its first long edge) clear of what's planted, for a row of this plant. */
function nextAcross(bed: Feature, busy: { p: Point; r: number }[], plant: Plant): { across: boolean; at: number } | null {
  const b = bounds(bed.footprint)!;
  const across = b.maxX - b.minX >= b.maxY - b.minY;
  const [lo, hi] = across ? [b.minY, b.maxY] : [b.minX, b.maxX];
  const gap = rowSpacingOf(plant) / 2;
  const used = busy.map(({ p, r }) => (across ? p[1] : p[0]) + r);
  const at = Math.max(lo + gap, ...used.map((u) => u + gap));
  return at <= hi - gap / 2 ? { across, at } : null;
}

/** The middle of the bed along its length, at a point across it. */
const alongMiddle = (bed: Feature, across: boolean, at: number): Point => {
  const b = bounds(bed.footprint)!;
  return across ? [(b.minX + b.maxX) / 2, at] : [at, (b.minY + b.maxY) / 2];
};

/** The first clear spot in a bed, along it from one end, on a grid of half the plant's spacing. Null when there's none. */
function freePoint(bed: Feature, busy: { p: Point; r: number }[], plant: Plant): Point | null {
  const b = bounds(bed.footprint)!;
  const s = Math.max(100, plant.size.spacingMm);
  const r = spreadOf(plant) / 2;
  for (let x = b.minX + s / 2; x <= b.maxX - s / 2 + 1; x += s / 2)
    for (let y = b.minY + s / 2; y <= b.maxY - s / 2 + 1; y += s / 2) {
      const p: Point = [Math.round(x), Math.round(y)];
      if (pointInPolygon(p, bed.footprint) && busy.every((o) => Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) >= (o.r + r) * 0.9)) return p;
    }
  return null;
}

/**
 * New plantings from the list, in a bed: each placed clear of what's there. One goes in the next free spot (in a pot,
 * beside what's in it); a row along the bed, after the rows already in it; Fill the bed fills the room that's left; a
 * number makes rows of that many plants. When there's no room, it goes in the middle anyway, and `full` says so (the
 * list's check says how over-full the bed is).
 */
export function placeInList(g: Garden, bed: Feature, plant: Plant, how: ListHow, plantOf: (id: string) => Plant, growing = false): { plantings: Planting[]; full: boolean } {
  const b = bounds(bed.footprint)!;
  const middle: Point = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const busy = taken(g, bed, plantOf);
  const make = (shape: ReturnType<typeof fillPlanting>): Planting => {
    const pl = makePlanting(plant, bed.id, shape.layout ?? 'single', [shape.x, shape.y], shape.endPoint, growing);
    return { ...pl, ...(shape.endPoint ? { endPoint: shape.endPoint } : {}), ...(shape.count ? { count: shape.count } : {}) };
  };
  const one = (): { plantings: Planting[]; full: boolean } => {
    if (isPot(bed)) return { plantings: [make({ layout: 'single', ...xy(spotInPot(g, bed, middle, plantOf)) })], full: false };
    const p = freePoint(bed, busy, plant);
    return { plantings: [make({ layout: 'single', ...xy(p ?? middle) })], full: !p };
  };

  const way = typeof how === 'number' ? 'count' : how;
  if (way === 'one' || isPot(bed)) {
    if (typeof how === 'number' && how > 1) {
      // Several in a pot: each beside the last.
      let next = g;
      const out: Planting[] = [];
      for (let i = 0; i < how; i++) {
        const spot = spotInPot(next, bed, middle, plantOf);
        const pl = make({ layout: 'single', ...xy(spot) });
        out.push(pl);
        next = { ...next, plantings: [...next.plantings, pl] };
      }
      return { plantings: out, full: false };
    }
    if (way === 'fill' && isPot(bed) && !busy.length) return { plantings: [make(fillPlanting(plant, bed, 'fill', middle))], full: false };
    return one();
  }
  if (way === 'row') {
    const next = nextAcross(bed, busy, plant);
    if (!next) return { plantings: [make(fillPlanting(plant, bed, 'row', middle))], full: true };
    return { plantings: [make(fillPlanting(plant, bed, 'row', alongMiddle(bed, next.across, next.at)))], full: false };
  }
  if (way === 'fill') {
    if (!busy.length) return { plantings: [make(fillPlanting(plant, bed, 'fill', middle))], full: false };
    const next = nextAcross(bed, busy, plant);
    if (!next) return { plantings: [make({ layout: 'single', ...xy(middle) })], full: true };
    const s = plant.size.spacingMm;
    const min: Point = next.across ? [Math.round(b.minX + s / 2), Math.round(next.at)] : [Math.round(next.at), Math.round(b.minY + s / 2)];
    const max: Point = next.across ? [Math.round(b.maxX - s / 2), Math.round(b.maxY - s / 2)] : [Math.round(b.maxX - s / 2), Math.round(b.maxY - s / 2)];
    if (max[0] - min[0] < s || max[1] - min[1] < s) return { plantings: [make(fillPlanting(plant, bed, 'row', alongMiddle(bed, next.across, next.at)))], full: false };
    return { plantings: [make({ layout: 'block', x: min[0], y: min[1], endPoint: max })], full: false };
  }
  return rowsOf(how as number);

  /** A number of plants: rows along the bed, each as many as fit (a short one cut to length), the rest one by one. */
  function rowsOf(n: number): { plantings: Planting[]; full: boolean } {
    const out: Planting[] = [];
    let left = Math.max(1, Math.round(n));
    let next = g;
    let full = false;
    const s = plant.size.spacingMm;
    while (left > 0 && out.length < 500) {
      const spot = nextAcross(bed, taken(next, bed, plantOf), plant);
      const shape = spot ? fillPlanting(plant, bed, 'row', alongMiddle(bed, spot.across, spot.at)) : null;
      let pl: Planting;
      if (shape && shape.layout === 'row' && shape.endPoint) {
        const fits = shape.count ?? rowCount([shape.x, shape.y], shape.endPoint, s);
        const count = Math.min(left, fits);
        const len = Math.hypot(shape.endPoint[0] - shape.x, shape.endPoint[1] - shape.y);
        const k = count > 1 && len > 0 ? Math.min(1, ((count - 1) * s) / len) : 0;
        const end: Point = [Math.round(shape.x + (shape.endPoint[0] - shape.x) * k), Math.round(shape.y + (shape.endPoint[1] - shape.y) * k)];
        pl = count > 1 ? make({ layout: 'row', x: shape.x, y: shape.y, endPoint: end, count }) : make({ layout: 'single', x: shape.x, y: shape.y });
        left -= count;
      } else {
        // No room for a row: one at a time, in the next free spot, or the middle.
        const p = spot ? alongMiddle(bed, spot.across, spot.at) : freePoint(bed, taken(next, bed, plantOf), plant);
        if (!p) full = true;
        pl = make({ layout: 'single', ...xy(p ?? middle) });
        left -= 1;
      }
      out.push(pl);
      next = { ...next, plantings: [...next.plantings, pl] };
    }
    return { plantings: out, full };
  }
}

const xy = (p: Point) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

/** The usual way to plant this in this bed, from the list. */
export const usualHow = (plant: Plant, bed: Feature): Fill => defaultFill(plant, bed);

/** The plant's room: a square of its spacing for each plant. */
const roomOf = (pl: Planting, plant: Plant) => plantCount(pl, plant) * plant.size.spacingMm ** 2;

/**
 * How full a bed is: the room its plantings want against its area, as a share (1 is full). Everything in it now counts
 * together, whenever it was started. Plantings planned for a date (next year's draft, batches) count with what comes back
 * each year, for their year, as this year's crops will be gone by then; the fuller is taken. Weeds and cleared plantings
 * don't count.
 */
export function howFull(g: Garden, bed: Feature, plantOf: (id: string) => Plant): number {
  const area = polygonArea(bed.footprint);
  if (area <= 0) return 0;
  let now = 0;
  let stays = 0;
  const later = new Map<string, number>();
  for (const pl of g.plantings) {
    if (pl.featureId !== bed.id || !isActive(pl)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed') continue;
    const room = roomOf(pl, plant);
    if (currentStage(pl) === 'planned' && pl.sowBy) {
      const y = pl.sowBy.slice(0, 4);
      later.set(y, (later.get(y) ?? 0) + room);
      continue;
    }
    now += room;
    if (perennial(plant)) stays += room;
  }
  return Math.max(now, ...[...later.values()].map((v) => v + stays)) / area;
}

/** Over this much is worth a word: plants vary, and close planting is fine. */
export const OVER_FULL = 1.15;

/** "Veg bed is over-full: about 130%." For each listed bed the plants want more room than it has. */
export function fullnessFindings(g: Garden, plantOf: (id: string) => Plant): { id: string; featureId: string; plantingIds: string[]; message: string }[] {
  return listBeds(g)
    .map((bed) => ({ bed, share: howFull(g, bed, plantOf) }))
    .filter(({ share }) => share > OVER_FULL)
    .map(({ bed, share }) => ({
      id: `full:${bed.id}`,
      featureId: bed.id,
      plantingIds: g.plantings.filter((pl) => pl.featureId === bed.id && isActive(pl)).map((pl) => pl.id),
      message: `${placeLabel(bed)} is over-full: its plants want about ${Math.round(share * 100)}% of the room it has. Fewer plants, or another bed, would give them space.`,
    }));
}

/** "About half full", in words, for a bed's card. */
export function fullText(share: number): string {
  if (share <= 0.02) return 'Empty';
  if (share < 0.35) return 'Plenty of room';
  if (share < 0.7) return 'About half full';
  if (share <= OVER_FULL) return 'Nearly full';
  return 'Over-full';
}

/**
 * Moves a planting to another bed from the list, as the same planting with the same number of plants (its stages,
 * dates, picks and notes kept), clear of what's growing there where there's room. A row keeps its count, along the new
 * bed (closer together if the bed is shorter: the row check then says so); a block keeps its size, turned to suit the
 * bed; one plant goes in the first clear spot.
 */
export function moveToListBed(g: Garden, plantingId: string, bedId: string, plantOf: (id: string) => Plant): Garden {
  const pl = g.plantings.find((p) => p.id === plantingId);
  const bed = g.features.find((f) => f.id === bedId);
  if (!pl || !bed || pl.featureId === bedId) return g;
  const plant = plantOf(pl.plantId);
  const without = { ...g, plantings: g.plantings.filter((p) => p.id !== plantingId) };
  const b = bounds(bed.footprint)!;
  const middle: Point = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const busy = taken(without, bed, plantOf);
  const s = plant.size.spacingMm;
  let shape: Pick<Planting, 'x' | 'y'> & Partial<Pick<Planting, 'endPoint' | 'count'>>;
  if (pl.layout === 'row' && pl.endPoint) {
    const count = plantCount(pl, plant);
    const spot = nextAcross(bed, busy, plant);
    const line = fillPlanting(plant, bed, 'row', spot ? alongMiddle(bed, spot.across, spot.at) : middle);
    const end = line.endPoint ?? [line.x, line.y];
    const len = Math.hypot(end[0] - line.x, end[1] - line.y);
    const k = len > 0 ? Math.min(1, ((count - 1) * s) / len) : 0;
    shape = { x: line.x, y: line.y, endPoint: [Math.round(line.x + (end[0] - line.x) * k), Math.round(line.y + (end[1] - line.y) * k)], count };
  } else if (pl.layout === 'block' && pl.endPoint) {
    // The same width and depth, turned if the new bed runs the other way, from the first clear strip.
    const [w0, d0] = [Math.abs(pl.endPoint[0] - pl.x), Math.abs(pl.endPoint[1] - pl.y)];
    const across = b.maxX - b.minX >= b.maxY - b.minY;
    const [w, d] = across === w0 >= d0 ? [w0, d0] : [d0, w0];
    const spot = nextAcross(bed, busy, plant);
    const x = Math.round(across ? b.minX + s / 2 : (spot?.at ?? b.minX + s / 2));
    const y = Math.round(across ? (spot?.at ?? b.minY + s / 2) : b.minY + s / 2);
    shape = { x, y, endPoint: [x + w, y + d] };
  } else {
    const p = isPot(bed) ? spotInPot(without, bed, middle, plantOf) : (freePoint(bed, busy, plant) ?? middle);
    shape = { x: Math.round(p[0]), y: Math.round(p[1]) };
  }
  const { endPoint: _e, count: _c, ...rest } = pl;
  const moved: Planting = { ...rest, featureId: bed.id, ...shape };
  return { ...g, plantings: g.plantings.map((p) => (p.id === plantingId ? moved : p)) };
}

/** A tray from the shed planted out into a bed from the list: as many plants as it holds, each carrying the tray's dates. */
export function plantOutInList(g: Garden, trayId: string, bed: Feature, plantOf: (id: string) => Plant, date: string): Garden {
  const tray = g.trays?.find((t) => t.id === trayId);
  if (!tray) return g;
  const plant = plantOf(tray.plantId);
  const { plantings } = placeInList(g, bed, plant, Math.max(1, tray.count), plantOf, true);
  const fromTray = plantings.map((pl) => ({ ...pl, sownOn: tray.sownOn, sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { ...(tray.stageDates ?? {}), transplanted: date } }));
  return { ...g, trays: (g.trays ?? []).filter((t) => t.id !== trayId), plantings: [...g.plantings, ...fromTray] };
}
