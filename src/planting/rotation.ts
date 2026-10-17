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
//
// A crop belongs to the year it's picked: garlic planted in October is next
// year's, and its bed is taken until it's lifted.

import { behindOf } from '../lifecycle/behind';
import { afterRun, nextInMonths, timeline } from '../lifecycle/projection';
import { canSowIn } from '../library/library';
import { currentStage, flowerMonthsOf, perennial, sowingOf } from '../lifecycle/stages';
import { microclimateAt, microclimateOf } from '../climate/microclimate';
import { bounds, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import { addDays } from '../model/dates';
import { newId } from '../model/ids';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import type { Weather } from '../weather/weather';
import { fillPlanting } from './fill';
import { plantCount, plantPositions } from './place';

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

/**
 * Whether a bed's crops go round in the rotation. Beds and patches of bare ground do, as you've set it; left unset, all
 * but a fruit cage and a bed of only plants that come back each year and flowers (a border). Pots, planters, lawns and
 * anything under glass keep what they have.
 */
export function rotates(f: Feature, g?: Garden, plantOf?: (id: string) => Plant, since = ''): boolean {
  if (!(f.kind === 'bed' || (f.kind === 'surface' && f.material === 'soil'))) return false;
  if (f.rotates !== undefined) return f.rotates;
  if (f.fruitCage) return false;
  if (!g || !plantOf) return true;
  // What's there, and what grew there since `since` and was cleared.
  const here = g.plantings.filter((pl) => pl.featureId === f.id && (!pl.removedOn || pl.removedOn >= since)).map((pl) => plantOf(pl.plantId)).filter((p) => p.category !== 'weed');
  return !here.length || here.some((p) => !perennial(p) && p.category !== 'flower');
}

/** When a planting started: when it was sown, or else when it first reached a stage. */
const startOf = (pl: Planting): string | undefined => pl.sownOn ?? Object.values(pl.stageDates ?? {}).sort()[0];

/**
 * When a planned planting with no date is likely to go in: from its timeline, as the bed's booking reads it. A kit's
 * garlic, planned in October, goes in this autumn, so it's next year's crop where it stands.
 */
export function expectedStart(pl: Planting, plant: Plant, g: Garden, today: string, weather: Weather | null = null): string | undefined {
  return timeline(plant, pl, g, today, weather).find((s) => (s.stage === 'sown' || s.stage === 'transplanted') && s.date !== null)?.date ?? undefined;
}

/** The year a planting was started in. */
function grownIn(pl: Planting): number | null {
  const first = startOf(pl);
  return first ? Number(first.slice(0, 4)) : null;
}

/**
 * The year a crop is for: the year it's first picked (or flowers), from when it started, or for one still planned,
 * when it's to be sown. Garlic planted in October 2026 is a 2027 crop; leeks sown in April crop that autumn. It can't be
 * picked before it's had time to grow: its days to harvest where the plant has them, otherwise a month.
 */
export function cropYear(pl: Planting, plant: Plant): number | null {
  const start = startOf(pl) ?? pl.sowBy;
  if (!start) return null;
  const months = plant.cropping?.harvestMonths.length ? plant.cropping.harvestMonths : flowerMonthsOf(plant);
  const days = plant.growth?.days?.[0];
  const from = addDays(start, days ?? 30);
  let first = months.length ? nextInMonths(from, months) : null;
  // With no days to go on, something started in its picking months crops in the next run of them: sprouting broccoli
  // sown in April is picked the spring after.
  if (first && days === undefined && first === from) first = nextInMonths(afterRun(from, months), months);
  return Number((first ?? start).slice(0, 4));
}

/** The same day a year on (28 Feb for 29 Feb). */
const yearOn = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4) === '-02-29' ? '-02-28' : iso.slice(4)}`;

export type LeftOut = 'not-up' | 'behind' | 'no-room' | 'planned' | 'taken';

export const LEFT_OUT_TEXT: Record<LeftOut, string> = {
  'not-up': 'didn’t come up',
  behind: 'ran behind',
  'no-room': 'no room in its new bed',
  planned: 'already planned',
  taken: 'its new bed is taken',
};

/** Something in a bed that the draft doesn't move, and why. */
export type Stays = 'perennial' | 'under-glass' | 'not-sown' | 'no-date';

export const STAYS_TEXT: Record<Stays, string> = {
  perennial: 'comes back each year, so it stays',
  'under-glass': 'under glass, which keeps what it has',
  'not-sown': 'never sown, so there’s nothing to move',
  'no-date': 'no date for when it went in: give it one and it moves with the rest',
};

export interface DraftItem {
  /** This year's planting. */
  was: Planting;
  /** Next year's: planned, in its new bed, with a date to sow or plant it. */
  next: Planting;
  /** Left out unless you put it back: it didn't come up, ran behind, doesn't fit its new bed, is already planned, or its new bed is taken. */
  leftOut?: LeftOut;
  /** It cropped: something picked, or marked as harvesting. */
  didWell: boolean;
}

export interface DraftBed {
  bed: Feature;
  /** This year's main group, and the one that comes in next year. Null: no crop that rotates. */
  was: RotationGroup | null;
  next: RotationGroup | null;
  /** The bed whose crops come here. It may have had none. */
  from: string;
  /** Next year's crop already in the ground (garlic planted this autumn), and when it's likely out. Nothing new goes in. */
  taken?: { plantings: Planting[]; until: string | null };
  /** What's in the bed that isn't moved, and why. */
  stays: { planting: Planting; why: Stays }[];
  /** This year's crops still standing into next year (leeks, parsnips), and when they're likely out: what comes here goes in after. */
  standing?: { plantings: Planting[]; until: string };
  /** Free again by summer: from when, and crops to follow on there (after broad beans, kale or leeks), by plant id. */
  after?: { from: string; ideas: string[] };
}

export interface Draft {
  year: number;
  beds: DraftBed[];
  items: DraftItem[];
  /** Plantings you planned for that year yourself, which the draft goes alongside. */
  already: number;
  /** Plantings from a draft used before, still to sow: using this one replaces them. */
  replaces: number;
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

const middle = (f: Feature): Point => {
  const b = bounds(f.footprint)!;
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
};

/** Still to sow, from a draft used before for this year: using the draft again replaces it. */
const fromDraft = (pl: Planting, year: number) => pl.draft === year && !pl.removedOn && currentStage(pl) === 'planned';

/**
 * Next year, drafted from this year's crops in the beds and patches of ground (not pots, planters or anything under
 * glass, which keep what they have, nor anything that comes back each year). Every bed is in it, with or without crops.
 * Each bed's crops move together to another bed, chosen so that as many beds as can get the group that follows theirs,
 * none gets the same group again, and none that's still taken by next year's crop gets more; with one bed, they stay.
 * `from` changes where a bed's crops come from: bed id → the bed whose crops it takes.
 */
export function draftNextYear(g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null, from: Record<string, string> = {}): Draft {
  const year = draftYear(today);
  const byId = new Map(g.features.map((f) => [f.id, f]));
  const mine = (pl: Planting) => !pl.removedOn && currentStage(pl) === 'planned' && !!pl.sowBy && pl.draft !== year && cropYear(pl, plantOf(pl.plantId)) === year;
  const already = g.plantings.filter(mine).length;
  const replaces = g.plantings.filter((pl) => fromDraft(pl, year)).length;

  // Every bed, and what's in each: this year's crops to move, next year's already in, and what stays.
  const beds = g.features.filter((f) => rotates(f, g, plantOf, `${year - 1}-01-01`) && bounds(f.footprint) && !microclimateAt(g, middle(f)));
  const crops = new Map<string, Planting[]>(beds.map((f) => [f.id, []]));
  const taken = new Map<string, Planting[]>();
  /** When planned plantings with no date are likely to go in. */
  const expected = new Map<string, string>();
  const stays = new Map<string, DraftBed['stays']>(beds.map((f) => [f.id, []]));
  for (const pl of g.plantings) {
    if (!crops.has(pl.featureId) || fromDraft(pl, year)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed') continue;
    const stay = (why: Stays) => stays.get(pl.featureId)!.push({ planting: pl, why });
    const active = !pl.removedOn;
    const planned = currentStage(pl) === 'planned';
    if (perennial(plant)) {
      if (active) stay('perennial');
      continue;
    }
    if (microclimateOf(g, pl)) {
      if (active) stay('under-glass');
      continue;
    }
    if (planned) {
      if (active && pl.sowBy && cropYear(pl, plant) === year - 1) stay('not-sown');
      // Planned with no date (a kit's garlic): when it's likely to go in, so this autumn's crop is next year's where it stands.
      else if (active && !pl.sowBy && pl.draft !== year) {
        const start = expectedStart(pl, plant, g, today, weather);
        if (start && cropYear({ ...pl, sowBy: start }, plant) === year) {
          expected.set(pl.id, start);
          taken.set(pl.featureId, [...(taken.get(pl.featureId) ?? []), pl]);
        }
      }
      continue;
    }
    const crop = cropYear(pl, plant);
    if (crop === null) {
      if (active) stay('no-date');
    } else if (crop === year - 1) crops.get(pl.featureId)!.push(pl);
    // Next year's crop already in, unless the draft put it there: that one's already planned, below.
    else if (crop === year && active && pl.draft !== year) taken.set(pl.featureId, [...(taken.get(pl.featureId) ?? []), pl]);
  }
  const groupOf = new Map(beds.map((f) => [f.id, mainGroup(crops.get(f.id)!, plantOf)]));

  // In order round the rotation, beds with nothing to move last; then try each turn of the round and keep the best.
  const SLOTLESS = 9;
  const slot = (f: Feature) => {
    const gr = groupOf.get(f.id);
    return gr ? SLOT[gr] : crops.get(f.id)!.length ? SLOTLESS : SLOTLESS + 1;
  };
  const order = [...beds].sort((x, y) => slot(x) - slot(y) || (x.name ?? '').localeCompare(y.name ?? '', undefined, { numeric: true }) || x.id.localeCompare(y.id));
  const n = order.length;
  // A bed that's taken loses whatever would have come to it.
  const fit = (to: string, src: string) => (taken.has(to) ? -20 * crops.get(src)!.length : fitScore(groupOf.get(to)!, groupOf.get(src)!));
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < n; k++) {
    let score = 0;
    for (let i = 0; i < n; i++) score += fit(order[i]!.id, order[(i + k) % n]!.id);
    if (score > bestScore) [best, bestScore] = [k, score];
  }
  const srcs = order.map((_, i) => order[(i + best) % n]!.id);
  // Then any two beds swap what they take while that does better: a turn of the round can't free a taken bed by itself.
  for (let better = true; better; ) {
    better = false;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const [a, b] = [order[i]!.id, order[j]!.id];
        if (fit(a, srcs[j]!) + fit(b, srcs[i]!) > fit(a, srcs[i]!) + fit(b, srcs[j]!)) [srcs[i], srcs[j], better] = [srcs[j]!, srcs[i]!, true];
      }
  }
  const source = new Map(order.map((f, i) => [f.id, srcs[i]!]));
  // Your changes: a bed taking another's crops, and the bed that was to take them taking its crops instead, so no bed's
  // crops go twice or not at all. Only to beds in the draft, from beds in it.
  for (const [to, src] of Object.entries(from)) {
    if (!source.has(to) || !source.has(src)) continue;
    const other = [...source].find(([, s]) => s === src)?.[0];
    if (other) source.set(other, source.get(to)!);
    source.set(to, src);
  }
  // Next year's plantings you planned yourself, or from a draft and already sown, so the draft doesn't plan them twice.
  const planned = new Set(
    g.plantings.filter((pl) => mine(pl) || (pl.draft === year && !pl.removedOn && currentStage(pl) !== 'planned')).map((pl) => `${pl.plantId}|${pl.featureId}`),
  );

  const items: DraftItem[] = [];
  const draftBeds: DraftBed[] = [];
  for (const bed of order) {
    const src = source.get(bed.id)!;
    const busy = taken.get(bed.id);
    // Taken until the last of them is likely out; no telling if any of them can't say.
    const ends = busy?.map((pl) => goneBy(pl, plantOf(pl.plantId), expected.get(pl.id)));
    const until = ends?.every(Boolean) ? (ends as string[]).sort().at(-1)! : null;
    // This year's crops still in the ground into next year: the bed's busy until they're out.
    const still = crops.get(bed.id)!.filter((pl) => !pl.removedOn && (goneBy(pl, plantOf(pl.plantId)) ?? '') > `${year}-01-01`);
    const standing = still.length ? { plantings: still, until: still.map((pl) => goneBy(pl, plantOf(pl.plantId))!).sort().at(-1)! } : null;
    draftBeds.push({
      bed,
      was: groupOf.get(bed.id) ?? null,
      next: busy ? mainGroup(busy, plantOf) : (groupOf.get(src) ?? null),
      from: src,
      ...(busy ? { taken: { plantings: busy, until } } : {}),
      stays: stays.get(bed.id)!,
      ...(standing ? { standing } : {}),
    });
    const move = mover(byId.get(src)!, bed);
    const here: DraftItem[] = [];
    for (const pl of crops.get(src)!) {
      const item = nextOf(g, plantOf(pl.plantId), pl, bed, move, today, weather, year);
      const leftOut: LeftOut | undefined = planned.has(`${item.next.plantId}|${item.next.featureId}`) ? 'planned' : busy ? 'taken' : item.leftOut;
      // Sown or planted where something's still standing: not before it's out. Sown indoors, it goes in later anyway.
      if (standing && item.next.sowBy && sowingOf(plantOf(pl.plantId), pl) !== 'indoors' && standing.until > item.next.sowBy) item.next.sowBy = standing.until;
      here.push({ ...item, ...(leftOut ? { leftOut } : {}) });
    }
    items.push(...here);
    // Free again by summer: something to follow on.
    const after = followOn(busy ?? here.filter((i) => !i.leftOut).map((i) => i.next), plantOf, year, (pl) => goneBy(pl, plantOf(pl.plantId), expected.get(pl.id) ?? pl.sowBy));
    if (after) draftBeds[draftBeds.length - 1]!.after = after;
  }
  return { year, beds: draftBeds, items, already, replaces };
}

/** One of this year's plantings as next year's, in its new bed, and whether it's left out and why. */
function nextOf(g: Garden, plant: Plant, pl: Planting, bed: Feature, move: (p: Point) => Point, today: string, weather: Weather | null, year: number): DraftItem {
  const how = sowingOf(plant, pl);
  const [x, y] = move([pl.x, pl.y]);
  const next: Planting = { id: newId('p'), plantId: pl.plantId, featureId: bed.id, x, y, draft: year };
  if (pl.layout) next.layout = pl.layout;
  if (pl.endPoint) next.endPoint = move(pl.endPoint);
  if (pl.count) next.count = pl.count;
  if (pl.sowing) next.sowing = pl.sowing;
  if (pl.size) next.size = pl.size;
  if (pl.spreadMm) next.spreadMm = pl.spreadMm;
  if (pl.heightMm) next.heightMm = pl.heightMm;
  if (pl.batch) next.batch = { ...pl.batch, group: `${pl.batch.group}-${year}` };
  // The same day next year as it was sown (or planted, if it's bought as a plant); never before today.
  const when = (how === 'none' ? pl.stageDates?.transplanted : pl.sownOn) ?? startOf(pl);
  if (when) {
    const d = yearOn(when);
    next.sowBy = d < today ? today : d;
  }

  // Anything that cropped did well, whatever else; something still on the plan and late to move on didn't.
  const didWell = !!pl.picks?.length || !!pl.stageDates?.harvesting;
  const late = pl.removedOn || didWell ? null : behindOf(plant, pl, g, today, weather);
  const fitsIn = () => plantPositions(next, plant).every((p) => inside(p, bed.footprint));
  let fits = fitsIn();
  // A row too long for its new bed runs along that bed instead, as many as fit at the plant's spacing (never more than before).
  if (!fits && next.layout === 'row' && next.endPoint) {
    const mid: Point = [(next.x + next.endPoint[0]) / 2, (next.y + next.endPoint[1]) / 2];
    const row = fillPlanting(plant, bed, 'row', pointInPolygon(mid, bed.footprint) ? mid : middle(bed));
    if (row.layout === 'row' && row.endPoint && row.count) {
      const k = Math.min(plantCount(next, plant), row.count);
      const t = row.count > 1 ? (k - 1) / (row.count - 1) : 0;
      Object.assign(next, { x: row.x, y: row.y, count: k, endPoint: [Math.round(row.x + (row.endPoint[0] - row.x) * t), Math.round(row.y + (row.endPoint[1] - row.y) * t)] as Point });
      fits = fitsIn();
    }
  }
  // Left out only if it never came up: a crop that came up and grew slowly still grew.
  const neverUp = late && late.next === 'germinated';
  const leftOut: LeftOut | undefined = neverUp ? (how === 'direct' ? 'not-up' : 'behind') : !fits ? 'no-room' : undefined;
  return { was: pl, next, didWell, ...(leftOut ? { leftOut } : {}) };
}

/**
 * Crops to follow on in each group: after peas and beans the cabbage family, and so on round the rotation. Leeks follow
 * early crops too, planted out in June and July. Most grown first.
 */
const FOLLOW_ON: Record<RotationGroup, string[]> = {
  legumes: ['french-bean', 'pea'],
  brassicas: ['kale', 'sprouting-broccoli', 'cabbage', 'calabrese', 'pak-choi', 'turnip', 'oriental-greens'],
  potatoes: [],
  onions: ['leek', 'spring-onion'],
  roots: ['beetroot', 'carrot'],
};
/** Salads and leaves go anywhere: they fill a gap whatever came before. */
const ANYWHERE = ['lettuce', 'chard', 'spinach', 'winter-purslane', 'corn-salad'];

/**
 * When a bed's crops for the year are out by the end of August (free from September): from when, and two or three crops that can follow on
 * then, from the group next in the rotation (with leeks after early crops), or salads. Null if it isn't free by then.
 */
function followOn(list: Planting[], plantOf: (id: string) => Plant, year: number, out: (pl: Planting) => string | null): DraftBed['after'] | null {
  const crops = list.filter((pl) => rotationGroup(plantOf(pl.plantId)) !== null);
  if (!crops.length) return null;
  const ends = crops.map(out);
  if (!ends.every(Boolean)) return null;
  const from = (ends as string[]).sort().at(-1)!;
  const month = Number(from.slice(5, 7));
  if (Number(from.slice(0, 4)) !== year || month > 9) return null;
  const leaving = mainGroup(crops, plantOf)!;
  const nextGroup = (Object.keys(SLOT) as RotationGroup[]).find((gr) => follows(leaving, gr) && FOLLOW_ON[gr].length);
  const pool = [...(nextGroup ? FOLLOW_ON[nextGroup] : []), ...(leaving === 'legumes' || leaving === 'potatoes' ? ['leek'] : []), ...ANYWHERE];
  // What can go in the month it's free, or the month after.
  const ideas = [...new Set(pool)].filter((id) => {
    const p = plantOf(id);
    return p.commonName !== 'Unknown plant' && (canSowIn(p, month) || canSowIn(p, (month % 12) + 1));
  });
  return ideas.length ? { from, ideas: ideas.slice(0, 3) } : null;
}

/** A bed taking another's crops instead: the two beds swap where their crops come from. */
export function swapSources(draft: Draft, bedId: string, takeFrom: string): Record<string, string> {
  const out = Object.fromEntries(draft.beds.map((b) => [b.bed.id, b.from]));
  const other = draft.beds.find((b) => b.from === takeFrom);
  if (other) out[other.bed.id] = out[bedId]!;
  out[bedId] = takeFrom;
  return out;
}

/**
 * Puts next year's plantings on the plan, as planned. Anything from a draft used before for that year and not yet sown
 * goes, so using the draft again replaces it rather than adding to it.
 */
export function applyDraft(g: Garden, plantings: Planting[], year?: number): Garden {
  const y = year ?? plantings.find((pl) => pl.draft)?.draft;
  const kept = y ? g.plantings.filter((pl) => !fromDraft(pl, y)) : g.plantings;
  return plantings.length || kept.length !== g.plantings.length ? { ...g, plantings: [...kept, ...plantings] } : g;
}

/** Crops to ask about in a bed that grew something this summer the app wasn't told of: the usual ones in each group. */
export const PAST_CROPS = ['potato', 'tomato', 'pea', 'broad-bean', 'runner-bean', 'french-bean', 'cabbage', 'kale', 'calabrese', 'brussels-sprout', 'cauliflower', 'swede', 'onion', 'garlic', 'leek', 'shallot', 'carrot', 'parsnip', 'beetroot'];

/**
 * What grew in a bed in a past year, told after the fact so the draft has something to move: a row of it,
 * started in its usual month so it's that year's crop, and cleared when its harvest ends (or today, if that's sooner).
 */
export function pastCrop(plant: Plant, bed: Feature, year: number, today: string): Planting {
  const how = sowingOf(plant);
  // A row down the middle: a modest record of it, not the whole bed (512 peas), and one that moves to another bed.
  const row = fillPlanting(plant, bed, 'row', middle(bed));
  const shape = row.layout === 'row' ? row : fillPlanting(plant, bed, 'fill', middle(bed));
  const pl: Planting = { id: newId('p'), plantId: plant.id, featureId: bed.id, ...shape };
  const starts = [...new Set([...(plant.sowing ?? []).map((s) => s.months[0]!), ...(plant.plantOutMonths ?? []).slice(0, 1)])].filter(Boolean);
  // Its own months first, this year then the autumn before, until one makes a crop for that year; spring if none.
  const mm = (m: number) => String(m).padStart(2, '0');
  const dates = [year, year - 1].flatMap((y) => starts.map((m) => `${y}-${mm(m)}-15`));
  const start = dates.find((d) => cropYear({ ...pl, sownOn: d }, plant) === year) ?? `${year}-04-15`;
  const done: Planting =
    how === 'none'
      ? { ...pl, stage: 'transplanted', stageDates: { transplanted: start } }
      : { ...pl, sownOn: start, sowing: how, ...(how === 'indoors' ? { stage: 'transplanted' as const, stageDates: { transplanted: addDays(start, 42) } } : {}) };
  const gone = goneBy(done, plant);
  return { ...done, removedOn: gone && gone < today ? gone : today };
}

/**
 * When a crop is likely out of the ground: when it was cleared, or else the end of the run of harvest (or flowering)
 * months that follows its start. Leeks sown in April last until spring; garlic planted in autumn, until late summer.
 * Null: no telling, so it may be there any time.
 */
export function goneBy(pl: Planting, plant: Plant, expected?: string): string | null {
  if (pl.removedOn) return pl.removedOn;
  const start = startOf(pl) ?? expected;
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
