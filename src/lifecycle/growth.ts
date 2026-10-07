// Growing degree days: when a crop is likely to be ready, from the warmth it
// gets. The plant data's months and days describe a usual year in the middle
// of England; the warmth a crop gets there in that time is what it needs
// anywhere. So it's ready sooner in the south, in high summer and under glass,
// and later in the north, in a cold spring or from an early sowing. Pure
// functions.

import { actualTable, averagesAt, coverKey, dailyTable, daysUntil, dayIndex, REFERENCE, sumOver, type Averages } from '../climate/warmth';
import type { Climate, Garden, Plant, Planting } from '../model/types';
import type { Weather } from '../weather/weather';
import { addDays, isTender } from './shed';
import { sowingOf } from './stages';

/** Below this a plant hardly grows: its own, or 10 °C for tender plants and 5 °C for the rest. */
export const baseOf = (p: Plant): number => p.growth?.baseC ?? (isTender(p) ? 10 : 5);

const gardens = new WeakMap<Garden, Averages>();
/** The garden's usual temperatures, kept with the garden while it's unchanged. */
export function averagesOf(g: Garden): Averages {
  let av = gardens.get(g);
  if (!av) gardens.set(g, (av = averagesAt(g.latitude, g.longitude)));
  return av;
}
const reference = () => averagesAt(...REFERENCE);

/** The year the reference dates fall in: any year that isn't a leap year. */
const REF_YEAR = 2027;
const iso = (m: number, d: number) => `${REF_YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (m: number) => new Date(Date.UTC(REF_YEAR, m, 0)).getUTCDate();

/** Runs of months in year order, a run across the new year kept whole: [3,4,5,9,10] → [[3,4,5],[9,10]]; [11,12,1] → [[11,12,1]]. */
export function runsOf(months: number[]): number[][] {
  const set = new Set(months);
  if (!set.size) return [];
  if (set.size === 12) return [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]];
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  return starts.map((s) => {
    const run = [s];
    for (let m = (s % 12) + 1; set.has(m); m = (m % 12) + 1) run.push(m);
    return run;
  });
}

const middles = new Map<string, string>();

/** The middle of a run of months, in the reference year: [3..7] → 16 May. */
export function middleOf(run: number[]): string {
  const key = run.join(',');
  const hit = middles.get(key);
  if (hit) return hit;
  const from = iso(run[0]!, 1);
  const to = iso(run[run.length - 1]!, lastDay(run[run.length - 1]!));
  const span = (dayIndex(to) - dayIndex(from) + 365) % 365;
  const mid = addDays(from, Math.round(span / 2));
  middles.set(key, mid);
  return mid;
}

/**
 * The run of months a start falls in, or the last one to start before it. Null for a run starting from August on: an
 * autumn sowing grows on through the winter, and its spring timing (which the days describe) doesn't apply.
 */
function runFor(months: number[], start: string): number[] | null {
  const runs = runsOf(months);
  if (!runs.length) return null;
  const m = Number(start.slice(5, 7));
  const before = (r: number[]) => (m - r[0]! + 12) % 12;
  const run = runs.find((r) => r.includes(m)) ?? [...runs].sort((a, b) => before(a) - before(b))[0]!;
  return run[0]! >= 8 ? null : run;
}

/** The months a crop's days are counted from: sowing outside, or planting out. */
function startMonths(p: Plant, from: 'sowing' | 'planting'): number[] {
  const sowing = p.sowing ?? [];
  if (from === 'planting' && p.plantOutMonths?.length) return p.plantOutMonths;
  const direct = sowing.filter((s) => s.method === 'direct').flatMap((s) => s.months);
  return direct.length ? direct : sowing.flatMap((s) => s.months);
}

/** Seedlings raised indoors have about four weeks' head start on a sowing outside. */
const HEAD_START = 28;

/**
 * Warmth isn't all a plant needs: light and day length matter too, so a cool spell slows it less than the degree days
 * alone say, and a hot one hurries it less. The change from the usual days is damped: degree days saying twice as long
 * means about 1.5 times as long.
 */
export const DAMPING = 0.6;

/** Projections stay within these shares of the usual days: the averages can't tell a crop to take for ever. */
const FASTEST = 0.5;
const SLOWEST = 2;

const needed = new Map<string, number>();

/** Degree days a crop needs over these many days from a reference start: what it gets in the middle of England. */
function warmthNeeded(base: number, refStart: string, days: number): number {
  const key = `${base}|${refStart}|${days}`;
  let n = needed.get(key);
  if (n === undefined) {
    n = sumOver(dailyTable(reference(), base), refStart, days);
    needed.set(key, n);
  }
  return n;
}

/**
 * When something that usually takes `days` (from a start in these months) is done, started on `start` in this garden:
 * the day it's had the warmth it would have had in the middle of England. With this year's weather, the days it covers
 * count as they were (or are forecast to be). Null when the months don't say when it usually starts.
 */
export function afterWarmth(p: Plant, g: Garden, cover: Climate | null, start: string, days: number, months: number[], weather: Weather | null = null): string | null {
  const run = runFor(months, start);
  if (!run || days <= 0) return null;
  const base = baseOf(p);
  const need = warmthNeeded(base, middleOf(run), days);
  const limit = Math.ceil(days * SLOWEST ** (1 / DAMPING));
  const n = daysUntil(dailyTable(averagesOf(g), base, cover), start, need, limit, weather && actualTable(weather, base, cover)) ?? limit;
  const damped = days * (n / days) ** DAMPING;
  return addDays(start, Math.round(Math.min(days * SLOWEST, Math.max(days * FASTEST, damped))));
}

/**
 * When a crop is likely to be ready, from when it went in the ground (sown outside or planted out): the first harvest,
 * or the first flowers for a plant grown for its flowers. `share` of the way there gives an earlier milestone, such
 * as a fruiting crop's first flowers. Null without the plant's days, or for an autumn sowing.
 */
export function readyFrom(p: Plant, pl: Planting, g: Garden, start: string, cover: Climate | null, share = 1, weather: Weather | null = null): string | null {
  const growth = p.growth;
  if (!growth?.days) return null;
  const usual = (growth.days[0] + growth.days[1]) / 2;
  // The days count from sowing or from planting out; a planting started the other way is a few weeks ahead or behind.
  const sown = sowingOf(p, pl) === 'direct';
  const from = growth.from ?? 'planting';
  const days = from === 'planting' && sown ? usual + HEAD_START : from === 'sowing' && !sown ? Math.max(14, usual - HEAD_START) : usual;
  return afterWarmth(p, g, cover, start, Math.round(days * share), startMonths(p, sown ? 'sowing' : 'planting'), weather);
}

/** When seeds sown outside come up: their usual days, faster in warm soil and slower in cold. */
export function upFrom(p: Plant, g: Garden, sownOn: string, cover: Climate | null, usualDays: number, weather: Weather | null = null): string {
  return afterWarmth(p, g, cover, sownOn, usualDays, startMonths(p, 'sowing'), weather) ?? addDays(sownOn, usualDays);
}

/** Shifts for each place's averages, by cover and month. */
const shifts = new WeakMap<Averages, Map<string, number>>();

/** The furthest a season moves: six weeks either way. */
const MAX_SHIFT = 42;

/** Seasons are measured above 5 °C, as for most plants: above 10 °C a few degrees under glass would move them months. */
const SEASON_BASE = 5;

/**
 * How many days later (or sooner, if negative) a seasonal milestone comes in this garden than in the middle of England:
 * the day the warmth since 1 January matches the reference's on the 1st of `month`. Flowers and fruit on perennials
 * come on with the spring. Nothing moves in midwinter, when there's too little warmth to go by.
 */
export function seasonShift(g: Garden, cover: Climate | null, month: number): number {
  if (month < 2 || month > 9) return 0;
  const av = averagesOf(g);
  const base = SEASON_BASE;
  let mine = shifts.get(av);
  if (!mine) shifts.set(av, (mine = new Map()));
  const key = `${coverKey(cover)}|${month}`;
  const hit = mine.get(key);
  if (hit !== undefined) return hit;
  const target = dayIndex(iso(month, 1));
  const need = sumOver(dailyTable(reference(), base), iso(1, 1), target);
  let shift = 0;
  if (need >= 20) {
    const n = daysUntil(dailyTable(av, base, cover), iso(1, 1), need, 365);
    shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (n ?? target + MAX_SHIFT) - target));
  }
  mine.set(key, shift);
  return shift;
}

/** The first month of the run a set of months starts with in spring or summer, the one a season's shift is measured at. */
export function seasonMonth(months: number[]): number | null {
  const run = runsOf(months).find((r) => r[0]! >= 2 && r[0]! <= 9);
  return run ? run[0]! : null;
}

/** For the plant card: "Time to crop" and "About 60 to 80 days from planting out, sooner in a warm spell or under glass." */
export function growthText(p: Plant): { label: string; text: string } | null {
  const days = p.growth?.days;
  if (!days) return null;
  const crops = !!p.cropping?.harvestMonths.length;
  const span = days[0] === days[1] ? `${days[0]}` : `${days[0]} to ${days[1]}`;
  const from = p.growth?.from === 'sowing' ? 'sowing outside' : sowingOf(p) === 'none' ? 'planting' : 'planting out';
  return {
    label: crops ? 'Time to crop' : 'Time to flower',
    text: `About ${span} days from ${from} to the first ${crops ? 'harvest' : 'flowers'}: sooner in warm weather or under glass, and later in a cool spell or further north.`,
  };
}
