// Small seasonal moments for Today: one warm line when something in the
// garden's year has just happened or is about to. The first frost of autumn,
// the first pick of a crop, the last frost passing, the longest and shortest
// days. One at a time, the most timely first. Pure functions.

import { dayWords } from './week';
import { frostDates, inYear } from '../lifecycle/shed';
import { addDays, dayNumber } from '../model/dates';
import type { Garden, Plant } from '../model/types';
import { coldNights, FROST_C, weatherOn, type Weather } from '../weather/weather';

export type MomentKind = 'first-frost' | 'first-pick' | 'last-frost' | 'midsummer' | 'midwinter';

export interface Moment {
  kind: MomentKind;
  title: string;
  line: string;
  /** The plant it's about, for its picture. */
  plantId?: string;
}

/** Days a moment stays on Today after it happens. */
const FRESH_DAYS = 3;

/** The first frost of autumn, when the forecast has one in the next few days and there's been none since August. */
function firstFrost(w: Weather | null, today: string): Moment | null {
  const month = Number(today.slice(5, 7));
  if (!w || month < 9 || month > 12) return null;
  const coming = coldNights(w, today, FRESH_DAYS + 1).find((n) => n.level === 'frost');
  if (!coming) return null;
  for (let d = `${today.slice(0, 4)}-08-01`; d < today; d = addDays(d, 1)) {
    const day = weatherOn(w, d);
    if (day && day.min <= FROST_C) return null;
  }
  return {
    kind: 'first-frost',
    title: 'The first frost of autumn',
    line: `Likely early ${dayWords(coming.date, today)}. Bring in anything tender, and fleece what has to stay out.`,
  };
}

/** The first pick of a crop this year, logged in the last few days. */
function firstPick(g: Garden, plantOf: (id: string) => Plant, today: string): Moment | null {
  const year = today.slice(0, 4);
  const firsts = new Map<string, string>();
  for (const pl of g.plantings)
    for (const p of pl.picks ?? []) {
      if (!p.date.startsWith(year)) continue;
      const was = firsts.get(pl.plantId);
      if (!was || p.date < was) firsts.set(pl.plantId, p.date);
    }
  const recent = [...firsts.entries()].filter(([, d]) => d <= today && dayNumber(today) - dayNumber(d) < FRESH_DAYS).sort((a, b) => b[1].localeCompare(a[1]));
  const found = recent[0];
  if (!found) return null;
  const name = plantOf(found[0]).commonName.toLowerCase();
  return { kind: 'first-pick', title: `The first ${name} of the year`, line: 'From your own garden. Enjoy them.', plantId: found[0] };
}

/** The garden's average last frost, just passed. */
function lastFrost(g: Garden, today: string): Moment | null {
  const day = inYear(frostDates(g).lastFrost, Number(today.slice(0, 4)));
  const since = dayNumber(today) - dayNumber(day);
  if (since < 1 || since > FRESH_DAYS) return null;
  return {
    kind: 'last-frost',
    title: 'Past your last frost',
    line: 'On average, anyway. Tender plants can start going out, once they’ve been hardened off for a week.',
  };
}

/** The longest and shortest days, and a day either side. */
function solstice(today: string): Moment | null {
  const md = today.slice(5);
  if (md >= '06-20' && md <= '06-22') return { kind: 'midsummer', title: 'Midsummer', line: 'The longest days of the year. Evenings in the garden, light until after nine.' };
  if (md >= '12-20' && md <= '12-22') return { kind: 'midwinter', title: 'Midwinter', line: 'The shortest days. From here on, the light comes back a minute or two a day.' };
  return null;
}

/** The one moment worth a line on Today, if any. */
export function momentFor(g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null): Moment | null {
  return firstFrost(weather, today) ?? firstPick(g, plantOf, today) ?? lastFrost(g, today) ?? solstice(today);
}
