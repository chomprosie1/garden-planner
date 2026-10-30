// Release 56: fruit and perennials resting in winter, jobs for what's settled in,
// planted years ago, tulips from October, a tree's own how-to, one story for
// overwintering onions, and a rotation that sees each crop.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { careFor } from '../src/calendar/care';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { howTo } from '../src/content/howto';
import { generalJobs } from '../src/content/seasons';
import { canSowIn, withVarieties } from '../src/library/library';
import { restingNow, stageNow, stageTips } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { canSowInBatches } from '../src/planting/batches';
import { addPlanting, inGroundOptions, makePlanting } from '../src/planting/place';
import { draftNextYear, pastCrop, rotationGroup } from '../src/planting/rotation';

const DIR = join(__dirname, '..', 'data', 'plants');
const species: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const plants = withVarieties(species, JSON.parse(readFileSync(join(__dirname, '..', 'data', 'varieties.json'), 'utf8')));
const byId = new Map(plants.map((p) => [p.id, p]));
const plantOf = (id: string): Plant => byId.get(id)!;

const bedAt = (x: number, name: string, w = 1200, h = 3000): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y: 0, w, h }) }), name });
const settled = (id: string, f: Feature, went = '2024-03-01'): Planting => ({ ...makePlanting(plantOf(id), f.id, 'single', [f.footprint[0]![0] + 300, 500]), stage: 'vegetative', stageDates: { transplanted: went } });
const withAll = (features: Feature[], plantings: Planting[]): Garden => plantings.reduce(addPlanting, features.reduce(addFeature, newGarden()));
const careJobs = (g: Garden, month: number, year = 2027) => jobsFor(g, plantOf, month, year, { today: `${year}-${String(month).padStart(2, '0')}-10` }).filter((j) => j.care);

describe('resting', () => {
  it('shows fruit and perennials resting in winter, and not evergreens or crops', () => {
    expect(restingNow(plantOf('blackcurrant'), 'vegetative', 12)).toBe(true);
    expect(restingNow(plantOf('blackcurrant'), 'harvesting', 1)).toBe(true);
    expect(restingNow(plantOf('blackcurrant'), 'vegetative', 6)).toBe(false);
    expect(restingNow(plantOf('strawberry'), 'vegetative', 12)).toBe(false);
    expect(restingNow(plantOf('kale'), 'vegetative', 12)).toBe(false);
    expect(restingNow(plantOf('blackcurrant'), 'transplanted', 12)).toBe(false);
    expect(stageNow(plantOf('blackcurrant'), 'vegetative', undefined, '2026-12-05')).toBe('Resting');
    expect(stageNow(plantOf('blackcurrant'), 'vegetative', undefined, '2026-06-05')).toBe('Growing');
  });
});

describe('looking after what’s settled in', () => {
  const b = bedAt(0, 'Fruit');

  it('prunes a blackcurrant in winter, once, and not one planted last month', () => {
    const g = withAll([b], [settled('blackcurrant', b)]);
    const [job] = careJobs(g, 12, 2026);
    expect(job!.verb).toBe('Prune');
    expect(job!.detail).toMatch(/up to a third/);
    expect(howTo(job!, 'plants').need.join(' ')).toMatch(/secateurs/);
    const done = toggleJob(g, job!, '2026-12-10');
    expect(careJobs(done, 1)).toEqual([]);
    expect(careJobs(withAll([b], [settled('blackcurrant', b, '2026-11-10')]), 12, 2026)).toEqual([]);
  });

  it('gives each fruit its own time', () => {
    expect(careFor(plantOf('gooseberry'), 2)).toHaveLength(1);
    expect(careFor(plantOf('gooseberry'), 12)).toHaveLength(0);
    expect(careFor(plantOf('redcurrant'), 2)).toHaveLength(1);
    expect(careFor(plantOf('apple'), 1)).toHaveLength(1);
    expect(careFor(plantOf('apple'), 7)).toHaveLength(0);
    expect(careFor(plantOf('plum'), 1)).toHaveLength(0);
  });

  it('cuts back summer strawberries, not everbearers', () => {
    expect(careFor(plantOf('strawberry'), 8)[0]!.text).toMatch(/10 cm/);
    expect(careFor(plantOf('strawberry-summer-fruiting'), 8)).toHaveLength(1);
    expect(careFor(plantOf('strawberry-everbearer'), 8)).toEqual([]);
    expect(careFor(plantOf('strawberry-everbearer'), 10)[0]!.text).toMatch(/no need to cut it back/);
    const g = withAll([b], [settled('strawberry', b)]);
    expect(careJobs(g, 8).map((j) => j.verb)).toEqual(['Tidy']);
    expect(careJobs(g, 10).map((j) => j.verb)).toEqual(['Tidy']);
  });

  it('keeps both strawberry jobs apart when one’s ticked', () => {
    const g = withAll([b], [settled('strawberry', b)]);
    const done = toggleJob(g, careJobs(g, 8)[0]!, '2027-08-10');
    expect(careJobs(done, 10)).toHaveLength(1);
  });

  it('trims herbs after they flower, and doesn’t cut them in autumn', () => {
    for (const id of ['rosemary', 'thyme', 'chives']) {
      const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => careFor(plantOf(id), m).length);
      expect(months.length, id).toBeGreaterThan(0);
      expect(months.every((m) => m >= 4 && m <= 9), id).toBe(true);
    }
    expect(stageTips(plantOf('rosemary'), 'vegetative', undefined, 11).join(' ')).toMatch(/Leave it be/);
  });

  it('says a general pruning job once, by the plant’s own job', () => {
    const g = withAll([b], [settled('blackcurrant', b), settled('apple', bedAt(3000, 'Tree'))]);
    expect(generalJobs(1, g, (id) => byId.get(id) ?? null).map((j) => j.text).join(' ')).not.toMatch(/Prune/);
  });
});

describe('planted years ago', () => {
  it('offers two and three years ago', () => {
    const options = inGroundOptions('2026-10-20');
    expect(options.find((o) => o.label === 'Two years ago')!.date).toBe('2024-10-01');
    expect(options.find((o) => o.label === 'Three years ago or more')!.date).toBe('2023-10-01');
  });
});

describe('the plant pages', () => {
  it('has tulips to plant from October', () => {
    expect(canSowIn(plantOf('tulip'), 10)).toBe(true);
    expect(canSowIn(plantOf('tulip'), 9)).toBe(false);
  });

  it('tells one story for overwintering onions', () => {
    const o = plantOf('onion-overwintering');
    expect(o.wintering).toMatchObject({ type: 'hardy' });
    expect(JSON.stringify(o.feeding)).not.toMatch(/bolting/);
    expect(JSON.stringify(o.sowing)).not.toMatch(/late summer/);
  });

  it('says the same about white rot wherever it comes up', () => {
    const said = new Set(plants.flatMap((p) => (p.pests ?? []).filter((x) => x.name === 'Onion white rot').map((x) => x.control)));
    expect(said.size).toBe(1);
    expect([...said][0]).toMatch(/15 years/);
  });

  it('gives a tree’s fruit its own how-to', () => {
    const job = { key: 'harvest:apple:b:2026-09', kind: 'harvest' as const, plantId: 'apple', plant: 'Apple', where: 'in Bed', plantingIds: [] };
    const steps = howTo(job, 'plants', false, { plant: plantOf('apple'), month: 9, style: 'close' }).steps.join(' ');
    expect(steps).toMatch(/slight twist/);
    expect(steps).not.toMatch(/soft fruit/i);
  });

  it('doesn’t offer batches of autumn broad beans, and does of lettuce', () => {
    const b = bedAt(0, 'A');
    const row = (id: string) => makePlanting(plantOf(id), b.id, 'row', [600, 300], [600, 2700]);
    expect(canSowInBatches(plantOf('broad-bean-autumn-sown'), row('broad-bean-autumn-sown'))).toBe(false);
    expect(canSowInBatches(plantOf('lettuce'), row('lettuce'))).toBe(true);
  });
});

describe('a rotation that sees each crop', () => {
  const today = '2026-10-29';
  const crop = (bed: Feature, id: string, x: number, sownOn: string): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [bed.footprint[0]![0] + x, 300], [bed.footprint[0]![0] + x, 2700]), sownOn, removedOn: '2026-09-30' });

  it('knows kale from leeks in one bed', () => {
    const [a, b, c, d] = [bedAt(0, 'A'), bedAt(2000, 'B'), bedAt(4000, 'C'), bedAt(6000, 'D')];
    const g = withAll([a, b, c, d], [crop(a, 'pea', 600, '2026-04-01'), crop(b, 'kale', 300, '2026-04-01'), crop(b, 'leek', 900, '2026-04-01'), crop(c, 'potato', 600, '2026-04-01'), crop(d, 'carrot', 600, '2026-04-01')]);
    const draft = draftNextYear(g, plantOf, today);
    const bedB = draft.beds.find((x) => x.bed.id === b.id)!;
    expect(new Set(bedB.wasAll)).toEqual(new Set(['brassicas', 'onions']));
    // Nothing follows itself: neither crop lands where its own group grew.
    for (const i of draft.items) {
      const group = rotationGroup(plantOf(i.next.plantId));
      const grew = draft.beds.find((x) => x.bed.id === i.next.featureId)!.wasAll;
      if (group === 'brassicas') expect(grew).not.toContain('brassicas');
      if (group === 'onions') expect(grew).not.toContain('onions');
    }
  });

  it('takes what you say grew in a bed into account', () => {
    const [a, b, c, d] = [bedAt(0, 'A'), bedAt(2000, 'B'), bedAt(4000, 'C'), bedAt(6000, 'D')];
    const g = withAll([a, b, c, d], [crop(a, 'pea', 600, '2026-04-01'), crop(b, 'kale', 300, '2026-04-01'), crop(b, 'leek', 900, '2026-04-01')]);
    const before = draftNextYear(g, plantOf, today);
    const told = [pastCrop(plantOf('potato'), c, 2026, today), pastCrop(plantOf('kale'), d, 2026, today)].reduce(addPlanting, g);
    const after = draftNextYear(told, plantOf, today);
    expect(after.items.length).toBeGreaterThan(before.items.length);
    expect(after.beds.find((x) => x.bed.id === d.id)!.wasAll).toEqual(['brassicas']);
    // The kale from bed B doesn't go to the bed you said had kale.
    const kale = after.items.filter((i) => i.was.featureId === b.id && i.was.plantId === 'kale');
    expect(kale.map((i) => i.next.featureId)).not.toContain(d.id);
  });
});
