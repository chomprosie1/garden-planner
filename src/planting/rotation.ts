// Next year, drafted: this year's crops moved round the beds, so each crop
// family follows the one before it, with what did well kept and what failed or
// ran behind left out. Pure functions: garden and plants in, a draft out; then
// the draft's plantings go on the plan as planned, with next year's dates.
//
// The groups and their order are the RHS's ("Crop rotation", rhs.org.uk,
// checked 11 Oct 2026). Its four-year plan moves each section a step on every
// year: peas and beans (legumes), then the cabbage family (brassicas, with
// swedes, turnips and radishes), then potatoes (with tomatoes), then onions and
// roots (beetroot, carrots, celeriac, celery, Florence fennel, parsley,
// parsnips), then legumes again. Peppers, aubergines, squashes, salads and
// sweetcorn "can be grown wherever convenient"; perennials stay put.

import { behindOf } from '../lifecycle/behind';
import { afterRun, nextInMonths } from '../lifecycle/projection';
import { currentStage, flowerMonthsOf, perennial, sowingOf } from '../lifecycle/stages';
import { microclimateOf } from '../climate/microclimate';
import { bounds, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import { newId } from '../model/ids';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import type { Weather } from '../weather/weather';
import { plantPositions } from './place';

export type RotationGroup = 'legumes' | 'brassicas' | 'potatoes' | 'onions' | 'roots';

export const GROUP_LABEL: Record<RotationGroup, string> = {
  legumes: 'Peas and beans',
  brassicas: 'Cabbage family',
  potatoes: 'Potatoes and tomatoes',
  onions: 'Onions',
  roots: 'Roots',
};

/** Each group's place in the four-year round; onions and roots share one. */
const SLOT: Record<RotationGroup, number> = { legumes: 0, brassicas: 1, potatoes: 2, onions: 3, roots: 3 };

/** Roots by the RHS's list that aren't in the carrot family. */
const ROOTS = new Set(['beetroot', 'salsify', 'scorzonera', 'parsley']);
/** The potato group is potatoes and tomatoes; peppers and aubergines can go anywhere. */
const POTATOES = new Set(['potato', 'tomato']);

/** A plant's group in the rotation, or null: it can go anywhere, or it comes back each year and stays put. */
export function rotationGroup(p: Plant): RotationGroup | null {
  if (perennial(p) || p.category === 'weed') return null;
  const id = p.varietyOf ?? p.id;
  if (POTATOES.has(id)) return 'potatoes';
  if (ROOTS.has(id)) return 'roots';
  if (p.category !== 'vegetable') return null;
  if (p.family === 'Fabaceae') return 'legumes';
  if (p.family === 'Brassicaceae') return 'brassicas';
  if (p.family === 'Amaryllidaceae') return 'onions';
  if (p.family === 'Apiaceae') return 'roots';
  return null;
}

/** True when `next` is the group that should follow `was` in the same bed. */
export const follows = (was: RotationGroup, next: RotationGroup) => SLOT[next] === (SLOT[was] + 1) % 4;

/** The year a draft is for: from August, next year; before then, this one (the season about to start). */
export const draftYear = (today: string) => Number(today.slice(0, 4)) + (Number(today.slice(5, 7)) >= 8 ? 1 : 0);

/** When a planting started: when it was sown, or else when it first reached a stage. */
const startOf = (pl: Planting): string | undefined => pl.sownOn ?? Object.values(pl.stageDates ?? {}).sort()[0];

/** The year a planting was grown in. */
function grownIn(pl: Planting): number | null {
  const first = startOf(pl);
  return first ? Number(first.slice(0, 4)) : null;
}

/** The same day a year on (28 Feb for 29 Feb). */
const yearOn = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4) === '-02-29' ? '-02-28' : iso.slice(4)}`;

export type LeftOut = 'not-up' | 'behind' | 'no-room' | 'planned';

export const LEFT_OUT_TEXT: Record<LeftOut, string> = {
  'not-up': 'didn’t come up',
  behind: 'ran behind',
  'no-room': 'no room in its new bed',
  planned: 'already planned',
};

export interface DraftItem {
  /** This year's planting. */
  was: Planting;
  /** Next year's: planned, in its new bed, with a date to sow or plant it. */
  next: Planting;
  /** Left out unless you put it back: it didn't come up, ran behind, doesn't fit its new bed, or is already planned (a draft used before). */
  leftOut?: LeftOut;
  /** It cropped: something picked, or marked as harvesting. */
  didWell: boolean;
}

export interface DraftBed {
  bed: Feature;
  /** This year's main group, and the one that comes in next year. Null: no crop that rotates. */
  was: RotationGroup | null;
  next: RotationGroup | null;
  /** The bed whose crops come here. */
  from: string;
}

export interface Draft {
  year: number;
  beds: DraftBed[];
  items: DraftItem[];
  /** Plantings already planned for that year, which the draft adds to. */
  already: number;
}

/** The group most of a bed's crops are in, by plants; null if none rotate. */
function mainGroup(list: Planting[], plantOf: (id: string) => Plant): RotationGroup | null {
  const count = new Map<RotationGroup, number>();
  for (const pl of list) {
    const g = rotationGroup(plantOf(pl.plantId));
    if (g) count.set(g, (count.get(g) ?? 0) + plantPositions(pl, plantOf(pl.plantId)).length);
  }
  let best: RotationGroup | null = null;
  for (const [g, n] of count) if (!best || n > count.get(best)! || (n === count.get(best)! && SLOT[g] < SLOT[best])) best = g;
  return best;
}

/** How well a bed that grew `was` takes crops of `next`: the right one next is best; the same again is worst. */
function fitScore(was: RotationGroup | null, next: RotationGroup | null): number {
  if (!was || !next) return 0;
  if (SLOT[was] === SLOT[next]) return -10;
  return follows(was, next) ? 3 : 0;
}

/**
 * Moves points from one bed to another: the same arrangement, centred in the new bed, and turned a quarter if one bed
 * runs across and the other up and down.
 */
function mover(from: Feature, to: Feature): (p: Point) => Point {
  const a = bounds(from.footprint)!;
  const b = bounds(to.footprint)!;
  const [aw, ah, bw, bh] = [a.maxX - a.minX, a.maxY - a.minY, b.maxX - b.minX, b.maxY - b.minY];
  const turn = (aw > ah * 1.2 && bh > bw * 1.2) || (ah > aw * 1.2 && bw > bh * 1.2);
  const [cw, ch] = turn ? [ah, aw] : [aw, ah];
  const ox = b.minX + (bw - cw) / 2;
  const oy = b.minY + (bh - ch) / 2;
  return ([x, y]) => {
    const [u, v] = [x - a.minX, y - a.minY];
    const [u2, v2] = turn ? [v, aw - u] : [u, v];
    return [Math.round(ox + u2), Math.round(oy + v2)];
  };
}

const inside = (p: Point, poly: Point[]) => pointInPolygon(p, poly) || poly.some((a, i) => distanceToSegment(p, a, poly[(i + 1) % poly.length]!).distance <= 10);

/**
 * Next year, drafted from this year's crops in the beds (not pots, planters or anything under glass, which keep what
 * they have, nor anything that comes back each year). Each bed's crops move together to another bed, chosen so that as
 * many beds as can get the group that follows theirs, and none gets the same group again; with one bed, they stay.
 * `from` changes where a bed's crops come from: bed id → the bed whose crops it takes.
 */
export function draftNextYear(g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null, from: Record<string, string> = {}): Draft {
  const year = draftYear(today);
  const byId = new Map(g.features.map((f) => [f.id, f]));
  const already = g.plantings.filter((pl) => !pl.removedOn && currentStage(pl) === 'planned' && pl.sowBy?.startsWith(`${year}-`)).length;

  // This year's crops in the beds, by bed.
  const crops = new Map<string, Planting[]>();
  for (const pl of g.plantings) {
    const bed = byId.get(pl.featureId);
    const plant = plantOf(pl.plantId);
    if (!bed || bed.kind !== 'bed' || perennial(plant) || plant.category === 'weed' || microclimateOf(g, pl)) continue;
    if (grownIn(pl) !== year - 1) continue;
    crops.set(bed.id, [...(crops.get(bed.id) ?? []), pl]);
  }
  const beds = [...crops.keys()].map((id) => byId.get(id)!).filter((f) => bounds(f.footprint));
  const groupOf = new Map(beds.map((f) => [f.id, mainGroup(crops.get(f.id)!, plantOf)]));

  // In order round the rotation, beds with no rotating crop last; then try each turn of the round and keep the best.
  const SLOTLESS = 9;
  const order = [...beds].sort((x, y) => {
    const [gx, gy] = [groupOf.get(x.id), groupOf.get(y.id)];
    return (gx ? SLOT[gx] : SLOTLESS) - (gy ? SLOT[gy] : SLOTLESS) || (x.name ?? '').localeCompare(y.name ?? '') || x.id.localeCompare(y.id);
  });
  const n = order.length;
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < Math.max(1, n); k++) {
    let score = 0;
    for (let i = 0; i < n; i++) score += fitScore(groupOf.get(order[i]!.id)!, groupOf.get(order[(i + k) % n]!.id)!);
    if (score > bestScore) [best, bestScore] = [k, score];
  }
  const source = new Map(order.map((f, i) => [f.id, order[(i + best) % n]!.id]));
  // Your changes: a bed taking another's crops, and the bed that was to take them taking its crops instead, so no bed's
  // crops go twice or not at all. Only to beds in the draft, from beds in it.
  for (const [to, src] of Object.entries(from)) {
    if (!source.has(to) || !source.has(src)) continue;
    const other = [...source].find(([, s]) => s === src)?.[0];
    if (other) source.set(other, source.get(to)!);
    source.set(to, src);
  }
  // Next year's plantings already on the plan (a draft used before), so the same draft used again adds nothing.
  const planned = new Set(g.plantings.filter((pl) => !pl.removedOn && currentStage(pl) === 'planned' && pl.sowBy).map((pl) => `${pl.plantId}|${pl.featureId}|${pl.sowBy!.slice(0, 4)}`));

  const items: DraftItem[] = [];
  const draftBeds: DraftBed[] = [];
  for (const bed of order) {
    const src = source.get(bed.id)!;
    draftBeds.push({ bed, was: groupOf.get(bed.id) ?? null, next: groupOf.get(src) ?? null, from: src });
    const move = mover(byId.get(src)!, bed);
    for (const pl of crops.get(src)!) {
      const plant = plantOf(pl.plantId);
      const item = nextOf(g, plant, pl, bed, move, today, weather);
      items.push(planned.has(`${item.next.plantId}|${item.next.featureId}|${item.next.sowBy?.slice(0, 4)}`) ? { ...item, leftOut: 'planned' } : item);
    }
  }
  return { year, beds: draftBeds, items, already };
}

/** One of this year's plantings as next year's, in its new bed, and whether it's left out and why. */
function nextOf(g: Garden, plant: Plant, pl: Planting, bed: Feature, move: (p: Point) => Point, today: string, weather: Weather | null): DraftItem {
  const how = sowingOf(plant, pl);
  const [x, y] = move([pl.x, pl.y]);
  const next: Planting = { id: newId('p'), plantId: pl.plantId, featureId: bed.id, x, y };
  if (pl.layout) next.layout = pl.layout;
  if (pl.endPoint) next.endPoint = move(pl.endPoint);
  if (pl.count) next.count = pl.count;
  if (pl.sowing) next.sowing = pl.sowing;
  if (pl.size) next.size = pl.size;
  if (pl.spreadMm) next.spreadMm = pl.spreadMm;
  if (pl.heightMm) next.heightMm = pl.heightMm;
  if (pl.batch) next.batch = { ...pl.batch, group: `${pl.batch.group}-${draftYear(today)}` };
  // The same day next year as it was sown (or planted, if it's bought as a plant); never before today.
  const when = (how === 'none' ? pl.stageDates?.transplanted : pl.sownOn) ?? startOf(pl);
  if (when) {
    const d = yearOn(when);
    next.sowBy = d < today ? today : d;
  }

  // Anything that cropped did well, whatever else; something still on the plan and late to move on didn't.
  const didWell = !!pl.picks?.length || !!pl.stageDates?.harvesting;
  const late = pl.removedOn || didWell ? null : behindOf(plant, pl, g, today, weather);
  const fits = plantPositions(next, plant).every((p) => inside(p, bed.footprint));
  const leftOut: LeftOut | undefined = late && late.next === 'germinated' && how === 'direct' ? 'not-up' : late ? 'behind' : !fits ? 'no-room' : undefined;
  return { was: pl, next, didWell, ...(leftOut ? { leftOut } : {}) };
}

/** A bed taking another's crops instead: the two beds swap where their crops come from. */
export function swapSources(draft: Draft, bedId: string, takeFrom: string): Record<string, string> {
  const out = Object.fromEntries(draft.beds.map((b) => [b.bed.id, b.from]));
  const other = draft.beds.find((b) => b.from === takeFrom);
  if (other) out[other.bed.id] = out[bedId]!;
  out[bedId] = takeFrom;
  return out;
}

/** Puts next year's plantings on the plan, as planned. */
export function applyDraft(g: Garden, plantings: Planting[]): Garden {
  return plantings.length ? { ...g, plantings: [...g.plantings, ...plantings] } : g;
}

/**
 * When a crop is likely out of the ground: when it was cleared, or else the end of the run of harvest (or flowering)
 * months that follows its start. Leeks sown in April last until spring; garlic planted in autumn, until late summer.
 * Null: no telling, so it may be there any time.
 */
function goneBy(pl: Planting, plant: Plant): string | null {
  if (pl.removedOn) return pl.removedOn;
  const start = startOf(pl);
  const months = plant.cropping?.harvestMonths.length ? plant.cropping.harvestMonths : flowerMonthsOf(plant);
  if (!start || !months.length) return null;
  const first = nextInMonths(start, months);
  return first ? afterRun(first, months) : null;
}

/**
 * True when one planting is planned for a later year than the other was grown, and the other (not one that comes back
 * each year) will be out of the ground by then: next year's draft over this year's crops. They're never in the bed
 * together. Crops that stand over winter into the planned one's time are still checked against it.
 */
export function seasonsApart(a: Planting, b: Planting, pa: Plant, pb: Plant): boolean {
  const later = (x: Planting, y: Planting, py: Plant) => {
    if (!x.sowBy || currentStage(x) !== 'planned' || perennial(py)) return false;
    const grown = grownIn(y);
    if (grown === null || Number(x.sowBy.slice(0, 4)) <= grown) return false;
    const gone = goneBy(y, py);
    return gone !== null && gone <= x.sowBy;
  };
  return later(a, b, pb) || later(b, a, pa);
}
