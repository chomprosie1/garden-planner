// Release 48: Today follows what you've done. A planting recorded some other way
// than by ticking its job needs no job; dates follow the sowing; "ready to pick"
// means ready; and crops that stand through the winter stand.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobsFor, sownForPlan, toggleJob, type Job } from '../src/calendar/jobs';
import { addDays, hardenOn, nextFor } from '../src/lifecycle/shed';
import { expectedText, stageIn, timeline, yearDate } from '../src/lifecycle/projection';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting, unknownPlant, updatePlanting, setStatus } from '../src/planting/place';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const TODAY = '2026-10-29';
const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 3000 }) }), name: 'Bed 1' };
const row = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2700]), ...patch });
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));
const jobsIn = (g: Garden, month: number, year = 2026) => jobsFor(g, plantOf, month, year, { today: TODAY });
const sowing = (jobs: Job[]) => jobs.filter((j) => j.kind === 'sow-direct' || j.kind === 'sow-indoors');
const harvest = (jobs: Job[]) => jobs.filter((j) => j.kind === 'harvest');

describe('a planting recorded another way has no job left to do', () => {
  it('garlic marked as planted this month: no "Plant" job (Callum)', () => {
    const before = gardenWith(row('garlic'));
    expect(sowing(jobsIn(before, 10))).toHaveLength(1);
    const pl = before.plantings[0]!;
    expect(sowing(jobsIn(updatePlanting(before, pl.id, { sownOn: '2026-10-27' }), 10))).toHaveLength(0);
  });

  it('added as already in the ground this month: no sow or plant job (Margaret)', () => {
    const already = (id: string) => makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2700], { date: '2026-10-20', stage: 'sown' });
    const g = gardenWith(already('garlic'), already('broad-bean-autumn-sown'), already('onion-overwintering'));
    expect(sowing(jobsIn(g, 10))).toEqual([]);
  });

  it('marked as sown: no sow job', () => {
    const g = gardenWith(row('broad-bean-autumn-sown'));
    expect(sowing(jobsIn(setStatus(g, [g.plantings[0]!.id], 'sown', TODAY), 10))).toEqual([]);
  });

  it('a ticked job still stays for the month, ticked', () => {
    const g = gardenWith(row('garlic'));
    const [job] = sowing(jobsIn(g, 10));
    const done = toggleJob(g, job!, TODAY, plantOf);
    expect(sowing(jobsIn(done, 10)).map((j) => j.key)).toEqual([job!.key]);
    // Unticked (Jordan ticked one by accident): not sown after all, and the job's back to do.
    const undone = toggleJob(done, job!, TODAY, plantOf);
    expect(undone.plantings[0]!.sownOn).toBeUndefined();
    expect(sowing(jobsIn(undone, 10)).map((j) => j.key)).toEqual([job!.key]);
  });

  it('unticking a sowing that has since come up leaves it sown', () => {
    const g = gardenWith(row('lettuce-winter'));
    const [job] = sowing(jobsIn(g, 10));
    const done = toggleJob(g, job!, TODAY, plantOf);
    const up = updatePlanting(done, done.plantings[0]!.id, { stage: 'germinated', stageDates: { germinated: TODAY } });
    expect(toggleJob(up, job!, TODAY, plantOf).plantings[0]!.sownOn).toBe(TODAY);
  });

  it('unticking leaves a date you gave yourself alone', () => {
    const g = gardenWith(row('garlic'));
    const [job] = sowing(jobsIn(g, 10));
    const done = toggleJob(g, job!, TODAY, plantOf);
    const moved = updatePlanting(done, done.plantings[0]!.id, { sownOn: '2026-10-20' });
    expect(toggleJob(moved, job!, TODAY, plantOf).plantings[0]!.sownOn).toBe('2026-10-20');
  });

  it('sown in the Shed for the bed: the job stays ticked', () => {
    const g = gardenWith(row('lettuce-winter'));
    const [job] = sowing(jobsIn(g, 10));
    const done = sownForPlan(g, plantOf, [g.plantings[0]!.id], TODAY);
    expect(done.jobsDone.map((d) => d.key)).toContain(job!.key);
    expect(sowing(jobsIn(done, 10)).map((j) => j.key)).toEqual([job!.key]);
  });

  it('one row of two recorded: the job is for the other row only', () => {
    const g = gardenWith(row('garlic', { sownOn: '2026-10-27' }), row('garlic'));
    const jobs = sowing(jobsIn(g, 10));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.plantingIds).toEqual([g.plantings[1]!.id]);
  });
});

describe('a sowing under cover goes by the day it was sown (Priya)', () => {
  for (const id of ['lettuce-winter', 'corn-salad', 'winter-purslane'])
    it(`${id} sown today goes out this winter, not next September`, () => {
      const pl = row(id, { sownOn: TODAY, sowing: 'indoors' });
      const steps = timeline(plantOf(id), pl, gardenWith(pl), TODAY);
      const out = steps.find((s) => s.stage === 'transplanted')!;
      expect(out.date! > TODAY).toBe(true);
      expect(out.date! < '2027-03-01').toBe(true);
    });

  it('no projected date comes before the one before it', () => {
    for (const id of ['lettuce-winter', 'corn-salad', 'winter-purslane', 'broad-bean-autumn-sown', 'sweet-pea']) {
      const pl = row(id, { sownOn: TODAY, sowing: 'indoors' });
      const dates = timeline(plantOf(id), pl, gardenWith(pl), TODAY).map((s) => s.date!);
      expect(dates).toEqual([...dates].sort());
      expect(dates[0]).toBe(TODAY);
    }
  });

  for (const id of ['lettuce-winter', 'corn-salad', 'winter-purslane'])
    it(`${id} gets its plant-out job when the timeline brings it out, outside its usual months`, () => {
      const pl = row(id, { sownOn: TODAY, sowing: 'indoors' });
      const g = gardenWith(pl);
      const out = timeline(plantOf(id), pl, g, TODAY).find((s) => s.stage === 'transplanted')!;
      const [y, m] = out.date!.split('-').map(Number) as [number, number];
      expect(jobsIn(g, m, y).filter((j) => j.kind === 'plant-out').map((j) => j.plantingIds)).toEqual([[pl.id]]);
    });

  it('an autumn broad bean in a frame still waits for the spring', () => {
    const pl = row('broad-bean-autumn-sown', { sownOn: TODAY, sowing: 'indoors' });
    const out = timeline(plantOf(pl.plantId), pl, gardenWith(pl), TODAY).find((s) => s.stage === 'transplanted')!;
    expect(out.date! >= '2027-01-15').toBe(true);
  });
});

describe('"ready to pick" means ready', () => {
  it('seed sown under cover today is not ready to pick next month', () => {
    const g = gardenWith(row('lettuce-winter', { sownOn: TODAY, sowing: 'indoors' }));
    expect(harvest(jobsIn(g, 11))).toEqual([]);
  });

  it('a crop well on in its months is', () => {
    const g = gardenWith(row('parsnip', { sownOn: '2026-04-10', sowing: 'direct', stage: 'vegetative' }));
    expect(harvest(jobsIn(g, 11))).toHaveLength(1);
  });

  it('an established apple is ready in its months, and its card says the same as Today (Priya, Nadia)', () => {
    const pl = { ...makePlanting(plantOf('apple'), bed.id, 'single', [600, 600], undefined, { date: '2025-10-01', stage: 'vegetative' }) };
    const g = gardenWith(pl);
    expect(harvest(jobsIn(g, 10))).toHaveLength(1);
    expect(expectedText(timeline(plantOf('apple'), pl, g, TODAY), plantOf('apple'), TODAY)).toBe('Probably ready to pick now');
    expect(harvest(jobsFor(g, plantOf, 3, 2027, { today: '2027-03-15' }))).toEqual([]);
  });

  it('a crop not ready has no lift or clear-up job either', () => {
    // Carrots' last harvest month is November: not ready by its end, there's nothing to pick or lift.
    const g = gardenWith(row('carrot', { sownOn: '2026-11-20', sowing: 'direct', stage: 'vegetative' }));
    const jobs = jobsFor(g, plantOf, 11, 2026, { today: '2026-11-25' });
    expect(jobs.filter((j) => j.kind === 'lift' || j.kind === 'harvest')).toEqual([]);
  });

  it('in its harvest months but not ready, a crop is still asked about flowering', () => {
    const today = '2026-07-20';
    const late = row('tomato', { sownOn: '2026-05-01', sowing: 'indoors', stage: 'transplanted', stageDates: { transplanted: '2026-06-25' } });
    const jobs = jobsFor(gardenWith(late), plantOf, 8, 2026, { today });
    expect(jobs.some((j) => j.kind === 'check' || j.kind === 'harvest')).toBe(true);
  });

  it('leeks you have started picking stay on the list, whatever the month (Margaret)', () => {
    const g = gardenWith(row('leek-late', { sownOn: '2026-03-20', sowing: 'indoors', stage: 'harvesting', stageDates: { transplanted: '2026-06-20', harvesting: '2026-10-20' } }));
    expect(harvest(jobsIn(g, 10))).toHaveLength(1);
  });
});

describe('crops that stand through the winter stand', () => {
  for (const [id, by] of [
    ['parsnip', '2027-02-01'],
    ['kale', '2027-02-01'],
    ['leek-late', '2027-02-01'],
    ['swede', '2027-01-01'],
    ['brussels-sprout', '2027-01-01'],
  ] as const)
    it(`${id} isn't finished before ${by}`, () => {
      const pl = row(id, { sownOn: '2026-04-10', sowing: id === 'parsnip' || id === 'swede' ? 'direct' : 'indoors', stage: 'harvesting', stageDates: { transplanted: '2026-06-20', harvesting: '2026-10-20' } });
      const steps = timeline(plantOf(id), pl, gardenWith(pl), TODAY);
      expect(stageIn(steps, by).stage).toBe('harvesting');
    });

  for (const [id, sown, ready] of [
    ['radish', '2026-04-10', '2026-05-20'],
    ['beetroot', '2026-05-01', '2026-07-10'],
    ['cabbage', '2026-03-20', '2026-06-20'],
  ] as const)
    it(`${id} ready in ${ready.slice(5, 7) === '05' ? 'May' : ready.slice(5, 7) === '06' ? 'June' : 'July'} doesn't sit there until the autumn`, () => {
      const pl = row(id, { sownOn: sown, sowing: 'direct', stage: 'harvesting', stageDates: { harvesting: ready } });
      const end = timeline(plantOf(id), pl, gardenWith(pl), addDays(ready, 1)).find((s) => s.stage === 'cleared')!;
      expect(end.date).toBe(addDays(ready, 42));
    });

  it('a cabbage ready in October stands', () => {
    const pl = row('cabbage', { sownOn: '2026-05-20', sowing: 'indoors', stage: 'harvesting', stageDates: { harvesting: '2026-10-20' } });
    expect(stageIn(timeline(plantOf('cabbage'), pl, gardenWith(pl), TODAY), '2027-02-01').stage).toBe('harvesting');
  });

  it('a quick summer lettuce is still cut for about six weeks', () => {
    const pl = row('lettuce', { sownOn: '2026-05-01', sowing: 'direct', stage: 'harvesting', stageDates: { harvesting: '2026-06-20' } });
    const end = timeline(plantOf('lettuce'), pl, gardenWith(pl), '2026-06-21').find((s) => s.stage === 'cleared')!;
    expect(end.date).toBe(addDays('2026-06-20', 42));
  });
});

describe('the Shed and the timeline agree', () => {
  it('an autumn broad bean in a frame does not start hardening off the day it is up', () => {
    const plant = plantOf('broad-bean-autumn-sown');
    const next = nextFor(plant, newGarden(), 'germinated', '2026-10-20', { germinated: '2026-11-01' }, '2026-11-01');
    expect(next.text).toMatch(/Start hardening off from/);
    expect(next.due).toBe(false);
  });

  it('winter salads harden off a month after they are up', () => {
    const plant = plantOf('lettuce-winter');
    expect(hardenOn(plant, newGarden(), '2026-11-06')).toBe('2026-12-04');
  });
});

describe('dates a long way off say the year', () => {
  it('this coming spring does not, the one after does', () => {
    expect(yearDate('2027-04-23', TODAY)).toBe('23 Apr');
    expect(yearDate('2028-04-23', TODAY)).toBe('23 Apr 2028');
    expect(yearDate('2025-10-01', TODAY)).toBe('1 Oct 2025');
  });
});

describe('perennials picked all year', () => {
  it('a bay does not go round in circles', () => {
    const pl = makePlanting(plantOf('bay'), bed.id, 'single', [600, 600], undefined, { date: '2025-10-01', stage: 'vegetative' });
    const steps = timeline(plantOf('bay'), pl, gardenWith(pl), TODAY);
    expect(steps.filter((s) => s.stage === 'harvesting').length).toBeLessThanOrEqual(1);
    expect(expectedText(steps, plantOf('bay'), TODAY) ?? '').not.toMatch(/Ready to harvest/);
  });

  it('rosemary still flowers, year after year', () => {
    const pl = makePlanting(plantOf('rosemary'), bed.id, 'single', [600, 600], undefined, { date: '2025-10-01', stage: 'vegetative' });
    const flowers = timeline(plantOf('rosemary'), pl, gardenWith(pl), TODAY).filter((s) => s.stage === 'flowering');
    expect(flowers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(flowers.map((s) => s.date!.slice(0, 4))).size).toBeGreaterThanOrEqual(2);
  });
});
