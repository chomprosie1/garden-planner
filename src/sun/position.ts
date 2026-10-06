// Where the sun is, in the garden's own coordinates. Clock times are UK
// times (Europe/London), so 2 pm means 2 pm on the clock, in summer or winter.
// SunCalc by Volodymyr Agafonkin, BSD 2-Clause licence.

import { getPosition, getTimes } from 'suncalc';
import type { Point } from '../model/types';

const ZONE = 'Europe/London';
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

export interface ClockTime {
  year: number;
  month: number; // 1 to 12
  day: number;
  hour: number;
  minute: number;
}

/** The UK clock reading at an instant. */
export function ukClock(at: Date): ClockTime {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute! };
}

/** Minutes the UK clock is ahead of UTC at an instant: 0 in winter, 60 in summer. */
export function ukOffsetMinutes(at: Date): number {
  const c = ukClock(at);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** The instant a UK clock shows this time. */
export function fromUkClock(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset, even on the days the clocks change.
  let at = new Date(guess - ukOffsetMinutes(new Date(guess)) * 60000);
  at = new Date(guess - ukOffsetMinutes(at) * 60000);
  return at;
}

export interface Sun {
  /** Degrees above the horizon, corrected for refraction; below 0 at night. */
  altitude: number;
  /** Compass bearing, degrees clockwise from true north. */
  azimuth: number;
}

export function sunAt(at: Date, latitude: number, longitude: number): Sun {
  const p = getPosition(at, latitude, longitude);
  return { altitude: p.altitude, azimuth: ((p.azimuth % 360) + 360) % 360 };
}

/**
 * A unit vector, in garden coordinates (y up the plan), pointing towards a compass bearing.
 * northRotationDeg is how far true north is turned clockwise from the top of the plan.
 */
export function bearingToGarden(bearingDeg: number, northRotationDeg: number): Point {
  const a = ((bearingDeg + northRotationDeg) * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
}

/** How far, and which way, the top of something this tall casts its shadow. null when the sun is down. */
export function shadowOffset(heightMm: number, sun: Sun, northRotationDeg: number): Point | null {
  if (sun.altitude <= 0.5) return null; // a grazing sun: shadows run off to infinity
  const length = heightMm / Math.tan((sun.altitude * Math.PI) / 180);
  const [x, y] = bearingToGarden(sun.azimuth, northRotationDeg);
  return [-x * length, -y * length];
}

export interface Day {
  sunrise: Date | null;
  sunset: Date | null;
  noon: Date;
}

/** Sunrise, sunset and solar noon on a UK calendar day. */
export function sunDay(year: number, month: number, day: number, latitude: number, longitude: number): Day {
  const midday = fromUkClock(year, month, day, 12);
  const t = getTimes(midday, latitude, longitude, 0, ukOffsetMinutes(midday));
  return { sunrise: t.sunrise, sunset: t.sunset, noon: t.solarNoon };
}

/** "14:05" on the UK clock. */
export function formatClock(at: Date): string {
  const c = ukClock(at);
  return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
}
