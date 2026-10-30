// The month's jobs for your own plants, worked out from what's on the plan
// and what's on your sowing list. Pure functions: garden and plants in, jobs out.
//
// What's on the plan but not yet sown gets sowing and planting-out jobs.
// Once a planting has a sowing date, it gets harvest, winter and tidy jobs.
// When a planting has probably reached flowering, a "check progress" job asks you to confirm it.

import { microclimateOf } from '../climate/microclimate';
import { feedDetail, feedingDue, feedsInUse, isOnce, plantingFeedText, potFeedDetail, potFeedSteps } from '../feeding/schedule';
import { plantHere } from '../lifecycle/growth';
import { addDays, frostDates, isTender, plantOutMonthsUnder, safeOut } from '../lifecycle/shed';
import { currentStage, isRoot, pathFor, setStage, sowingOf, stageLabel, stageTips, suggestedStage } from '../lifecycle/stages';
import { probableStage, shortDate, stageIn, timeline } from '../lifecycle/projection';
import { behindOf } from '../lifecycle/behind';
import type { Weather } from '../weather/weather';
import { potWaterJobs, waterJob } from './watering';
import { featureLabel, placeLabel, updateFeature } from '../model/features';
import { runEnds } from '../library/library';
import { STAGES, type Garden, type PickSize, type Plant, type Planting, type Stage } from '../model/types';
import { addPick } from '../planting/harvest';
import { isActive, isContainer, plantingStatus, stillWanted } from '../planting/place';
import { isPot } from '../planting/pots';
import { bedHowTo, bedSize, firstBedHowTo, MAKE_BED, needsFirstBed } from '../planting/firstBed';
import { wherePhrase } from '../planting/supports';

export { runEnds };

export const JOB_KINDS = ['water', 'sow-indoors', 'sow-direct', 'plant-out', 'check', 'feed', 'harvest', 'protect', 'lift', 'tidy', 'weed'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_LABEL: Record<JobKind, string> = {
  water: 'Water',
  'sow-indoors': 'Sow under cover',
  'sow-direct': 'Sow outside',
  'plant-out': 'Plant out',
  check: 'Keep an eye on',
  feed: 'Feed',
  harvest: 'Ready to pick',
  protect: 'Tuck in for winter',
  lift: 'Lift and store',
  tidy: 'Clear and compost',
  weed: 'Weeding',
};

export interface Job {
  /** Stable, so a tick saved in jobsDone finds its job again, e.g. "sow-direct:carrot:f-veg:2026-04". */
  key: string;
  kind: JobKind;
  plantId: string;
  /** "Carrot". */
  plant: string;
  /** "in Veg bed (2 rows)", or "on your Want to grow list". */
  where: string;
  /** Extra advice from the plant's notes, if any. */
  detail?: string;
  featureId?: string;
  /** The plantings this job is for. Ticking a sowing or planting-out job dates them. */
  plantingIds: string[];
  /** For a "check progress" job: the stage the plants have probably reached. Ticking it marks them at that stage. */
  stage?: Stage;
  /** For a feed job: the feeds it calls for, by id. */
  feeds?: string[];
  /** What the job says, where its kind's label is wrong: "Plant" for garlic cloves, onion sets and bulbs. */
  verb?: string;
  /**
   * The ways it can be done, when there's more than one: broad beans sown outside, or under cover in a cold frame. It's
   * one job, done once whichever way; the first is the job's own kind.
   */
  ways?: JobWay[];
}

/** One way to do a job: its kind, what it says, and its own advice. */
export interface JobWay {
  kind: JobKind;
  label: string;
  detail?: string;
}

/** What a job says: "Sow outside", "Plant". */
export const jobLabel = (j: Job): string => j.verb ?? JOB_LABEL[j.kind];


const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;


/** True when this month comes after the month a planting was sown. */
function afterSowing(pl: Planting, year: number, month: number): boolean {
  return !!pl.sownOn && pl.sownOn.slice(0, 7) < ym(year, month);
}

/** True when a job starting with this key prefix was ticked in the 11 months before this one. */
function doneBefore(g: Garden, prefix: string, year: number, month: number): boolean {
  const now = ym(year, month);
  const from = ym(month === 12 ? year : year - 1, (month % 12) + 1);
  return g.jobsDone.some((j) => {
    if (!j.key.startsWith(prefix)) return false;
    const when = j.key.slice(-7);
    return when >= from && when < now;
  });
}

const sownThisMonth = (pl: Planting, year: number, month: number) => !!pl.sownOn && pl.sownOn.slice(0, 7) === ym(year, month);

/** Beans and peas: long roots, so they're raised in root trainers or deep pots, not modules or a seedbed. */
const longRoots = (p: Plant) => p.family === 'Fabaceae';

interface SowingKind {
  kind: JobKind;
  detail?: string;
  verb?: string;
  /** Under cover, in a cold frame: said as one of two ways. */
  coldFrame?: boolean;
}

function sowingKinds(p: Plant, month: number): SowingKind[] {
  const out: SowingKind[] = [];
  for (const s of p.sowing ?? []) {
    if (!s.months.includes(month)) continue;
    const kind: JobKind = s.method === 'direct' ? 'sow-direct' : 'sow-indoors';
    if (out.some((o) => o.kind === kind)) continue;
    // Where it's raised, unless the plant's own note says already.
    const said = /root trainer|deep pots/i.test(s.notes ?? '');
    const frame = s.method === 'cold-frame' && !said ? (longRoots(p) ? 'Sow in root trainers or deep pots in a cold frame, to plant out later.' : 'Sow in modules or a seedbed to plant out later.') : '';
    const bits = [frame, s.depthMm ? `About ${s.depthMm >= 10 ? `${s.depthMm / 10} cm` : `${s.depthMm} mm`} deep.` : '', s.notes ?? ''].filter(Boolean);
    out.push({ kind, ...(bits.length ? { detail: bits.join(' ') } : {}), ...(s.from ? { verb: 'Plant' } : {}), ...(s.method === 'cold-frame' ? { coldFrame: true } : {}) });
  }
  return out;
}

/** What one way of sowing says: "Sow outside", "Sow under cover in a cold frame", "Plant". */
const sayWay = (w: SowingKind) => w.verb ?? (w.kind === 'sow-direct' ? 'Sow outside' : w.coldFrame ? 'Sow under cover in a cold frame' : 'Sow under cover');

/** "Sow outside, or under cover in a cold frame": two ways of sowing as one job. */
function eitherWay(ways: SowingKind[]): string {
  const [first, ...rest] = ways.map(sayWay);
  return [first!, ...rest.map((v) => (v.startsWith('Sow ') && first!.startsWith('Sow ') ? v.slice(4) : v.charAt(0).toLowerCase() + v.slice(1)))].join(', or ');
}

/** How these plantings were said to be sown, if they all agree. */
function chosenSowing(list: Planting[]): 'indoors' | 'direct' | null {
  const ways = new Set(list.map((p) => p.sowing));
  const [only] = ways;
  return ways.size === 1 && only ? only : null;
}

const describeGroup = (layouts: Planting[]): string => {
  const rows = layouts.filter((p) => p.layout === 'row').length;
  const blocks = layouts.filter((p) => p.layout === 'block').length;
  const singles = layouts.length - rows - blocks;
  const parts = [rows && `${rows} ${rows === 1 ? 'row' : 'rows'}`, blocks && `${blocks} ${blocks === 1 ? 'block' : 'blocks'}`, singles && `${singles} ${singles === 1 ? 'plant' : 'plants'}`].filter(Boolean);
  return parts.length > 1 || rows + blocks + singles > 1 ? ` (${parts.join(', ')})` : '';
};

/** Spring and early autumn, when roots that spread are dug out most easily, before they grow away or go dormant. */
const ROOT_MONTHS = [4, 9];

/**
 * What to do about weeds you want gone, this month: pull ones that spread by seed in the month before they flower and
 * while they do, and dig out ones that spread by their roots in spring and autumn. Null: nothing this month.
 */
export function weedJob(plant: Plant, toRemove: Planting[], month: number): string | null {
  const w = plant.weed;
  if (!w || !toRemove.length) return null;
  const flowers = plant.flowerMonths ?? [];
  const before = flowers.map((m) => (m === 1 ? 12 : m - 1));
  const bySeed = (w.spreads === 'seed' || w.spreads === 'both') && (flowers.includes(month) || before.includes(month));
  const byRoots = (w.spreads === 'roots' || w.spreads === 'both') && ROOT_MONTHS.includes(month);
  if (!bySeed && !byRoots) return null;
  return `${bySeed ? 'Get it out before it seeds.' : 'Dig out the roots.'} ${w.removal}`;
}

/** A word for the season's weeding, March to October. */
const WEEDING_TIP: Record<number, string> = {
  3: 'Hoe on a dry day while weeds are tiny: they wither in the sun.',
  4: 'Hoe on a dry day while weeds are tiny: they wither in the sun.',
  5: 'Weeds grow fastest now. Hoe between rows weekly, and mulch round plants.',
  6: 'Little and often: pull weeds before they flower and seed.',
  7: 'Little and often: pull weeds before they flower and seed. Water the plants, not the paths.',
  8: 'Keep on top of seeding weeds: one left now is hundreds next year.',
  9: 'Clear weeds from beds as crops finish, and dig out spreading roots while the soil’s soft.',
  10: 'Weed beds before winter, then mulch or sow green manure on bare soil.',
};

export interface JobOptions {
  /** A monthly "Weed the beds" reminder, March to October. The app asks for it unless it's turned off in Settings. */
  weeding?: boolean;
  /** Feed jobs, and what goes in before planting. The app asks for them unless they're turned off in Settings. */
  feeding?: boolean;
  /**
   * Today, ISO. With it: a sowing outside that's running behind to come up has no harvest or other growing jobs (Today
   * asks whether it's up instead), and "probably flowering" goes by the warmth where the plant has days to crop. Without
   * it, both go by the months alone.
   */
  today?: string;
  /** This year's weather, with today: the warmth it's had, and watering in a dry spell (in today's month). */
  weather?: Weather | null;
  /** The watering job, with the weather. Off for the plan's chips, as it's for the whole garden. */
  watering?: boolean;
}

/** What a job says for a tender crop in a pot, and its advice. RHS: overwinter somewhere warm and bright, pruned to a manageable size and watered sparingly; chillies usually cope with nights of about 12 °C. */
export const BRING_IN_VERB = 'Bring indoors';
const BRING_IN = 'Before nights drop to about 12 °C, cut it back to a manageable size and move it to a warm, bright windowsill. Fleece won’t keep it warm enough. Water it sparingly over winter.';

/** Your jobs for a month, in the order of JOB_KINDS, then by plant name. */
export function jobsFor(g: Garden, listed: (id: string) => Plant, month: number, year: number, opts: JobOptions = {}): Job[] {
  // Each plant as it's grown here: its months moved for the garden's season.
  const plantOf = (id: string) => plantHere(listed(id), g);
  const jobs: Job[] = [];
  const keyOf = (kind: JobKind, plantId: string, scope: string) => `${kind}:${plantId}:${scope ? `${scope}:` : ''}${ym(year, month)}`;
  const add = (kind: JobKind, plant: Plant, where: string, scope: string, plantingIds: string[], detail?: string, featureId?: string, verb?: string) => {
    const job: Job = { key: keyOf(kind, plant.id, scope), kind, plantId: plant.id, plant: plant.commonName, where, plantingIds };
    if (detail) job.detail = detail;
    if (featureId) job.featureId = featureId;
    // Bulbs and bought plants are planted; only seedlings are planted out.
    const v = verb ?? (kind === 'plant-out' && !plant.sowing?.length ? 'Plant' : undefined);
    if (v) job.verb = v;
    jobs.push(job);
  };

  // Protect tender plants in the month before the first frost is due (about ten days ahead).
  const protectMonth = Number(addDays(`2027-${frostDates(g).firstFrost}`, -10).slice(5, 7));
  const { today, weather = null } = opts;
  const thisMonth = !!today && today.slice(0, 7) === ym(year, month);
  const monthEnd = addDays(`${ym(month === 12 ? year + 1 : year, (month % 12) + 1)}-01`, -1);
  // "Probably flowering by now": by tomorrow this month, by the month's end for a month ahead.
  const flowerBy = thisMonth ? addDays(today!, 1) : monthEnd;

  /** Probably in flower by then, and not yet marked so: by the warmth it's had where the plant has days, otherwise its months. */
  const floweringBy = (plant: Plant, p: Planting): boolean => {
    if (!today || !plant.growth?.days) return suggestedStage(plant, p, month) === 'flowering';
    const at = probableStage(plant, p, g, today, weather, flowerBy);
    return at === 'flowering' || (at === 'harvesting' && currentStage(p) !== 'flowering' && pathFor(plant, p).includes('flowering'));
  };

  if (thisMonth && opts.watering !== false) {
    const water = waterJob(g, plantOf, weather, today!);
    for (const j of [...potWaterJobs(g, plantOf, weather, today!), ...(water ? [water] : [])])
      jobs.push({ key: j.key, kind: 'water', plantId: '', plant: j.title, where: j.where, detail: j.detail, plantingIds: j.plantingIds, ...(j.featureId ? { featureId: j.featureId } : {}) });
  }

  // What's on the plan, grouped by plant and bed so three rows of carrots are one job.
  const groups = new Map<string, Planting[]>();
  for (const pl of g.plantings.filter(isActive)) {
    const k = `${pl.plantId}|${pl.featureId}`;
    groups.set(k, [...(groups.get(k) ?? []), pl]);
  }
  for (const [k, group] of groups) {
    const [plantId, featureId] = k.split('|') as [string, string];
    const plant = plantOf(plantId);
    const bed = g.features.find((f) => f.id === featureId);
    const bedName = bed ? placeLabel(bed) : 'a bed';
    const where = `${wherePhrase(bed)}${describeGroup(group)}${bed?.toMake ? ', once it’s made' : ''}`;
    const ids = (list: Planting[]) => list.map((p) => p.id);
    // A weed gets a job to be rid of it, unless you're keeping it; none of the jobs for crops.
    if (plant.category === 'weed') {
      const job = weedJob(plant, group.filter((p) => !p.keep), month);
      if (job) add('weed', plant, wherePhrase(bed), featureId, ids(group.filter((p) => !p.keep)), job, featureId);
      continue;
    }
    // Under a greenhouse or cold frame: in sooner, with no hardening off, and no winter protection.
    const cover = microclimateOf(g, group[0]!);
    const outMonths = plantOutMonthsUnder(plant, cover?.climate ?? null);

    // Not sown yet, or sown this month by ticking its job (so the tick stays in this month's list). Sown any other way
    // (already in the ground, marked as sown), there's nothing left to do. Plants already growing skip sowing and planting out.
    const isGrowing = (p: Planting) => plantingStatus(p) === 'growing';
    const notGrowing = group.filter((p) => !isGrowing(p));
    const batchScope = (p: Planting) => `${featureId}~${p.batch?.n ?? p.id}`;
    const sowTicked = (p: Planting) => (['sow-direct', 'sow-indoors'] as const).some((k) => g.jobsDone.some((j) => j.key === keyOf(k, plant.id, p.sowBy ? batchScope(p) : featureId)));
    const toSow = notGrowing.filter((p) => !p.sownOn || (sownThisMonth(p, year, month) && sowTicked(p)));
    // Batches are sown in the month you chose for each, one job each; the rest in the plant's sowing months.
    const plain = toSow.filter((p) => !p.sowBy);
    // In a pot, new compost has feed in it for about six weeks (RHS): nothing to dig in by the square metre.
    const inPot = !!bed && isPot(bed);
    const before = opts.feeding && !inPot ? plantingFeedText(plant, g) : undefined;
    const withFeed = (detail?: string) => [detail, before].filter(Boolean).join(' ') || undefined;
    if (plain.length) {
      // One job however many ways it can be sown, done once whichever way. Once you've said how (by ticking it), it's
      // that way only. The key is the first way's, so a tick stays put.
      const kinds = sowingKinds(plant, month);
      const chosen = chosenSowing(plain);
      const mine = chosen ? kinds.filter((k) => (k.kind === 'sow-direct') === (chosen === 'direct')) : [];
      const ways = mine.length ? mine : kinds;
      const s = ways[0];
      if (s) {
        const detailOf = (w: SowingKind) => (w.kind === 'sow-direct' ? withFeed(w.detail) : w.detail);
        add(s.kind, plant, s.kind === 'sow-indoors' ? `for ${where.slice(3)}` : where, featureId, ids(plain), detailOf(s), featureId, ways.length > 1 ? eitherWay(ways) : s.verb);
        const job = jobs[jobs.length - 1]!;
        job.key = keyOf(kinds[0]!.kind, plant.id, featureId);
        if (ways.length > 1)
          job.ways = ways.map((w) => {
            const detail = detailOf(w);
            return { kind: w.kind, label: sayWay(w), ...(detail ? { detail } : {}) };
          });
      }
    }
    // A batch not sown in its month stays on the list for the month after, as running late.
    const lastMonth = month === 1 ? ym(year - 1, 12) : ym(year, month - 1);
    for (const p of toSow.filter((x) => x.sowBy && ((x.sownOn ?? x.sowBy).slice(0, 7) === ym(year, month) || (!x.sownOn && x.sowBy.slice(0, 7) === lastMonth)))) {
      const how = sowingOf(plant, p);
      if (how === 'none') continue;
      const kind: JobKind = how === 'direct' ? 'sow-direct' : 'sow-indoors';
      const bed = `${bedName}${p.batch ? ` (batch ${p.batch.n} of ${p.batch.of})` : ''}`;
      const sk = sowingKinds(plant, month).find((s) => s.kind === kind);
      const tip = sk?.detail;
      add(kind, plant, kind === 'sow-indoors' ? `for ${bed}` : `in ${bed}`, batchScope(p), [p.id], [p.sowBy!.slice(0, 7) === lastMonth ? `Running late: it was due about ${shortDate(p.sowBy!)}.` : `${sk?.verb ? 'Plant' : 'Sow'} about ${shortDate(p.sowBy!)}.`, tip].filter(Boolean).join(' '), featureId, sk?.verb);
    }
    // In its months, or when a sowing's timeline brings it out in this one: winter salads sown in October go out in December.
    const outThisMonth = (p: Planting) => !!today && !!p.sownOn && !!timeline(plant, p, g, today, weather).find((s) => s.guessed && s.stage === 'transplanted')?.date?.startsWith(ym(year, month));
    if (outMonths.includes(month) || notGrowing.some(outThisMonth)) {
      // Ticking a planting-out job marks the plants as growing; the ticked job stays for the rest of the month.
      // A batch waits until after the month it's sown in; something bought as a plant (next year's draft) goes in in its month.
      const tickedNow = g.jobsDone.some((j) => j.key === keyOf('plant-out', plant.id, featureId));
      const due = (p: Planting) => !p.sowBy || (sowingOf(plant, p) === 'none' ? p.sowBy.slice(0, 7) <= ym(year, month) : p.sowBy.slice(0, 7) < ym(year, month));
      // Seedlings go out once they're sown and grown on: not while it can still be sown this month (that comes first),
      // not if sown outside, and not before the month the timeline expects them out. Unsown once its sowing time has
      // passed, it's bought as plants.
      const canSow = sowingKinds(plant, month).length > 0;
      const sownFirst = (p: Planting) => {
        const how = sowingOf(plant, p);
        if (how === 'none') return true;
        if (!p.sownOn) return !canSow;
        if (how === 'direct' || p.sownOn.slice(0, 7) > ym(year, month)) return false;
        if (!today || tickedNow) return true;
        const out = timeline(plant, p, g, today, weather).find((s) => s.guessed && s.stage === 'transplanted');
        return !out?.date || out.date <= monthEnd;
      };
      const toPlant = (tickedNow ? group : notGrowing).filter((p) => sownFirst(p) && due(p));
      if (toPlant.length && !doneBefore(g, `plant-out:${plant.id}:${featureId}:`, year, month)) {
        // A tender plant outside waits for the play-safe date, not the 50:50 last frost: a frost kills it.
        const safe = safeOut(g, year);
        const wait = !cover && isTender(plant) && Number(safe.slice(5, 7)) >= month ? `Tender: plant out from about ${shortDate(safe)}, when a frost is unlikely.` : undefined;
        add('plant-out', plant, where, featureId, ids(toPlant), withFeed(cover ? 'Under glass, so there’s no need to harden them off first.' : wait), featureId);
      }
    }

    // Sown outside and running behind to come up: nothing to pick or feed until it's up. Today asks about it instead.
    const notUp = (p: Planting) => !!today && currentStage(p) === 'sown' && sowingOf(plant, p) === 'direct' && behindOf(plant, p, g, today, weather)?.next === 'germinated';
    const growing = group.filter((p) => (isGrowing(p) || afterSowing(p, year, month)) && !notUp(p));
    if (!growing.length) continue;
    const harvest = plant.cropping?.harvestMonths ?? [];
    const harvesting = harvest.includes(month);
    // Ready means ready, by the same timeline as the planting's card: in its months and got there by the month's end,
    // or already being picked and not over yet, even before its months (leeks).
    const stepsOf = (p: Planting) => timeline(plant, p, g, today!, weather);
    const picking = (p: Planting) => !!today && currentStage(p) === 'harvesting' && stageIn(stepsOf(p), monthEnd).stage === 'harvesting';
    const ready = (p: Planting) => !today || currentStage(p) === 'harvesting' || !pathFor(plant, p).includes('harvesting') || stepsOf(p).some((s) => s.stage === 'harvesting' && s.date !== null && s.date <= monthEnd);
    const grown = growing.filter(ready);
    const toPick = growing.filter((p) => (harvesting && ready(p)) || picking(p));
    // Something picked all year round (bay, rosemary) is just there to pick: not a job every month.
    if (toPick.length && harvest.length < 12) add('harvest', plant, where, featureId, ids(toPick), plant.cropping?.notes, featureId, isRoot(plant) ? 'Ready to lift' : undefined);

    // Probably flowering by now? Ask, unless it's ready to pick anyway. The key holds the stage, so a tick is per stage.
    if (!toPick.length) {
      const ticked = g.jobsDone.find((j) => j.key.startsWith(`check:${plant.id}:${featureId}:`) && j.key.endsWith(`:${ym(year, month)}`));
      const due = ticked ? growing.filter((p) => currentStage(p) === ticked.key.split(':')[3]) : growing.filter((p) => floweringBy(plant, p));
      const stage = (ticked?.key.split(':')[3] as Stage | undefined) ?? (due.length ? 'flowering' : undefined);
      if (stage && due.length) {
        const job: Job = { key: `check:${plant.id}:${featureId}:${stage}:${ym(year, month)}`, kind: 'check', plantId: plant.id, plant: plant.commonName, where, plantingIds: ids(due), featureId, stage };
        const tip = stageTips(plant, stage, due[0], month, !!cover)[0];
        job.detail = `Probably ${stageLabel(plant, stage).toLowerCase()} by now. Tick when you see it.${tip ? ` ${tip}` : ''}`;
        jobs.push(job);
      }
    }
    // Feeding: once in spring or after cropping, or every week or two through its months. Only what's in the ground.
    if (opts.feeding) {
      const inGround = growing.filter((p) => isGrowing(p) || sowingOf(plant, p) !== 'indoors');
      for (const due of inGround.length ? feedingDue(plant, month) : []) {
        const scope = `${featureId}:${due.when}`;
        if (isOnce(due.when) && doneBefore(g, `feed:${plant.id}:${scope}:`, year, month)) continue;
        add('feed', plant, where, scope, ids(inGround), inPot ? potFeedDetail(due.steps, g) : feedDetail(due.steps, g), featureId);
        jobs[jobs.length - 1]!.feeds = feedsInUse(g, inPot ? potFeedSteps(due.steps) : due.steps);
      }
    }
    const winter = plant.wintering;
    // A chilli or pepper in a pot comes in: fleece won't keep it warm enough.
    if (winter?.type === 'protect' && month === protectMonth && !cover && inPot && plant.family === 'Solanaceae') add('protect', plant, where, featureId, ids(growing), BRING_IN, featureId, BRING_IN_VERB);
    else if (winter?.type === 'protect' && month === protectMonth && !cover) add('protect', plant, where, featureId, ids(growing), winter.notes ?? 'Bring pots under cover or fleece the plants before the first frosts.', featureId);
    if (winter?.type === 'lift-and-store' && grown.length && runEnds(harvest).includes(month)) add('lift', plant, where, featureId, ids(grown), winter.notes, featureId);
    if (winter?.type === 'annual' && grown.length && runEnds(harvest).some((m) => m % 12 === month - 1 && month >= 9)) add('tidy', plant, where, featureId, ids(grown), 'Pull up finished plants and compost them, then mark the planting as harvested.', featureId);
  }

  // The season's weeding: one job for every bed with something growing in it.
  const tip = WEEDING_TIP[month];
  if (opts.weeding && tip) {
    const beds = g.features.filter((f) => isContainer(f) && !isPot(f) && !f.toMake && g.plantings.some((p) => isActive(p) && p.featureId === f.id && plantOf(p.plantId).category !== 'weed'));
    if (beds.length) {
      const names = beds.map(placeLabel);
      const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ');
      jobs.push({ key: `weed:beds:${ym(year, month)}`, kind: 'weed', plantId: '', plant: 'Weed the beds', where: `(${list})`, plantingIds: [], detail: tip });
    }
  }

  // Your sowing list: plants you mean to grow that aren't on the plan yet.
  for (const id of stillWanted(g, plantOf)) {
    const plant = plantOf(id);
    // Sowing-list keys have no bed: "sow-indoors:tomato:2026-03". The "2" starts the year, so bed jobs don't match.
    for (const s of sowingKinds(plant, month)) if (!doneBefore(g, `${s.kind}:${plant.id}:2`, year, month)) add(s.kind, plant, 'on your Want to grow list', '', [], s.detail, undefined, s.verb);
    if (plant.plantOutMonths?.includes(month) && !doneBefore(g, `plant-out:${plant.id}:2`, year, month)) add('plant-out', plant, 'on your Want to grow list', '', []);
  }

  jobs.push(...cardboardJobs(g, month, year));
  const first = firstBedJob(g, month, year);
  if (first) jobs.push(first);

  const order = (k: JobKind) => JOB_KINDS.indexOf(k);
  // A bed to make comes first: everything to go in it waits for it.
  // Only now: next month's preview doesn't say it again.
  const ahead = !!today && ym(year, month) > today.slice(0, 7);
  return [...(ahead ? [] : makeBedJobs(g, month, year)), ...jobs.sort((a, b) => order(a.kind) - order(b.kind) || a.plant.localeCompare(b.plant) || a.where.localeCompare(b.where))];
}

/**
 * How long laid cardboard usually takes to rot down enough to plant into under a mulch: six months or more (Seattle
 * Public Utilities' sheet-mulching guide). The RHS gives no figure.
 */
export const CARDBOARD_MONTHS = 6;

/**
 * A check on cardboard laid over weeds, from the month it's likely to have rotted down until it's ticked off. Not tied
 * to a plant, and only once you've said when it was laid: a plan drawn ahead hasn't been laid yet.
 */
export function cardboardJobs(g: Garden, month: number, year: number): Job[] {
  const out: Job[] = [];
  const now = ym(year, month);
  for (const f of g.features) {
    if (f.kind !== 'surface' || f.material !== 'cardboard' || !f.laidOn) continue;
    const due = addDays(f.laidOn, Math.round(CARDBOARD_MONTHS * 30.4)).slice(0, 7);
    if (now < due) continue;
    const prefix = `check:cardboard:${f.id}:`;
    // Ticked in an earlier month: done. Ticked this month: it stays, ticked, until the month ends.
    if (g.jobsDone.some((d) => d.key.startsWith(prefix) && d.key.slice(-7) < now)) continue;
    out.push({
      key: `${prefix}${now}`,
      kind: 'check',
      plantId: '',
      plant: 'Cardboard',
      where: `${f.name?.trim() ? `on ${featureLabel(f)}, ` : ''}laid ${shortDate(f.laidOn)}`,
      detail: 'It’s usually soft enough to plant into by now. Push a trowel through it, and top up the mulch where the card shows.',
      featureId: f.id,
      plantingIds: [],
    });
  }
  return out;
}

/** A job for each bed still to be made, until it's ticked; ticked this month, it stays there, ticked. */
export function makeBedJobs(g: Garden, month: number, year: number): Job[] {
  const keyOf = (f: { id: string }) => `${MAKE_BED}${f.id}:${ym(year, month)}`;
  return g.features
    .filter((f) => f.toMake || g.jobsDone.some((d) => d.key === keyOf(f)))
    .map((f) => ({ key: keyOf(f), kind: 'check' as const, verb: 'Make', plantId: '', plant: placeLabel(f), where: 'with cardboard and compost, no digging', detail: bedHowTo(...bedSize(f)), featureId: f.id, plantingIds: [] }));
}

/**
 * A garden that's all lawn: make a first bed, without digging, cardboard and compost over the grass. Until there's a
 * bed, pot or patch of soil to grow in, or it's been ticked in an earlier month.
 */
export function firstBedJob(g: Garden, month: number, year: number): Job | null {
  if (!needsFirstBed(g)) return null;
  const now = ym(year, month);
  const prefix = 'check:first-bed:';
  if (g.jobsDone.some((d) => d.key.startsWith(prefix) && d.key.slice(-7) < now)) return null;
  return { key: `${prefix}${now}`, kind: 'check', verb: 'Make your first bed', plantId: '', plant: 'A first bed', where: 'with cardboard and compost, no digging', detail: firstBedHowTo(), plantingIds: [] };
}

/** Jobs grouped by kind, skipping kinds with nothing to do. */
/** Jobs grouped under what they say, in the order of their kinds: "Sow outside", then "Plant" (cloves, sets), and so on. */
export function groupJobs(jobs: Job[]): [string, Job[]][] {
  const groups = new Map<string, Job[]>();
  const order = (j: Job) => (j.key.startsWith(MAKE_BED) ? -1 : JOB_KINDS.indexOf(j.kind));
  for (const j of [...jobs].sort((a, b) => order(a) - order(b))) groups.set(jobLabel(j), [...(groups.get(jobLabel(j)) ?? []), j]);
  return [...groups];
}

/**
 * The first job to do, for landing on the plan after setting up: the first of this month's jobs that's about plantings
 * on the plan, with a note of what it is. Null when there's none (nothing planted, or nothing to do this month).
 */
export function firstJob(g: Garden, plantOf: (id: string) => Plant, now: Date, opts: JobOptions = {}): { target: { type: 'planting' | 'feature'; id: string }; note: string } | null {
  const jobs = jobsFor(g, plantOf, now.getMonth() + 1, now.getFullYear(), opts);
  // A bed to make comes before anything to go in it.
  const make = jobs.find((j) => j.key.startsWith(MAKE_BED));
  if (make) return { target: { type: 'feature', id: make.featureId! }, note: `Your first job: make ${make.plant}.` };
  const job = jobs.find((j) => j.plantingIds.length > 0);
  if (!job) return null;
  // Two ways to do it: the first, in a sentence; the job itself offers both.
  return { target: { type: 'planting', id: job.plantingIds[0]! }, note: `Your first job: ${job.plant}. ${job.ways?.[0]?.label ?? jobLabel(job)} ${job.where}.` };
}

// ---------- Ticking jobs off ----------

/**
 * Ticks or unticks a job. Ticking a sowing job dates its plantings (if they have no date) and records how they were
 * sown; planting out marks them planted out; a progress check or the first harvest moves them on to that stage.
 */
export function toggleJob(g: Garden, job: Job, date: string, plantOf?: (id: string) => Plant, way: JobKind = job.kind): Garden {
  const done = g.jobsDone.find((j) => j.key === job.key);
  const ids = new Set(job.plantingIds);
  const making = job.key.startsWith(MAKE_BED) && job.featureId;
  if (done) {
    const unticked = { ...g, jobsDone: g.jobsDone.filter((j) => j.key !== job.key) };
    if (making) return updateFeature(unticked, making, { toMake: true });
    // A weed job unticked: the weeds it cleared are back.
    if (job.kind === 'weed' && ids.size) return { ...unticked, plantings: unticked.plantings.map((p) => (ids.has(p.id) && p.removedOn === done.date ? withoutRemoved(p) : p)) };
    // A sowing unticked: it wasn't sown after all, so the job's back to do. Not if it's moved on since: it's come up, so it was.
    if ((job.kind === 'sow-direct' || job.kind === 'sow-indoors') && ids.size) return { ...unticked, plantings: unticked.plantings.map((p) => (ids.has(p.id) && p.sownOn === done.date && currentStage(p) === 'sown' ? withoutSown(p) : p)) };
    return unticked;
  }
  const ticked = { ...g, jobsDone: [...g.jobsDone, { key: job.key, date }] };
  if (making) return updateFeature(ticked, making, { toMake: undefined });
  if (!ids.size) return ticked;
  // A weed dug or pulled out is gone from the plan, kept in the bed's history.
  if (job.kind === 'weed') return { ...ticked, plantings: ticked.plantings.map((p) => (ids.has(p.id) && !p.removedOn ? { ...p, removedOn: date } : p)) };
  const mine = g.plantings.filter((p) => ids.has(p.id));
  // Only move plantings forward: never back past a stage they've already reached.
  const before = (target: Stage) =>
    mine
      .filter((p) => {
        const now = currentStage(p);
        return now === 'planned' || (now !== 'cleared' && STAGES.indexOf(now) < STAGES.indexOf(target));
      })
      .map((p) => p.id);
  if (job.kind === 'sow-indoors' || job.kind === 'sow-direct') {
    // Done one way: that's how they were sown, and the other way's gone.
    const sowing = way === 'sow-direct' ? 'direct' : 'indoors';
    return { ...ticked, plantings: ticked.plantings.map((p) => (!ids.has(p.id) || p.sownOn ? p : { ...p, sownOn: date, sowing })) };
  }
  if (job.kind === 'plant-out') return setStage(ticked, before('transplanted'), 'transplanted', date);
  if (job.kind === 'check' && job.stage) return setStage(ticked, before(job.stage), job.stage, date);
  if (job.kind === 'harvest' && plantOf) {
    const harvestable = new Set(mine.filter((p) => pathFor(plantOf(p.plantId), p).includes('harvesting')).map((p) => p.id));
    return setStage(ticked, before('harvesting').filter((id) => harvestable.has(id)), 'harvesting', date);
  }
  return ticked;
}

/** A picking from a harvest job: how much, on the job's first planting (totals are by crop), with the job ticked. */
export function logPick(g: Garden, job: Job, date: string, size: PickSize, plantOf?: (id: string) => Plant): Garden {
  const first = job.plantingIds[0];
  if (job.kind !== 'harvest' || !first) return g;
  const ticked = g.jobsDone.some((j) => j.key === job.key) ? g : toggleJob(g, job, date, plantOf);
  return addPick(ticked, first, date, { size });
}

// ---------- Sowing list ----------

export const onWishlist = (g: Garden, id: string) => g.wishlist.includes(id);

export function toggleWishlist(g: Garden, id: string): Garden {
  return { ...g, wishlist: onWishlist(g, id) ? g.wishlist.filter((x) => x !== id) : [...g.wishlist, id] };
}

const withoutRemoved = ({ removedOn: _gone, ...rest }: Planting): Planting => rest;
const withoutSown = ({ sownOn: _gone, sowing: _how, ...rest }: Planting): Planting => rest;

/**
 * Plantings of a plant waiting to be sown, by bed: what a sowing in the shed could be for. Its kinds count, since a packet
 * of autumn broad beans is broad bean seed.
 */
export function plannedToSow(g: Garden, plant: Plant, plantOf: (id: string) => Plant): { featureId: string; ids: string[] }[] {
  const same = (id: string) => id === plant.id || id === plant.varietyOf || plantOf(id).varietyOf === plant.id;
  const out = new Map<string, string[]>();
  for (const p of g.plantings) if (isActive(p) && currentStage(p) === 'planned' && same(p.plantId)) out.set(p.featureId, [...(out.get(p.featureId) ?? []), p.id]);
  return [...out].map(([featureId, ids]) => ({ featureId, ids }));
}

/**
 * Sown in the shed for plantings on the plan: they're sown under cover that day, so they show in the Shed under "Sown
 * for the plan" and their plant-out comes from then, and this month's sowing job for them is ticked. No tray: the
 * planting is the record.
 */
export function sownForPlan(g: Garden, plantOf: (id: string) => Plant, ids: string[], date: string): Garden {
  const set = new Set(ids);
  const sown: Garden = { ...g, plantings: g.plantings.map((p) => (set.has(p.id) && !p.sownOn ? { ...p, sownOn: date, sowing: 'indoors' as const } : p)) };
  const jobs = jobsFor(g, plantOf, Number(date.slice(5, 7)), Number(date.slice(0, 4))).filter((j) => (j.kind === 'sow-indoors' || j.kind === 'sow-direct') && j.plantingIds.some((id) => set.has(id)));
  const fresh = jobs.filter((j) => !g.jobsDone.some((d) => d.key === j.key));
  return fresh.length ? { ...sown, jobsDone: [...sown.jobsDone, ...fresh.map((j) => ({ key: j.key, date }))] } : sown;
}

/**
 * Sown in a tray in the shed: this month's sowing job for it (and for the plant it's a kind of) on your Want to grow
 * list is done, so Today doesn't still ask you to sow it.
 */
export function sownInTray(g: Garden, plant: Plant, date: string): Garden {
  const keys = [plant.id, plant.varietyOf].filter((id): id is string => !!id).map((id) => `sow-indoors:${id}:${date.slice(0, 7)}`);
  const fresh = keys.filter((k) => !g.jobsDone.some((j) => j.key === k));
  return fresh.length ? { ...g, jobsDone: [...g.jobsDone, ...fresh.map((key) => ({ key, date }))] } : g;
}
