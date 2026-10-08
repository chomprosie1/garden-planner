// Where each planting is in its life: sown, up, hardening off, planted out,
// growing, flowering, harvesting, cleared. Pure functions: plants and
// plantings in, stages and new gardens out.
//
// Not every plant goes through every stage. Carrots sown outside never harden
// off, lettuce has no flowering stage worth marking (it has bolted), and plants
// bought in pots or bulbs start at planting. Perennials go round again each year.

import { feedTip } from '../feeding/feeds';
import { runStarts } from '../library/library';
import { addNote, makeNote } from '../model/notes';
import { STAGES, type Garden, type Plant, type Planting, type Stage } from '../model/types';

/** A planting's place in its life, including before sowing and after clearing. */
export type LifeStage = 'planned' | Stage | 'cleared';

export const STAGE_LABEL: Record<LifeStage, string> = {
  planned: 'Planned',
  sown: 'Sown',
  germinated: 'Up',
  hardening: 'Hardening off',
  transplanted: 'Planted out',
  vegetative: 'Growing',
  flowering: 'Flowering',
  harvesting: 'Harvesting',
  cleared: 'Cleared',
};

/** A line on what a stage means, for the ones that aren't obvious. */
export const STAGE_EXPLAIN: Partial<Record<Stage, string>> = {
  hardening: 'Hardening off gets seedlings used to the outdoors: outside by day and in at night for a week or two, before they’re planted out.',
};

/** What "move on" says for each stage: "Mark as up", "Start hardening off". */
export const STAGE_ACTION: Record<Stage, string> = {
  sown: 'Mark as sown',
  germinated: 'Mark as up',
  hardening: 'Start hardening off',
  transplanted: 'Mark as planted out',
  vegetative: 'Mark as growing',
  flowering: 'Mark as flowering',
  harvesting: 'Start harvesting',
};

const order = (s: Stage) => STAGES.indexOf(s);

export const flowers = (p: Plant): boolean => p.lifePath?.flowering ?? (p.category === 'flower' || p.category === 'fruit' || !!p.flowerMonths?.length);
export const harvests = (p: Plant): boolean => !!p.cropping?.harvestMonths.length;
export const perennial = (p: Plant): boolean => p.lifePath?.perennial ?? (p.category === 'fruit' || p.category === 'shrub' || p.category === 'tree');

/** How this planting was, or will be, sown: indoors (or under cover), outside, or not at all (bought plants, bulbs, fruit). */
export function sowingOf(plant: Plant, pl?: Planting): 'indoors' | 'direct' | 'none' {
  if (pl?.sowing) return pl.sowing;
  const methods = (plant.sowing ?? []).map((s) => s.method);
  if (methods.length === 0) return 'none';
  return methods[0] === 'direct' ? 'direct' : 'indoors';
}

/** The stages this planting goes through, in order. Under a greenhouse or cold frame (covered), seedlings go in without hardening off. */
export function pathFor(plant: Plant, pl?: Planting, covered = false): Stage[] {
  const sowing = sowingOf(plant, pl);
  const indoors: Stage[] = covered ? ['sown', 'germinated', 'transplanted'] : ['sown', 'germinated', 'hardening', 'transplanted'];
  const start: Stage[] = sowing === 'indoors' ? indoors : sowing === 'direct' ? ['sown', 'germinated'] : ['transplanted'];
  return [...start, 'vegetative', ...(flowers(plant) ? (['flowering'] as const) : []), ...(harvests(plant) ? (['harvesting'] as const) : [])];
}

export function currentStage(pl: Planting): LifeStage {
  if (pl.removedOn) return 'cleared';
  if (pl.stage) return pl.stage;
  return pl.sownOn ? 'sown' : 'planned';
}

/** When a stage was reached, if known. */
export function stageDate(pl: Planting, s: LifeStage): string | undefined {
  if (s === 'sown') return pl.sownOn;
  if (s === 'cleared') return pl.removedOn;
  if (s === 'planned') return undefined;
  return pl.stageDates?.[s];
}

/** In the ground and growing: planted out, or sown outside and past sowing. */
export const isGrowingStage = (s: LifeStage) => s === 'transplanted' || s === 'vegetative' || s === 'flowering' || s === 'harvesting';

/** The stage after this one, or for a perennial at the end of its year, "vegetative" again (a new season). Null when there's nothing next. */
export function nextStage(plant: Plant, pl: Planting, covered = false): Stage | null {
  const now = currentStage(pl);
  if (now === 'cleared') return null;
  const path = pathFor(plant, pl, covered);
  if (now === 'planned') return path[0]!;
  const later = path.filter((s) => order(s) > order(now));
  if (later.length) return later[0]!;
  return perennial(plant) ? 'vegetative' : null;
}

/** True when moving on would start a new season (a perennial going round again). */
export const isNewSeason = (plant: Plant, pl: Planting) => {
  const now = currentStage(pl);
  return now !== 'planned' && now !== 'cleared' && nextStage(plant, pl) === 'vegetative' && order(now) > order('vegetative');
};

/**
 * Sets plantings to a stage on a date. Moving back (correcting a mistake, or a perennial's new season) drops the
 * dates of the stages after it, and a corrected stage keeps the date it was first reached; a new season starts afresh.
 * "planned" clears sowing and stages altogether. Clearing has its own edit, harvestPlantings.
 */
export function setStage(g: Garden, ids: string[], stage: Stage | 'planned', date: string, opts: { newSeason?: boolean } = {}): Garden {
  const set = new Set(ids);
  let changed = false;
  const plantings = g.plantings.map((p) => {
    if (!set.has(p.id) || p.removedOn) return p;
    changed = true;
    const { stage: _s, stageDates: _d, sownOn, sowing, ...rest } = p;
    if (stage === 'planned') return rest;
    const keep = Object.fromEntries(Object.entries(p.stageDates ?? {}).filter(([s]) => order(s as Stage) < order(stage))) as Partial<Record<Stage, string>>;
    const next: Planting = { ...rest };
    if (sowing) next.sowing = sowing;
    if (stage === 'sown') {
      next.sownOn = sownOn ?? date;
    } else {
      if (sownOn) next.sownOn = sownOn;
      next.stage = stage;
      keep[stage] = (!opts.newSeason && p.stageDates?.[stage]) || date;
    }
    if (Object.keys(keep).length) next.stageDates = keep;
    return next;
  });
  return changed ? { ...g, plantings } : g;
}

/** A sowing that didn't come to anything: back to planned, so it can be sown again, with a note in the journal. */
export function markFailed(g: Garden, id: string, plantName: string, date: string): Garden {
  const pl = g.plantings.find((p) => p.id === id);
  if (!pl || pl.removedOn) return g;
  const sown = pl.sownOn ? ` (sown ${pl.sownOn})` : '';
  return addNote(setStage(g, [id], 'planned', date), makeNote(`${plantName}: sowing failed${sown}. Ready to sow again.`, date, { plantingId: id }));
}

/** Records how plantings were sown (indoors or outside), which changes their path. */
export function setSowing(g: Garden, ids: string[], sowing: 'indoors' | 'direct'): Garden {
  const set = new Set(ids);
  return { ...g, plantings: g.plantings.map((p) => (set.has(p.id) ? { ...p, sowing } : p)) };
}

// ---------- What stage it's probably at ----------

/** Months it's probably flowering: its flower months, or for a fruiting crop, the month before the harvest starts. */
export function flowerMonthsOf(plant: Plant): number[] {
  if (!flowers(plant)) return [];
  if (plant.flowerMonths?.length) return plant.flowerMonths;
  const starts = runStarts(plant.cropping?.harvestMonths ?? []);
  return starts.map((m) => (m === 1 ? 12 : m - 1));
}

/**
 * The stage a planting has probably reached in this month, when that's later than the stage you've marked: from the
 * plant's months, for the month's jobs. For a day, projection.ts's probableStage uses growing degree days.
 * Only flowering and harvesting are guessed: earlier stages need you to look.
 */
export function suggestedStage(plant: Plant, pl: Planting, month: number): Stage | null {
  const now = currentStage(pl);
  if (now === 'planned' || now === 'cleared') return null;
  const path = pathFor(plant, pl);
  const growing = isGrowingStage(now) || (sowingOf(plant, pl) === 'direct' && order(now) >= order('sown'));
  if (!growing) return null;
  const candidates: Stage[] = [];
  if (path.includes('harvesting') && plant.cropping!.harvestMonths.includes(month)) candidates.push('harvesting');
  if (path.includes('flowering') && flowerMonthsOf(plant).includes(month)) candidates.push('flowering');
  const best = candidates.find((s) => order(s) > order(now));
  return best ?? null;
}

// ---------- Advice ----------

/** Advice for a stage: the plant's own first, or general advice that fits how it's grown; then a line on feeding, if it has one. */
export function stageTips(plant: Plant, stage: LifeStage, pl?: Planting): string[] {
  if (stage === 'planned' || stage === 'cleared') return [];
  const feed = feedTip(plant, stage);
  const own = plant.stageTips?.[stage];
  const tips = own?.length ? own : generalTips(plant, stage, pl, !!feed);
  return feed ? [...tips, feed] : tips;
}

function generalTips(plant: Plant, stage: Stage, pl: Planting | undefined, fed: boolean): string[] {
  const sowing = sowingOf(plant, pl);
  switch (stage) {
    case 'sown':
      return sowing === 'direct'
        ? ['Keep the soil moist while they come up, and look out for slugs after dark: they love a tender seedling.']
        : ['Moist, not wet. Most seeds are up in one to three weeks, quicker somewhere warm.'];
    case 'germinated':
      return sowing === 'direct'
        ? ['Once they’re big enough to hold, thin them to their final spacing. The thinnings of many crops are good to eat.']
        : ['All the light you can give them, so they grow sturdy rather than tall. Pot them on when roots peep out of the bottom.'];
    case 'hardening':
      return ['Out by day and in at night for a week or two, then out on mild nights too. Then they’re ready for the garden.'];
    case 'transplanted':
      return sowing === 'none' ? ['Water in well, and keep watering in dry spells until the roots have found their way.'] : ['Water in well to settle the soil round the roots. Keep a fleece handy for a cold night.'];
    case 'vegetative':
      return ['Weeds down, water in dry spells, and a mulch to hold the moisture in. Then let it grow.'];
    case 'flowering':
      return plant.category === 'flower'
        ? ['Snip off the faded flowers and more will follow: a few minutes with the secateurs on a summer evening.']
        : harvests(plant)
          ? [fed ? 'The flowers are the start of the crop. Water regularly, so the fruit doesn’t split.' : 'The flowers are the start of the crop. Water regularly, and switch to a high-potash feed for fruiting crops.']
          : ['In flower. Enjoy it.'];
    case 'harvesting':
      return ['Pick little and often: for many crops, the more you pick, the more there is.'];
  }
}
