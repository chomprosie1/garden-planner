// Release 42: one job, done once. A planting that can be sown two ways gets one
// job with both; ticking either clears it. Planting out comes after sowing.
// Sowing in the Shed sows the bed's planting. The right verbs, and fewer
// pointless jobs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { firstJob, jobLabel, jobsFor, plannedToSow, sownForPlan, toggleJob, type Job } from '../src/calendar/jobs';
import { jobTiming, upcomingVerb } from '../src/calendar/week';
import { generalJobs } from '../src/content/seasons';
import { happenings } from '../src/lifecycle/happened';
import { defaultContainer, plantingsIndoors } from '../src/lifecycle/shed';
import { currentStage } from '../src/lifecycle/stages';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { canSowInBatches } from '../src/planting/batches';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const TODAY = '2026-10-12';
const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), name: 'Back bed' };
const pot: Feature = { ...makeFeature('pot', { area: rectPoints({ x: 3000, y: 0, w: 400, h: 400 }) }), name: 'Herb pot' };
const row = (id: string, patch: Partial<Planting> = {}, where: Feature = bed): Planting => ({ ...makePlanting(plantOf(id), where.id, where === bed ? 'row' : 'single', where === bed ? [600, 300] : [3200, 200], where === bed ? [600, 2100] : undefined), ...patch });
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(addFeature(newGarden(), bed), pot));
const october = (g: Garden, opts = {}) => jobsFor(g, plantOf, 10, 2026, { today: TODAY, ...opts });
const sowJobs = (jobs: Job[]) => jobs.filter((j) => j.kind === 'sow-direct' || j.kind === 'sow-indoors');

describe('one sow job per planting, with either way', () => {
  const beans = row('broad-bean-autumn-sown');

  it('autumn broad beans get one job: sow outside, or under cover in a cold frame', () => {
    const jobs = sowJobs(october(gardenWith(beans)));
    expect(jobs).toHaveLength(1);
    expect(jobLabel(jobs[0]!)).toBe('Sow outside, or under cover in a cold frame');
    expect(jobs[0]!.ways!.map((w) => w.kind)).toEqual(['sow-direct', 'sow-indoors']);
    expect(jobs[0]!.ways![1]!.detail).toMatch(/root trainers/);
  });

  for (const way of ['sow-direct', 'sow-indoors'] as const)
    it(`ticking it done ${way === 'sow-direct' ? 'outside' : 'under cover'} records that way and clears it`, () => {
      const g = gardenWith(beans);
      const [job] = sowJobs(october(g));
      const done = toggleJob(g, job!, TODAY, plantOf, way);
      expect(done.plantings[0]!.sowing).toBe(way === 'sow-direct' ? 'direct' : 'indoors');
      expect(done.plantings[0]!.sownOn).toBe(TODAY);
      const after = sowJobs(october(done));
      // Still this month's job, ticked, and now only the way it was done.
      expect(after).toHaveLength(1);
      expect(after[0]!.key).toBe(job!.key);
      expect(after[0]!.kind).toBe(way);
      expect(after[0]!.ways).toBeUndefined();
      expect(done.jobsDone.map((d) => d.key)).toContain(after[0]!.key);
      expect(validateGarden(JSON.parse(JSON.stringify(done)))).toEqual([]);
    });

  it('the first-job note says the first way in a sentence', () => {
    const first = firstJob(gardenWith(beans), plantOf, new Date(2026, 9, 12), { today: TODAY });
    expect(first!.note).toBe('Your first job: Broad bean, autumn-sown. Sow outside in Back bed.');
  });
});

describe('planting out comes after sowing', () => {
  it('no "Plant out" for unsown corn salad while it can still be sown this month', () => {
    const jobs = october(gardenWith(row('corn-salad')));
    expect(jobs.filter((j) => j.kind === 'plant-out')).toEqual([]);
    expect(sowJobs(jobs)).toHaveLength(1);
  });

  it('none for a sowing outside, nor before the month the timeline expects it out', () => {
    expect(october(gardenWith(row('corn-salad', { sownOn: '2026-09-01', sowing: 'direct' }))).filter((j) => j.kind === 'plant-out')).toEqual([]);
    // Sown under cover today: it's up and grown on by about late November.
    expect(october(gardenWith(row('corn-salad', { sownOn: TODAY, sowing: 'indoors' }))).filter((j) => j.kind === 'plant-out')).toEqual([]);
    // Sown in early September: ready to go out this month.
    expect(october(gardenWith(row('corn-salad', { sownOn: '2026-09-01', sowing: 'indoors' }))).filter((j) => j.kind === 'plant-out')).toHaveLength(1);
  });

  it('bought plants still go in when their sowing time has passed', () => {
    const may = jobsFor(gardenWith(row('tomato')), plantOf, 5, 2027);
    expect(may.filter((j) => j.kind === 'plant-out')).toHaveLength(1);
  });

  it('a sowing job’s timing goes by its own way of sowing, and an unfound step is later, not now', () => {
    const g = gardenWith(row('corn-salad'));
    const [job] = sowJobs(october(g));
    expect(jobTiming([job!], g, plantOf, TODAY).get(job!.key)).toBe('now');
  });
});

describe('sowing in the Shed sows the bed’s planting', () => {
  it('offers the bed it’s planned for, a kind counting as the plant', () => {
    const g = gardenWith(row('broad-bean-autumn-sown'), row('carrot'));
    expect(plannedToSow(g, plantOf('broad-bean-autumn-sown'), plantOf).map((b) => b.featureId)).toEqual([bed.id]);
    expect(plannedToSow(g, plantOf('broad-bean'), plantOf)).toHaveLength(1);
    expect(plannedToSow(g, plantOf('sweet-pea'), plantOf)).toEqual([]);
  });

  it('dates the planting as sown under cover and clears its sowing job', () => {
    const g = gardenWith(row('corn-salad'));
    const [job] = sowJobs(october(g));
    const ids = plannedToSow(g, plantOf('corn-salad'), plantOf)[0]!.ids;
    const sown = sownForPlan(g, plantOf, ids, TODAY);
    const pl = sown.plantings[0]!;
    expect(currentStage(pl)).toBe('sown');
    expect(pl.sowing).toBe('indoors');
    expect(sown.jobsDone.map((d) => d.key)).toContain(job!.key);
    // It shows in the Shed under "Sown for the plan", with no tray of its own.
    expect(plantingsIndoors(sown, plantOf).map((p) => p.id)).toEqual([pl.id]);
    expect(sown.trays ?? []).toEqual([]);
    // Nothing more to sow, and no planting out before it's grown on.
    const after = october(sown);
    expect(sowJobs(after).every((j) => sown.jobsDone.some((d) => d.key === j.key))).toBe(true);
    expect(after.filter((j) => j.kind === 'plant-out')).toEqual([]);
    expect(validateGarden(JSON.parse(JSON.stringify(sown)))).toEqual([]);
  });

  it('sweet peas and beans go in root trainers', () => {
    expect(defaultContainer(plantOf('sweet-pea'))).toBe('root-trainer');
    expect(defaultContainer(plantOf('broad-bean'))).toBe('root-trainer');
    expect(defaultContainer(plantOf('lettuce'))).toBe('module-tray');
  });
});

describe('the right verbs', () => {
  it('garlic is planted, not sown, and not in batches', () => {
    const garlic = row('garlic');
    expect(happenings(plantOf('garlic'), garlic).map((h) => h.label)).toEqual(['Planted']);
    expect(canSowInBatches(plantOf('garlic'), garlic)).toBe(false);
    expect(canSowInBatches(plantOf('carrot'), row('carrot'))).toBe(true);
  });

  it('roots are lifted', () => {
    const parsnips = row('parsnip', { sownOn: '2026-04-15', stage: 'vegetative' });
    const harvest = october(gardenWith(parsnips)).find((j) => j.kind === 'harvest')!;
    expect(jobLabel(harvest)).toBe('Ready to lift');
    expect(happenings(plantOf('parsnip'), { ...parsnips, stage: 'harvesting' }).map((h) => h.label)).toContain('Lifted some');
    expect(upcomingVerb({ key: '', plantId: 'parsnip', featureId: bed.id, plantingIds: [], stage: 'harvesting', date: TODAY, todo: false, sowing: 'direct', from: 'seed', now: false, root: true })).toBe('Ready to lift');
  });
});

describe('fewer pointless jobs', () => {
  it('no monthly "Ready to pick" for a herb picked all year', () => {
    const bay = row('bay', { stage: 'vegetative', stageDates: { transplanted: '2025-10-01' } }, pot);
    expect(october(gardenWith(bay)).filter((j) => j.kind === 'harvest')).toEqual([]);
  });

  it('"Weed the beds" counts beds, not pots', () => {
    const g = gardenWith(row('carrot', { sownOn: '2026-08-01', sowing: 'direct' }), row('bay', { stage: 'vegetative' }, pot));
    const weed = october(g, { weeding: true }).find((j) => j.key.startsWith('weed:beds'))!;
    expect(weed.where).toBe('(Back bed)');
  });

  it('the general jobs leave out plants you don’t grow, and ones your own jobs cover', () => {
    const all = generalJobs(10, newGarden()).map((j) => j.text);
    expect(all).toContain('Lift and store dahlia tubers after the first frost');
    const g = gardenWith(row('garlic'));
    const mine = generalJobs(10, g, plantOf);
    expect(mine.map((j) => j.text)).not.toContain('Lift and store dahlia tubers after the first frost');
    expect(mine.map((j) => j.text)).not.toContain('Plant garlic cloves');
    // Each keeps its place in the month's list, which its tick is saved under.
    expect(mine.find((j) => j.text.startsWith('Gather fallen leaves'))!.i).toBe(3);
    // A pruning job the app doesn't do itself shows only for a garden with the tree.
    expect(generalJobs(1, g, plantOf).map((j) => j.text)).not.toContain('Prune apple and pear trees while they are dormant');
    expect(generalJobs(1, gardenWith(row('apple', {}, pot)), plantOf).map((j) => j.text)).toContain('Prune apple and pear trees while they are dormant');
  });
});
