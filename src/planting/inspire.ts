// Inspire me: an empty bed, pot or patch of lawn, a budget, when you want it
// and how much time you have, and three ideas that would grow there. Ranked by
// the spot's sun and cover, then by cost, effort and how soon it's ready. Pure
// functions: garden in, ideas out, and a garden with the chosen idea planted.

import { toggleWishlist } from '../calendar/jobs';
import { microclimateAt, isCover, climateOf } from '../climate/microclimate';
import { bounds, distanceToSegment, pointInPolygon, polygonArea } from '../geometry/polygon';
import { daysToCrop, nextInMonths } from '../lifecycle/projection';
import { isTender, plantOutMonthsUnder } from '../lifecycle/shed';
import { flowerMonthsOf, perennial } from '../lifecycle/stages';
import { addDays, daysBetween } from '../model/dates';
import { pivotOf } from '../model/features';
import type { Climate, Feature, Garden, Plant, Planting, Point } from '../model/types';
import { sunNeeded } from './rules';
import { defaultFill, fillPlanting, fillsFor, type Fill } from './fill';
import { KITS, plantKitBed, type KitBed } from './kits';
import { addPlanting, isActive, isContainer, makePlanting, plantCount, plantPositions, spreadOf } from './place';
import { seedPrice } from './seeds';

// ---------- The three questions ----------

export const BUDGETS = [10, 25, 50] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = { 10: 'Under £10', 25: 'Under £25', 50: '£50 or more' };

export const WHENS = ['soon', 'year', 'years'] as const;
export type When = (typeof WHENS)[number];
export const WHEN_LABEL: Record<When, string> = { soon: 'Something quick', year: 'This year', years: 'For years to come' };

export const TIMES = [10, 60, 600] as const;
export type TimeAWeek = (typeof TIMES)[number];
export const TIME_LABEL: Record<TimeAWeek, string> = { 10: '10 minutes', 60: 'An hour', 600: 'A weekend' };

export interface Answers {
  budget: Budget;
  when: When;
  time: TimeAWeek;
}

export const DEFAULT_ANSWERS: Answers = { budget: 25, when: 'year', time: 60 };

/** Quick means it goes in within six weeks and is ready within four months. */
const SOON_START_DAYS = 42;
const SOON_READY_DAYS = 120;

// ---------- The spot ----------

export interface Spot {
  feature: Feature;
  /** Where a single plant goes: the middle of a bed, or the most open part of a lawn. */
  at: Point;
  /** Room across, mm: the bed's narrow side, or the clear space round `at` on a lawn. */
  room: number;
  areaM2: number;
  /** Sun hours a day in June, or null if not worked out yet. */
  hours: number | null;
  /** Under a greenhouse or cold frame. */
  cover: Climate | null;
  /** Something planned goes in on this day: ideas must be done by then. */
  until: string | null;
}

/** Ground that isn't dug: a lawn, a meadow, gravel or bark, for trees, shrubs and bulbs. Bare soil, or cardboard (planted through), is like a bed. */
const isLawnish = (f: Feature) => f.kind === 'surface' && f.material !== 'soil' && f.material !== 'cardboard';

/** The most open point of a lawn or patch: furthest from its edges and from anything planted in it. */
function openPoint(g: Garden, f: Feature, plantOf: (id: string) => Plant): { at: Point; room: number } {
  const b = bounds(f.footprint);
  if (!b) return { at: pivotOf(f), room: 0 };
  const taken = g.plantings.filter((p) => p.featureId === f.id && isActive(p)).flatMap((p) => plantPositions(p, plantOf(p.plantId)));
  const edges = f.footprint.map((a, i) => [a, f.footprint[(i + 1) % f.footprint.length]!] as const);
  const toEdge = (p: Point) => Math.min(...edges.map(([a, c]) => distanceToSegment(p, a, c).distance));
  let best: { at: Point; room: number } = { at: pivotOf(f), room: 0 };
  const n = 24;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const p: Point = [Math.round(b.minX + ((b.maxX - b.minX) * i) / n), Math.round(b.minY + ((b.maxY - b.minY) * j) / n)];
      if (!pointInPolygon(p, f.footprint)) continue;
      const clear = Math.min(toEdge(p), ...taken.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
      if (clear > best.room / 2) best = { at: p, room: Math.round(clear * 2) };
    }
  return best;
}

/**
 * A bed, pot or lawn as a spot to fill. `hoursAt` gives the June sun at a point (or over the bed), when it's known.
 * A bed with plans that haven't gone in yet is a gap until the first of them is due.
 */
export function spotOf(g: Garden, f: Feature, plantOf: (id: string) => Plant, hoursOf: ((f: Feature, at: Point) => number | null) | null): Spot {
  const b = bounds(f.footprint);
  const narrow = b ? Math.min(b.maxX - b.minX, b.maxY - b.minY) : 0;
  const lawn = isLawnish(f);
  const { at, room } = lawn ? openPoint(g, f, plantOf) : { at: insidePoint(f), room: narrow };
  const cover = isCover(f) ? climateOf(f) : (microclimateAt(g, at)?.climate ?? null);
  const planned = g.plantings.filter((p) => p.featureId === f.id && isActive(p) && p.sowBy).map((p) => p.sowBy!);
  return {
    feature: f,
    at,
    room,
    areaM2: lawn ? Math.PI * (room / 2000) ** 2 : Math.abs(polygonArea(f.footprint)) / 1e6,
    hours: hoursOf ? hoursOf(f, at) : null,
    cover,
    until: planned.length ? planned.sort()[0]! : null,
  };
}

/** The middle of a bed, or the nearest corner-ward point inside it for an L-shaped one. */
function insidePoint(f: Feature): Point {
  const c = pivotOf(f);
  if (pointInPolygon(c, f.footprint)) return c;
  const b = bounds(f.footprint)!;
  for (let k = 1; k < 10; k++)
    for (const p of f.footprint) {
      const q: Point = [Math.round(p[0] + (c[0] - p[0]) * (k / 10)), Math.round(p[1] + (c[1] - p[1]) * (k / 10))];
      if (pointInPolygon(q, f.footprint)) return q;
    }
  return [Math.round((b.minX + b.maxX) / 2), Math.round((b.minY + b.maxY) / 2)];
}

/** Beds, pots and planters with nothing in the ground or planned: the places Inspire me is for. */
export function emptyPlaces(g: Garden): Feature[] {
  return g.features.filter((f) => isContainer(f) && !g.plantings.some((p) => p.featureId === f.id && isActive(p) && !p.sowBy));
}

// ---------- What things cost ----------

/**
 * Rough UK prices, in pounds, low and high, checked in October 2026 against retailers' listings:
 * - a packet of seed: allotment-garden.org (99p to £1.99) and the bigger seed firms, which cost more;
 * - a herb or perennial in a 9 cm pot: buyplants.co.uk (about £2.70 each in a six), eBay and Tesco Marketplace (£6 to £7);
 * - a strawberry runner: rhsplants.co.uk (5 bare roots £7.99, about £1.60 each);
 * - a shrub in a 2 or 3 litre pot: crocus.co.uk (from about £26 for a 2 litre cistus); cheaper at garden centres;
 * - a bare-root fruit tree: ashridgetrees.co.uk (from £19.99) and rootsplants.co.uk (£26 to £50);
 * - a spring bulb: suttons.co.uk's 2024 catalogue (about 20p to 40p) and parrot tulips on wowcher.co.uk (50p to 60p).
 * Shown as "about": they change, and vary a lot by size and seller.
 */
export const PRICES = {
  packet: [1, 3],
  potted: [3, 7],
  runner: [1, 2],
  shrub: [15, 30],
  tree: [20, 50],
  bulb: [0.2, 0.6],
} as const satisfies Record<string, readonly [number, number]>;

export type Buy = keyof typeof PRICES;

/** How it's usually bought: annuals as seed, perennials as plants, bulbs as bulbs. */
export function buyAs(p: Plant): Buy {
  const form = p.art?.form;
  if (p.category === 'tree' || form === 'tree') return 'tree';
  if (form === 'bulb') return 'bulb';
  if (p.category === 'shrub' || (p.category === 'fruit' && (form === 'shrub' || form === 'climber'))) return 'shrub';
  if (!perennial(p) && p.sowing?.length) return 'packet';
  if (p.category === 'fruit' && (p.size.heightMm ?? 1000) <= 400) return 'runner';
  return 'potted';
}

export interface Cost {
  low: number;
  high: number;
  /** A packet you already have. */
  inTin: boolean;
}

/** What it would cost: one packet of seed (nothing if you have some), or so many plants or bulbs. */
export function costOf(p: Plant, count: number, g: Garden, plantOf: (id: string) => Plant): Cost {
  const buy = buyAs(p);
  if (buy === 'packet') {
    const tin = seedPrice(g, p, plantOf);
    const inTin = tin !== null || (g.seeds ?? []).some((k) => k.count !== 0 && (k.plantId === p.id || plantOf(k.plantId).varietyOf === p.id));
    return inTin ? { low: 0, high: 0, inTin } : { low: PRICES.packet[0], high: PRICES.packet[1], inTin };
  }
  const [lo, hi] = PRICES[buy];
  return { low: lo * count, high: hi * count, inTin: false };
}

const pounds = (n: number) => (n < 1 ? `${Math.round(n * 100)}p` : Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`);

/** "Seed in your tin", "about £1 to £3", "about £45 to £105". */
export function costText(c: Cost): string {
  if (c.inTin) return 'Seed in your tin';
  const [lo, hi] = [roundCost(c.low), roundCost(c.high)];
  return lo === hi ? `about ${pounds(lo)}` : `about ${pounds(lo)} to ${pounds(hi)}`;
}

const roundCost = (n: number) => (n < 5 ? Math.round(n * 10) / 10 : Math.round(n));

// ---------- Effort ----------

/**
 * About how many minutes a week it takes, worked out from what the library knows rather than stored: sowing
 * indoors and hardening off, feeding, watering, tying in and frost watch all add to it, and so does the area. Woody
 * plants and bulbs ask little once they're in; vegetables ask the most. Pots need watering most days.
 */
export function minutesAWeek(p: Plant, spot: Pick<Spot, 'feature' | 'cover'>, areaM2: number): number {
  return roundMinutes(baseMinutes(spot) + workMinutes(p, spot, areaM2));
}

/** A few minutes to look round, and a pot dries out fast: a few minutes most days, whatever's in it. */
const baseMinutes = (spot: Pick<Spot, 'feature'>) => 2 + (spot.feature.kind === 'pot' || spot.feature.kind === 'planter' ? 5 : 0);
const roundMinutes = (raw: number) => Math.max(5, Math.round(raw / 5) * 5);

function workMinutes(p: Plant, spot: Pick<Spot, 'feature' | 'cover'>, areaM2: number): number {
  const buy = buyAs(p);
  let points = buy === 'tree' || buy === 'shrub' ? 0.3 : buy === 'bulb' ? 0.2 : perennial(p) ? 0.8 : p.category === 'vegetable' ? 2 : 1.2;
  const sowing = p.sowing ?? [];
  if (buy === 'packet' && sowing.length && !sowing.some((s) => s.method === 'direct')) points += 1;
  if (p.feeding?.need === 'hungry') points += 1;
  else if (p.feeding?.need === 'moderate') points += 0.5;
  if (p.conditions.moisture === 'moist') points += 0.5;
  if (isTender(p) && !spot.cover) points += 0.5;
  if (p.art?.form === 'climber') points += 0.5;
  return points * 3 * Math.max(0.5, areaM2);
}

/** "about 20 minutes a week", "about an hour a week", "about 3 hours a week". */
export function effortText(minutes: number): string {
  if (minutes < 50) return `about ${minutes} minutes a week`;
  if (minutes < 90) return 'about an hour a week';
  return `about ${Math.round(minutes / 60)} hours a week`;
}

// ---------- When ----------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const month = (iso: string) => Number(iso.slice(5, 7));

/** Months it can go in here: sown (from seed), or planted (plants and bulbs). Woody plants go in outside high summer. */
function startMonths(p: Plant, cover: Climate | null): number[] {
  if (buyAs(p) === 'packet') {
    const months = (p.sowing ?? []).filter((s) => cover || s.method !== 'cold-frame').flatMap((s) => s.months);
    return [...new Set(months)];
  }
  const out = plantOutMonthsUnder(p, cover);
  if (out.length) return out;
  if (p.sowing?.length) return [...new Set(p.sowing.flatMap((s) => s.months))];
  return [3, 4, 10, 11];
}

export interface Timing {
  /** When it can go in: today, or the first day of the next month it can. */
  start: string;
  /** When there's first something to pick (or flowers), or null for a plant grown for its leaves or shape. */
  ready: string | null;
  /** When it's finished and the bed is free again, for a crop; null for anything that stays. */
  done: string | null;
}

export function timingOf(p: Plant, today: string, cover: Climate | null): Timing | null {
  const start = nextInMonths(today, startMonths(p, cover));
  if (!start) return null;
  const crop = p.cropping?.harvestMonths?.length ? p.cropping.harvestMonths : flowerMonthsOf(p);
  let earliest: string;
  if (p.growth?.days) {
    // Days to crop count from planting out for most; seed sown indoors takes about six weeks to get there.
    const indoors = buyAs(p) === 'packet' && p.growth.from !== 'sowing' && !(p.sowing ?? []).some((s) => s.method === 'direct' && s.months.includes(month(start)));
    earliest = addDays(start, p.growth.days[0] + (indoors ? 42 : 0));
  } else earliest = addDays(start, perennial(p) ? 30 : 60);
  const ready = crop.length ? nextInMonths(earliest, crop) : null;
  const days = perennial(p) ? null : daysToCrop(p, month(start));
  return { start, ready, done: days === null ? null : addDays(start, days) };
}

// ---------- Ideas ----------

export interface Idea {
  id: string;
  title: string;
  /** The plants, by id: one, or a mix from a kit. */
  plants: string[];
  /** For a single plant: one, a row or the whole bed. */
  fill?: Fill;
  /** For a mix: the kit bed it's planted from. */
  mix?: KitBed;
  count: number;
  cost: Cost;
  minutes: number;
  timing: Timing;
  /** Why it suits, the best reason first: two or three short lines. */
  why: string[];
  score: number;
}

export interface InspireContext {
  plants: Plant[];
  plantOf: (id: string) => Plant;
  today: string;
}

const BAND = (h: number) => (h >= 6 ? 'full sun' : h >= 3 ? 'part shade' : 'shade');
const hoursText = (h: number) => `${Math.round(h * 2) / 2} h`;

/** Why a plant can't go here, or null if it can: sun, room, cover and the time it takes. */
function unsuited(p: Plant, spot: Spot, a: Answers, t: Timing, today: string): string | null {
  if (p.category === 'weed') return 'weed';
  const buy = buyAs(p);
  if (spot.cover && (buy === 'tree' || buy === 'shrub' || buy === 'bulb')) return 'cover';
  // On a lawn: a tree, a shrub or bulbs, not fruit canes or a bed's plants.
  if (isLawnish(spot.feature) && !(buy === 'tree' || buy === 'bulb' || (buy === 'shrub' && p.category === 'shrub'))) return 'lawn';
  if (spreadOf(p) > spot.room * 1.1) return 'room';
  if (spot.feature.kind === 'pot' && buy === 'tree') return 'room';
  // A tender plant that stays (citrus, agapanthus) needs bringing in for winter: not for a bed outside.
  if (perennial(p) && isTender(p) && !spot.cover && p.wintering?.type !== 'lift-and-store' && spot.feature.kind !== 'pot') return 'tender';
  if (spot.hours !== null) {
    if (spot.hours < sunNeeded(p) - 0.5) return 'sun';
    if (p.conditions.light === 'shade' && spot.hours > 6) return 'sun';
  }
  if (spot.until) {
    if (perennial(p) || !t.done || t.done > spot.until) return 'until';
  }
  const startIn = daysBetween(today, t.start);
  if (a.when === 'soon') {
    if (startIn > SOON_START_DAYS || !t.ready || daysBetween(today, t.ready) > SOON_READY_DAYS) return 'when';
  } else if (a.when === 'year') {
    if (buy === 'tree' || daysBetween(today, t.ready ?? t.start) > 365) return 'when';
  } else if (!perennial(p)) return 'when';
  return null;
}

/** "Sow in March, picking from June", "Plant now, flowers from May", or "Plant in November; fruit after a few years". */
export function whenText(p: Plant, t: Timing, today: string): string {
  const verb = buyAs(p) === 'packet' ? 'Sow' : 'Plant';
  const start = t.start === today ? `${verb} now` : `${verb} in ${MONTH_NAMES[month(t.start) - 1]}`;
  const crop = !!p.cropping?.harvestMonths?.length;
  if (buyAs(p) === 'tree' && crop) return `${start}; fruit after a few years`;
  if (!t.ready) return perennial(p) ? `${start}; it stays for years` : start;
  return `${start}, ${crop ? 'picking' : 'flowers'} from ${MONTH_NAMES[month(t.ready) - 1]}`;
}

function reasons(p: Plant, spot: Spot, g: Garden, cost: Cost, t: Timing, today: string, minutes: number): { why: string[]; bonus: number } {
  const why: { text: string; weight: number }[] = [];
  if (spot.hours !== null) {
    const need = sunNeeded(p);
    const where = isLawnish(spot.feature) ? 'there' : 'here';
    if (need >= 6) why.push({ text: `About ${hoursText(spot.hours)} of sun ${where} in June: it wants full sun`, weight: 2 });
    else if (spot.hours < 3) why.push({ text: `It's happy in shade: about ${hoursText(spot.hours)} of sun ${where} in June`, weight: 2.5 });
    else why.push({ text: `About ${hoursText(spot.hours)} of sun ${where} in June, which suits it`, weight: 1.5 });
  }
  // Under glass, tender crops gain the most, above all those never sown outside: tomatoes, peppers, aubergines.
  if (spot.cover && isTender(p) && p.cropping?.harvestMonths.length && p.category !== 'flower')
    why.push({ text: 'A tender crop, so glass gives it a longer season', weight: (p.sowing ?? []).some((s) => s.method === 'direct') ? 2 : 3.5 });
  if (cost.inTin) why.push({ text: 'You have the seed already', weight: 3 });
  if (g.wishlist.includes(p.id)) why.push({ text: "It's on your sowing list", weight: 3 });
  if (t.ready && daysBetween(today, t.ready) <= 70 && !perennial(p)) why.push({ text: `Quick: ready in about ${Math.max(1, Math.round(daysBetween(today, t.ready) / 7))} weeks`, weight: 1.5 });
  if (p.pollinators?.rating === 'good') why.push({ text: `Good for ${p.pollinators.visitors?.includes('bees') ? 'bees' : (p.pollinators.visitors?.[0] ?? 'pollinators')}`, weight: 1 });
  if (perennial(p)) why.push({ text: 'Comes back every year', weight: 1 });
  if (minutes <= 10) why.push({ text: 'Little work once it’s in', weight: 0.8 });
  why.sort((a, b) => b.weight - a.weight);
  return { why: why.slice(0, 3).map((w) => w.text), bonus: why.reduce((n, w) => n + (w.weight >= 3 ? w.weight : 0), 0) };
}

/** The ways to plant it, most first, within the budget: a bed full, a row, or one. */
function fillsToTry(p: Plant, spot: Spot): Fill[] {
  if (isLawnish(spot.feature)) return ['one'];
  const ok = fillsFor(p, spot.feature);
  const buy = buyAs(p);
  // A shrub or tree on its own; perennials and bulbs as a drift, a row or one, as the budget allows.
  if (buy === 'shrub' || buy === 'tree') return ['one'];
  if (buy !== 'packet') return (['fill', 'row', 'one'] as Fill[]).filter((f) => ok.includes(f));
  // Seed the usual way (a row of carrots, one courgette); tall crops such as tomatoes in a row, not a forest.
  const usual = defaultFill(p, spot.feature);
  const first: Fill = usual === 'fill' && (p.size.heightMm ?? 0) >= 1000 ? 'row' : usual;
  return [...new Set<Fill>([first, 'one'])].filter((f) => ok.includes(f));
}

/** The planting an idea makes for one plant, before it has an id. */
function shapeFor(p: Plant, spot: Spot, fill: Fill): Planting {
  const f = spot.feature;
  if (isLawnish(f) && buyAs(p) === 'bulb') {
    // A drift of bulbs, a metre across (or as much as there's room for).
    const half = Math.round(Math.min(1000, spot.room * 0.7) / 2);
    const [x, y] = spot.at;
    return { ...makePlanting(p, f.id, 'block', [x - half, y - half], [x + half, y + half]) };
  }
  if (isLawnish(f)) return makePlanting(p, f.id, 'single', spot.at);
  const shape = fillPlanting(p, f, fill, spot.at);
  return { ...makePlanting(p, f.id, 'single', [shape.x, shape.y]), ...shape };
}

/**
 * Familiar, forgiving plants, offered before the rarer ones in the library: the things most people would recognise
 * and could buy at any garden centre. A choice about what to suggest, not a fact about the plants.
 */
export const FAMILIAR = new Set([
  // Vegetables and salads
  'broad-bean', 'runner-bean', 'french-bean', 'pea', 'potato', 'onion', 'garlic', 'leek', 'spring-onion', 'carrot', 'beetroot', 'radish',
  'lettuce', 'spinach', 'chard', 'kale', 'courgette', 'winter-squash', 'cucumber', 'tomato', 'chilli', 'sweet-pepper', 'rocket', 'pak-choi', 'mangetout',
  // Herbs
  'basil', 'parsley', 'coriander', 'chives', 'mint', 'rosemary', 'thyme', 'sage', 'dill', 'oregano', 'bay',
  // Fruit
  'strawberry', 'raspberry', 'blackcurrant', 'redcurrant', 'gooseberry', 'blueberry', 'rhubarb', 'apple', 'pear', 'plum', 'crab-apple', 'rowan',
  // Flowers and bulbs
  'sweet-pea', 'sunflower', 'french-marigold', 'calendula', 'nasturtium', 'cosmos', 'zinnia', 'tulip', 'daffodil', 'snowdrop', 'crocus', 'ornamental-allium',
  'lavender', 'foxglove', 'lupin', 'hardy-geranium', 'hellebore', 'echinacea', 'rudbeckia', 'verbena-bonariensis', 'cornflower', 'nigella', 'catmint',
  'salvia-nemorosa', 'hosta', 'sedum', 'japanese-anemone', 'aquilegia', 'grape-hyacinth', 'hardy-cyclamen', 'forget-me-not', 'viola', 'wallflower',
  // Shrubs and climbers
  'buddleja', 'hydrangea', 'hardy-fuchsia', 'hebe', 'viburnum-tinus', 'choisya', 'skimmia', 'mahonia', 'clematis', 'honeysuckle', 'climbing-rose',
  'star-jasmine', 'heather', 'cistus', 'escallonia', 'russian-sage',
]);

/** The mixes on offer: beds from the starter kits that work on their own. */
export const MIXES: { id: string; title: string; kit: string; bed: number }[] = [
  { id: 'mix-salad', title: 'A salad bed', kit: 'salad-bed', bed: 0 },
  { id: 'mix-first-veg', title: 'Easy veg in rows', kit: 'first-veg-bed', bed: 0 },
  { id: 'mix-bees', title: 'Flowers for bees', kit: 'pollinator-garden', bed: 0 },
  { id: 'mix-herbs', title: 'Kitchen herbs', kit: 'herb-balcony', bed: 0 },
];

function single(p: Plant, spot: Spot, a: Answers, g: Garden, ctx: InspireContext): Idea | null {
  const timing = timingOf(p, ctx.today, spot.cover);
  if (!timing || unsuited(p, spot, a, timing, ctx.today)) return null;
  for (const fill of fillsToTry(p, spot)) {
    const pl = shapeFor(p, spot, fill);
    const count = plantCount(pl, p);
    const cost = costOf(p, count, g, ctx.plantOf);
    if (cost.high > a.budget && a.budget !== 50) continue;
    // The area that needs looking after: the bed, a strip along it, or round one plant (a tree's canopy needs little).
    const area = fill === 'fill' && !isLawnish(spot.feature) ? spot.areaM2 : fill === 'row' ? Math.min(spot.areaM2, (spot.room / 1000) * 0.3 + 0.2) : Math.min(1, Math.max(0.3, (spreadOf(p) / 1000) ** 2));
    const minutes = minutesAWeek(p, spot, area);
    if (minutes > a.time * 1.5) continue;
    const { why, bonus } = reasons(p, spot, g, cost, timing, ctx.today, minutes);
    const readyIn = daysBetween(ctx.today, timing.ready ?? timing.start);
    const sunFit = spot.hours === null ? 0 : -Math.abs(Math.min(spot.hours, 10) - Math.max(sunNeeded(p), 2)) / 4;
    const score =
      bonus +
      sunFit -
      cost.high / (a.budget * 2) -
      minutes / (a.time * 2) -
      (a.when === 'years' ? 0 : readyIn / 120) +
      (p.pollinators?.rating === 'good' ? 0.3 : 0) +
      (FAMILIAR.has(p.varietyOf ?? p.id) ? 1 : 0);
    return { id: p.id, title: p.commonName, plants: [p.id], fill, count, cost, minutes, timing, why, score };
  }
  return null;
}

function mixIdea(m: (typeof MIXES)[number], spot: Spot, a: Answers, g: Garden, ctx: InspireContext): Idea | null {
  // Not on a lawn or in a pot, and not in a short gap: a mix is sown in batches over weeks.
  if (spot.feature.kind === 'surface' || spot.feature.kind === 'pot' || spot.until) return null;
  const bed = KITS.find((k) => k.id === m.kit)?.beds[m.bed];
  if (!bed) return null;
  const plants = bed.items.map((i) => ctx.plants.find((p) => p.id === i.plant)).filter((p): p is Plant => !!p);
  if (plants.length !== bed.items.length || plants.length < 2) return null;
  const share = spot.areaM2 / plants.length;
  const timings: Timing[] = [];
  for (const p of plants) {
    const t = timingOf(p, ctx.today, spot.cover);
    if (!t || unsuited(p, { ...spot, room: Math.max(spot.room / plants.length, spot.room * 0.4) }, a, t, ctx.today)) return null;
    timings.push(t);
  }
  // Each plant in its share of the bed, as the kit sets it out.
  const trial = plantKitBed({ ...g, plantings: [] }, spot.feature, bed, ctx.plantOf, ctx.today);
  const counts = new Map<string, number>();
  for (const pl of trial.plantings) counts.set(pl.plantId, (counts.get(pl.plantId) ?? 0) + plantCount(pl, ctx.plantOf(pl.plantId)));
  const costs = plants.map((p) => costOf(p, counts.get(p.id) ?? 1, g, ctx.plantOf));
  const cost: Cost = { low: costs.reduce((n, c) => n + c.low, 0), high: costs.reduce((n, c) => n + c.high, 0), inTin: costs.every((c) => c.inTin) };
  if (cost.high > a.budget && a.budget !== 50) return null;
  const minutes = roundMinutes(baseMinutes(spot) + plants.reduce((n, p) => n + workMinutes(p, spot, share), 0));
  if (minutes > a.time * 1.5) return null;
  const order = timings.map((t, i) => ({ t, p: plants[i]! })).sort((x, y) => (x.t.ready ?? x.t.start).localeCompare(y.t.ready ?? y.t.start));
  const first = order[0]!;
  const names = plants.map((p) => p.commonName.toLowerCase());
  const why = [`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`];
  if (spot.hours !== null) why.push(`About ${hoursText(spot.hours)} of sun here in June: ${BAND(spot.hours)}`);
  if (plants.every((p) => p.pollinators?.rating === 'good')) why.push('Good for bees');
  const readyIn = daysBetween(ctx.today, first.t.ready ?? first.t.start);
  // Its plants are all familiar ones, like the best single ideas.
  const score = 1.2 - cost.high / (a.budget * 2) - minutes / (a.time * 2) - (a.when === 'years' ? 0 : readyIn / 120);
  return { id: m.id, title: m.title, plants: plants.map((p) => p.id), mix: bed, count: trial.plantings.length, cost, minutes, timing: { ...first.t, done: null }, why, score };
}

/**
 * Three ideas for a spot, best first, each of a different kind where it can be: a vegetable, a flower and a mix,
 * rather than three salads. Varieties come in only when there's a packet of one in the seed tin.
 */
export function inspire(g: Garden, spot: Spot, a: Answers, ctx: InspireContext, n = 3): Idea[] {
  const inTin = new Set((g.seeds ?? []).filter((k) => k.count !== 0).map((k) => k.plantId));
  const ideas: Idea[] = [];
  for (const p of ctx.plants) {
    if (p.varietyOf && !inTin.has(p.id)) continue;
    const idea = single(p, spot, a, g, ctx);
    if (idea) ideas.push(idea);
  }
  for (const m of MIXES) {
    const idea = mixIdea(m, spot, a, g, ctx);
    if (idea) ideas.push(idea);
  }
  ideas.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
  // Nothing far behind the best: three good ideas beat two and an odd one.
  const floor = (ideas[0]?.score ?? 0) - 3;
  const kind = (i: Idea) => (i.mix ? 'mix' : ctx.plantOf(i.plants[0]!).category);
  const family = (i: Idea) => ctx.plantOf(i.plants[0]!).varietyOf ?? i.plants[0]!;
  const out: Idea[] = [];
  // Different kinds first, then the best of the rest; never two of the same plant.
  for (const pass of [true, false])
    for (const i of ideas) {
      if (out.length >= n) break;
      if (i.score < floor || out.includes(i) || out.some((o) => family(o) === family(i))) continue;
      if (pass && out.some((o) => kind(o) === kind(i))) continue;
      out.push(i);
    }
  return out.sort((x, y) => y.score - x.score);
}

/** Why there are no ideas: the likeliest thing to change. */
export function nothingText(spot: Spot, a: Answers, today: string): string {
  if (spot.until) return `Something's planned here from ${Number(spot.until.slice(8, 10))} ${MONTH_NAMES[month(spot.until) - 1]}, and nothing quick would be done by then.`;
  if (a.when === 'soon') return `Not much goes in outside in ${MONTH_NAMES[month(today) - 1]} and crops within four months. Try “${WHEN_LABEL.year}”.`;
  if (a.budget === 10) return `Nothing fits under £10 here. Try a bigger budget.`;
  if (a.time === 10) return `Everything that would grow here needs more than 10 minutes a week. Try “${TIME_LABEL[60]}”.`;
  return 'Nothing in the library suits this spot with those answers. Try different ones.';
}

/** Plants an idea in its spot, and puts anything from seed on your sowing list. One change, so one undo. */
export function plantIdea(g: Garden, spot: Spot, idea: Idea, plantOf: (id: string) => Plant, today: string): Garden {
  let next = g;
  if (idea.mix) next = plantKitBed(g, spot.feature, idea.mix, plantOf, today);
  else {
    const p = plantOf(idea.plants[0]!);
    next = addPlanting(g, shapeFor(p, spot, idea.fill ?? 'one'));
  }
  for (const id of idea.plants) if (buyAs(plantOf(id)) === 'packet' && !next.wishlist.includes(id)) next = toggleWishlist(next, id);
  return next;
}

/** "Sow in March, picking from June" for an idea: its first plant's, for a mix. */
export const ideaWhen = (idea: Idea, plantOf: (id: string) => Plant, today: string) => whenText(plantOf(idea.plants[0]!), idea.timing, today);
