// Release 46: a fruit cage; beds that rotate and beds that don't (schema 22);
// next year's draft going round only the veg beds, counting this autumn's
// crops as next year's, keeping standing crops' beds, and suggesting a crop to
// follow on.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import varieties from '../data/varieties.json';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, rectPoints } from '../src/model/features';
import { addListBed, listKindOf } from '../src/model/listLayout';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { defaultFill, fillsFor } from '../src/planting/fill';
import { howFull, OVER_FULL, placeInList } from '../src/planting/listPlant';
import { addPlanting, makePlanting, plantCount, unknownPlant } from '../src/planting/place';
import { draftNextYear, rotates, rotationGroup } from '../src/planting/rotation';
import { checkGarden } from '../src/planting/rules';

const library = withVarieties([...vegetables, ...herbs, ...fruit, ...flowers] as Plant[], varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const today = '2026-10-17';

const bedAt = (x: number, name: string, patch: Partial<Feature> = {}, w = 1200, h = 3000): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y: 0, w, h }) }), name, ...patch });
const rowIn = (bed: Feature, id: string, patch: Partial<Planting> = {}): Planting => {
  const [x0] = bed.footprint[0]!;
  return { ...makePlanting(plantOf(id), bed.id, 'row', [x0 + 600, 300], [x0 + 600, 2700]), ...patch };
};
const one = (bed: Feature, id: string, at: [number, number], patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'single', at), ...patch });
const withAll = (features: Feature[], plantings: Planting[]): Garden => plantings.reduce(addPlanting, features.reduce(addFeature, newGarden()));
const grown = (sownOn: string): Partial<Planting> => ({ sownOn, removedOn: '2026-09-30' });
const established: Partial<Planting> = { stage: 'transplanted', stageDates: { transplanted: '2024-11-01' } };

describe('save format 22', () => {
  it('names a border, a flower bed or a fruit cage out of the rotation, and leaves the veg beds alone', () => {
    expect(SCHEMA_VERSION).toBe(22);
    const g = withAll([bedAt(0, 'Border'), bedAt(2000, 'Fruit cage'), bedAt(4000, 'Bed 2'), bedAt(6000, 'Herb bed'), bedAt(8000, 'Cut flowers')], []);
    const migrated = migrateGarden({ ...JSON.parse(JSON.stringify(g)), schemaVersion: 21 }) as Garden;
    expect(migrated.schemaVersion).toBe(22);
    const by = Object.fromEntries(migrated.features.map((f) => [f.name, f]));
    expect(by['Border']!.rotates).toBe(false);
    expect(by['Fruit cage']).toMatchObject({ rotates: false, fruitCage: true });
    expect(by['Bed 2']!.rotates).toBeUndefined();
    expect(by['Herb bed']!.rotates).toBe(false);
    expect(by['Cut flowers']!.rotates).toBe(false);
    expect(validateGarden(migrated)).toEqual([]);
    // Whatever you've set already stays.
    const set = migrateGarden({ ...JSON.parse(JSON.stringify(withAll([bedAt(0, 'Border', { rotates: true })], []))), schemaVersion: 21 }) as Garden;
    expect(set.features[0]!.rotates).toBe(true);
    expect(validateGarden({ ...g, features: g.features.map((f) => ({ ...f, rotates: 'yes' })) } as unknown as Garden).join(' ')).toMatch(/rotates must be true or false/);
    expect(validateGarden({ ...g, features: g.features.map((f) => ({ ...f, fruitCage: 1 })) } as unknown as Garden).join(' ')).toMatch(/fruitCage must be true or false/);
  });
});

describe('beds that rotate and beds that don’t', () => {
  it('a veg bed does; a fruit cage, a border of perennials and flowers, and anything you switch off don’t', () => {
    const veg = bedAt(0, 'Veg');
    const border = bedAt(2000, 'Back');
    const cage = bedAt(4000, 'Soft fruit', { fruitCage: true });
    const off = bedAt(6000, 'Mine', { rotates: false });
    const on = bedAt(8000, 'Cage too', { fruitCage: true, rotates: true });
    const g = withAll([veg, border, cage, off, on], [rowIn(veg, 'carrot', grown('2026-04-01')), one(border, 'lavender', [2600, 500], established), one(border, 'cosmos', [2600, 1500], grown('2026-05-01'))]);
    expect([veg, border, cage, off, on].map((f) => rotates(f, g, plantOf, '2026-01-01'))).toEqual([true, false, false, false, true]);
    // An empty bed goes round, ready for whatever comes.
    expect(rotates(bedAt(10000, 'New'), g, plantOf)).toBe(true);
  });
});

describe('next year’s draft round the real beds', () => {
  it('moves the veg round the veg beds only, never into the fruit cage or the border', () => {
    const a = bedAt(0, 'Bed 1');
    const b = bedAt(2000, 'Bed 2');
    const cage = bedAt(4000, 'Fruit cage', { fruitCage: true }, 3000, 4000);
    const border = bedAt(8000, 'Border', { rotates: false });
    const g = withAll(
      [a, b, cage, border],
      [rowIn(a, 'pea', grown('2026-04-01')), rowIn(b, 'potato', grown('2026-04-01')), one(cage, 'raspberry', [4500, 500], established), one(cage, 'blackcurrant', [6000, 2000], established), rowIn(border, 'leek', grown('2026-04-01'))],
    );
    const draft = draftNextYear(g, plantOf, today);
    expect(draft.beds.map((d) => d.bed.name).sort()).toEqual(['Bed 1', 'Bed 2']);
    expect(draft.items.every((i) => i.next.featureId === a.id || i.next.featureId === b.id)).toBe(true);
    // The border's own leeks stay out of the round too.
    expect(draft.items.some((i) => i.next.plantId === 'leek')).toBe(false);
  });

  it('counts this autumn’s garlic and broad beans, planned with no date, as next year’s where they stand', () => {
    const a = bedAt(0, 'Bed 1');
    const b = bedAt(2000, 'Bed 2');
    const c = bedAt(4000, 'Bed 3');
    // As a kit leaves them: planned, with no date.
    const g = withAll([a, b, c], [rowIn(a, 'garlic'), rowIn(b, 'broad-bean-autumn-sown'), rowIn(c, 'carrot', grown('2026-04-01'))]);
    const draft = draftNextYear(g, plantOf, today);
    const of = (bed: Feature) => draft.beds.find((d) => d.bed.id === bed.id)!;
    expect(of(a).taken?.plantings.map((p) => p.plantId)).toEqual(['garlic']);
    expect(of(b).taken?.plantings.map((p) => p.plantId)).toEqual(['broad-bean-autumn-sown']);
    // Taken until they're lifted next summer, not "free".
    expect(of(a).taken!.until! > '2027-05-01').toBe(true);
    expect(draft.items.filter((i) => !i.leftOut).every((i) => i.next.featureId === c.id)).toBe(true);
  });

  it('keeps a standing crop’s bed until it’s out: what follows goes in after', () => {
    const a = bedAt(0, 'Bed 1');
    const b = bedAt(2000, 'Bed 2');
    // Leeks still in the ground, to be lifted over winter; peas grown and cleared.
    const leeks = rowIn(a, 'leek', { sownOn: '2026-04-01', sowing: 'indoors', stage: 'harvesting', stageDates: { transplanted: '2026-06-15', harvesting: '2026-10-01' } });
    const g = withAll([a, b], [leeks, rowIn(b, 'pea', grown('2026-03-20'))]);
    const draft = draftNextYear(g, plantOf, today);
    const bedA = draft.beds.find((d) => d.bed.id === a.id)!;
    expect(bedA.standing?.plantings.map((p) => p.plantId)).toEqual(['leek']);
    const into = draft.items.filter((i) => i.next.featureId === a.id);
    expect(into.map((i) => i.next.plantId)).toEqual(['pea']);
    expect(into[0]!.next.sowBy! >= bedA.standing!.until).toBe(true);
  });

  it('leaves out only crops that never came up, not ones that came up and grew slowly', () => {
    const a = bedAt(0, 'Bed 1');
    const b = bedAt(2000, 'Bed 2');
    const g = withAll(
      [a, b],
      [
        rowIn(a, 'carrot', { sownOn: '2026-04-01', stage: 'germinated', stageDates: { germinated: '2026-04-25' } }),
        rowIn(b, 'parsnip', { sownOn: '2026-04-01' }),
      ],
    );
    const draft = draftNextYear(g, plantOf, today);
    expect(draft.items.find((i) => i.next.plantId === 'carrot')!.leftOut).toBeUndefined();
    expect(draft.items.find((i) => i.next.plantId === 'parsnip')!.leftOut).toBe('not-up');
  });

  it('suggests a crop to follow on in a bed that’s free by summer', () => {
    const a = bedAt(0, 'Bed 1');
    const b = bedAt(2000, 'Bed 2');
    const g = withAll([a, b], [rowIn(a, 'broad-bean', grown('2026-03-01')), rowIn(b, 'carrot', grown('2026-04-01'))]);
    const draft = draftNextYear(g, plantOf, today);
    // The broad beans move on to a bed of their own next year, out by late summer, with something to follow.
    const beans = draft.beds.find((d) => draft.items.some((i) => i.next.featureId === d.bed.id && i.next.plantId === 'broad-bean'))!;
    expect(beans.after).toBeTruthy();
    expect(beans.after!.from.startsWith('2027-')).toBe(true);
    expect(beans.after!.ideas.length).toBeGreaterThan(0);
    // The cabbage family follows peas and beans; leeks after early crops, or salads, which go anywhere.
    for (const id of beans.after!.ideas) expect(['brassicas', null, 'onions']).toContain(rotationGroup(plantOf(id)));
    expect(beans.after!.ideas.some((id) => rotationGroup(plantOf(id)) === 'brassicas')).toBe(true);
  });
});

describe('a fruit cage', () => {
  it('is a kind you can add from the list, out of the rotation', () => {
    const [g, id] = addListBed({ ...newGarden(), view: 'list' }, 'fruit-cage', '');
    const cage = g.features.find((f) => f.id === id)!;
    expect(cage).toMatchObject({ kind: 'bed', fruitCage: true });
    expect(featureLabel(cage)).toBe('Fruit cage');
    expect(listKindOf(cage)).toBe('fruit-cage');
    expect(rotates(cage, g, plantOf)).toBe(false);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
  });

  it('takes a row of raspberries by the netting and blackcurrants on a grid, with no checks against them', () => {
    let [g, id] = addListBed({ ...newGarden(), view: 'list' }, 'fruit-cage', 'Fruit cage');
    const cage = () => g.features.find((f) => f.id === id)!;
    expect(defaultFill(plantOf('raspberry'), cage())).toBe('row');
    const add = (plantId: string, how: Parameters<typeof placeInList>[3]) => {
      const { plantings } = placeInList(g, cage(), plantOf(plantId), how, plantOf);
      g = { ...g, plantings: [...g.plantings, ...plantings] };
      return plantings;
    };
    const canes = add('raspberry', 'row');
    expect(plantCount(canes[0]!, plantOf('raspberry'))).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < 3; i++) expect(add('blackcurrant', 'one')).toHaveLength(1);
    expect(checkGarden(g, plantOf).filter((f) => f.kind === 'spacing')).toEqual([]);
    expect(howFull(g, cage(), plantOf)).toBeLessThanOrEqual(OVER_FULL);
  });

  it('a patch of ground takes rows and fills, as a bed does; a lawn takes one', () => {
    const patch = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 4000 }) }), material: 'soil' as const };
    const lawn = { ...patch, material: 'lawn' as const };
    expect(fillsFor(plantOf('raspberry'), patch)).toContain('row');
    expect(fillsFor(plantOf('lettuce'), patch)).toContain('fill');
    expect(fillsFor(plantOf('lettuce'), lawn)).toEqual(['one']);
  });
});
