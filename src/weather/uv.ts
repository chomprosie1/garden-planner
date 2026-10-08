// The UV index: live from Open-Meteo's forecast when the weather is on, or
// otherwise worked out from how high the sun gets at the garden, for a clear,
// sunny day at this time of year. Pure functions.

import { dayNumber } from '../model/dates';
import { sunAt, sunDay } from '../sun/position';
import type { Weather } from './weather';

export const UV_BANDS = ['low', 'moderate', 'high', 'very-high', 'extreme'] as const;
export type UvBand = (typeof UV_BANDS)[number];

export const UV_LABEL: Record<UvBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very-high': 'Very high',
  extreme: 'Extreme',
};

/** What to do at each level, for a day in the garden. */
export const UV_ADVICE: Record<UvBand, string> = {
  low: 'No need for sun cream for most people.',
  moderate: 'Sun cream (factor 30+) and a hat if you’re out for long, and shade around midday.',
  high: 'Factor 30+, a hat, and shade from 11 to 3. Save the long jobs for the morning or evening.',
  'very-high': 'Factor 50, a hat and long sleeves, and keep out of the sun from 11 to 3.',
  extreme: 'Factor 50, a hat and long sleeves, and stay in the shade from 11 to 3 if you can.',
};

/** The World Health Organization's bands: 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme. */
export function uvBand(index: number): UvBand {
  const i = Math.round(index);
  return i <= 2 ? 'low' : i <= 5 ? 'moderate' : i <= 7 ? 'high' : i <= 10 ? 'very-high' : 'extreme';
}

/** Ozone over the UK is about 330 Dobson units, a little more than the 300 the formula is made for. */
const OZONE_DU = 330;

/**
 * The UV index under a clear sky with the sun this high (degrees), from Madronich's fit:
 * UVI = 12.5 · cos(zenith)^2.42 · (ozone / 300)^-1.23. Near enough for the UK; cloud only lowers it.
 */
export function clearSkyUv(altitudeDeg: number): number {
  if (altitudeDeg <= 0) return 0;
  const mu = Math.sin((altitudeDeg * Math.PI) / 180);
  return 12.5 * Math.pow(mu, 2.42) * Math.pow(OZONE_DU / 300, -1.23);
}

/** The highest UV of a clear day at the garden: the sun at its highest, at solar noon. */
export function clearDayUv(iso: string, latitude: number, longitude: number): number {
  const day = sunDay(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)), latitude, longitude);
  return clearSkyUv(sunAt(day.noon, latitude, longitude).altitude);
}

export interface UvDay {
  /** The day's highest UV index, rounded to a whole number. */
  index: number;
  band: UvBand;
  /** From the forecast; false when it's the clear-sky estimate ("on a sunny day at this time of year"). */
  live: boolean;
}

/** The day's highest UV: the forecast's when it has the day, otherwise a sunny day's at this time of year. */
export function uvOn(weather: Weather | null, iso: string, latitude: number, longitude: number): UvDay {
  const i = weather?.uv ? dayNumber(iso) - dayNumber(weather.from) : -1;
  const live = i >= 0 ? (weather?.uv?.[i] ?? null) : null;
  const index = Math.round(live ?? clearDayUv(iso, latitude, longitude));
  return { index, band: uvBand(index), live: live !== null };
}

/** Today's UV card shows from April to September, at Moderate or above. */
export const showsUv = (uv: UvDay, iso: string) => {
  const m = Number(iso.slice(5, 7));
  return m >= 4 && m <= 9 && uv.band !== 'low';
};

/** A reminder is worth it at High or above. */
export const UV_REMIND_FROM = 6;
