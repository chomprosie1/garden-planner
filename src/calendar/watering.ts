// Watering in a dry spell: with this year's weather on, a job to water pots and
// new plantings after a few dry, warm days, and none once it's rained. Pure
// functions: garden, plants and weather in, a job out.
//
// The thresholds are a design call, not a plant fact: pots dry out within a day
// or two of warm weather, and new plantings until their roots are down.

import { microclimateOf } from '../climate/microclimate';
import { addDays, daysBetween } from '../model/dates';
import { placeLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive } from '../planting/place';
import { isPot } from '../planting/pots';
import { inGround } from '../lifecycle/projection';
import { currentStage, sowingOf } from '../lifecycle/stages';
import { rainOver, weatherOn, type Weather } from '../weather/weather';

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
    if (f && isPot(f)) return true;
    if (potsOnly) return false;
    const went = inGroundOn(plant, pl);
    return !!went && went <= today && daysBetween(went, today) <= NEW_DAYS;
  });
}

export interface WaterJob {
  key: string;
  /** "Pots and new plantings". */
  title: string;
  /** "(Patio pot, Veg bed and 2 more)". */
  where: string;
  detail: string;
  plantingIds: string[];
}

/** Today's watering, in a dry, warm spell, or null. Its key has the day, so a tick lasts the day. */
export function waterJob(g: Garden, plantOf: (id: string) => Plant, w: Weather | null, today: string): WaterJob | null {
  const spell = drySpell(w, today);
  if (!spell) return null;
  const due = rainDue(w, today);
  const list = thirsty(g, plantOf, today, due);
  if (!list.length) return null;
  const byId = new Map(g.features.map((f) => [f.id, f]));
  const pots = list.filter((pl) => byId.get(pl.featureId) && isPot(byId.get(pl.featureId)!));
  const title = pots.length === list.length ? 'Pots' : pots.length ? 'Pots and new plantings' : 'New plantings';
  const names = [...new Set(list.map((pl) => byId.get(pl.featureId)).filter((f) => !!f).map((f) => placeLabel(f!)))];
  const where = names.length ? `(${names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ')})` : '';
  const detail = [
    `No real rain for ${spell.days} days, and warm (up to ${spell.warmest} °C).`,
    due ? 'Rain is forecast tomorrow, so the beds can wait; pots still dry out.' : '',
    'Water in the evening or early morning, at the roots: a good soak does more than a sprinkle.',
    pots.length ? 'Pots in the sun may want it every day.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { key: `water:${today}`, title, where, detail, plantingIds: list.map((pl) => pl.id) };
}
