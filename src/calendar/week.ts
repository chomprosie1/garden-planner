// What's coming up in the garden this week and next: the next steps each
// planting is likely to take, from the year's projections (the plant's months
// and the warmth it gets, or this year's weather). Things you do (sow, harden
// off, plant out) and things to look out for (seedlings up, first flowers,
// ready to pick). Pure functions.

import { timeline } from '../lifecycle/projection';
import { currentStage, isRoot, sowingOf, type LifeStage } from '../lifecycle/stages';
import { addDays, dayNumber } from '../model/dates';
import { runningBehind } from '../lifecycle/behind';
import { featureLabel } from '../model/features';
import { STAGES, type Garden, type Plant, type Stage } from '../model/types';
import { isSown, startsAs, type StartsAs } from '../planting/windows';
import type { Weather } from '../weather/weather';
import type { Job } from './jobs';

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
  /** What goes in: seed, or sets, cloves, tubers, bulbs or plants, which are planted. */
  from: StartsAs;
  /** Due already (its window's open, or it's late): now, rather than a day. */
  now: boolean;
  /** A root crop: lifted, not picked. */
  root?: true;
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
    // Weeds come and go on their own: nothing to look forward to.
    if (plant.category === 'weed') continue;
    // Not sown or planted yet: only that first step. What follows waits until it's done.
    const planned = currentStage(pl) === 'planned';
    let first = true;
    for (const s of timeline(plant, pl, g, today, weather)) {
      if (!s.guessed || s.date === null) continue;
      const isFirst = first;
      first = false;
      if (planned && !isFirst) break;
      if (s.date <= from || s.date > to || !SHOWN.includes(s.stage)) continue;
      // Rows of the same plant in the same bed doing the same thing are one line; batches stay apart.
      const batch = pl.batch ? `batch ${pl.batch.n} of ${pl.batch.of}` : undefined;
      const key = `${pl.plantId}|${pl.featureId}|${s.stage}|${pl.batch ? `${pl.batch.group}:${pl.batch.n}` : ''}`;
      const was = found.get(key);
      if (was) {
        was.plantingIds.push(pl.id);
        if (s.date < was.date) was.date = s.date;
        if (s.due) was.now = true;
      } else
        found.set(key, {
          key,
          plantId: pl.plantId,
          featureId: pl.featureId,
          plantingIds: [pl.id],
          stage: s.stage,
          date: s.date,
          ...(batch ? { batch } : {}),
          todo: TODO.includes(s.stage),
          sowing: sowingOf(plant, pl),
          from: startsAs(plant, Number((pl.sownOn ?? s.date).slice(5, 7)), pl),
          now: !!s.due,
          ...(isRoot(plant) ? { root: true as const } : {}),
        });
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

/** "now" for something due already, otherwise "today", "tomorrow", "on Thursday". */
export const whenWords = (u: Upcoming, today: string): string => (u.now ? 'now' : dayWords(u.date, today));

/** "Sow outside", "Plant", "Ready to pick": what's happening, in a few words. */
export function upcomingVerb(u: Upcoming): string {
  switch (u.stage) {
    case 'sown':
      if (!isSown(u.from)) return 'Plant';
      return u.sowing === 'direct' ? 'Sow outside' : 'Sow indoors';
    case 'germinated':
      return isSown(u.from) ? 'Seedlings up soon' : 'Shoots up soon';
    case 'hardening':
      return 'Harden off';
    case 'transplanted':
      return u.sowing === 'none' ? 'Plant' : 'Plant out';
    case 'flowering':
      return 'Coming into flower';
    case 'harvesting':
      return u.root ? 'Ready to lift' : 'Ready to pick';
    case 'cleared':
      return 'Clear and compost';
    default:
      return 'Growing on';
  }
}

/** "Lettuce (batch 2 of 3) in Veg bed: sow outside on Thursday". */
export function upcomingText(u: Upcoming, g: Garden, plantOf: (id: string) => Plant, today: string): string {
  const plant = plantOf(u.plantId);
  const bed = g.features.find((f) => f.id === u.featureId);
  const verb = upcomingVerb(u);
  return `${plant.commonName}${u.batch ? ` (${u.batch})` : ''}${bed ? ` in ${featureLabel(bed)}` : ''}: ${verb.charAt(0).toLowerCase()}${verb.slice(1)} ${whenWords(u, today)}`;
}

/**
 * When in the month each of its jobs falls, for Today: "now" (due already, or this week) or "later" this month. Only
 * sowing and planting out can wait: a sowing on its planned day, a batch's day, or seedlings still growing on, by when
 * the plantings' timelines expect them. Everything else in the month's list is for now, as is a job ticked already.
 */
export function jobTiming(jobs: Job[], g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null): Map<string, 'now' | 'later'> {
  const weekEnd = addDays(today, 6);
  const done = new Set(g.jobsDone.map((j) => j.key));
  const out = new Map<string, 'now' | 'later'>();
  for (const job of jobs) {
    const sow = job.kind === 'sow-indoors' || job.kind === 'sow-direct';
    const stage: LifeStage | null = sow ? 'sown' : job.kind === 'plant-out' ? 'transplanted' : null;
    let soonest: string | null = null;
    if (stage && !done.has(job.key))
      for (const id of job.plantingIds) {
        const found = g.plantings.find((p) => p.id === id);
        if (!found) continue;
        // A sowing job goes by its own way of sowing, whatever the planting would usually be.
        const pl = sow && !found.sowing ? { ...found, sowing: job.kind === 'sow-direct' ? ('direct' as const) : ('indoors' as const) } : found;
        const step = timeline(plantOf(pl.plantId), pl, g, today, weather).find((s) => s.guessed && s.stage === stage && s.date !== null);
        // Nothing expected for it: for now if it's marked as there already, otherwise it isn't due yet.
        const there = STAGES.indexOf(currentStage(pl) as Stage) >= STAGES.indexOf(stage as Stage);
        const date = step?.date ?? (there ? today : addDays(weekEnd, 1));
        if (soonest === null || date < soonest) soonest = date;
      }
    out.set(job.key, soonest !== null && soonest > weekEnd ? 'later' : 'now');
  }
  return out;
}

/** This week (today to six days on) and next (the seven days after). */
export function weekWindows(today: string): { thisWeek: [string, string]; nextWeek: [string, string] } {
  return { thisWeek: [addDays(today, -1), addDays(today, 6)], nextWeek: [addDays(today, 6), addDays(today, 13)] };
}

export interface WeekNudge {
  /** The Monday the week starts, ISO. */
  week: string;
  title: string;
  body: string;
}

/** The Monday of the week a date is in. */
export const mondayOf = (iso: string): string => addDays(iso, -((dayNumber(iso) + 3) % 7));

/**
 * The weekly reminder for each of the next few weeks: the things to do that week, from this week's Monday on. Worked
 * out while the app's open and kept for the service worker, which shows the one for the week it's in (and only when
 * there's something to do).
 */
export function weekNudges(g: Garden, plantOf: (id: string) => Plant, today: string, weeks = 5, weather: Weather | null = null): WeekNudge[] {
  const out: WeekNudge[] = [];
  for (let i = 0; i < weeks; i++) {
    const monday = addDays(mondayOf(today), 7 * i);
    // Steps due before today were never projected; the week's left are.
    const todo = upcoming(g, plantOf, today, addDays(monday, -1), addDays(monday, 6), weather).filter((u) => u.todo);
    // This week only: anything running behind, to check on.
    const late = i === 0 ? runningBehind(g, plantOf, today, weather) : [];
    if (!todo.length && !late.length) continue;
    const lines = todo.slice(0, 3).map((u) => {
      const bed = g.features.find((f) => f.id === u.featureId);
      return `${upcomingVerb(u)}: ${plantOf(u.plantId).commonName.toLowerCase()}${u.batch ? ` (${u.batch})` : ''}${bed ? ` in ${featureLabel(bed)}` : ''}`;
    });
    if (late.length) lines.push(`Running behind: ${late.slice(0, 2).map((b) => plantOf(b.plantId).commonName.toLowerCase()).join(' and ')}${late.length > 2 ? ` and ${late.length - 2} more` : ''}`);
    const more = todo.length - Math.min(todo.length, 3);
    const title = todo.length ? `${todo.length} ${todo.length === 1 ? 'job' : 'jobs'} this week` : `${late.length} running behind`;
    out.push({ week: monday, title, body: `${lines.join('. ')}.${more ? ` And ${more} more.` : ''}` });
  }
  return out;
}
