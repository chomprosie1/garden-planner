// Planting from the list, for a garden kept as a list: which beds the list
// shows, where a new planting goes in a bed so it doesn't sit on the others
// (rows one after another along the bed, a fill in the room left, one plant in
// the next free spot), and how full each bed is. Pure functions.

import { bounds, pointInPolygon, polygonArea } from '../geometry/polygon';
import { currentStage, perennial } from '../lifecycle/stages';
import { placeLabel } from '../model/features';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { defaultFill, fillPlanting, type Fill } from './fill';
import { isActive, isContainer, isSoftGround, makePlanting, plantCount, plantPositions, rowCount, rowSpacingOf, spreadOf, type InGroundAt } from './place';
import { spotInPot } from './pots';
import { goneBy } from './rotation';
import { isSupport } from './supports';

/** A garden kept as a list. */
export const isList = (g: Garden) => g.view === 'list';

/**
 * What the list shows: beds, pots, planters, greenhouses and cold frames; soft ground with something in it, or added as
 * a patch of ground; and a fence, wall, trellis, arch or obelisk with a climber on it.
 */
export function isListed(g: Garden): (f: Feature) => boolean {
  const used = new Set(g.plantings.filter(isActive).map((p) => p.featureId));
  return (f) => !f.nextDoor && (isContainer(f) || (isSoftGround(f) && (f.material === 'soil' || f.material === 'cardboard' || used.has(f.id))) || (isSupport(f) && used.has(f.id)));
}

/** The beds and areas the list shows, in their order. */
export const listBeds = (g: Garden): Feature[] => g.features.filter(isListed(g));

/** The ones you can add plants to from the list: not the fences and arches, whose climbers are planted on the plan. */
export const plantableBeds = (g: Garden): Feature[] => listBeds(g).filter((f) => !isSupport(f));

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

/** A round pot: plants go in beside each other. A planter or window box is planted like a bed, in rows. */
const isRoundPot = (f: Feature) => f.kind === 'pot';

/** What came of planting from the list. */
export interface ListPlacing {
  plantings: Planting[];
  /** Plants asked for that there was no room for (a number of plants, or a tray planted out). */
  left: number;
  /** No room for what was asked (a row or a fill), or the bed's over-full now. */
  full: boolean;
}

/**
 * New plantings from the list, in a bed, each placed clear of what's there and never on top of it. One goes in the
 * next free spot (or the least crowded); a row along the bed, after the rows already in it; Fill the bed fills the
 * room that's left; a number makes rows of that many plants, as far as they fit. In a round pot each goes in beside
 * the last. With no room for a row or a fill, nothing is planted; with no room for all of a number, `left` says how
 * many didn't fit. `full` says the bed's over-full, or there was no room.
 */
export function placeInList(g: Garden, bed: Feature, plant: Plant, how: ListHow, plantOf: (id: string) => Plant, growing: boolean | InGroundAt | null = false): ListPlacing {
  const b = bounds(bed.footprint)!;
  const middle: Point = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  const busy = taken(g, bed, plantOf);
  const s = plant.size.spacingMm;
  const make = (shape: ReturnType<typeof fillPlanting>): Planting => {
    const pl = makePlanting(plant, bed.id, shape.layout ?? 'single', [shape.x, shape.y], shape.endPoint, growing);
    return { ...pl, ...(shape.endPoint ? { endPoint: shape.endPoint } : {}), ...(shape.count ? { count: shape.count } : {}) };
  };
  const inside = (pl: Planting) => plantPositions(pl, plant).every((p) => pointInPolygon(p, bed.footprint));
  const done = (plantings: Planting[], left = 0): ListPlacing => {
    const after = { ...g, plantings: [...g.plantings, ...plantings] };
    return { plantings, left, full: left > 0 || !plantings.length || howFull(after, bed, plantOf) > OVER_FULL };
  };
  /** One plant: the next free spot, or else the least crowded one. */
  const single = (from: Garden): Planting => make({ layout: 'single', ...xy(freePoint(bed, taken(from, bed, plantOf), plant) ?? spotInPot(from, bed, middle, plantOf)) });

  const way = typeof how === 'number' ? 'count' : how;
  if (isRoundPot(bed)) {
    if (way === 'fill' && !busy.length) return done([make(fillPlanting(plant, bed, 'fill', middle))]);
    // Several in a pot: each beside the last.
    let next = g;
    const out: Planting[] = [];
    for (let i = 0; i < (typeof how === 'number' ? Math.max(1, Math.round(how)) : 1); i++) {
      const pl = make({ layout: 'single', ...xy(spotInPot(next, bed, middle, plantOf)) });
      out.push(pl);
      next = { ...next, plantings: [...next.plantings, pl] };
    }
    return done(out);
  }
  if (way === 'one') return done([single(g)]);
  if (way === 'row') {
    const next = nextAcross(bed, busy, plant);
    const row = next && make(fillPlanting(plant, bed, 'row', alongMiddle(bed, next.across, next.at)));
    return done(row && inside(row) ? [row] : []);
  }
  if (way === 'fill') {
    if (!busy.length) return done([make(fillPlanting(plant, bed, 'fill', middle))]);
    const next = nextAcross(bed, busy, plant);
    if (!next) return done([]);
    // The strip left beyond the rows already in: a block, drawn in from its sides until every plant's in the bed.
    for (let k = 0; k < 40; k++) {
      const d = (k * s) / 4;
      const min: Point = next.across ? [Math.round(b.minX + s / 2 + d), Math.round(next.at)] : [Math.round(next.at), Math.round(b.minY + s / 2 + d)];
      const max: Point = next.across ? [Math.round(b.maxX - s / 2 - d), Math.round(b.maxY - s / 2 - d)] : [Math.round(b.maxX - s / 2 - d), Math.round(b.maxY - s / 2 - d)];
      if (max[0] - min[0] < s || max[1] - min[1] < s) break;
      const block = make({ layout: 'block', x: min[0], y: min[1], endPoint: max });
      if (inside(block)) return done([block]);
    }
    // Room for a row, not a block.
    const row = make(fillPlanting(plant, bed, 'row', alongMiddle(bed, next.across, next.at)));
    return done(inside(row) ? [row] : []);
  }
  return rowsOf(Math.max(1, Math.round(how as number)));

  /** A number of plants: rows along the bed, each as many as fit (a short one cut to length), then one by one where there's a gap. */
  function rowsOf(n: number): ListPlacing {
    const out: Planting[] = [];
    let left = n;
    let next = g;
    while (left > 0 && out.length < 500) {
      const spot = nextAcross(bed, taken(next, bed, plantOf), plant);
      const shape = spot ? fillPlanting(plant, bed, 'row', alongMiddle(bed, spot.across, spot.at)) : null;
      let pl: Planting | null = null;
      if (shape && shape.layout === 'row' && shape.endPoint) {
        const fits = shape.count ?? rowCount([shape.x, shape.y], shape.endPoint, s);
        const count = Math.min(left, fits);
        const len = Math.hypot(shape.endPoint[0] - shape.x, shape.endPoint[1] - shape.y);
        const k = count > 1 && len > 0 ? Math.min(1, ((count - 1) * s) / len) : 0;
        const end: Point = [Math.round(shape.x + (shape.endPoint[0] - shape.x) * k), Math.round(shape.y + (shape.endPoint[1] - shape.y) * k)];
        const row = count > 1 ? make({ layout: 'row', x: shape.x, y: shape.y, endPoint: end, count }) : make({ layout: 'single', x: shape.x, y: shape.y });
        if (inside(row)) {
          pl = row;
          left -= count;
        }
      }
      if (!pl) {
        // No room for a row: one at a time where there's a gap, and none on top of another.
        const p = freePoint(bed, taken(next, bed, plantOf), plant);
        if (!p) break;
        pl = make({ layout: 'single', ...xy(p) });
        left -= 1;
      }
      out.push(pl);
      next = { ...next, plantings: [...next.plantings, pl] };
    }
    return done(out, left);
  }
}

const xy = (p: Point) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

/** The usual way to plant this in this bed, from the list. */
export const usualHow = (plant: Plant, bed: Feature): Fill => defaultFill(plant, bed);

/** The plant's room: a square of its spacing for each plant; in a round pot, a circle of its spread, as it fills the pot. */
const roomOf = (pl: Planting, plant: Plant, round: boolean) => plantCount(pl, plant) * (round ? Math.PI * (spreadOf(plant) / 2) ** 2 : plant.size.spacingMm ** 2);

/**
 * How full a bed is: the room its plantings want against its area, as a share (1 is full). One plant in a pot is never
 * more than full. Everything in it now counts together, whenever it was started. Plantings planned for a date (next
 * year's draft, batches) count for their year with what comes back each year and with anything still in the ground when
 * the first of them goes in (garlic over winter), as the rest will be gone by then; the fuller of now and each year is
 * taken. Weeds and cleared plantings don't count.
 */
export function howFull(g: Garden, bed: Feature, plantOf: (id: string) => Plant): number {
  const area = polygonArea(bed.footprint);
  if (area <= 0) return 0;
  const round = isRoundPot(bed);
  let now = 0;
  let stays = 0;
  let plants = 0;
  /** Planned room for each year, and when the first of it goes in. */
  const later = new Map<string, { room: number; from: string }>();
  const growing: { room: number; gone: string | null }[] = [];
  for (const pl of g.plantings) {
    if (pl.featureId !== bed.id || !isActive(pl)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed') continue;
    plants += plantCount(pl, plant);
    const room = roomOf(pl, plant, round);
    if (currentStage(pl) === 'planned' && pl.sowBy) {
      const y = pl.sowBy.slice(0, 4);
      const was = later.get(y);
      later.set(y, { room: (was?.room ?? 0) + room, from: was && was.from < pl.sowBy ? was.from : pl.sowBy });
      continue;
    }
    now += room;
    if (perennial(plant)) stays += room;
    else growing.push({ room, gone: goneBy(pl, plant) });
  }
  const still = (from: string) => growing.filter((c) => c.gone !== null && c.gone > from).reduce((a, c) => a + c.room, 0);
  const share = Math.max(now, ...[...later.values()].map((v) => v.room + stays + still(v.from))) / area;
  // One plant to a pot is what a pot is for: it's never over-full, however big the plant.
  return round && plants === 1 ? Math.min(share, 1) : share;
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
 * Moves a planting to another bed from the list, as the same planting (its stages, dates, picks and notes kept), clear
 * of what's growing there where there's room. A row goes along the new bed, shortened to what fits there, never squeezed
 * closer; a block keeps its size, turned to suit the bed, or fills what room there is if it's too big; one plant goes in
 * the first clear spot.
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
  const inside = (shape: Partial<Planting>) => plantPositions({ ...pl, ...shape } as Planting, plant).every((p) => pointInPolygon(p, bed.footprint));
  const one = (): Pick<Planting, 'layout' | 'x' | 'y'> => {
    const p = isRoundPot(bed) ? spotInPot(without, bed, middle, plantOf) : (freePoint(bed, busy, plant) ?? spotInPot(without, bed, middle, plantOf));
    return { layout: 'single', x: Math.round(p[0]), y: Math.round(p[1]) };
  };
  let shape: Pick<Planting, 'layout' | 'x' | 'y'> & Partial<Pick<Planting, 'endPoint' | 'count'>>;
  if (pl.layout === 'row' && pl.endPoint) {
    const spot = nextAcross(bed, busy, plant);
    const line = fillPlanting(plant, bed, 'row', spot ? alongMiddle(bed, spot.across, spot.at) : middle);
    const end = line.endPoint ?? [line.x, line.y];
    const fits = line.layout === 'row' ? (line.count ?? rowCount([line.x, line.y], end, s)) : 1;
    const count = Math.min(plantCount(pl, plant), fits);
    const len = Math.hypot(end[0] - line.x, end[1] - line.y);
    const k = count > 1 && len > 0 ? Math.min(1, ((count - 1) * s) / len) : 0;
    shape = count > 1 ? { layout: 'row', x: line.x, y: line.y, endPoint: [Math.round(line.x + (end[0] - line.x) * k), Math.round(line.y + (end[1] - line.y) * k)], count } : one();
  } else if (pl.layout === 'block' && pl.endPoint) {
    // The same width and depth, turned if the new bed runs the other way, from the first clear strip.
    const [w0, d0] = [Math.abs(pl.endPoint[0] - pl.x), Math.abs(pl.endPoint[1] - pl.y)];
    const across = b.maxX - b.minX >= b.maxY - b.minY;
    const [w, d] = across === w0 >= d0 ? [w0, d0] : [d0, w0];
    const spot = nextAcross(bed, busy, plant);
    const x = Math.round(across ? b.minX + s / 2 : (spot?.at ?? b.minX + s / 2));
    const y = Math.round(across ? (spot?.at ?? b.minY + s / 2) : b.minY + s / 2);
    const block = { layout: 'block' as const, x, y, endPoint: [x + w, y + d] as Point };
    if (inside(block)) shape = block;
    else {
      // Too big for the room there: as much of the bed as there is, or one plant.
      const fill = fillPlanting(plant, bed, 'fill', middle);
      shape = !busy.length && fill.layout === 'block' ? fill : one();
    }
  } else shape = one();
  const { endPoint: _e, count: _c, ...rest } = pl;
  const moved: Planting = { ...rest, featureId: bed.id, ...shape };
  return { ...g, plantings: g.plantings.map((p) => (p.id === plantingId ? moved : p)) };
}

/**
 * A tray from the shed planted out into a bed from the list: as many of its plants as fit, each carrying the tray's
 * dates. Any that don't fit stay in the tray, for another bed.
 */
export function plantOutInList(g: Garden, trayId: string, bed: Feature, plantOf: (id: string) => Plant, date: string): { garden: Garden; planted: number; left: number } {
  const tray = g.trays?.find((t) => t.id === trayId);
  if (!tray) return { garden: g, planted: 0, left: 0 };
  const plant = plantOf(tray.plantId);
  const { plantings, left } = placeInList(g, bed, plant, Math.max(1, tray.count), plantOf, true);
  const fromTray = plantings.map((pl) => ({ ...pl, sownOn: tray.sownOn, sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { ...(tray.stageDates ?? {}), transplanted: date } }));
  const trays = left > 0 && plantings.length ? (g.trays ?? []).map((t) => (t.id === trayId ? { ...t, count: left } : t)) : plantings.length ? (g.trays ?? []).filter((t) => t.id !== trayId) : (g.trays ?? []);
  return { garden: { ...g, trays, plantings: [...g.plantings, ...fromTray] }, planted: tray.count - left, left: plantings.length ? left : tray.count };
}
