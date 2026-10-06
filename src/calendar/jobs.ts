// The month's jobs for your own plants, worked out from what's on the plan
// and what's on your sowing list. Pure functions: garden and plants in, jobs out.
//
// What's on the plan but not yet sown gets sowing and planting-out jobs.
// Once a planting has a sowing date, it gets harvest, winter and tidy jobs.

import { featureLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive } from '../planting/place';

export const JOB_KINDS = ['sow-indoors', 'sow-direct', 'plant-out', 'harvest', 'protect', 'lift', 'tidy'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_LABEL: Record<JobKind, string> = {
  'sow-indoors': 'Sow indoors or under cover',
  'sow-direct': 'Sow outside',
  'plant-out': 'Plant out',
  harvest: 'Harvest',
  protect: 'Protect for winter',
  lift: 'Lift and store',
  tidy: 'Clear and tidy',
};

export interface Job {
  /** Stable, so a tick saved in jobsDone finds its job again, e.g. "sow-direct:carrot:f-veg:2026-04". */
  key: string;
  kind: JobKind;
  plantId: string;
  /** "Carrot". */
  plant: string;
  /** "in Veg bed (2 rows)", or "on your sowing list". */
  where: string;
  /** Extra advice from the plant's notes, if any. */
  detail?: string;
  featureId?: string;
  /** The plantings this job is for. Ticking a sowing or planting-out job dates them. */
  plantingIds: string[];
}

const MONTH_FIRST_FROST = 10;

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

/** Your jobs for a month, in the order of JOB_KINDS, then by plant name. */
export function jobsFor(g: Garden, plantOf: (id: string) => Plant, month: number, year: number): Job[] {
  const jobs: Job[] = [];
  const add = (kind: JobKind, plant: Plant, where: string, scope: string, plantingIds: string[], detail?: string, featureId?: string) => {
    const job: Job = { key: `${kind}:${plant.id}:${scope ? `${scope}:` : ''}${ym(year, month)}`, kind, plantId: plant.id, plant: plant.commonName, where, plantingIds };
    if (detail) job.detail = detail;
    if (featureId) job.featureId = featureId;
    jobs.push(job);
  };

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
    const where = `in ${bed ? featureLabel(bed) : 'a bed'}${describeGroup(group)}`;
    const ids = (list: Planting[]) => list.map((p) => p.id);

    // Not sown yet, or sown this month (so a ticked job stays in this month's list).
    // Plants already growing skip sowing and planting out.
    const notGrowing = group.filter((p) => p.status !== 'growing');
    const toSow = notGrowing.filter((p) => !p.sownOn || sownThisMonth(p, year, month));
    if (toSow.length)
      for (const s of sowingKinds(plant, month)) add(s.kind, plant, s.kind === 'sow-indoors' ? `for ${where.slice(3)}` : where, featureId, ids(toSow), s.detail, featureId);
    if (plant.plantOutMonths?.includes(month)) {
      // Ticking a planting-out job marks the plants as growing; the ticked job stays for the rest of the month.
      const tickedNow = g.jobsDone.some((j) => j.key === `plant-out:${plant.id}:${featureId}:${ym(year, month)}`);
      const toPlant = (tickedNow ? group : notGrowing).filter((p) => !p.sownOn || p.sownOn.slice(0, 7) <= ym(year, month));
      if (toPlant.length && !doneBefore(g, `plant-out:${plant.id}:${featureId}:`, year, month)) add('plant-out', plant, where, featureId, ids(toPlant), undefined, featureId);
    }

    const growing = group.filter((p) => p.status === 'growing' || afterSowing(p, year, month));
    if (!growing.length) continue;
    const harvest = plant.cropping?.harvestMonths ?? [];
    if (harvest.includes(month)) add('harvest', plant, where, featureId, ids(growing), plant.cropping?.notes, featureId);
    const winter = plant.wintering;
    if (winter?.type === 'protect' && month === MONTH_FIRST_FROST) add('protect', plant, where, featureId, ids(growing), winter.notes ?? 'Bring pots under cover or fleece the plants before the first frosts.', featureId);
    if (winter?.type === 'lift-and-store' && runEnds(harvest).includes(month)) add('lift', plant, where, featureId, ids(growing), winter.notes, featureId);
    if (winter?.type === 'annual' && runEnds(harvest).some((m) => m % 12 === month - 1 && month >= 9)) add('tidy', plant, where, featureId, ids(growing), 'Pull up finished plants and compost them, then mark the planting as harvested.', featureId);
  }

  // Your sowing list: plants you mean to grow that aren't on the plan yet.
  const planned = new Set(g.plantings.filter(isActive).map((p) => p.plantId));
  for (const id of new Set(g.wishlist)) {
    if (planned.has(id)) continue;
    const plant = plantOf(id);
    // Sowing-list keys have no bed: "sow-indoors:tomato:2026-03". The "2" starts the year, so bed jobs don't match.
    for (const s of sowingKinds(plant, month)) if (!doneBefore(g, `${s.kind}:${plant.id}:2`, year, month)) add(s.kind, plant, 'on your sowing list', '', [], s.detail);
    if (plant.plantOutMonths?.includes(month) && !doneBefore(g, `plant-out:${plant.id}:2`, year, month)) add('plant-out', plant, 'on your sowing list', '', []);
  }

  const order = (k: JobKind) => JOB_KINDS.indexOf(k);
  return jobs.sort((a, b) => order(a.kind) - order(b.kind) || a.plant.localeCompare(b.plant) || a.where.localeCompare(b.where));
}

/** Jobs grouped by kind, skipping kinds with nothing to do. */
export function groupJobs(jobs: Job[]): [JobKind, Job[]][] {
  return JOB_KINDS.map((k) => [k, jobs.filter((j) => j.kind === k)] as [JobKind, Job[]]).filter(([, list]) => list.length > 0);
}

// ---------- Ticking jobs off ----------

/** Ticks or unticks a job. Ticking a sowing job dates its plantings (if they have no date); ticking planting out marks them growing. */
export function toggleJob(g: Garden, job: Job, date: string): Garden {
  const done = g.jobsDone.some((j) => j.key === job.key);
  if (done) return { ...g, jobsDone: g.jobsDone.filter((j) => j.key !== job.key) };
  const sowing = job.kind === 'sow-indoors' || job.kind === 'sow-direct';
  const planting = job.kind === 'plant-out';
  const ids = new Set(job.plantingIds);
  return {
    ...g,
    jobsDone: [...g.jobsDone, { key: job.key, date }],
    plantings:
      (sowing || planting) && ids.size
        ? g.plantings.map((p) => {
            if (!ids.has(p.id)) return p;
            if (planting) return { ...p, status: 'growing' as const };
            return p.sownOn ? p : { ...p, sownOn: date };
          })
        : g.plantings,
  };
}

// ---------- Sowing list ----------

export const onWishlist = (g: Garden, id: string) => g.wishlist.includes(id);

export function toggleWishlist(g: Garden, id: string): Garden {
  return { ...g, wishlist: onWishlist(g, id) ? g.wishlist.filter((x) => x !== id) : [...g.wishlist, id] };
}
