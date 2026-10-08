// The month's jobs for your own plants, worked out from what's on the plan
// and what's on your sowing list. Pure functions: garden and plants in, jobs out.
//
// What's on the plan but not yet sown gets sowing and planting-out jobs.
// Once a planting has a sowing date, it gets harvest, winter and tidy jobs.
// When a planting has probably reached flowering, a "check progress" job asks you to confirm it.

import { microclimateOf } from '../climate/microclimate';
import { addDays, frostDates, plantOutMonthsUnder } from '../lifecycle/shed';
import { currentStage, pathFor, setStage, sowingOf, STAGE_LABEL, stageTips, suggestedStage } from '../lifecycle/stages';
import { shortDate } from '../lifecycle/projection';
import { placeLabel } from '../model/features';
import { STAGES, type Garden, type PickSize, type Plant, type Planting, type Stage } from '../model/types';
import { addPick } from '../planting/harvest';
import { isActive, isContainer, plantingStatus } from '../planting/place';

export const JOB_KINDS = ['sow-indoors', 'sow-direct', 'plant-out', 'check', 'harvest', 'protect', 'lift', 'tidy', 'weed'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_LABEL: Record<JobKind, string> = {
  'sow-indoors': 'Sow under cover',
  'sow-direct': 'Sow outside',
  'plant-out': 'Plant out',
  check: 'Keep an eye on',
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
}


const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Months where a run ends: [6,7,8] → [8]; [9,10,11,12,1,2,3] → [3]. */
export function runEnds(months: number[]): number[] {
  const set = new Set(months);
  if (set.size === 12) return [];
  return [...set].filter((m) => !set.has((m % 12) + 1)).sort((a, b) => a - b);
}

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

function sowingKinds(p: Plant, month: number): { kind: JobKind; detail?: string }[] {
  const out: { kind: JobKind; detail?: string }[] = [];
  for (const s of p.sowing ?? []) {
    if (!s.months.includes(month)) continue;
    const kind: JobKind = s.method === 'direct' ? 'sow-direct' : 'sow-indoors';
    if (out.some((o) => o.kind === kind)) continue;
    const bits = [s.method === 'cold-frame' ? 'Sow in modules or a seedbed to plant out later.' : '', s.depthMm ? `About ${s.depthMm >= 10 ? `${s.depthMm / 10} cm` : `${s.depthMm} mm`} deep.` : '', s.notes ?? ''].filter(Boolean);
    out.push(bits.length ? { kind, detail: bits.join(' ') } : { kind });
  }
  return out;
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
  /** A monthly "Weed the beds" reminder, March to October. The app asks for it unless it's turned off in Your garden. */
  weeding?: boolean;
}

/** Your jobs for a month, in the order of JOB_KINDS, then by plant name. */
export function jobsFor(g: Garden, plantOf: (id: string) => Plant, month: number, year: number, opts: JobOptions = {}): Job[] {
  const jobs: Job[] = [];
  const add = (kind: JobKind, plant: Plant, where: string, scope: string, plantingIds: string[], detail?: string, featureId?: string) => {
    const job: Job = { key: `${kind}:${plant.id}:${scope ? `${scope}:` : ''}${ym(year, month)}`, kind, plantId: plant.id, plant: plant.commonName, where, plantingIds };
    if (detail) job.detail = detail;
    if (featureId) job.featureId = featureId;
    jobs.push(job);
  };

  // Protect tender plants in the month before the first frost is due (about ten days ahead).
  const protectMonth = Number(addDays(`2027-${frostDates(g).firstFrost}`, -10).slice(5, 7));

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
    const where = `in ${bedName}${describeGroup(group)}`;
    const ids = (list: Planting[]) => list.map((p) => p.id);
    // A weed gets a job to be rid of it, unless you're keeping it; none of the jobs for crops.
    if (plant.category === 'weed') {
      const job = weedJob(plant, group.filter((p) => !p.keep), month);
      if (job) add('weed', plant, `in ${bedName}`, featureId, ids(group.filter((p) => !p.keep)), job, featureId);
      continue;
    }
    // Under a greenhouse or cold frame: in sooner, with no hardening off, and no winter protection.
    const cover = microclimateOf(g, group[0]!);
    const outMonths = plantOutMonthsUnder(plant, cover?.climate ?? null);

    // Not sown yet, or sown this month (so a ticked job stays in this month's list).
    // Plants already growing skip sowing and planting out.
    const isGrowing = (p: Planting) => plantingStatus(p) === 'growing';
    const notGrowing = group.filter((p) => !isGrowing(p));
    const toSow = notGrowing.filter((p) => !p.sownOn || sownThisMonth(p, year, month));
    // Batches are sown in the month you chose for each, one job each; the rest in the plant's sowing months.
    const plain = toSow.filter((p) => !p.sowBy);
    if (plain.length)
      for (const s of sowingKinds(plant, month)) add(s.kind, plant, s.kind === 'sow-indoors' ? `for ${where.slice(3)}` : where, featureId, ids(plain), s.detail, featureId);
    // A batch not sown in its month stays on the list for the month after, as running late.
    const lastMonth = month === 1 ? ym(year - 1, 12) : ym(year, month - 1);
    for (const p of toSow.filter((x) => x.sowBy && ((x.sownOn ?? x.sowBy).slice(0, 7) === ym(year, month) || (!x.sownOn && x.sowBy.slice(0, 7) === lastMonth)))) {
      const how = sowingOf(plant, p);
      if (how === 'none') continue;
      const kind: JobKind = how === 'direct' ? 'sow-direct' : 'sow-indoors';
      const bed = `${bedName}${p.batch ? ` (batch ${p.batch.n} of ${p.batch.of})` : ''}`;
      const tip = sowingKinds(plant, month).find((s) => s.kind === kind)?.detail;
      add(kind, plant, kind === 'sow-indoors' ? `for ${bed}` : `in ${bed}`, `${featureId}~${p.batch?.n ?? p.id}`, [p.id], [p.sowBy!.slice(0, 7) === lastMonth ? `Running late: it was due about ${shortDate(p.sowBy!)}.` : `Sow about ${shortDate(p.sowBy!)}.`, tip].filter(Boolean).join(' '), featureId);
    }
    if (outMonths.includes(month)) {
      // Ticking a planting-out job marks the plants as growing; the ticked job stays for the rest of the month.
      // A batch waits until after the month it's sown in.
      const tickedNow = g.jobsDone.some((j) => j.key === `plant-out:${plant.id}:${featureId}:${ym(year, month)}`);
      const toPlant = (tickedNow ? group : notGrowing).filter((p) => (!p.sownOn || p.sownOn.slice(0, 7) <= ym(year, month)) && (!p.sowBy || p.sowBy.slice(0, 7) < ym(year, month)));
      if (toPlant.length && !doneBefore(g, `plant-out:${plant.id}:${featureId}:`, year, month))
        add('plant-out', plant, where, featureId, ids(toPlant), cover ? 'Under glass, so there’s no need to harden them off first.' : undefined, featureId);
    }

    const growing = group.filter((p) => isGrowing(p) || afterSowing(p, year, month));
    if (!growing.length) continue;
    const harvest = plant.cropping?.harvestMonths ?? [];
    const harvesting = harvest.includes(month);
    if (harvesting) add('harvest', plant, where, featureId, ids(growing), plant.cropping?.notes, featureId);

    // Probably flowering by now? Ask, unless it's harvest time anyway. The key holds the stage, so a tick is per stage.
    if (!harvesting) {
      const ticked = g.jobsDone.find((j) => j.key.startsWith(`check:${plant.id}:${featureId}:`) && j.key.endsWith(`:${ym(year, month)}`));
      const due = ticked ? growing.filter((p) => currentStage(p) === ticked.key.split(':')[3]) : growing.filter((p) => suggestedStage(plant, p, month) === 'flowering');
      const stage = (ticked?.key.split(':')[3] as Stage | undefined) ?? (due.length ? 'flowering' : undefined);
      if (stage && due.length) {
        const job: Job = { key: `check:${plant.id}:${featureId}:${stage}:${ym(year, month)}`, kind: 'check', plantId: plant.id, plant: plant.commonName, where, plantingIds: ids(due), featureId, stage };
        const tip = stageTips(plant, stage, due[0])[0];
        job.detail = `Probably ${STAGE_LABEL[stage].toLowerCase()} by now. Tick when you see it.${tip ? ` ${tip}` : ''}`;
        jobs.push(job);
      }
    }
    const winter = plant.wintering;
    if (winter?.type === 'protect' && month === protectMonth && !cover) add('protect', plant, where, featureId, ids(growing), winter.notes ?? 'Bring pots under cover or fleece the plants before the first frosts.', featureId);
    if (winter?.type === 'lift-and-store' && runEnds(harvest).includes(month)) add('lift', plant, where, featureId, ids(growing), winter.notes, featureId);
    if (winter?.type === 'annual' && runEnds(harvest).some((m) => m % 12 === month - 1 && month >= 9)) add('tidy', plant, where, featureId, ids(growing), 'Pull up finished plants and compost them, then mark the planting as harvested.', featureId);
  }

  // The season's weeding: one job for every bed with something growing in it.
  const tip = WEEDING_TIP[month];
  if (opts.weeding && tip) {
    const beds = g.features.filter((f) => isContainer(f) && g.plantings.some((p) => isActive(p) && p.featureId === f.id && plantOf(p.plantId).category !== 'weed'));
    if (beds.length) {
      const names = beds.map(placeLabel);
      const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', ');
      jobs.push({ key: `weed:beds:${ym(year, month)}`, kind: 'weed', plantId: '', plant: 'Weed the beds', where: `(${list})`, plantingIds: [], detail: tip });
    }
  }

  // Your sowing list: plants you mean to grow that aren't on the plan yet.
  const planned = new Set(g.plantings.filter(isActive).map((p) => p.plantId));
  for (const id of new Set(g.wishlist)) {
    if (planned.has(id)) continue;
    const plant = plantOf(id);
    // Sowing-list keys have no bed: "sow-indoors:tomato:2026-03". The "2" starts the year, so bed jobs don't match.
    for (const s of sowingKinds(plant, month)) if (!doneBefore(g, `${s.kind}:${plant.id}:2`, year, month)) add(s.kind, plant, 'on your Want to grow list', '', [], s.detail);
    if (plant.plantOutMonths?.includes(month) && !doneBefore(g, `plant-out:${plant.id}:2`, year, month)) add('plant-out', plant, 'on your Want to grow list', '', []);
  }

  const order = (k: JobKind) => JOB_KINDS.indexOf(k);
  return jobs.sort((a, b) => order(a.kind) - order(b.kind) || a.plant.localeCompare(b.plant) || a.where.localeCompare(b.where));
}

/** Jobs grouped by kind, skipping kinds with nothing to do. */
export function groupJobs(jobs: Job[]): [JobKind, Job[]][] {
  return JOB_KINDS.map((k) => [k, jobs.filter((j) => j.kind === k)] as [JobKind, Job[]]).filter(([, list]) => list.length > 0);
}

// ---------- Ticking jobs off ----------

/**
 * Ticks or unticks a job. Ticking a sowing job dates its plantings (if they have no date) and records how they were
 * sown; planting out marks them planted out; a progress check or the first harvest moves them on to that stage.
 */
export function toggleJob(g: Garden, job: Job, date: string, plantOf?: (id: string) => Plant): Garden {
  const done = g.jobsDone.find((j) => j.key === job.key);
  const ids = new Set(job.plantingIds);
  if (done) {
    const unticked = { ...g, jobsDone: g.jobsDone.filter((j) => j.key !== job.key) };
    // A weed job unticked: the weeds it cleared are back.
    if (job.kind === 'weed' && ids.size) return { ...unticked, plantings: unticked.plantings.map((p) => (ids.has(p.id) && p.removedOn === done.date ? withoutRemoved(p) : p)) };
    return unticked;
  }
  const ticked = { ...g, jobsDone: [...g.jobsDone, { key: job.key, date }] };
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
    const sowing = job.kind === 'sow-direct' ? 'direct' : 'indoors';
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
