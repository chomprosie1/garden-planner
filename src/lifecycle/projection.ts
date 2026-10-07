// The garden through the year: where each planting is on any day, a year
// either side of today. Up to today it's what you've marked. After today it's
// carried on from there with the plant's usual months (sowing, planting out,
// flowering, harvest), sharpened by growing degree days from UK climate
// averages: crops come on with the warmth they get, so they're sooner in the
// south and under glass, and tender ones end at the first frost. A projected
// stage is a guess, and says so. Pure functions.

import { isCover, microclimateOf, type Cover } from '../climate/microclimate';
import { coverKey } from '../climate/warmth';
import { rainOver, weatherOn, type Weather } from '../weather/weather';
import { daysBetween } from '../model/dates';
import { featureLabel } from '../model/features';
import { STAGES, type Feature, type Garden, type Plant, type Planting, type Stage } from '../model/types';
import { isContainer } from '../planting/place';
import { readyFrom, runsOf, seasonMonth, seasonShift, upFrom } from './growth';
import { addDays, frostDatesUnder, germination, hardenFrom, inYear, isTender, plantInFrom, plantOutFrom } from './shed';
import { currentStage, flowerMonthsOf, isGrowingStage, pathFor, perennial, sowingOf, type LifeStage } from './stages';

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

const later = (a: string, b: string) => (a > b ? a : b);
const sooner = (a: string, b: string) => (a < b ? a : b);

/** What a projection knows besides the stage: the cover over the planting, and when it went in the ground. */
interface Context {
  plant: Plant;
  pl: Planting;
  g: Garden;
  cover: Cover | null;
  /** When it was sown outside or planted out, the day its growing degree days count from; null before that. */
  start: string | null;
  /** This year's weather, if you've turned it on: the days it covers count as they were. */
  weather: Weather | null;
}

/**
 * The runs of these months around a day, as [first day, day after], moved with the season: a run starts `shift` days
 * later (sooner, if negative). A month or two of flowers or fruit ends the same amount later; a longer season ends that
 * much sooner, since where spring comes late, autumn comes early (and the other way round under glass).
 */
const seasonCache = new Map<string, [string, string][]>();

function seasons(around: string, months: number[], shift: number): [string, string][] {
  const year = yearOf(around);
  const key = `${months.join(',')}|${shift}|${year}`;
  const hit = seasonCache.get(key);
  if (hit) return hit;
  const out: [string, string][] = [];
  for (let y = year - 1; y <= year + 2; y++)
    for (const run of runsOf(months)) {
      const first = firstOf(y, run[0]!);
      const from = addDays(first, shift);
      const to = addDays(afterRun(first, run), run.length >= 3 ? -shift : shift);
      if (from < to) out.push([from, to]);
    }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  seasonCache.set(key, out);
  return out;
}

/** The next day in these months, with the season moved by `shift` days: a spring that comes two weeks sooner brings the months two weeks sooner. */
export function nextInSeason(from: string, months: number[], shift: number): string | null {
  const run = seasons(from, months, shift).find(([, to]) => to > from);
  return run ? later(run[0], from) : null;
}

/**
 * The end of the run of these months that `from` is in, or the next one if it's come early (sprouts ready before their
 * months stand until the end of them), moved with the season. The day after `from` if there's none within three months.
 */
export function afterSeason(from: string, months: number[], shift: number): string {
  const run = seasons(from, months, shift).find(([, to]) => to > from);
  return run && run[0] <= addDays(from, 92) ? run[1] : addDays(from, 1);
}

const frosts = new WeakMap<Garden, Map<string, ReturnType<typeof frostDatesUnder>>>();

/** The garden's frost dates, outdoors or under a cover, kept with the garden while it's unchanged. */
function frostsFor(g: Garden, cover: Cover | null) {
  let mine = frosts.get(g);
  if (!mine) frosts.set(g, (mine = new Map()));
  const key = coverKey(cover?.climate ?? null);
  if (!mine.has(key)) mine.set(key, frostDatesUnder(g, cover?.climate ?? null));
  return mine.get(key)!;
}

/** Tender annuals outside, or under unheated glass, die at the first autumn frost after they went in. Null when that's not a worry. */
function frostEnd(c: Context, from: string): string | null {
  const { plant, g, cover } = c;
  if (!isTender(plant) || perennial(plant)) return null;
  const frost = frostsFor(g, cover);
  if (!frost) return null;
  const sameYear = inYear(frost.firstFrost, yearOf(from));
  return sameYear > from ? sameYear : inYear(frost.firstFrost, yearOf(from) + 1);
}

/** The next step after a stage reached on a date, from the warmth it gets and the plant's usual months; null when nothing more is expected. */
function after(c: Context, stage: LifeStage, date: string): Step | null {
  const { plant, pl, g, cover } = c;
  const path = pathFor(plant, pl, !!cover);
  const ahead = (s: Stage) => path.includes(s) && order(s) > order(stage);
  const step = (s: LifeStage, d: string | null): Step | null => (d ? { stage: s, date: d, guessed: true } : null);
  const climate = cover?.climate ?? null;
  const flowerMonths = flowerMonthsOf(plant);
  const harvestMonths = plant.cropping?.harvestMonths ?? [];
  // How much sooner or later its season comes here than in the middle of England.
  const shiftFor = (months: number[]) => {
    const m = seasonMonth(months);
    return m ? seasonShift(g, climate, m) : 0;
  };
  // When the crop's had the warmth to be ready: the first harvest (or flowers, for a plant grown for them). A perennial
  // comes round with the seasons instead.
  const cropMonths = path.includes('harvesting') ? harvestMonths : flowerMonths;
  const ready = (share = 1) => (c.start && !perennial(plant) ? readyFrom(plant, pl, g, c.start, climate, share, c.weather) : null);
  // A late sowing still crops before its season's out: the warmth can't push the first harvest past two weeks before
  // the end of its months.
  const cropBy = (): string | null => {
    const d = ready();
    if (!d || !c.start || !cropMonths.length) return d;
    const shift = shiftFor(cropMonths);
    const open = nextInSeason(c.start, cropMonths, shift);
    if (!open) return d;
    const close = addDays(afterSeason(open, cropMonths, shift), -14);
    return d > close ? later(close, open) : d;
  };
  // A tender annual that hasn't got there by the first frost is finished.
  const orFrost = (s: Stage, d: string | null): Step | null => {
    const frost = frostEnd(c, c.start ?? date);
    return d && frost && frost < d ? step('cleared', later(frost, addDays(date, 1))) : step(s, d);
  };
  switch (stage) {
    case 'planned':
    case 'cleared':
      return null;
    case 'sown': {
      const [min, max] = germination(plant);
      const usual = Math.round((min + max) / 2);
      // Indoors it's always warm; outside, seeds come up sooner in warm soil and slower in cold.
      return step('germinated', sowingOf(plant, pl) === 'direct' ? upFrom(plant, g, date, climate, usual, c.weather) : addDays(date, usual));
    }
    case 'germinated': {
      if (ahead('hardening')) {
        // Hardening off starts at its usual time in spring, once the seedlings have had a month to grow. A late
        // sowing hardens off as soon as it's ready; an autumn sowing waits for next spring.
        const grown = addDays(date, 28);
        const usual = hardenFrom(plant, g, yearOf(grown));
        return step('hardening', usual >= grown ? usual : monthOf(grown) <= 7 ? grown : hardenFrom(plant, g, yearOf(grown) + 1));
      }
      // Going under glass: straight in once grown on, with no hardening off.
      if (cover && ahead('transplanted')) return step('transplanted', plantInFrom(plant, g, date, cover.climate));
      return step('vegetative', addDays(date, 21));
    }
    case 'hardening':
      return step('transplanted', plantOutFrom(plant, g, date));
    case 'transplanted':
      return step('vegetative', addDays(date, 21));
    case 'vegetative': {
      const crop = cropBy();
      if (crop) {
        // From the warmth: a fruiting crop flowers a little over halfway to its first harvest, and at least a week before it.
        const week = addDays(date, 7);
        if (ahead('flowering')) return orFrost('flowering', later(ahead('harvesting') ? sooner(ready(0.6) ?? crop, addDays(crop, -7)) : crop, week));
        if (ahead('harvesting')) return orFrost('harvesting', later(crop, week));
      }
      // From its months, moved with the season. Whichever comes first: growing on into the harvest months can pass
      // the month it usually flowers.
      const f = ahead('flowering') ? nextInSeason(addDays(date, 14), flowerMonths, shiftFor(flowerMonths)) : null;
      const h = ahead('harvesting') ? nextInSeason(addDays(date, 21), harvestMonths, shiftFor(harvestMonths)) : null;
      if (f && (!h || f <= h)) return orFrost('flowering', f);
      return orFrost('harvesting', h);
    }
    case 'flowering': {
      if (ahead('harvesting')) {
        const fromMonths = nextInSeason(addDays(date, 14), harvestMonths, shiftFor(harvestMonths));
        const crop = cropBy();
        return orFrost('harvesting', crop ? later(crop, addDays(date, 7)) : fromMonths);
      }
      // In flower to the end of its flower months, or for at least four weeks if the warmth brought it on late.
      const end = later(afterSeason(date, flowerMonths, shiftFor(flowerMonths)), addDays(date, 28));
      if (perennial(plant)) return step('vegetative', end);
      const frost = frostEnd(c, c.start ?? date);
      return step('cleared', frost ? later(sooner(end, frost), addDays(date, 1)) : end);
    }
    case 'harvesting': {
      const months = harvestMonths.length ? harvestMonths : [monthOf(date)];
      const end = later(afterSeason(date, months, shiftFor(months)), addDays(date, 28));
      if (perennial(plant)) return step('vegetative', end);
      // Its harvest months cover sowings through the season; one sowing of a quick leafy crop is cut for about six weeks.
      const quick = plant.art?.form === 'rosette' && plant.art.crop?.kind !== 'fruit' && plant.art.crop?.kind !== 'pod';
      const six = addDays(date, 42);
      const done = quick && six < end ? six : end;
      const frost = frostEnd(c, c.start ?? date);
      return step('cleared', frost ? later(sooner(done, frost), addDays(date, 1)) : done);
    }
  }
}

/** Steps that put a planting in the ground: planting out, or sowing outside. */
const startsGrowth = (s: Step, plant: Plant, pl: Planting) => s.date !== null && (s.stage === 'transplanted' || (s.stage === 'sown' && sowingOf(plant, pl) === 'direct'));

/** When a planned planting would usually be sown (or planted, if it isn't grown from seed), on or after today, or when you mean to sow it. */
function firstStep(plant: Plant, pl: Planting, today: string): Step | null {
  const how = sowingOf(plant, pl);
  // A batch sown on a date of your choosing: then, whatever the months say.
  if (pl.sowBy) return { stage: how === 'none' ? 'transplanted' : 'sown', date: pl.sowBy, guessed: true };
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
export function timeline(plant: Plant, pl: Planting, g: Garden, today: string, weather: Weather | null = null): Step[] {
  const steps = marked(pl);
  if (pl.removedOn) return steps;
  const now = currentStage(pl);
  const c: Context = { plant, pl, g, cover: microclimateOf(g, pl), start: null, weather };
  for (const s of steps) if (startsGrowth(s, plant, pl)) c.start = s.date;
  let last: Step | null;
  if (now === 'planned') last = firstStep(plant, pl, today);
  else {
    // Carry on from the latest stage, measured from when it was reached (or today, if that's not known).
    const latest = steps[steps.length - 1]!;
    // Growing, with no date for when it went in: count the warmth from when it reached this stage, or today.
    if (!c.start && isGrowingStage(latest.stage)) c.start = latest.date ?? today;
    last = after(c, latest.stage, latest.date ?? today);
  }
  const horizon = addDays(today, 800);
  const tomorrow = addDays(today, 1);
  for (let i = 0; last && i < MAX_STEPS && last.date! <= horizon; i++) {
    // Each step follows from when the last was due. Nothing guessed shows on or before today: steps that are
    // overdue all land tomorrow, so it's shown at the latest of them.
    steps.push(last.date! <= today ? { ...last, date: tomorrow } : last);
    if (startsGrowth(last, plant, pl)) c.start = last.date;
    last = after(c, last.stage, last.date!);
  }
  return steps;
}

/**
 * The step a planting should reach next after the latest one you've marked, and when, as it was expected: not moved to
 * tomorrow when it's overdue, as the timeline does. Null when it's planned or cleared, or its latest stage has no date.
 * From: when the latest stage was reached.
 */
export function expectedNext(plant: Plant, pl: Planting, g: Garden, weather: Weather | null = null): { stage: LifeStage; date: string; from: string } | null {
  const now = currentStage(pl);
  if (now === 'planned' || now === 'cleared' || pl.removedOn) return null;
  const steps = marked(pl);
  const latest = steps[steps.length - 1];
  if (!latest?.date) return null;
  const c: Context = { plant, pl, g, cover: microclimateOf(g, pl), start: null, weather };
  for (const s of steps) if (startsGrowth(s, plant, pl)) c.start = s.date;
  if (!c.start && isGrowingStage(latest.stage)) c.start = latest.date;
  const next = after(c, latest.stage, latest.date);
  return next?.date ? { stage: next.stage, date: next.date, from: latest.date } : null;
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
export const stageOn = (plant: Plant, pl: Planting, g: Garden, date: string, today: string, weather: Weather | null = null): Projected => stageIn(timeline(plant, pl, g, today, weather), date);

/**
 * The stage a growing planting has probably reached by a day (tomorrow, by default), when that's flowering or
 * harvesting and later than the stage you've marked. Earlier stages need you to look.
 */
export function probableStage(plant: Plant, pl: Planting, g: Garden, today: string, weather: Weather | null = null, by = addDays(today, 1)): 'flowering' | 'harvesting' | null {
  const now = currentStage(pl);
  if (now === 'planned' || now === 'cleared') return null;
  if (!isGrowingStage(now) && sowingOf(plant, pl) !== 'direct') return null;
  const at = stageIn(timeline(plant, pl, g, today, weather), by);
  if (!at.guessed || (at.stage !== 'flowering' && at.stage !== 'harvesting') || order(at.stage) <= order(now)) return null;
  return at.stage;
}

/** "Ready to harvest from about 12 Aug": the next milestone a growing planting is heading for, after today. Null when there's none. */
export function expectedText(steps: Step[], plant: Plant, today: string): string | null {
  for (const s of steps) {
    if (!s.guessed || s.date === null || s.date <= today) continue;
    if (s.stage === 'flowering') return `In flower from about ${shortDate(s.date)}`;
    if (s.stage === 'harvesting') return `Ready to harvest from about ${shortDate(s.date)}`;
    if (s.stage === 'cleared') return perennial(plant) ? null : `Finished by about ${shortDate(s.date)}`;
  }
  return null;
}

// ---------- Lenses ----------

export type YearLens = 'flower' | 'harvest' | 'water';

/**
 * The plantings a lens picks out on a day, from what's in the ground then:
 * - flower: flowering (for bees), or a plant grown for its flowers in its flower months;
 * - harvest: ready to harvest;
 * - water: thirsty, from April to September: plants that like it moist, anything young or just planted, and
 *   everything in pots and planters, which dry out fastest, and under glass, where no rain falls (in March and October
 *   too). With this year's weather, for the days it covers: after a good soaking only what's under glass; after a
 *   little rain, pots in warm weather; in a dry, warm spell, everything in the ground.
 */
export function pickedBy(lens: YearLens, g: Garden, plantOf: (id: string) => Plant, at: (pl: Planting) => Projected, date: string, weather: Weather | null = null): Set<string> {
  const month = monthOf(date);
  const ids = new Set<string>();
  const kindOf = new Map(g.features.map((f) => [f.id, f.kind]));
  const anyCover = lens === 'water' && g.features.some(isCover);
  const wet = lens === 'water' ? wetness(weather, date) : null;
  for (const pl of g.plantings) {
    const plant = plantOf(pl.plantId);
    const { stage } = at(pl);
    if (!inGround(stage, plant, pl)) continue;
    // A weed you keep can be in flower for the bees; it's never one to pick or water.
    if (plant.category === 'weed' && (lens !== 'flower' || !pl.keep)) continue;
    const grown = stage === 'vegetative' || stage === 'flowering' || stage === 'harvesting';
    let picked = false;
    if (lens === 'flower') picked = stage === 'flowering' || (grown && !!plant.flowerMonths?.includes(month));
    else if (lens === 'harvest') picked = stage === 'harvesting';
    else {
      const kind = kindOf.get(pl.featureId);
      const covered = anyCover && !!microclimateOf(g, pl);
      const potted = kind === 'pot' || kind === 'planter' || covered;
      const summer = month >= 4 && month <= 9;
      const young = stage === 'sown' || stage === 'germinated' || stage === 'transplanted';
      if (wet && covered) picked = month >= 3 && month <= 10;
      else if (wet?.soaked) picked = false;
      else if (wet) picked = (potted && wet.warm) || (!wet.damp && (young || plant.conditions.moisture === 'moist' || (wet.dry && wet.warm)));
      else picked = (summer && (potted || young || plant.conditions.moisture === 'moist')) || (potted && (month === 3 || month === 10));
    }
    if (picked) ids.add(pl.id);
  }
  return ids;
}

/** How wet it's been, from the weather, for the Water lens. */
export interface Wetness {
  /** 10 mm or more in the last three days: the ground's had a good soaking. */
  soaked: boolean;
  /** 4 mm or more in the last three days: enough for beds, not for pots in the warm. */
  damp: boolean;
  /** Under 5 mm in the last week. */
  dry: boolean;
  /** 18 °C or warmer by day. */
  warm: boolean;
  /** Rain in the last three days, mm. */
  rain3: number;
}

/** How wet it's been up to a day; null on days the weather doesn't cover. */
export function wetness(w: Weather | null, date: string): Wetness | null {
  const day = weatherOn(w, date);
  const rain3 = rainOver(w, date, 3);
  const rain7 = rainOver(w, date, 7);
  if (!day || rain3 === null || rain7 === null) return null;
  return { soaked: rain3 >= 10, damp: rain3 >= 4, dry: rain7 < 5, warm: day.max >= 18, rain3 };
}

// ---------- Beds standing empty ----------

export interface Gap {
  bed: Feature;
  /** When the last planting came out, if any did before this day. */
  emptyFrom: string | null;
  /** When something planned for it goes in, if anything is: ideas must be done by then. */
  until: string | null;
  /** Plants that could go in this month: quick crops for a gap. */
  ideas: string[];
}

/** Quick crops, in order of preference, for filling a bed that's standing empty. */
const FILLERS = ['lettuce', 'radish', 'spinach', 'rocket', 'spring-onion', 'oriental-greens', 'mizuna', 'pak-choi', 'winter-purslane', 'corn-salad', 'garlic', 'broad-bean', 'onion', 'pea', 'beetroot', 'chard', 'kale', 'green-manure'];

/** A bed that's empty for less than this before something planned goes in isn't a gap: it's waiting. */
export const GAP_MIN_DAYS = 56;

/**
 * About how long a crop sown in a month takes until it's done: its days to crop if it has them, otherwise to the end of
 * its first harvest (or flowering) run after sowing. null when there's no telling.
 */
export function daysToCrop(p: Plant, month: number): number | null {
  if (p.growth?.days) return p.growth.days[1];
  const months = p.cropping?.harvestMonths?.length ? p.cropping.harvestMonths : p.flowerMonths;
  if (!months?.length) return null;
  // Months from sowing to the start of the first run, then that run's length.
  const ahead = (m: number) => (m - month + 12) % 12;
  const start = months.reduce((best, m) => (ahead(m) < ahead(best) ? m : best));
  let len = 1;
  while (len < 12 && months.includes(((start + len - 1) % 12) + 1)) len++;
  return Math.round((ahead(start) + len) * 30.4);
}

export interface FillerOptions {
  /** Plants already growing or planned in the bed: ideas they're usually kept apart from are left out. */
  neighbours?: Plant[];
  /** The days until something planned goes in: ideas must be done by then. */
  withinDays?: number | null;
}

const badNeighbours = (a: Plant, b: Plant) => !!a.companions?.avoid.includes(b.id) || !!b.companions?.avoid.includes(a.id);

/**
 * Plants that can be sown outside or planted out in a month: from your sowing list first, then quick crops, quickest
 * first. Two at most. Never one that's usually kept apart from what's in the bed, or one that won't be done before
 * what's planned for it goes in.
 */
export function fillersFor(month: number, plantOf: (id: string) => Plant | null, sowingList: string[] = [], opts: FillerOptions = {}): string[] {
  const out: string[] = [];
  const neighbours = opts.neighbours ?? [];
  for (const id of [...new Set([...sowingList, ...FILLERS])]) {
    const p = plantOf(id);
    if (!p || perennial(p)) continue;
    if (neighbours.some((n) => n.id === p.id || badNeighbours(p, n))) continue;
    if (opts.withinDays != null) {
      const days = daysToCrop(p, month);
      if (days === null || days > opts.withinDays) continue;
    }
    const sow = (p.sowing ?? []).some((s) => s.method === 'direct' && s.months.includes(month));
    if (sow || p.plantOutMonths?.includes(month)) out.push(p.id);
    if (out.length === 2) break;
  }
  return out;
}

/**
 * Beds, pots and planters standing empty on a day: nothing in the ground, though something grew there before or
 * is planned for it. Beds that have never had anything are left alone, and so is a bed whose planned crop goes in
 * within eight weeks: it's waiting, not empty.
 */
export function gapsOn(g: Garden, plantOf: (id: string) => Plant, timelines: Map<string, Step[]>, date: string, ideaOf: (id: string) => Plant | null = plantOf): Gap[] {
  const gaps: Gap[] = [];
  for (const bed of g.features) {
    if (!isContainer(bed)) continue;
    // Weeds don't fill a bed.
    const here = g.plantings.filter((p) => p.featureId === bed.id && plantOf(p.plantId).category !== 'weed');
    if (!here.length) continue;
    let used = false;
    let emptyFrom: string | null = null;
    let until: string | null = null;
    const neighbours: Plant[] = [];
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
      // When it goes in, if that's still to come: it's a neighbour for whatever fills the gap first.
      const next = steps.find((s) => s.date !== null && s.date > date && inGround(s.stage, plant, pl));
      if (next?.date) {
        neighbours.push(plant);
        if (!until || next.date < until) until = next.date;
      }
    }
    if (used) continue;
    const window = until ? daysBetween(date, until) : null;
    if (window !== null && window < GAP_MIN_DAYS) continue;
    gaps.push({ bed, emptyFrom, until, ideas: fillersFor(monthOf(date), ideaOf, g.wishlist, { neighbours, withinDays: window }) });
  }
  return gaps;
}

/** "Empty from 12 Aug: sow lettuce or radish?", or "Empty until 1 Mar: sow radish first?" */
export function gapText(gap: Gap, plantOf: (id: string) => Plant, today: string): string {
  const when = gap.emptyFrom && gap.emptyFrom > today ? `Empty from ${shortDate(gap.emptyFrom)}` : gap.until ? `Empty until ${shortDate(gap.until)}` : `${featureLabel(gap.bed)} is empty`;
  const names = gap.ideas.map((id) => plantOf(id).commonName.toLowerCase());
  return names.length ? `${when}: sow ${names.join(' or ')}${gap.until ? ' first' : ''}?` : when;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Aug". */
export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[monthOf(iso) - 1]}`;
