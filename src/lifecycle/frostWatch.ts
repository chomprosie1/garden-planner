// Frost in the forecast: which tender plants and seedlings are at risk on a
// cold night this week, outside, hardening off, or under glass that's only a
// degree or two warmer. Pure functions, from this year's weather (opt-in).

import { microclimateOf, placeClimate } from '../climate/microclimate';
import { dayNumber } from '../model/dates';
import { featureLabel } from '../model/features';
import type { Garden, Plant } from '../model/types';
import { coldNights, FROST_C, type ColdNight, type Weather } from '../weather/weather';
import { inGround } from './projection';
import { isTender, placesOf, PLACE_LABEL, traysOf, trayStage } from './shed';
import { currentStage } from './stages';

export interface AtRisk {
  kind: 'planting' | 'tray';
  id: string;
  plantId: string;
  /** "in Veg bed", "hardening off", "in Greenhouse". */
  where: string;
}

export interface FrostWarning {
  night: ColdNight;
  atRisk: AtRisk[];
}

/** Is a night cold enough to harm a tender plant here: outside on a ground frost, under glass only on a real frost once its gain is added. */
const harms = (night: ColdNight, nightGain: number) => (nightGain > 0 ? night.min + nightGain <= FROST_C : true);

/** What's at risk on a cold night: tender plants in the ground or hardening off, and tender seedlings under unheated glass. */
export function atRiskOn(g: Garden, plantOf: (id: string) => Plant, night: ColdNight): AtRisk[] {
  const out: AtRisk[] = [];
  for (const pl of g.plantings) {
    if (pl.removedOn) continue;
    const plant = plantOf(pl.plantId);
    if (!isTender(plant)) continue;
    const stage = currentStage(pl);
    const hardening = stage === 'hardening';
    if (!hardening && !inGround(stage, plant, pl)) continue;
    const cover = hardening ? null : microclimateOf(g, pl);
    if (cover?.climate.heated || !harms(night, cover?.climate.nightGainC ?? 0)) continue;
    const bed = g.features.find((f) => f.id === pl.featureId);
    out.push({ kind: 'planting', id: pl.id, plantId: pl.plantId, where: hardening ? 'hardening off' : `in ${bed ? featureLabel(bed) : 'a bed'}` });
  }
  const places = new Map(placesOf(g).map((p) => [p.id, p]));
  for (const t of traysOf(g)) {
    if (!isTender(plantOf(t.plantId))) continue;
    const place = places.get(t.placeId);
    if (trayStage(t) === 'hardening') {
      out.push({ kind: 'tray', id: t.id, plantId: t.plantId, where: 'hardening off' });
      continue;
    }
    const c = place ? placeClimate(g, place) : null;
    if (!c || c.heated || !harms(night, c.nightGainC)) continue;
    out.push({ kind: 'tray', id: t.id, plantId: t.plantId, where: `on the ${place!.name || PLACE_LABEL[place!.kind]}` });
  }
  return out;
}

/** The first cold night this week that puts something at risk, and what. Null when there's none, or no forecast. */
export function frostWarning(g: Garden, plantOf: (id: string) => Plant, w: Weather | null, today: string, days = 7): FrostWarning | null {
  for (const night of coldNights(w, today, days)) {
    const atRisk = atRiskOn(g, plantOf, night);
    if (atRisk.length) return { night, atRisk };
  }
  return null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "tonight", "early tomorrow", "early on Thursday": a day's coldest is usually just before dawn. */
export function whenText(date: string, today: string): string {
  const ahead = dayNumber(date) - dayNumber(today);
  if (ahead <= 0) return 'early this morning';
  if (ahead === 1) return 'tonight, into tomorrow morning';
  return `early on ${DAYS[(dayNumber(date) + 4) % 7]}`;
}

const degrees = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n))} °C`;

/** "Frost likely tonight, into tomorrow morning: about −1 °C." */
export function frostHeadline(f: FrostWarning, today: string): string {
  const what = f.night.level === 'frost' ? 'Frost likely' : 'A ground frost is possible';
  return `${what} ${whenText(f.night.date, today)}: about ${degrees(f.night.min)}.`;
}

/** What to do, for what's at risk. */
export function frostAdvice(f: FrostWarning): string {
  const outside = f.atRisk.some((a) => a.where.startsWith('in '));
  const hardening = f.atRisk.some((a) => a.where === 'hardening off');
  const glass = f.atRisk.some((a) => a.where.startsWith('on the '));
  return [
    outside && 'Cover tender plants with fleece, or bring pots under cover.',
    hardening && 'Bring seedlings that are hardening off indoors for the night.',
    glass && 'Fleece seedlings in the greenhouse or cold frame, or bring them in.',
  ]
    .filter(Boolean)
    .join(' ');
}
