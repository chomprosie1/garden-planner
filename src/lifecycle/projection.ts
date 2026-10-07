// The garden through the year: where each planting is on any day, a year
// either side of today. Up to today it's what you've marked. After today it's
// carried on from there with the plant's usual months (sowing, planting out,
// flowering, harvest), so a projected stage is a guess, and says so. Growing
// degree days will sharpen it later. Pure functions.

import { isCover, microclimateOf, type Cover } from '../climate/microclimate';
import { featureLabel } from '../model/features';
import { STAGES, type Feature, type Garden, type Plant, type Planting, type Stage } from '../model/types';
import { isContainer } from '../planting/place';
import { addDays, germination, hardenFrom, plantInFrom, plantOutFrom } from './shed';
import { currentStage, flowerMonthsOf, pathFor, perennial, sowingOf, type LifeStage } from './stages';

export interface Step {
  stage: LifeStage;
  /** When it's reached, ISO; null when it was marked without a date (it's been at that stage as long as we know). */
  date: string | null;
  /** From the plant's usual months, not marked by you. */
  guessed: boolean;
}

export interface Projected {
  stage: LifeStage;
  guessed: boolean;
}

const order = (s: LifeStage) => (s === 'planned' ? -1 : s === 'cleared' ? 99 : STAGES.indexOf(s));
const monthOf = (iso: string) => Number(iso.slice(5, 7));
const yearOf = (iso: string) => Number(iso.slice(0, 4));
const firstOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`;
const nextMonth = (year: number, month: number): [number, number] => (month === 12 ? [year + 1, 1] : [year, month + 1]);

/** The first day on or after `from` that falls in one of these months, within two years; null if none. */
export function nextInMonths(from: string, months: number[]): string | null {
  if (!months.length) return null;
  if (months.includes(monthOf(from))) return from;
  let [y, m] = [yearOf(from), monthOf(from)];
  for (let i = 0; i < 24; i++) {
    [y, m] = nextMonth(y, m);
    if (months.includes(m)) return firstOf(y, m);
  }
  return null;
}

/** The first day after the run of these months that `from` is in: Jul in [6,7,8] → 1 Sep. */
export function afterRun(from: string, months: number[]): string {
  const set = new Set(months);
  let [y, m] = [yearOf(from), monthOf(from)];
  for (let i = 0; i < 12 && set.has(m); i++) [y, m] = nextMonth(y, m);
  return firstOf(y, m);
}

/** In the bed: planted out or growing, or sown straight into it. Indoor sowings are in the shed. */
export function inGround(stage: LifeStage, plant: Plant, pl: Planting): boolean {
  if (stage === 'planned' || stage === 'cleared' || stage === 'hardening') return false;
  if (stage === 'sown' || stage === 'germinated') return sowingOf(plant, pl) === 'direct';
  return true;
}

/** What it's marked as, in date order: sowing, each stage's date, and clearing. */
function marked(pl: Planting): Step[] {
  const out: Step[] = [];
  if (pl.sownOn) out.push({ stage: 'sown', date: pl.sownOn, guessed: false });
  for (const s of STAGES) {
    if (s === 'sown') continue;
    const d = pl.stageDates?.[s];
    if (d) out.push({ stage: s, date: d, guessed: false });
    else if (pl.stage === s) out.push({ stage: s, date: null, guessed: false });
  }
  if (pl.removedOn) out.push({ stage: 'cleared', date: pl.removedOn, guessed: false });
  return out;
}

/** Stops a projection running on for ever: a perennial goes round about twice in two years. */
const MAX_STEPS = 16;

/** The next step after a stage reached on a date, from the plant's usual months; null when nothing more is expected. */
function after(plant: Plant, pl: Planting, g: Garden, stage: LifeStage, date: string, cover: Cover | null): Step | null {
  const path = pathFor(plant, pl, !!cover);
  const later = (s: Stage) => path.includes(s) && order(s) > order(stage);
  const step = (s: LifeStage, d: string | null): Step | null => (d ? { stage: s, date: d, guessed: true } : null);
  const flowerMonths = flowerMonthsOf(plant);
  const harvestMonths = plant.cropping?.harvestMonths ?? [];
  switch (stage) {
    case 'planned':
    case 'cleared':
      return null;
    case 'sown': {
      const [min, max] = germination(plant);
      return step('germinated', addDays(date, Math.round((min + max) / 2)));
    }
    case 'germinated': {
      if (later('hardening')) {
        // Hardening off starts at its usual time in spring, once the seedlings have had a month to grow. A late
        // sowing hardens off as soon as it's ready; an autumn sowing waits for next spring.
        const ready = addDays(date, 28);
        const usual = hardenFrom(plant, g, yearOf(ready));
        return step('hardening', usual >= ready ? usual : monthOf(ready) <= 7 ? ready : hardenFrom(plant, g, yearOf(ready) + 1));
      }
      // Going under glass: straight in once grown on, with no hardening off.
      if (cover && later('transplanted')) return step('transplanted', plantInFrom(plant, g, date, cover.climate));
      return step('vegetative', addDays(date, 21));
    }
    case 'hardening':
      return step('transplanted', plantOutFrom(plant, g, date));
    case 'transplanted':
      return step('vegetative', addDays(date, 21));
    case 'vegetative': {
      // Whichever comes first: growing on into the harvest months can pass the month it usually flowers.
      const f = later('flowering') ? nextInMonths(addDays(date, 14), flowerMonths) : null;
      const h = later('harvesting') ? nextInMonths(addDays(date, 21), harvestMonths) : null;
      if (f && (!h || f <= h)) return step('flowering', f);
      return step('harvesting', h);
    }
    case 'flowering': {
      if (later('harvesting')) return step('harvesting', nextInMonths(addDays(date, 14), harvestMonths));
      return step(perennial(plant) ? 'vegetative' : 'cleared', afterRun(date, flowerMonths));
    }
    case 'harvesting': {
      const end = afterRun(date, harvestMonths.length ? harvestMonths : [monthOf(date)]);
      if (perennial(plant)) return step('vegetative', end);
      // Its harvest months cover sowings through the season; one sowing of a quick leafy crop is cut for about six weeks.
      const quick = plant.art?.form === 'rosette' && plant.art.crop?.kind !== 'fruit' && plant.art.crop?.kind !== 'pod';
      const six = addDays(date, 42);
      return step('cleared', quick && six < end ? six : end);
    }
  }
}

/** When a planned planting would usually be sown (or planted, if it isn't grown from seed), on or after today. */
function firstStep(plant: Plant, pl: Planting, today: string): Step | null {
  const how = sowingOf(plant, pl);
  if (how === 'none') {
    const d = plant.plantOutMonths?.length ? nextInMonths(today, plant.plantOutMonths) : today;
    return d ? { stage: 'transplanted', date: d, guessed: true } : null;
  }
  const months = (plant.sowing ?? []).filter((s) => (how === 'direct' ? s.method === 'direct' : s.method !== 'direct')).flatMap((s) => s.months);
  const d = nextInMonths(today, months.length ? months : (plant.sowing ?? []).flatMap((s) => s.months));
  return d ? { stage: 'sown', date: d, guessed: true } : null;
}

/**
 * A planting's life as steps in date order: what you've marked, then (unless it's been cleared) what usually
 * comes next, carried on from its latest stage for about two years.
 */
export function timeline(plant: Plant, pl: Planting, g: Garden, today: string): Step[] {
  const steps = marked(pl);
  if (pl.removedOn) return steps;
  const now = currentStage(pl);
  const cover = microclimateOf(g, pl);
  let last: Step | null;
  if (now === 'planned') last = firstStep(plant, pl, today);
  else {
    // Carry on from the latest stage, measured from when it was reached (or today, if that's not known).
    const latest = steps[steps.length - 1]!;
    last = after(plant, pl, g, latest.stage, latest.date ?? today, cover);
  }
  const horizon = addDays(today, 800);
  const tomorrow = addDays(today, 1);
  for (let i = 0; last && i < MAX_STEPS && last.date! <= horizon; i++) {
    // Each step follows from when the last was due. Nothing guessed shows on or before today: steps that are
    // overdue all land tomorrow, so it's shown at the latest of them.
    steps.push(last.date! <= today ? { ...last, date: tomorrow } : last);
    last = after(plant, pl, g, last.stage, last.date!, cover);
  }
  return steps;
}

/** Where a planting is on a day, from its timeline. Before anything's marked or expected, it's planned. */
export function stageIn(steps: Step[], date: string): Projected {
  let at: Projected = { stage: 'planned', guessed: false };
  for (const s of steps) {
    if (s.date !== null && s.date > date) break;
    at = { stage: s.stage, guessed: s.guessed };
  }
  return at;
}

/** Where a planting is on a day: what you've marked up to today, a guess after. */
export const stageOn = (plant: Plant, pl: Planting, g: Garden, date: string, today: string): Projected => stageIn(timeline(plant, pl, g, today), date);

// ---------- Lenses ----------

export type YearLens = 'flower' | 'harvest' | 'water';

/**
 * The plantings a lens picks out on a day, from what's in the ground then:
 * - flower: flowering (for bees), or a plant grown for its flowers in its flower months;
 * - harvest: ready to harvest;
 * - water: thirsty, from April to September: plants that like it moist, anything young or just planted, and
 *   everything in pots and planters, which dry out fastest, and under glass, where no rain falls (in March and October
 *   too). Live weather will sharpen this.
 */
export function pickedBy(lens: YearLens, g: Garden, plantOf: (id: string) => Plant, at: (pl: Planting) => Projected, date: string): Set<string> {
  const month = monthOf(date);
  const ids = new Set<string>();
  const kindOf = new Map(g.features.map((f) => [f.id, f.kind]));
  const anyCover = lens === 'water' && g.features.some(isCover);
  for (const pl of g.plantings) {
    const plant = plantOf(pl.plantId);
    const { stage } = at(pl);
    if (!inGround(stage, plant, pl)) continue;
    const grown = stage === 'vegetative' || stage === 'flowering' || stage === 'harvesting';
    let picked = false;
    if (lens === 'flower') picked = stage === 'flowering' || (grown && !!plant.flowerMonths?.includes(month));
    else if (lens === 'harvest') picked = stage === 'harvesting';
    else {
      const kind = kindOf.get(pl.featureId);
      const potted = kind === 'pot' || kind === 'planter' || (anyCover && !!microclimateOf(g, pl));
      const summer = month >= 4 && month <= 9;
      const young = stage === 'sown' || stage === 'germinated' || stage === 'transplanted';
      picked = (summer && (potted || young || plant.conditions.moisture === 'moist')) || (potted && (month === 3 || month === 10));
    }
    if (picked) ids.add(pl.id);
  }
  return ids;
}

// ---------- Beds standing empty ----------

export interface Gap {
  bed: Feature;
  /** When the last planting came out, if any did before this day. */
  emptyFrom: string | null;
  /** Plants that could go in this month: quick crops for a gap. */
  ideas: string[];
}

/** Quick crops, in order of preference, for filling a bed that's standing empty. */
const FILLERS = ['lettuce', 'radish', 'spinach', 'rocket', 'spring-onion', 'oriental-greens', 'mizuna', 'pak-choi', 'winter-purslane', 'corn-salad', 'garlic', 'broad-bean', 'onion', 'pea', 'beetroot', 'chard', 'kale', 'green-manure'];

/** Plants that can be sown outside or planted out in a month, quickest first. */
export function fillersFor(month: number, plantOf: (id: string) => Plant | null): string[] {
  const out: string[] = [];
  for (const id of FILLERS) {
    const p = plantOf(id);
    if (!p) continue;
    const sow = (p.sowing ?? []).some((s) => s.method === 'direct' && s.months.includes(month));
    if (sow || p.plantOutMonths?.includes(month)) out.push(p.id);
    if (out.length === 2) break;
  }
  return out;
}

/**
 * Beds, pots and planters standing empty on a day: nothing in the ground, though something grew there before or
 * is planned for it. Beds that have never had anything are left alone.
 */
export function gapsOn(g: Garden, plantOf: (id: string) => Plant, timelines: Map<string, Step[]>, date: string, ideaOf: (id: string) => Plant | null = plantOf): Gap[] {
  const gaps: Gap[] = [];
  for (const bed of g.features) {
    if (!isContainer(bed)) continue;
    const here = g.plantings.filter((p) => p.featureId === bed.id);
    if (!here.length) continue;
    let used = false;
    let emptyFrom: string | null = null;
    for (const pl of here) {
      const plant = plantOf(pl.plantId);
      const steps = timelines.get(pl.id) ?? [];
      if (inGround(stageIn(steps, date).stage, plant, pl)) {
        used = true;
        break;
      }
      // When it left the ground, if that was before this day.
      for (let i = 1; i < steps.length; i++) {
        const s = steps[i]!;
        if (s.date === null || s.date > date) break;
        if (!inGround(s.stage, plant, pl) && inGround(steps[i - 1]!.stage, plant, pl) && (!emptyFrom || s.date > emptyFrom)) emptyFrom = s.date;
      }
    }
    if (!used) gaps.push({ bed, emptyFrom, ideas: fillersFor(monthOf(date), ideaOf) });
  }
  return gaps;
}

/** "Empty from 12 Aug: sow lettuce or radish?" */
export function gapText(gap: Gap, plantOf: (id: string) => Plant, today: string): string {
  const when = gap.emptyFrom && gap.emptyFrom > today ? `Empty from ${shortDate(gap.emptyFrom)}` : `${featureLabel(gap.bed)} is empty`;
  const names = gap.ideas.map((id) => plantOf(id).commonName.toLowerCase());
  return names.length ? `${when}: sow ${names.join(' or ')}?` : when;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Aug". */
export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[monthOf(iso) - 1]}`;
