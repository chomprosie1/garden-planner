// Release 52: a first garden, for real. A garden with nowhere to grow is told how
// to start, beds still to be made say so, every kit's plants have somewhere to go,
// and no kit warns about itself.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { firstJob, groupJobs, jobsFor, toggleJob } from '../src/calendar/jobs';
import { howTo } from '../src/content/howto';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { pointInPolygon } from '../src/geometry/polygon';
import { addFeature, duplicateFeature, makeFeature, rectPoints } from '../src/model/features';
import { addNumbered } from '../src/model/listLayout';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { makeSpace, spaceInfo } from '../src/model/spaces';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { bedsToMake, markBedsToMake, needsFirstBed } from '../src/planting/firstBed';
import { applyKit, kitBlurb, KITS } from '../src/planting/kits';
import { addPlanting, asGrown, isActive, makePlanting, unknownPlant } from '../src/planting/place';
import { checkGarden } from '../src/planting/rules';
import { shoppingList } from '../src/planting/shopping';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]).map((p) => asGrown(p, 'close'));
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const known = (id: string) => byId.get(id) ?? null;

const TODAY = '2026-10-29';
const jobsIn = (g: Garden, month = 10) => jobsFor(g, plantOf, month, 2026, { today: TODAY });
const spaceFor = (kit: (typeof KITS)[number], opts = {}) => {
  const [w, d] = spaceInfo(kit.space).size;
  return makeSpace(newGarden(), kit.space, w, d, null, opts);
};

describe('a garden with nowhere to grow is told how to start (Jordan)', () => {
  const boundary = rectPoints({ x: 0, y: 0, w: 4000, h: 6000 });
  it('a boundary and a house, with no lawn drawn, counts as grass', () => {
    const house = makeFeature('building', { area: rectPoints({ x: 0, y: -4000, w: 4000, h: 4000 }) });
    expect(needsFirstBed(addFeature({ ...newGarden(), boundary }, house))).toBe(true);
  });
  it('a lawn still does', () => {
    const lawn = makeFeature('surface', { area: boundary });
    expect(needsFirstBed(addFeature(newGarden(), lawn))).toBe(true);
  });
  it('with somewhere to grow, it isn’t offered', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) });
    expect(needsFirstBed(addFeature({ ...newGarden(), boundary }, bed))).toBe(false);
  });
  it('a paved yard has no grass to make a bed on, but a small patio doesn’t stop a garden', () => {
    const yard = { ...makeFeature('surface', { area: boundary }), material: 'paving' as const };
    expect(needsFirstBed(addFeature({ ...newGarden(), boundary }, yard))).toBe(false);
    const patio = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 2000, h: 1000 }) }), material: 'paving' as const };
    expect(needsFirstBed(addFeature({ ...newGarden(), boundary }, patio))).toBe(true);
  });
  it('nothing drawn at all, it waits', () => {
    expect(needsFirstBed(newGarden())).toBe(false);
  });
  it('the job appears for a bare garden', () => {
    const jobs = jobsIn({ ...newGarden(), boundary });
    expect(jobs.some((j) => j.key.startsWith('check:first-bed:'))).toBe(true);
  });
});

describe('beds still to make (Jordan)', () => {
  const kit = KITS.find((k) => k.id === 'autumn-garden')!;
  const made = applyKit(spaceFor(kit), kit, known, TODAY);
  const g = markBedsToMake(made);

  it('marks the beds, not the border', () => {
    const beds = bedsToMake(g);
    expect(beds.length).toBeGreaterThan(0);
    expect(beds.every((f) => f.kind === 'bed' && f.name !== 'Border')).toBe(true);
  });

  it('each gets a job, with a how-to at its own size', () => {
    const jobs = jobsIn(g).filter((j) => j.key.startsWith('check:make-bed:'));
    expect(jobs).toHaveLength(bedsToMake(g).length);
    expect(jobs[0]!.detail).toMatch(/cardboard/);
    expect(jobs[0]!.detail).toMatch(/bags of 40 litres/);
  });

  it('making a bed comes first: nothing can go in before it', () => {
    expect(jobsIn(g)[0]!.key).toMatch(/^check:make-bed:/);
    expect(groupJobs(jobsIn(g))[0]![0]).toBe('Make');
  });

  it('only beds with something in them, so an allotment isn’t 300 bags of compost', () => {
    const plot = KITS.find((k) => k.id === 'autumn-allotment')!;
    const h = markBedsToMake(applyKit(spaceFor(plot), plot, known, TODAY));
    const empty = h.features.filter((f) => f.kind === 'bed' && !h.plantings.some((p) => p.featureId === f.id));
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((f) => !f.toMake)).toBe(true);
  });

  it('with nothing planned, all its beds', () => {
    const [w, d] = spaceInfo('garden').size;
    const bare = markBedsToMake(makeSpace(newGarden(), 'garden', w, d));
    expect(bedsToMake(bare).length).toBeGreaterThan(0);
  });

  it('the first job is to make it', () => {
    const first = firstJob(g, plantOf, new Date(2026, 9, 29), { today: TODAY })!;
    expect(first.target.type).toBe('feature');
    expect(first.note).toMatch(/make Bed/);
  });

  it('next month’s preview doesn’t say it again', () => {
    expect(jobsIn(g, 11).filter((j) => j.key.startsWith('check:make-bed:'))).toEqual([]);
  });

  it('its how-to is how to make a bed, not a look at the plants', () => {
    const job = jobsIn(g).find((j) => j.key.startsWith('check:make-bed:'))!;
    const how = howTo(job, 'seed');
    expect(how.need.join(' ')).toMatch(/cardboard/i);
    expect(how.steps.join(' ')).not.toMatch(/look at the plants/);
  });

  it('its crops say so', () => {
    const job = jobsIn(g).find((j) => j.plantId === 'garlic' && j.kind === 'sow-direct')!;
    expect(job.where).toMatch(/once it’s made/);
  });

  it('no weeding a bed that isn’t there', () => {
    const jobs = jobsFor(g, plantOf, 10, 2026, { today: TODAY, weeding: true }).filter((j) => j.plantId === '' && j.kind === 'weed');
    for (const j of jobs) for (const f of bedsToMake(g)) expect(j.where).not.toContain(f.name);
  });

  it('the shopping list has its cardboard and compost', () => {
    const items = shoppingList(g, plantOf, TODAY);
    expect(items.some((i) => i.key === 'compost:to-make' && /bags of 40 litres/.test(i.amount ?? ''))).toBe(true);
    expect(items.some((i) => i.key === 'compost:to-make-card' && /box/.test(i.amount ?? ''))).toBe(true);
  });

  it('ticking the job makes the bed, and unticking puts it back', () => {
    const job = jobsIn(g).find((j) => j.key.startsWith('check:make-bed:'))!;
    const done = toggleJob(g, job, TODAY, plantOf);
    expect(done.features.find((f) => f.id === job.featureId)!.toMake).toBeUndefined();
    expect(jobsIn(done).find((j) => j.key === job.key)).toBeDefined();
    const undone = toggleJob(done, job, TODAY, plantOf);
    expect(undone.features.find((f) => f.id === job.featureId)!.toMake).toBe(true);
  });

  it('beds that are there get none of this', () => {
    expect(jobsIn(made).filter((j) => j.key.startsWith('check:make-bed:'))).toEqual([]);
    expect(shoppingList(made, plantOf, TODAY).some((i) => i.key === 'compost:to-make')).toBe(false);
  });
});

describe('beds are numbered when they’re made (Jordan: "Bed and Bed")', () => {
  for (const kit of KITS.filter((k) => k.space === 'garden' || k.space === 'allotment'))
    it(`${kit.id}: no two beds share a name`, () => {
      const g = applyKit(spaceFor(kit), kit, known, TODAY);
      const names = g.features.filter((f) => f.kind === 'bed').map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    });

  it('a bed drawn or copied takes the next number, and the others keep theirs', () => {
    const a = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), name: 'Veg' };
    const b = makeFeature('bed', { area: rectPoints({ x: 2000, y: 0, w: 1200, h: 2400 }) });
    const g = addNumbered(addFeature(newGarden(), a), { ...b, name: 'Veg' });
    expect(g.features.map((f) => f.name)).toEqual(['Veg', 'Veg 2']);
    const [copied] = duplicateFeature(g, a.id);
    expect(copied.features.map((f) => f.name)).toEqual(['Veg', 'Veg 2', 'Veg 3']);
    const third = addNumbered(addNumbered(newGarden(), { ...a, name: undefined }), { ...b, name: undefined });
    expect(third.features.map((f) => f.name)).toEqual(['Bed', 'Bed 2']);
  });

  it('a garden with no kit too', () => {
    const [w, d] = spaceInfo('garden').size;
    const names = makeSpace(newGarden(), 'garden', w, d).features.filter((f) => f.kind === 'bed').map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('no kit leaves its plants homeless (Jordan)', () => {
  const kit = KITS.find((k) => k.id === 'autumn-garden')!;
  const g = applyKit(spaceFor(kit, { border: false }), kit, known, TODAY);
  it('with no border, the bulbs go in pots', () => {
    const planted = new Set(g.plantings.filter(isActive).map((p) => p.plantId));
    for (const id of ['crocus', 'daffodil', 'tulip', 'ornamental-allium']) expect(planted.has(id)).toBe(true);
    const crocus = g.plantings.find((p) => p.plantId === 'crocus')!;
    expect(g.features.find((f) => f.id === crocus.featureId)!.kind).toBe('pot');
  });
  it('and every pot is inside the garden', () => {
    const pots = g.features.filter((f) => f.kind === 'pot');
    expect(pots.length).toBeGreaterThan(0);
    for (const pot of pots) expect(pointInPolygon(pot.circle!.centre, g.boundary)).toBe(true);
  });
  it('no kit’s plants are all left waiting', () => {
    for (const k of KITS) {
      const h = applyKit(spaceFor(k), k, known, TODAY);
      expect(h.plantings.filter(isActive).length).toBeGreaterThan(0);
    }
  });
  it('the kit’s words follow', () => {
    expect(kitBlurb(kit, true)).toMatch(/along the border/);
    expect(kitBlurb(kit, false)).not.toMatch(/border/);
    expect(kitBlurb(kit, false)).toMatch(/in pots/);
  });
});

describe('no kit warns about itself (Priya, Sam)', () => {
  for (const kit of KITS)
    for (const [list, border] of [[false, true], [true, true], [false, false]] as const)
      it(`${kit.id}, as a ${list ? 'list' : 'plan'}${border ? '' : ', no border'}`, () => {
        let g = applyKit(spaceFor(kit, { border }), kit, known, TODAY);
        if (list) g = { ...g, view: 'list' };
        const own = checkGarden(g, plantOf).filter((f) => f.level === 'warn').map((f) => f.message);
        expect(own).toEqual([]);
      });
});

describe('a bed with something to plant keeps it', () => {
  it('a pot that fits is bigger than the kit’s usual one', () => {
    const kit = KITS.find((k) => k.id === 'herb-balcony')!;
    const g = applyKit(spaceFor(kit), kit, known, TODAY);
    const rosemary = g.plantings.find((p) => p.plantId === 'rosemary')!;
    expect(g.features.find((f) => f.id === rosemary.featureId)!.circle!.radiusMm).toBeGreaterThanOrEqual(225);
  });
});

describe('the save format', () => {
  const bed = (name?: string, patch = {}) => ({ ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), ...(name ? { name } : {}), ...patch });
  const migrated = (...features: unknown[]) => {
    const { schemaVersion: _v, ...old } = newGarden();
    return migrateGarden({ ...old, schemaVersion: 24, features }) as Garden;
  };
  it('schema 25: a v23 garden comes through', () => {
    const { schemaVersion: _v, ...old } = newGarden();
    const out = migrateGarden({ ...old, schemaVersion: 23 }) as Garden;
    expect(SCHEMA_VERSION).toBe(26);
    expect(out.schemaVersion).toBe(26);
    expect(validateGarden(JSON.parse(JSON.stringify(out)))).toEqual([]);
  });
  it('saved beds that share a name are numbered (Jordan: "Bed and Bed")', () => {
    expect(migrated(bed(), bed(), bed('Bed')).features.map((f) => f.name)).toEqual(['Bed 1', 'Bed 2', 'Bed 3']);
  });
  it('it steps round a number that’s taken', () => {
    expect(migrated(bed('Veg'), bed('Veg'), bed('Veg 1')).features.map((f) => f.name)).toEqual(['Veg 2', 'Veg 3', 'Veg 1']);
  });
  it('names already different, the border and fruit cages stay as they are', () => {
    const out = migrated(bed('Veg'), bed('Herbs'), bed('Border'), bed('Border '), bed(undefined, { fruitCage: true }), bed(undefined, { fruitCage: true }), bed('Fruit cage', { fruitCage: true }), bed('Fruit cage', { fruitCage: true }));
    expect(out.features.map((f) => f.name)).toEqual(['Veg', 'Herbs', 'Border', 'Border ', undefined, undefined, 'Fruit cage', 'Fruit cage']);
  });
  it('plantings stay in their beds', () => {
    const [a, b] = [bed(), bed()];
    const { schemaVersion: _v, ...old } = newGarden();
    const pl = makePlanting(plantOf('garlic'), b.id, 'single', [600, 600]);
    const out = migrateGarden({ ...old, schemaVersion: 24, features: [a, b], plantings: [pl] }) as Garden;
    expect(out.plantings[0]!.featureId).toBe(b.id);
    expect(out.features.map((f) => f.id)).toEqual([a.id, b.id]);
  });
  it('a bed to make saves', () => {
    const f = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), toMake: true };
    const pl = makePlanting(plantOf('garlic'), f.id, 'single', [600, 600]);
    const g = addPlanting(addFeature(newGarden(), f), pl);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
  });
});
