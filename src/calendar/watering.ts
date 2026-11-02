// Watering: each pot by how fast it dries, and new plantings in a dry spell.
// Pure functions: garden, plants and weather in, jobs out.
//
// The thresholds are a design call, not a plant fact: pots dry out within a day
// or two of warm weather, and new plantings until their roots are down. The RHS
// says to check containers daily in warm or windy weather, even after rain, so
// every pot's job says to feel the compost first.

import { microclimateOf } from '../climate/microclimate';
import { addDays, daysBetween } from '../model/dates';
import { placeLabel } from '../model/features';
import type { Feature, Garden, Plant, Planting } from '../model/types';
import { isCovered, lightHere } from '../planting/balcony';
import { isActive } from '../planting/place';
import { comesIndoors, isPot, litresText, potSize, sizeText } from '../planting/pots';
import { inGround } from '../lifecycle/projection';
import { frostDates } from '../lifecycle/shed';
import { currentStage, sowingOf } from '../lifecycle/stages';
import { rainOver, weatherOn, windOn, type Weather } from '../weather/weather';

/** A dry spell is at least this many days, today and the days before it. */
export const DRY_DAYS = 3;
/** Less rain than this over them is dry: a shower that hardly wets the surface. */
export const DRY_MM = 2;
/** And warm: the warmest of each day, on average over them, at least this. */
export const WARM_C = 18;
/** Rain forecast tomorrow of this much or more waters the beds, though not pots under the eaves or in the sun. */
export const RAIN_DUE_MM = 5;
/** Planted out or sown outside within this many days: its roots aren't down far yet. */
export const NEW_DAYS = 42;

export interface DrySpell {
  /** Days with under DRY_MM of rain between them, up to today; at most 14. */
  days: number;
  /** The warmest of those days, °C. */
  warmest: number;
}

/** A dry, warm spell up to today, or null: it's rained, it's cool, or the weather doesn't cover the days. */
export function drySpell(w: Weather | null, today: string): DrySpell | null {
  const rain = rainOver(w, today, DRY_DAYS);
  if (rain === null || rain >= DRY_MM) return null;
  const maxOn = (i: number) => weatherOn(w, addDays(today, -i))!.max;
  const recent = Array.from({ length: DRY_DAYS }, (_, i) => maxOn(i));
  if (recent.reduce((a, b) => a + b, 0) / DRY_DAYS < WARM_C) return null;
  let days = DRY_DAYS;
  while (days < 14 && (rainOver(w, today, days + 1) ?? DRY_MM) < DRY_MM) days++;
  return { days, warmest: Math.round(Math.max(...Array.from({ length: days }, (_, i) => maxOn(i)))) };
}

/** Rain forecast for tomorrow is enough to water the beds. */
const rainDue = (w: Weather | null, today: string) => (weatherOn(w, addDays(today, 1))?.rain ?? 0) >= RAIN_DUE_MM;

/** When it went in the ground, if you've said: planted out, or sown outside. */
function inGroundOn(plant: Plant, pl: Planting): string | undefined {
  return pl.stageDates?.transplanted ?? (sowingOf(plant, pl) === 'direct' ? pl.sownOn : undefined);
}

/**
 * Indoors for the winter, off the balcony's watering: a plant told to come in, once you've ticked that, or anyway from
 * the first frost until the last, as it couldn't be out there.
 */
function broughtIn(g: Garden, plant: Plant, pl: Planting, f: Feature, today: string): boolean {
  if (!comesIndoors(plant, f)) return false;
  const { firstFrost, lastFrost } = frostDates(g);
  const day = today.slice(5);
  if (day >= firstFrost || day < lastFrost) return true;
  const ticked = `protect:${pl.plantId}:${pl.featureId}:${today.slice(0, 4)}-`;
  return day >= '08-01' && g.jobsDone.some((j) => j.key.startsWith(ticked));
}

/**
 * What wants water in a dry spell: plants in pots and planters, and anything planted out or sown outside in the last
 * six weeks. Only what's in the ground outside (under glass no rain falls, so it's always watered), and no weeds.
 */
export function thirsty(g: Garden, plantOf: (id: string) => Plant, today: string, potsOnly = false): Planting[] {
  const byId = new Map(g.features.map((f) => [f.id, f]));
  return g.plantings.filter((pl) => {
    if (!isActive(pl)) return false;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed' || !inGround(currentStage(pl), plant, pl) || microclimateOf(g, pl)) return false;
    const f = byId.get(pl.featureId);
    if (f && broughtIn(g, plant, pl, f, today)) return false;
    if (f && isPot(f)) return true;
    if (potsOnly) return false;
    const went = inGroundOn(plant, pl);
    return !!went && went <= today && daysBetween(went, today) <= NEW_DAYS;
  });
}

export interface WaterJob {
  key: string;
  /** "New plantings", or the pot's name. */
  title: string;
  /** "(Patio pot, Veg bed and 2 more)". */
  where: string;
  detail: string;
  plantingIds: string[];
  featureId?: string;
}

const listed = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', '));

/** New plantings in the ground to water today, in a dry, warm spell, or null. Its key has the day, so a tick lasts the day. */
export function waterJob(g: Garden, plantOf: (id: string) => Plant, w: Weather | null, today: string): WaterJob | null {
  const spell = drySpell(w, today);
  // Rain tomorrow waters the beds.
  if (!spell || rainDue(w, today)) return null;
  const byId = new Map(g.features.map((f) => [f.id, f]));
  const list = thirsty(g, plantOf, today).filter((pl) => !byId.get(pl.featureId) || !isPot(byId.get(pl.featureId)!));
  if (!list.length) return null;
  const names = [...new Set(list.map((pl) => byId.get(pl.featureId)).filter((f) => !!f).map((f) => placeLabel(f!)))];
  const detail = `No real rain for ${spell.days} days, and warm (up to ${spell.warmest} °C). Water in the evening or early morning, at the roots: a good soak does more than a sprinkle.`;
  return { key: `water:${today}`, title: 'New plantings', where: names.length ? `(${listed(names)})` : '', detail, plantingIds: list.map((pl) => pl.id) };
}

// ---------- Pots ----------

/** Rain of this much in a day wets a pot through: less hardly gets past the leaves. */
export const RAIN_WETS_MM = 5;
/** Wind this strong, km/h, dries a pot noticeably: a fresh breeze, Beaufort 5. */
export const WINDY_KMH = 29;
/** More pots than this due at once are one job, not a list that buries the rest of the day. */
export const POT_JOBS = 5;
/** The usual warmest of a UK day by month, °C, for a pot under cover when the weather isn't on. A rough figure: it only sets how often to look. */
const TYPICAL_MAX = [7, 8, 10, 13, 16, 19, 21, 21, 18, 14, 10, 8];

/** How many days a pot goes between waterings. Warmth first, then the pot: small ones dry fastest, sun and wind bring it forward. */
export function potLasts(litres: number, warmest: number, opts: { windy?: boolean; sunny?: boolean; shady?: boolean } = {}): number {
  const base = warmest >= 24 ? 1 : warmest >= 18 ? 2 : warmest >= 12 ? 4 : warmest >= 7 ? 7 : 12;
  const size = litres < 10 ? 0.6 : litres < 30 ? 0.8 : litres >= 60 ? 1.4 : 1;
  const days = base * size * (opts.sunny ? 0.8 : opts.shady ? 1.25 : 1) * (opts.windy ? 0.7 : 1);
  return Math.max(1, Math.floor(days));
}

/** Days this cool, little grows and little dries: the warmest of a day under this, °C, about December to February. */
export const WINTER_C = 10;
/** How long a pot goes in the cold, days: it's looked at once a month, in the month's first week. */
export const WINTER_DAYS = 21;
const WINTER_WEEK = 7;

/** A line on why it's due now, from the warmth it's had, or the time of year without the weather. */
function howDry(warmest: number, known: boolean): string {
  const about = `about ${Math.round(warmest)} °C`;
  if (warmest < WINTER_C) return 'Little grows or dries in the cold, so a look once a month will do. Water only if it’s dry well below the surface, and not with a frost due.';
  if (warmest >= 24) return known ? `It’s been hot, ${about}: a pot can dry out in a day, so look morning and evening.` : 'A pot can dry out in a day at this time of year, so look morning and evening.';
  if (warmest >= 18) return known ? `It’s been warm, ${about}, so it’ll dry faster.` : 'It dries faster at this time of year.';
  return known && warmest < 12 ? `It’s been cool, ${about}, so it’ll need less.` : '';
}

/** The day a pot was last watered by ticking its job, before today. */
function lastTicked(g: Garden, f: Feature, today: string): string | null {
  // One job for many pots names them in its key, so it only counts for those.
  const days = g.jobsDone.filter((j) => j.key.startsWith(`water:${f.id}:`) || (j.key.startsWith('water:pots:') && j.key.includes(f.id))).map((j) => j.key.slice(-10));
  return days.filter((d) => d < today).sort().pop() ?? null;
}

/** The last day rain wet this pot through, in the fortnight up to today. */
function lastRained(w: Weather | null, today: string): string | null {
  for (let i = 0; i <= 14; i++) {
    const day = addDays(today, -i);
    if ((weatherOn(w, day)?.rain ?? 0) >= RAIN_WETS_MM) return day;
  }
  return null;
}

/**
 * Today's watering, a job for each pot that's due: smallest first, and one job for the lot when there are more than
 * POT_JOBS. A pot rain reaches needs the weather on to know; one under cover doesn't. Its key has the day, so a tick
 * lasts the day, and starts the pot's clock again.
 */
export function potWaterJobs(g: Garden, plantOf: (id: string) => Plant, w: Weather | null, today: string): WaterJob[] {
  const known = !!weatherOn(w, today);
  const here = thirsty(g, plantOf, today, true);
  const recent = known ? [0, 1, 2].map((i) => weatherOn(w, addDays(today, -i))?.max).filter((x): x is number => x !== undefined) : [];
  const warmest = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : TYPICAL_MAX[Number(today.slice(5, 7)) - 1]!;
  const windy = (windOn(w, today) ?? 0) >= WINDY_KMH || (windOn(w, addDays(today, -1)) ?? 0) >= WINDY_KMH;
  const rained = lastRained(w, today);
  const winter = warmest < WINTER_C;
  if (winter && Number(today.slice(8, 10)) > WINTER_WEEK) return [];
  const why = howDry(warmest, known && recent.length > 0);
  const due = g.features
    .filter((f) => isPot(f) && (known || isCovered(g, f)))
    .flatMap((f) => {
      const ids = here.filter((pl) => pl.featureId === f.id).map((pl) => pl.id);
      const size = potSize(f);
      if (!ids.length || !size) return [];
      const covered = isCovered(g, f);
      const light = lightHere(g, f);
      const windyHere = windy || !!g.balcony?.windy;
      const lasts = potLasts(size.litres, warmest, { windy: windyHere, sunny: light === 'full-sun', shady: light === 'shade' });
      const days = winter ? Math.max(lasts, WINTER_DAYS) : lasts;
      const wetted = [lastTicked(g, f, today), covered ? null : rained].filter((d): d is string => !!d).sort().pop() ?? null;
      if (wetted && daysBetween(wetted, today) < days) return [];
      return [{ f, ids, size, covered, windy: windyHere }];
    })
    .sort((a, b) => a.size.litres - b.size.litres);
  const feel = 'Push a finger into the compost first: if it’s moist below the surface, leave it for now. Otherwise water until it runs out of the bottom.';
  if (due.length > POT_JOBS)
    return [{ key: `water:pots:${due.map((d) => d.f.id).join(',')}:${today}`, title: 'Pots', where: `(${listed(due.map((d) => placeLabel(d.f)))})`, detail: [due.some((d) => d.covered) ? 'Rain doesn’t reach those under cover.' : '', why, feel].filter(Boolean).join(' '), plantingIds: due.flatMap((d) => d.ids) }];
  return due.map((d, i) => ({
    key: `water:${d.f.id}:${today}`,
    title: placeLabel(d.f),
    where: `(${sizeText(d.size)}, ${litresText(d.size.litres)})`,
    detail: [d.covered ? 'Rain doesn’t reach it here.' : '', d.windy && !winter ? 'Wind dries a pot fast.' : '', i === 0 && due.length > 1 ? 'The smallest dries fastest.' : '', why, feel].filter(Boolean).join(' '),
    plantingIds: d.ids,
    featureId: d.f.id,
  }));
}
