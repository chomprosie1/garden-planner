// Life stages (Stage 8): each plant's path, moving on and back, failed sowings,
// the guesses from the plant's months, and the jobs and migration that go with them.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { currentStage, flowerMonthsOf, isNewSeason, markFailed, nextStage, pathFor, setSowing, setStage, stageTips, suggestedStage } from '../src/lifecycle/stages';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, makePlanting, plantingStatus, unknownPlant } from '../src/planting/place';
import v3 from './fixtures/garden-v3.json';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

function withPlanting(id: string, patch: Partial<Planting> = {}): { g: Garden; pl: Planting } {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
  const pl = { ...makePlanting(plantOf(id), bed.id, 'single', [500, 500]), ...patch };
  return { g: addPlanting(addFeature(newAppState().garden, bed), pl), pl };
}
const first = (g: Garden) => g.plantings[0]!;

describe('life paths', () => {
  it('tomatoes are sown indoors, hardened off, planted out, flower and crop', () => {
    expect(pathFor(plantOf('tomato'))).toEqual(['sown', 'germinated', 'hardening', 'transplanted', 'vegetative', 'flowering', 'harvesting']);
  });
  it('carrots sown outside never harden off and have no flowering stage', () => {
    expect(pathFor(plantOf('carrot'))).toEqual(['sown', 'germinated', 'vegetative', 'harvesting']);
  });
  it('lettuce sown outside follows the outdoor path, and indoors the protected one', () => {
    const lettuce = plantOf('lettuce');
    const pl = makePlanting(lettuce, 'b', 'single', [0, 0]);
    expect(pathFor(lettuce, { ...pl, sowing: 'direct' })).toEqual(['sown', 'germinated', 'vegetative', 'harvesting']);
    expect(pathFor(lettuce, { ...pl, sowing: 'indoors' })).not.toContain('flowering');
    expect(pathFor(lettuce, { ...pl, sowing: 'indoors' })).toContain('hardening');
  });
  it('strawberries and tulips start at planting; tulips are grown for their flowers', () => {
    expect(pathFor(plantOf('strawberry'))).toEqual(['transplanted', 'vegetative', 'flowering', 'harvesting']);
    expect(pathFor(plantOf('tulip'))).toEqual(['transplanted', 'vegetative', 'flowering']);
  });
  it('every library plant has a path that starts at sowing or planting and includes growth', () => {
    for (const p of library) {
      const path = pathFor(p);
      expect(['sown', 'transplanted']).toContain(path[0]);
      expect(path).toContain('vegetative');
    }
  });
});

describe('moving through the stages', () => {
  it('moves on one stage at a time, keeping the date of each', () => {
    const tomato = plantOf('tomato');
    let { g } = withPlanting('tomato');
    expect(nextStage(tomato, first(g))).toBe('sown');
    g = setStage(g, [first(g).id], 'sown', '2027-03-01');
    expect(first(g).sownOn).toBe('2027-03-01');
    expect(nextStage(tomato, first(g))).toBe('germinated');
    g = setStage(g, [first(g).id], 'germinated', '2027-03-12');
    g = setStage(g, [first(g).id], 'hardening', '2027-05-01');
    g = setStage(g, [first(g).id], 'transplanted', '2027-05-15');
    expect(first(g)).toMatchObject({ stage: 'transplanted', sownOn: '2027-03-01', stageDates: { germinated: '2027-03-12', hardening: '2027-05-01', transplanted: '2027-05-15' } });
    expect(plantingStatus(first(g))).toBe('growing');
  });

  it('can be corrected back, dropping the later dates', () => {
    let { g } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'transplanted', stageDates: { germinated: '2027-03-12', transplanted: '2027-05-15' } });
    g = setStage(g, [first(g).id], 'germinated', '2027-05-16');
    expect(first(g)).toMatchObject({ stage: 'germinated', stageDates: { germinated: '2027-03-12' } });
    expect(first(g).stageDates?.transplanted).toBeUndefined();
    g = setStage(g, [first(g).id], 'planned', '2027-05-16');
    expect(currentStage(first(g))).toBe('planned');
    expect(first(g).sownOn).toBeUndefined();
  });

  it('a failed sowing goes back to planned, with a note in the journal', () => {
    let { g } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'germinated' });
    g = markFailed(g, first(g).id, 'Tomato', '2027-03-20');
    expect(currentStage(first(g))).toBe('planned');
    expect(g.notes).toHaveLength(1);
    expect(g.notes[0]).toMatchObject({ plantingId: first(g).id, date: '2027-03-20' });
    expect(g.notes[0]!.text).toMatch(/failed/);
  });

  it('a perennial starts a new season after its harvest, instead of ending', () => {
    const strawberry = plantOf('strawberry');
    const { pl } = withPlanting('strawberry', { stage: 'harvesting' });
    expect(nextStage(strawberry, pl)).toBe('vegetative');
    expect(isNewSeason(strawberry, pl)).toBe(true);
    expect(nextStage(plantOf('carrot'), { ...pl, plantId: 'carrot', stage: 'harvesting' })).toBeNull();
  });

  it('recording how it was sown changes the path', () => {
    let { g } = withPlanting('lettuce');
    g = setSowing(g, [first(g).id], 'direct');
    expect(pathFor(plantOf('lettuce'), first(g))).not.toContain('hardening');
  });
});

describe('guessing the stage from the months', () => {
  it('a tomato flowers the month before its harvest starts', () => {
    expect(flowerMonthsOf(plantOf('tomato'))).toEqual([6]);
    expect(flowerMonthsOf(plantOf('carrot'))).toEqual([]);
  });
  it('suggests flowering in June for planted-out tomatoes, and harvesting in August', () => {
    const tomato = plantOf('tomato');
    const { pl } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'transplanted' });
    expect(suggestedStage(tomato, pl, 6)).toBe('flowering');
    expect(suggestedStage(tomato, pl, 8)).toBe('harvesting');
    expect(suggestedStage(tomato, { ...pl, stage: 'harvesting' }, 8)).toBeNull();
  });
  it('makes no guess for seedlings still indoors', () => {
    const { pl } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'germinated' });
    expect(suggestedStage(plantOf('tomato'), pl, 6)).toBeNull();
  });
});

describe('advice', () => {
  it('uses the plant’s own advice first', () => {
    expect(stageTips(plantOf('tomato'), 'vegetative')[0]).toMatch(/side shoots/);
    expect(stageTips(plantOf('potato'), 'vegetative')[0]).toMatch(/[Ee]arth up/);
  });
  it('falls back to general advice that fits how it was sown', () => {
    const carrot = plantOf('carrot');
    expect(stageTips(carrot, 'germinated')[0]).toMatch(/[Tt]hin/);
    expect(stageTips(plantOf('basil'), 'germinated')[0]).toMatch(/light/);
    expect(stageTips(carrot, 'planned')).toEqual([]);
  });
  it('names no brands of feed', () => {
    for (const p of library) for (const tips of Object.values(p.stageTips ?? {})) for (const t of tips) expect(t).not.toMatch(/Tomorite|Miracle-Gro|Phostrogen/i);
  });
});

describe('jobs move plantings on', () => {
  it('ticking a sowing job records indoors or outside', () => {
    let { g } = withPlanting('lettuce');
    const job = jobsFor(g, plantOf, 4, 2027).find((j) => j.kind === 'sow-direct')!;
    g = toggleJob(g, job, '2027-04-03', plantOf);
    expect(first(g)).toMatchObject({ sownOn: '2027-04-03', sowing: 'direct' });
  });

  it('asks you to check a planted-out tomato is flowering in June, and ticking it marks it so', () => {
    let { g } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'transplanted' });
    const check = jobsFor(g, plantOf, 6, 2027).find((j) => j.kind === 'check')!;
    expect(check).toMatchObject({ stage: 'flowering', plantingIds: [first(g).id] });
    g = toggleJob(g, check, '2027-06-12', plantOf);
    expect(first(g)).toMatchObject({ stage: 'flowering', stageDates: { flowering: '2027-06-12' } });
    // The ticked job stays for the rest of the month.
    expect(jobsFor(g, plantOf, 6, 2027).find((j) => j.kind === 'check')?.key).toBe(check.key);
    expect(jobsFor(g, plantOf, 7, 2027).filter((j) => j.kind === 'check')).toEqual([]);
  });

  it('ticking the first harvest moves crops on to harvesting, and nothing moves back', () => {
    let { g } = withPlanting('tomato', { sownOn: '2027-03-01', stage: 'flowering' });
    const harvest = jobsFor(g, plantOf, 8, 2027).find((j) => j.kind === 'harvest')!;
    g = toggleJob(g, harvest, '2027-08-02', plantOf);
    expect(first(g).stage).toBe('harvesting');
    const out = { key: 'plant-out:tomato:x:2027-05', kind: 'plant-out' as const, plantId: 'tomato', plant: 'Tomato', where: '', plantingIds: [first(g).id] };
    expect(first(toggleJob(g, out, '2027-05-20', plantOf)).stage).toBe('harvesting');
  });
});

describe('schema 4', () => {
  it('turns "growing" into the planted-out stage, keeping dates and cleared plantings', () => {
    const g = migrateGarden(v3) as Garden;
    expect(g.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateGarden(g)).toEqual([]);
    const [tomato, carrot, lettuce] = g.plantings;
    expect(tomato).toMatchObject({ stage: 'transplanted' });
    expect('status' in tomato!).toBe(false);
    expect(currentStage(carrot!)).toBe('sown');
    expect(currentStage(lettuce!)).toBe('cleared');
  });

  it('rejects stages and dates it doesn’t know', () => {
    const { g } = withPlanting('tomato');
    expect(validateGarden({ ...g, plantings: [{ ...first(g), stageDates: { blooming: '2027-06-01' } as never }] }).length).toBe(1);
    expect(validateGarden({ ...g, plantings: [{ ...first(g), sowing: 'sideways' as never }] }).length).toBe(1);
  });
});
