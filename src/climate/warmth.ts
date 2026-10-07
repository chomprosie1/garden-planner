// How warm the garden usually is, day by day, from UK climate averages, and
// growing degree days from that: the warmth above a plant's base temperature,
// added up day by day. A crop needs about the same warmth to come ready
// wherever it grows, so it takes longer in the north or in a cold spring, and
// less time in the south, in summer or under glass. Pure functions.
//
// The averages are each month's mean day (max) and night (min) temperatures
// for 16 UK stations, 1991–2020. A garden's are weighted from its three
// nearest stations. They're averages, not this year's weather.

import data from '../../data/climate/uk-stations.json';
import { dayNumber } from '../model/dates';
import type { Climate } from '../model/types';
import type { Weather } from '../weather/weather';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Each month's average day (max) and night (min) temperature, °C, January first. */
  tmax: number[];
  tmin: number[];
}

export const STATIONS: Station[] = data.stations;

/** A place's usual temperatures through the year, and the stations they come from, nearest first. */
export interface Averages {
  tmax: number[];
  tmin: number[];
  stations: Station[];
  /** Kilometres to the nearest station. */
  nearestKm: number;
}

/** Rough distance in km: plenty for weighting stations. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const k = Math.PI / 180;
  const x = (lon2 - lon1) * k * Math.cos(((lat1 + lat2) / 2) * k);
  const y = (lat2 - lat1) * k;
  return Math.hypot(x, y) * 6371;
}

const cache = new Map<string, Averages>();

/** The usual temperatures at a place: the three nearest stations, weighted by how near they are (inverse square). */
export function averagesAt(lat: number, lon: number): Averages {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const near = STATIONS.map((s) => ({ s, km: distanceKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
  // Within a couple of km, a station speaks for the garden on its own.
  const used = near[0]!.km < 2 ? [near[0]!] : near;
  const weights = used.map((n) => 1 / Math.max(1, n.km) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const blend = (pick: (s: Station) => number[]) =>
    Array.from({ length: 12 }, (_, m) => Math.round((used.reduce((sum, n, i) => sum + pick(n.s)[m]! * weights[i]!, 0) / total) * 100) / 100);
  const out: Averages = { tmax: blend((s) => s.tmax), tmin: blend((s) => s.tmin), stations: used.map((n) => n.s), nearestKm: Math.round(near[0]!.km) };
  cache.set(key, out);
  return out;
}

/**
 * The climate the plant data's months and days describe: the middle of England, where a new garden starts. A crop's
 * usual timing there is the yardstick for how much warmth it needs.
 */
export const REFERENCE: [lat: number, lon: number] = [52.5, -1.5];
export const referenceAverages = () => averagesAt(...REFERENCE);

// ---------- Day by day ----------

/** Days into a 365-day year, from 0 (1 January). 29 February counts as 28 February. */
export function dayIndex(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
  return leap && n >= 59 ? n - 1 : n;
}

/** The middle of each month, as a day index: the day each monthly average belongs to. */
const MID = [15, 45, 74, 104, 135, 165, 196, 227, 257, 288, 318, 349];

/** A month's averages drawn smoothly through the year: straight lines between the middles of months. */
function onDay(monthly: number[], day: number): number {
  let i = 11;
  while (i >= 0 && MID[i]! > day) i--;
  const [a, b] = i < 0 ? [11, 0] : [i, (i + 1) % 12];
  const from = i < 0 ? MID[11]! - 365 : MID[a]!;
  const to = b === 0 && i >= 0 ? MID[0]! + 365 : MID[b]!;
  const t = (day - from) / (to - from);
  return monthly[a]! + (monthly[b]! - monthly[a]!) * t;
}

/** The usual day and night temperature on a day of the year (an index from dayIndex). */
export function tempsOn(av: Pick<Averages, 'tmax' | 'tmin'>, day: number): { max: number; min: number } {
  return { max: onDay(av.tmax, day), min: onDay(av.tmin, day) };
}

/** Above this, most plants grow no faster: the warmth counts only up to here. */
export const UPPER_C = 30;

/**
 * Degree days for one day, from its warmest and coolest: the average of the two above the base, with the night
 * counted at the base when it's colder and the day capped at 30 °C (the "modified" method, used for crops).
 */
export function degreeDays(max: number, min: number, base: number): number {
  if (max <= base) return 0;
  const hi = Math.min(max, UPPER_C);
  const lo = Math.max(min, base);
  return Math.max(0, (hi + lo) / 2 - base);
}

/**
 * Under glass it's warmer. The day gain is for a sunny day; over sunny and dull days alike, with the vents open on hot
 * ones, it's about half that. A heated greenhouse is kept at 7 °C or more at night.
 */
export const DULL_DAY_SHARE = 0.5;
export const HEATED_MIN_C = 7;

export function underCover(t: { max: number; min: number }, c: Climate | null): { max: number; min: number } {
  if (!c) return t;
  const min = t.min + c.nightGainC;
  return { max: t.max + c.dayGainC * DULL_DAY_SHARE, min: c.heated ? Math.max(min, HEATED_MIN_C) : min };
}

/** A short key for a cover's climate, or outdoors. */
export const coverKey = (c: Climate | null) => (c ? `${c.heated ? 1 : 0},${c.dayGainC},${c.nightGainC}` : '-');

/** Tables for each place's averages (kept with them, as averagesAt hands back the same object for a place). */
const tables = new WeakMap<Pick<Averages, 'tmax' | 'tmin'>, Map<string, Float64Array>>();

/** Degree days for each day of the year, at a place, above a base, outdoors or under cover. Worked out once and kept. */
export function dailyTable(av: Averages, base: number, cover: Climate | null = null): Float64Array {
  let mine = tables.get(av);
  if (!mine) tables.set(av, (mine = new Map()));
  const key = `${base}|${coverKey(cover)}`;
  const hit = mine.get(key);
  if (hit) return hit;
  const out = new Float64Array(365);
  for (let d = 0; d < 365; d++) {
    const t = underCover(tempsOn(av, d), cover);
    out[d] = degreeDays(t.max, t.min, base);
  }
  mine.set(key, out);
  return out;
}

/** Degree days over a number of days, starting on a day. */
export function sumOver(table: Float64Array, from: string, days: number): number {
  let sum = 0;
  let d = dayIndex(from);
  for (let i = 0; i < days; i++) {
    sum += table[d]!;
    d = d === 364 ? 0 : d + 1;
  }
  return sum;
}

// ---------- This year's weather ----------

/** Degree days for the days the weather has, from its first day: NaN where a day is missing. */
export interface Actual {
  /** Day number of the first day. */
  start: number;
  dd: Float64Array;
}

const actuals = new WeakMap<Weather, Map<string, Actual>>();

/** This year's degree days, from the weather, above a base, outdoors or under cover. Worked out once and kept. */
export function actualTable(w: Weather, base: number, cover: Climate | null = null): Actual {
  let mine = actuals.get(w);
  if (!mine) actuals.set(w, (mine = new Map()));
  const key = `${base}|${coverKey(cover)}`;
  const hit = mine.get(key);
  if (hit) return hit;
  const dd = new Float64Array(w.tmax.length);
  for (let i = 0; i < dd.length; i++) {
    const [max, min] = [w.tmax[i], w.tmin[i]];
    if (max == null || min == null) dd[i] = NaN;
    else {
      const t = underCover({ max, min }, cover);
      dd[i] = degreeDays(t.max, t.min, base);
    }
  }
  const out = { start: dayNumber(w.from), dd };
  mine.set(key, out);
  return out;
}

/**
 * Days from a day until this many degree days have built up; null if they don't within the limit. Days the weather
 * has (what's happened and the forecast) count as they were; the rest, as usual.
 */
export function daysUntil(table: Float64Array, from: string, needed: number, limit = 730, actual: Actual | null = null): number | null {
  if (needed <= 0) return 0;
  let sum = 0;
  let d = dayIndex(from);
  // Where this day falls in the weather, if it does.
  let k = actual ? dayNumber(from) - actual.start : -1;
  const len = actual ? actual.dd.length : 0;
  for (let i = 1; i <= limit; i++) {
    const real = k >= 0 && k < len ? actual!.dd[k]! : NaN;
    sum += Number.isNaN(real) ? table[d]! : real;
    if (sum >= needed) return i;
    d = d === 364 ? 0 : d + 1;
    k++;
  }
  return null;
}

/**
 * How this year compares with the usual, from 1 January to a day: degree days above 5 °C, so far and as usual. Null
 * when the weather doesn't cover those days.
 */
export function yearSoFar(w: Weather, av: Averages, today: string): { actual: number; usual: number } | null {
  const jan1 = `${today.slice(0, 4)}-01-01`;
  const a = actualTable(w, 5);
  const from = dayNumber(jan1) - a.start;
  const to = dayNumber(today) - a.start;
  if (from < 0 || to > a.dd.length || to - from < 30) return null;
  let actual = 0;
  for (let i = from; i < to; i++) {
    if (Number.isNaN(a.dd[i]!)) return null;
    actual += a.dd[i]!;
  }
  const usual = sumOver(dailyTable(av, 5), jan1, to - from);
  return { actual: Math.round(actual), usual: Math.round(usual) };
}

// ---------- In a sentence ----------

/** Days in a usual year with the average temperature above a base: the growing season. */
export function seasonDays(av: Averages, base = 5): number {
  let n = 0;
  for (let d = 0; d < 365; d++) {
    const t = tempsOn(av, d);
    if ((t.max + t.min) / 2 > base) n++;
  }
  return n;
}

/** Degree days in a usual year, above a base. */
export const yearDegreeDays = (av: Averages, base = 5, cover: Climate | null = null) => Math.round(dailyTable(av, base, cover).reduce((a, b) => a + b, 0));

export const stationNames = (av: Averages) => av.stations.map((s) => s.name);
