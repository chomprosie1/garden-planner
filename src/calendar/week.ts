// What's coming up in the garden this week and next: the next steps each
// planting is likely to take, from the year's projections (the plant's months
// and the warmth it gets, or this year's weather). Things you do (sow, harden
// off, plant out) and things to look out for (seedlings up, first flowers,
// ready to pick). Pure functions.

import { timeline } from '../lifecycle/projection';
import { sowingOf, type LifeStage } from '../lifecycle/stages';
import { addDays, dayNumber } from '../model/dates';
import { featureLabel } from '../model/features';
import type { Garden, Plant } from '../model/types';
import type { Weather } from '../weather/weather';

export interface Upcoming {
  key: string;
  plantId: string;
  featureId: string;
  plantingIds: string[];
  stage: LifeStage;
  /** The earliest it's likely, ISO. */
  date: string;
  /** "batch 2 of 3", for a batch. */
  batch?: string;
  /** Something to do, rather than something to look out for. */
  todo: boolean;
  /** How it's sown: indoors, outside, or not at all (bought plants). */
  sowing: 'indoors' | 'direct' | 'none';
}

/** Stages worth a line: the ones you act on or look out for. Growing on isn't news. */
const SHOWN: LifeStage[] = ['sown', 'germinated', 'hardening', 'transplanted', 'flowering', 'harvesting', 'cleared'];
const TODO: LifeStage[] = ['sown', 'hardening', 'transplanted', 'cleared'];

/** What each planting is likely to do after `from` and up to `to` (ISO dates), soonest first. */
export function upcoming(g: Garden, plantOf: (id: string) => Plant, today: string, from: string, to: string, weather: Weather | null = null): Upcoming[] {
  const found = new Map<string, Upcoming>();
  for (const pl of g.plantings) {
    if (pl.removedOn) continue;
    const plant = plantOf(pl.plantId);
    for (const s of timeline(plant, pl, g, today, weather)) {
      if (!s.guessed || s.date === null || s.date <= from || s.date > to || !SHOWN.includes(s.stage)) continue;
      // Rows of the same plant in the same bed doing the same thing are one line; batches stay apart.
      const batch = pl.batch ? `batch ${pl.batch.n} of ${pl.batch.of}` : undefined;
      const key = `${pl.plantId}|${pl.featureId}|${s.stage}|${pl.batch ? `${pl.batch.group}:${pl.batch.n}` : ''}`;
      const was = found.get(key);
      if (was) {
        was.plantingIds.push(pl.id);
        if (s.date < was.date) was.date = s.date;
      } else found.set(key, { key, plantId: pl.plantId, featureId: pl.featureId, plantingIds: [pl.id], stage: s.stage, date: s.date, ...(batch ? { batch } : {}), todo: TODO.includes(s.stage), sowing: sowingOf(plant, pl) });
    }
  }
  return [...found.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.plantId.localeCompare(b.plantId)));
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "tomorrow", "on Thursday", or "on 12 Oct" a week or more away. */
export function dayWords(date: string, today: string): string {
  const ahead = dayNumber(date) - dayNumber(today);
  if (ahead <= 0) return 'today';
  if (ahead === 1) return 'tomorrow';
  if (ahead < 7) return `on ${DAYS[(dayNumber(date) + 4) % 7]}`;
  return `on ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** "Sow outside", "Ready to pick": what's happening, in a few words. */
export function upcomingVerb(u: Upcoming): string {
  switch (u.stage) {
    case 'sown':
      return u.sowing === 'direct' ? 'Sow outside' : 'Sow indoors';
    case 'germinated':
      return 'Seedlings likely up';
    case 'hardening':
      return 'Start hardening off';
    case 'transplanted':
      return u.sowing === 'none' ? 'Plant' : 'Plant out';
    case 'flowering':
      return 'Likely flowering';
    case 'harvesting':
      return 'Likely ready to pick';
    case 'cleared':
      return 'Likely finished: clear and compost';
    default:
      return 'Growing on';
  }
}

/** "Lettuce (batch 2 of 3) in Veg bed: sow outside on Thursday". */
export function upcomingText(u: Upcoming, g: Garden, plantOf: (id: string) => Plant, today: string): string {
  const plant = plantOf(u.plantId);
  const bed = g.features.find((f) => f.id === u.featureId);
  const verb = upcomingVerb(u);
  return `${plant.commonName}${u.batch ? ` (${u.batch})` : ''}${bed ? ` in ${featureLabel(bed)}` : ''}: ${verb.charAt(0).toLowerCase()}${verb.slice(1)} ${dayWords(u.date, today)}`;
}

/** This week (today to six days on) and next (the seven days after). */
export function weekWindows(today: string): { thisWeek: [string, string]; nextWeek: [string, string] } {
  return { thisWeek: [addDays(today, -1), addDays(today, 6)], nextWeek: [addDays(today, 6), addDays(today, 13)] };
}
