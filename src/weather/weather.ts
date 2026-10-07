// This year's weather, day by day: what it's been since last summer and the
// forecast for the next fortnight, from Open-Meteo (opt-in). It sharpens the
// year's projections, warns of frost, and tells the Water lens when it's
// rained. Pure functions: the fetching is in openMeteo.ts and the keeping in
// storage/weatherCache.ts.

import { addDays, dayNumber, fromDayNumber } from '../model/dates';

/** Each day's warmest, coolest and rain, in order from `from`. null where a day is missing. */
export interface Weather {
  /** The first day, ISO. */
  from: string;
  tmax: (number | null)[];
  tmin: (number | null)[];
  /** Rain (and snow, as water), mm. */
  rain: (number | null)[];
  /** The day it was fetched: from here on it's the forecast. */
  today: string;
  /** When it was fetched, ISO date and time. */
  fetchedAt: string;
  /** Where for, rounded as sent. */
  lat: number;
  lon: number;
}

export interface DayWeather {
  max: number;
  min: number;
  rain: number;
}

/** Rounded to about a kilometre: close enough for the weather, and no closer than it needs to be. */
export const roundPlace = (n: number) => Math.round(n * 100) / 100;

type Daily = Map<string, Partial<DayWeather>>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The days in an Open-Meteo reply ({ daily: { time, temperature_2m_max, temperature_2m_min, precipitation_sum } }).
 * Throws if it isn't one.
 */
export function parseDaily(json: unknown): Daily {
  const daily = (json as { daily?: Record<string, unknown> } | null)?.daily;
  const time = daily?.time;
  if (!daily || !Array.isArray(time)) throw new Error('Not an Open-Meteo daily reply.');
  const pick = (key: string) => (Array.isArray(daily[key]) ? (daily[key] as unknown[]) : []);
  const max = pick('temperature_2m_max');
  const min = pick('temperature_2m_min');
  const rain = pick('precipitation_sum');
  const out: Daily = new Map();
  time.forEach((t, i) => {
    if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
    const day: Partial<DayWeather> = {};
    const [a, b, r] = [num(max[i]), num(min[i]), num(rain[i])];
    if (a !== null) day.max = a;
    if (b !== null) day.min = b;
    if (r !== null) day.rain = r;
    out.set(t, day);
  });
  return out;
}

/** Days from several replies as one run of days; a later reply's day wins where both have it. */
export function makeWeather(replies: Daily[], today: string, fetchedAt: string, lat: number, lon: number): Weather | null {
  const all: Daily = new Map();
  for (const r of replies)
    for (const [d, v] of r) {
      const was = all.get(d) ?? {};
      all.set(d, { ...was, ...v });
    }
  const days = [...all.keys()].sort();
  if (!days.length) return null;
  const first = dayNumber(days[0]!);
  const n = dayNumber(days[days.length - 1]!) - first + 1;
  const w: Weather = { from: days[0]!, tmax: [], tmin: [], rain: [], today, fetchedAt, lat, lon };
  for (let i = 0; i < n; i++) {
    const v = all.get(fromDayNumber(first + i));
    w.tmax.push(v?.max ?? null);
    w.tmin.push(v?.min ?? null);
    w.rain.push(v?.rain ?? null);
  }
  return w;
}

/** The weather on a day, if it has all of it. */
export function weatherOn(w: Weather | null, iso: string): DayWeather | null {
  if (!w) return null;
  const i = dayNumber(iso) - dayNumber(w.from);
  const [max, min, rain] = [w.tmax[i], w.tmin[i], w.rain[i]];
  if (max == null || min == null || rain == null) return null;
  return { max, min, rain };
}

/** The last day it covers, ISO. */
export const lastDay = (w: Weather) => addDays(w.from, w.tmax.length - 1);

/** True when it's for this place and was fetched in the last few hours. */
export function isFresh(w: Weather | null, lat: number, lon: number, now: Date, hours = 6): boolean {
  if (!w || w.lat !== roundPlace(lat) || w.lon !== roundPlace(lon)) return false;
  return now.getTime() - new Date(w.fetchedAt).getTime() < hours * 3_600_000;
}

/** Usable for this place: the right place, and fetched in the last two weeks (the forecast runs out after that). */
export function usableFor(w: Weather | null, lat: number, lon: number, today: string): Weather | null {
  if (!w || w.lat !== roundPlace(lat) || w.lon !== roundPlace(lon)) return null;
  return lastDay(w) >= today ? w : null;
}

/** Rain over the days up to and including this one; null if any are missing. */
export function rainOver(w: Weather | null, iso: string, days: number): number | null {
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const d = weatherOn(w, addDays(iso, -i));
    if (!d) return null;
    sum += d.rain;
  }
  return Math.round(sum * 10) / 10;
}

/** Air this cold overnight means a frost is likely; a little warmer, a ground frost in sheltered spots. */
export const FROST_C = 1;
export const GROUND_FROST_C = 3;

export interface ColdNight {
  /** The day the cold comes, early in the morning. */
  date: string;
  min: number;
  /** A frost likely, or a ground frost possible. */
  level: 'frost' | 'ground';
}

/** Cold nights in the forecast, from today for so many days, warmed by a greenhouse or cold frame's night gain. */
export function coldNights(w: Weather | null, today: string, days = 7, nightGain = 0): ColdNight[] {
  const out: ColdNight[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const d = weatherOn(w, date);
    if (!d) continue;
    const min = d.min + nightGain;
    if (min <= GROUND_FROST_C) out.push({ date, min: Math.round(min * 10) / 10, level: min <= FROST_C ? 'frost' : 'ground' });
  }
  return out;
}

/** True when a day is in the forecast, not what happened. */
export const isForecast = (w: Weather, iso: string) => iso >= w.today;
