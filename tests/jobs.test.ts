import { describe, expect, it } from 'vitest';
import vegetables from '../data/plants/vegetable.json';
import { groupJobs, jobsFor, runEnds, toggleJob, toggleWishlist, type Job } from '../src/calendar/jobs';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const library = vegetables as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

function garden(): { g: Garden; bed: string } {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
  return { g: addFeature(newAppState().garden, bed), bed: bed.id };
}
const plant = (g: Garden, bed: string, id: string, sownOn?: string, layout: Planting['layout'] = 'row'): [Garden, Planting] => {
  const pl = makePlanting(plantOf(id), bed, layout ?? 'row', [100, 100], [2900, 100]);
  const withDate = sownOn ? { ...pl, sownOn } : pl;
  return [addPlanting(g, withDate), withDate];
};
const summary = (jobs: Job[]) => jobs.map((j) => `${j.kind} ${j.plantId} ${j.where}`);

describe('jobs for your plants', () => {
  it('a carrot row not yet sown: sow outside in April, nothing in January', () => {
    const { g: g0, bed } = garden();
    const [g] = plant(g0, bed, 'carrot');
    expect(summary(jobsFor(g, plantOf, 4, 2027))).toEqual(['sow-direct carrot in Veg bed']);
    expect(jobsFor(g, plantOf, 1, 2027)).toEqual([]);
  });

  it('carrots sown in April: harvest from June, lift and store in November', () => {
    const { g: g0, bed } = garden();
    const [g] = plant(g0, bed, 'carrot', '2027-04-12');
    expect(summary(jobsFor(g, plantOf, 4, 2027))).toEqual(['sow-direct carrot in Veg bed']); // the ticked sowing stays this month
    expect(summary(jobsFor(g, plantOf, 5, 2027))).toEqual([]);
    expect(summary(jobsFor(g, plantOf, 7, 2027))).toEqual(['harvest carrot in Veg bed']);
    expect(summary(jobsFor(g, plantOf, 11, 2027))).toEqual(['harvest carrot in Veg bed', 'lift carrot in Veg bed']);
  });

  it('tomatoes on the plan: sow indoors in March, plant out in May, harvest in August, clear in November', () => {
    const { g: g0, bed } = garden();
    let [g, pl] = plant(g0, bed, 'tomato', undefined, 'single');
    const march = jobsFor(g, plantOf, 3, 2027);
    expect(summary(march)).toEqual(['sow-indoors tomato for Veg bed']);
    g = toggleJob(g, march[0]!, '2027-03-10');
    expect(g.plantings.find((p) => p.id === pl.id)?.sownOn).toBe('2027-03-10');
    expect(summary(jobsFor(g, plantOf, 4, 2027))).toEqual([]);
    expect(summary(jobsFor(g, plantOf, 5, 2027))).toEqual(['plant-out tomato in Veg bed']);
    expect(summary(jobsFor(g, plantOf, 8, 2027))).toEqual(['harvest tomato in Veg bed']);
    expect(summary(jobsFor(g, plantOf, 11, 2027))).toEqual(['tidy tomato in Veg bed']);
  });

  it('a plant-out job ticked in May does not come back in June', () => {
    const { g: g0, bed } = garden();
    let [g] = plant(g0, bed, 'tomato', '2027-03-10', 'single');
    const may = jobsFor(g, plantOf, 5, 2027).find((j) => j.kind === 'plant-out')!;
    g = toggleJob(g, may, '2027-05-20');
    expect(jobsFor(g, plantOf, 5, 2027).find((j) => j.kind === 'plant-out')?.key).toBe(may.key);
    expect(jobsFor(g, plantOf, 6, 2027).filter((j) => j.kind === 'plant-out')).toEqual([]);
  });

  it('chillies get protected before the first frosts', () => {
    const { g: g0, bed } = garden();
    const [g] = plant(g0, bed, 'chilli', '2027-02-01', 'single');
    expect(summary(jobsFor(g, plantOf, 10, 2027))).toEqual(['harvest chilli in Veg bed', 'protect chilli in Veg bed']);
  });

  it('potatoes are lifted when their harvest ends; runner beans are cleared the month after', () => {
    const { g: g0, bed } = garden();
    let [g] = plant(g0, bed, 'potato', '2027-03-20');
    [g] = plant(g, bed, 'runner-bean', '2027-05-15');
    expect(summary(jobsFor(g, plantOf, 10, 2027))).toEqual(['harvest potato in Veg bed', 'harvest runner-bean in Veg bed', 'lift potato in Veg bed']);
    expect(summary(jobsFor(g, plantOf, 11, 2027))).toEqual(['tidy runner-bean in Veg bed']);
  });

  it('groups rows of one plant in one bed into one job', () => {
    const { g: g0, bed } = garden();
    let [g] = plant(g0, bed, 'carrot');
    [g] = plant(g, bed, 'carrot');
    [g] = plant(g, bed, 'carrot', undefined, 'block');
    const jobs = jobsFor(g, plantOf, 4, 2027);
    expect(summary(jobs)).toEqual(['sow-direct carrot in Veg bed (2 rows, 1 block)']);
    expect(jobs[0]!.plantingIds.length).toBe(3);
  });

  it('ignores what has been harvested', () => {
    const { g: g0, bed } = garden();
    const [g1, pl] = plant(g0, bed, 'carrot', '2027-04-01');
    const g = { ...g1, plantings: g1.plantings.map((p) => (p.id === pl.id ? { ...p, removedOn: '2027-08-01' } : p)) };
    expect(jobsFor(g, plantOf, 9, 2027)).toEqual([]);
  });

  it('keys are stable, so ticks find their jobs again', () => {
    const { g: g0, bed } = garden();
    const [g] = plant(g0, bed, 'carrot');
    const key = jobsFor(g, plantOf, 4, 2027)[0]!.key;
    expect(key).toBe(`sow-direct:carrot:${bed}:2027-04`);
    expect(jobsFor(g, plantOf, 4, 2027)[0]!.key).toBe(key);
  });
});

describe('sowing list', () => {
  it('gives sowing jobs for plants not yet on the plan, and stops once one is', () => {
    const { g: g0, bed } = garden();
    let g = toggleWishlist(g0, 'tomato');
    expect(summary(jobsFor(g, plantOf, 3, 2027))).toEqual(['sow-indoors tomato on your Want to grow list']);
    expect(jobsFor(g, plantOf, 3, 2027)[0]!.key).toBe('sow-indoors:tomato:2027-03');
    [g] = plant(g, bed, 'tomato', undefined, 'single');
    expect(summary(jobsFor(g, plantOf, 3, 2027))).toEqual(['sow-indoors tomato for Veg bed']);
    expect(toggleWishlist(toggleWishlist(g0, 'kale'), 'kale').wishlist).toEqual([]);
  });

  it('a sowing ticked in February is not asked for again in March', () => {
    const { g: g0 } = garden();
    let g = toggleWishlist(g0, 'tomato');
    g = toggleJob(g, jobsFor(g, plantOf, 2, 2027)[0]!, '2027-02-20');
    expect(jobsFor(g, plantOf, 3, 2027)).toEqual([]);
    // A year later it's due again.
    expect(summary(jobsFor(g, plantOf, 3, 2028))).toEqual(['sow-indoors tomato on your Want to grow list']);
  });

  it('cold-frame sowings say to transplant later', () => {
    const { g: g0 } = garden();
    const g = toggleWishlist(g0, 'leek');
    expect(jobsFor(g, plantOf, 3, 2027)[0]!.detail).toContain('plant out later');
  });
});

describe('helpers', () => {
  it('finds where harvest runs end, across the new year too', () => {
    expect(runEnds([6, 7, 8])).toEqual([8]);
    expect(runEnds([9, 10, 11, 12, 1, 2, 3])).toEqual([3]);
    expect(runEnds([4, 5, 6, 7, 9, 10, 11])).toEqual([7, 11]);
    expect(runEnds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toEqual([]);
  });

  it('groups by kind in the order you would do them', () => {
    const { g: g0, bed } = garden();
    let [g] = plant(g0, bed, 'carrot', '2027-04-01');
    g = toggleWishlist(g, 'leek');
    expect(groupJobs(jobsFor(g, plantOf, 4, 2027)).map(([k]) => k)).toEqual(['sow-indoors', 'sow-direct']);
  });

  it('unticking leaves the sowing date alone', () => {
    const { g: g0, bed } = garden();
    let [g] = plant(g0, bed, 'carrot');
    const job = jobsFor(g, plantOf, 4, 2027)[0]!;
    g = toggleJob(g, job, '2027-04-03');
    g = toggleJob(g, job, '2027-04-03');
    expect(g.jobsDone).toEqual([]);
    expect(g.plantings[0]!.sownOn).toBe('2027-04-03');
  });
});
