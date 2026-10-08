// Running behind: plantings that should have moved on to their next stage by
// now and haven't been marked as having done so, with the usual reasons a
// plant is slow at that stage. Pure functions: garden and plants in, a list out.
//
// "Should have" is the timeline's own guess (src/lifecycle/projection.ts): by
// the warmth where the plant has days to grow, otherwise by its months. Some
// slack is allowed before it's called late, as plants vary.

import { addDays, daysBetween } from '../model/dates';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive } from '../planting/place';
import type { Weather } from '../weather/weather';
import { expectedNext } from './projection';
import { feedTip } from '../feeding/feeds';
import { currentStage, STAGE_LABEL, type LifeStage } from './stages';

export interface Behind {
  plantingId: string;
  plantId: string;
  featureId: string;
  /** The stage it's marked at, and the one it should have reached. */
  stage: LifeStage;
  next: LifeStage;
  /** When it was expected there. */
  due: string;
  /** Days past that, beyond the slack. */
  late: number;
  /** Likely reasons, most likely first. */
  causes: string[];
}

/** How long after the expected date before it counts as late: a week for seedlings, otherwise two weeks or a quarter of the wait. */
export function slackDays(next: LifeStage, waited: number): number {
  if (next === 'germinated') return 7;
  return Math.max(14, Math.round(waited / 4));
}

/** The usual reasons a plant hasn't reached a stage, in plain words. */
const CAUSES: Partial<Record<LifeStage, string[]>> = {
  germinated: [
    'Cold soil or compost: most seeds wait for warmth. Indoors, a warm windowsill or a heated propagator helps.',
    'Too dry, or so wet the seed rotted.',
    'Sown too deep for the seed’s size.',
    'Old seed: try a few on damp kitchen paper to see if they sprout.',
    'Slugs, mice or birds got there first.',
  ],
  hardening: [
    'Too little light: pale, leggy seedlings want the brightest spot you have.',
    'Cold nights indoors slow them down.',
    'Hungry or pot-bound: pot them on into fresh compost.',
  ],
  transplanted: [
    'Tender plants wait for the last frost, so a late spring holds them back. That’s right.',
    'Too small yet: pot them on and give them time.',
    'Hardening off takes one to two weeks before planting out.',
  ],
  vegetative: [
    'A cold spell: growth stalls below about 6 °C.',
    'Short of water, or of food in poor soil.',
    'Too much feed: strong feeds scorch young roots, and fresh manure burns them.',
    'Pests at the roots or under the leaves.',
  ],
  flowering: [
    'Too much feed, or rich manure: lots of leaves, few flowers.',
    'Too little sun.',
    'Dry at the roots, or a cold spell.',
  ],
  harvesting: [
    'Not pollinated: too few insects, or too cold or wet for them. Some crops can be helped by hand.',
    'Uneven watering: fruit and pods need steady moisture.',
    'Too much nitrogen feed: plenty of leaf and little fruit. A high-potash feed, such as tomato feed, turns it round.',
    'Too little sun or warmth this year.',
    'Pests or disease: look under the leaves and at the stems.',
  ],
};

/** Likely reasons it's slow to reach a stage: the usual ones, then (once it's up) this plant's own pests. */
export function causesFor(plant: Plant, next: LifeStage): string[] {
  if (!CAUSES[next]) return [];
  const own = next === 'germinated' ? [] : (plant.pests ?? []).slice(0, 2).map((p) => `${p.name}: ${p.signs.charAt(0).toLowerCase()}${p.signs.slice(1)}`);
  // A hungry crop slow to grow away is most likely short of food.
  const hungry = next === 'vegetative' && plant.feeding?.need === 'hungry' ? [`Hungry: ${plant.commonName.toLowerCase()} is a hungry crop, and thin soil holds it back. ${feedTip(plant, 'vegetative') ?? 'A feed and a mulch of compost help.'}`] : [];
  return [...hungry, ...(CAUSES[next] ?? []), ...own];
}

/**
 * Plantings late to reach their next stage, most late first. Left out: weeds, anything planned or cleared, anything
 * whose latest stage has no date, the step to clearing, and anything you've said you're still waiting for.
 */
export function runningBehind(g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null): Behind[] {
  const out: Behind[] = [];
  for (const pl of g.plantings) {
    if (!isActive(pl) || (pl.snoozeUntil && pl.snoozeUntil > today)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed') continue;
    const b = behindOf(plant, pl, g, today, weather);
    if (b) out.push(b);
  }
  return out.sort((a, b) => b.late - a.late);
}

/** One planting, if it's running behind. */
export function behindOf(plant: Plant, pl: Planting, g: Garden, today: string, weather: Weather | null = null): Behind | null {
  const exp = expectedNext(plant, pl, g, weather);
  if (!exp || exp.stage === 'cleared' || exp.stage === 'planned') return null;
  const late = daysBetween(addDays(exp.date, slackDays(exp.stage, daysBetween(exp.from, exp.date))), today);
  if (late <= 0) return null;
  return { plantingId: pl.id, plantId: plant.id, featureId: pl.featureId, stage: currentStage(pl), next: exp.stage, due: exp.date, late, causes: causesFor(plant, exp.stage) };
}

/** "Expected to be up by 12 Oct." */
export function behindText(b: Behind, shortDate: (iso: string) => string): string {
  const what: Partial<Record<LifeStage, string>> = {
    germinated: 'to be up',
    hardening: 'to be ready to harden off',
    transplanted: 'to be planted out',
    vegetative: 'to be growing away',
    flowering: 'to be flowering',
    harvesting: 'to be ready to pick',
  };
  return `Expected ${what[b.next] ?? `to be ${STAGE_LABEL[b.next].toLowerCase()}`} by ${shortDate(b.due)}.`;
}

/** Still waiting: not running behind again for two weeks. */
export const snooze = (g: Garden, id: string, today: string): Garden => ({
  ...g,
  plantings: g.plantings.map((p) => (p.id === id ? { ...p, snoozeUntil: addDays(today, 14) } : p)),
});
