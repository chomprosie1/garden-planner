// The sun through a window: how many hours of direct sun a windowsill, or
// shelves or a propagator by a window, gets each month from the way it faces.
// The sun counts while it's up and within 80° either side of straight out of
// the window; walls, trees and next door aren't known, so it's the most it
// could get. Greenhouses and cold frames are glass all round, so they don't
// face a way. Pure functions.

import { FACINGS, type Facing, type Garden, type Plant, type ShedPlace, type ShedPlaceKind } from '../model/types';
import { sunAt, sunDay } from '../sun/position';
import { freeSpot, placesOf } from './shed';

/** Places lit through a window, so the way they face matters. */
export const FACES_A_WAY: ShedPlaceKind[] = ['windowsill', 'shelves', 'propagator'];
export const facesAWay = (p: ShedPlace) => FACES_A_WAY.includes(p.kind);

/** The compass bearing straight out of the window, degrees clockwise from north. */
export const facingBearing = (f: Facing) => FACINGS.indexOf(f) * 45;

/** How far from straight out the sun can be and still shine in. */
export const WINDOW_HALF_ANGLE = 80;

/** The angle between two bearings, 0 to 180. */
const apart = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/** Hours of direct sun through a window facing this way, on a day (ISO), to the nearest tenth. */
export function windowSunOn(facing: Facing, iso: string, latitude: number, longitude: number): number {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  const day = sunDay(y, m, d, latitude, longitude);
  if (!day.sunrise || !day.sunset) return 0;
  const bearing = facingBearing(facing);
  const step = 5; // minutes
  let minutes = 0;
  for (let t = day.sunrise.getTime(); t <= day.sunset.getTime(); t += step * 60000) {
    const s = sunAt(new Date(t), latitude, longitude);
    if (s.altitude > 0 && apart(s.azimuth, bearing) <= WINDOW_HALF_ANGLE) minutes += step;
  }
  return Math.round((minutes / 60) * 10) / 10;
}

/** Hours of direct sun through the window in a month, on its middle day. */
export const windowSunInMonth = (facing: Facing, month: number, year: number, latitude: number, longitude: number) =>
  windowSunOn(facing, `${year}-${String(month).padStart(2, '0')}-15`, latitude, longitude);

/** A place's sun in a month, or null when it doesn't face a way (a greenhouse bench) or you haven't said which. */
export function placeSun(g: Garden, place: ShedPlace, month: number, year: number): number | null {
  if (!facesAWay(place) || !place.facing) return null;
  return windowSunInMonth(place.facing, month, year, g.latitude, g.longitude);
}

/** Under this many hours of direct sun, seedlings stretch for the light. */
export const LEGGY_UNDER_HOURS = 3;

/** Plants that want the sunniest spot indoors: those that need full sun outside (tomatoes, peppers, basil). */
export const isSunLover = (p: Plant) => p.conditions.light === 'full-sun';

/** "About 5 h of sun in April", or "about 5 h…" in the middle of a sentence. */
export function placeSunText(hours: number, month: number, midSentence = false): string {
  const h = hours < 0.5 ? 'Hardly any direct sun' : `About ${Math.round(hours)} h of sun`;
  const text = `${h} in ${MONTHS[month - 1]}`;
  return midSentence ? text[0]!.toLowerCase() + text.slice(1) : text;
}

export interface SunniestPlace {
  place: ShedPlace;
  hours: number;
}

/** The sunniest place with room, this month, of those you've said the facing of; null when none face a way or all are full. */
export function sunniestPlace(g: Garden, month: number, year: number): SunniestPlace | null {
  let best: SunniestPlace | null = null;
  for (const place of placesOf(g)) {
    const hours = placeSun(g, place, month, year);
    if (hours === null || freeSpot(g, place.id)?.placeId !== place.id) continue;
    if (!best || hours > best.hours) best = { place, hours };
  }
  return best;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
