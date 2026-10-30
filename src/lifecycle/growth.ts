// Growing degree days: when a crop is likely to be ready, from the warmth it
// gets. The plant data's months and days describe a usual year in the middle
// of England; the warmth a crop gets there in that time is what it needs
// anywhere. So it's ready sooner in the south, in high summer and under glass,
// and later in the north, in a cold spring or from an early sowing. Pure
// functions.

import { actualTable, averagesAt, averagesHere, coverKey, dailyTable, daysUntil, dayIndex, REFERENCE, sumOver, type Averages } from '../climate/warmth';
import type { Climate, Garden, Plant, Planting } from '../model/types';
import type { Weather } from '../weather/weather';
import { addDays, frostDates, inYear, isTender, ownFrostDays, PLAY_SAFE_DAYS } from './shed';
import { sowingOf } from './stages';

/** Below this a plant hardly grows: its own, or 10 °C for tender plants and 5 °C for the rest. */
export const baseOf = (p: Plant): number => p.growth?.baseC ?? (isTender(p) ? 10 : 5);

const gardens = new WeakMap<Garden, Averages>();
/** The garden's usual temperatures, kept with the garden while it's unchanged. */
export function averagesOf(g: Garden): Averages {
  let av = gardens.get(g);
  if (!av) gardens.set(g, (av = averagesHere(g)));
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

/** The months a crop's days are counted from: sowing outside, or planting out. Its usual months, which the days describe, wherever it's grown. */
function startMonths(here: Plant, from: 'sowing' | 'planting'): number[] {
  const p = listedAs.get(here) ?? here;
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

/** The furthest a season moves: eight weeks either way. */
const MAX_SHIFT = 56;

/** Seasons are measured above 5 °C, as for most plants: above 10 °C a few degrees under glass would move them months. */
const SEASON_BASE = 5;

/**
 * How many days later (or sooner, if negative) a seasonal milestone comes in this garden than in the middle of England:
 * the day the warmth since 1 January matches the reference's on the 1st of `month`. Your own last frost says it instead,
 * as its days after the reference's: you know your garden better than any average. A cover moves it the same either way.
 * Flowers and fruit on perennials come on with the spring. Nothing moves by the warmth in midwinter, when there's too
 * little to go by.
 */
export function seasonShift(g: Garden, cover: Climate | null, month: number): number {
  if (month < 2 || month > 9) return 0;
  const av = averagesOf(g);
  const own = ownFrostDays(g, REFERENCE[0]);
  let mine = shifts.get(av);
  if (!mine) shifts.set(av, (mine = new Map()));
  const key = `${coverKey(cover)}|${month}|${own}`;
  const hit = mine.get(key);
  if (hit !== undefined) return hit;
  const target = dayIndex(iso(month, 1));
  const need = sumOver(dailyTable(reference(), SEASON_BASE), iso(1, 1), target);
  const warmth = (c: Climate | null) => (need >= 20 ? (daysUntil(dailyTable(av, SEASON_BASE, c), iso(1, 1), need, 365) ?? target + MAX_SHIFT) - target : 0);
  const days = own === null ? warmth(cover) : own + (cover ? warmth(cover) - warmth(null) : 0);
  const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, days));
  mine.set(key, shift);
  return shift;
}

/** Whole months spring comes later here than in the middle of England: what a plant's months, in whole months, move by. */
export const monthsLater = (g: Garden): number => Math.max(0, Math.round(seasonShift(g, null, 4) / 30.4));

/**
 * In a late garden, the first day this can go outside, by its last frost: hardy plants eight weeks before it, half-hardy
 * ones such as seed potatoes two weeks before, whose shoots come up after it, and tender ones on the play-safe date. A
 * rule of thumb for a late, cold spring, not from a named source. Null where the plant's own months will do.
 */
export function earliestOut(p: Plant, g: Garden): string | null {
  if (!monthsLater(g)) return null;
  const days = /^\s*tender/i.test(p.conditions.hardiness ?? '') ? PLAY_SAFE_DAYS : isTender(p) ? -14 : -56;
  return addDays(inYear(frostDates(g).lastFrost, 2027), days);
}

/** Sown outside in autumn, these stand the winter only where it's mild: in a late garden they're sown in spring. */
const MILD_WINTERS_ONLY = ['broad-bean', 'broad-bean-autumn-sown'];

/**
 * A plant's months moved for a late garden. A spring window opens later: a long one (broad beans, February to April) loses
 * its first months, as it ends about the same time, and a short one (courgettes, April and May) moves along. A window
 * that opens from June is summer, and stays. A short autumn window closes earlier, as winter comes sooner. What's sown
 * outside goes in no sooner than `earliestOut`.
 */
function monthsHere(months: number[], k: number, from: number | null): number[] {
  const out: number[] = [];
  for (const run of runsOf(months)) {
    const start = run[0]!;
    if (start >= 2 && start <= 5) out.push(...(run.length >= 3 ? run.slice(Math.min(k, run.length - 1)) : run.map((m) => m + k).filter((m) => m <= 12)));
    else if (start >= 8 && run.length <= 3) out.push(...run.slice(0, Math.max(1, run.length - k)));
    else out.push(...run);
  }
  if (from === null) return out;
  // Months over before that day. If that leaves none, the month of that day: the card and the timeline say the same.
  const kept = out.filter((m) => m >= from || m >= 8);
  return kept.length ? kept : [from];
}

/** Each plant moved for a garden, and the plant as listed. */
const listedAs = new WeakMap<Plant, Plant>();
const local = new WeakMap<Garden, Map<Plant, Plant>>();

/** A plant as it's grown in this garden: its sowing and planting months moved for the season. The same plant where the months will do. */
export function plantHere(p: Plant, g: Garden): Plant {
  if (listedAs.has(p)) return p;
  const k = monthsLater(g);
  if (!k || (!p.sowing?.length && !p.plantOutMonths?.length)) return p;
  let mine = local.get(g);
  if (!mine) local.set(g, (mine = new Map()));
  const hit = mine.get(p);
  if (hit) return hit;
  const first = earliestOut(p, g);
  const from = first ? Number(first.slice(5, 7)) : null;
  const sowing = (p.sowing ?? []).map((s) => {
    const months = monthsHere(s.months, k, s.method === 'direct' ? from : null);
    return { ...s, months: s.method === 'direct' && MILD_WINTERS_ONLY.includes(p.id) ? months.filter((m) => m < 8) : months };
  });
  const here: Plant = {
    ...p,
    ...(p.sowing ? { sowing: sowing.filter((s) => s.months.length) } : {}),
    ...(p.plantOutMonths ? { plantOutMonths: monthsHere(p.plantOutMonths, k, null) } : {}),
  };
  listedAs.set(here, p);
  mine.set(p, here);
  return here;
}

/** The first month of the run a set of months starts with in spring or summer, the one a season's shift is measured at. */
export function seasonMonth(months: number[]): number | null {
  const run = runsOf(months).find((r) => r[0]! >= 2 && r[0]! <= 9);
  return run ? run[0]! : null;
}

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** For the plant card: "Time to crop" and "About 60 to 80 days from planting out, sooner in a warm spell or under glass." */
export function growthText(p: Plant): { label: string; text: string } | null {
  const days = p.growth?.days;
  if (!days) return null;
  const crops = !!p.cropping?.harvestMonths.length;
  const span = days[0] === days[1] ? `${days[0]}` : `${days[0]} to ${days[1]}`;
  const from = p.growth?.from === 'sowing' ? 'sowing outside' : sowingOf(p) === 'none' ? 'planting' : 'planting out';
  const label = crops ? 'Time to crop' : 'Time to flower';
  const what = crops ? 'harvest' : 'flowers';
  // Sown in autumn, it sits out the winter: the days (a spring sowing's) don't apply.
  const runs = (p.sowing ?? []).flatMap((s) => runsOf(s.months));
  const autumn = runs.some((r) => r[0]! >= 8);
  const spring = runs.some((r) => r[0]! < 8);
  const first = runsOf(crops ? p.cropping!.harvestMonths : (p.flowerMonths ?? [])).find((r) => r[0]! >= 3 && r[0]! <= 8)?.[0];
  const firstText = first ? `, from about ${MONTH_LONG[first - 1]}` : '';
  if (autumn && !spring) return { label, text: `Sown in autumn, it stands the winter and grows on in spring: the first ${what}${firstText}.` };
  return {
    label,
    text: `About ${span} days from ${from}${autumn ? ' in spring' : ''} to the first ${what}: sooner in warm weather or under glass, and later in a cool spell or further north.${autumn ? ` An autumn sowing stands the winter and is ready a few weeks before a spring one${firstText}.` : ''}`,
  };
}
