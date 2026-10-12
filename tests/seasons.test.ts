// Release 35: next year and the seasons. Crops belong to the year they're
// picked, the draft lists every bed and replaces itself when used again, what
// grew can be told after the fact, autumn sowings, advice that fits the
// season, and the climate's stations, growing season and frost dates.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { averagesAt, seasonDays } from '../src/climate/warmth';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { lastFrostText } from '../src/lifecycle/shed';
import { stageTips } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { howFull } from '../src/planting/listPlant';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { applyDraft, cropYear, draftNextYear, pastCrop, swapSources } from '../src/planting/rotation';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const today = '2026-10-11';
const bedAt = (x: number, name: string): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y: 0, w: 1200, h: 3000 }) }), name });
const rowIn = (bed: Feature, id: string, patch: Partial<Planting> = {}): Planting => {
  const [x0] = bed.footprint[0]!;
  return { ...makePlanting(plantOf(id), bed.id, 'row', [x0 + 600, 300], [x0 + 600, 2700]), ...patch };
};
const withAll = (features: Feature[], plantings: Planting[], g: Garden = newGarden()) => plantings.reduce(addPlanting, features.reduce(addFeature, g));
const grown = (sownOn: string): Partial<Planting> => ({ sownOn, removedOn: '2026-09-30' });

describe('a crop belongs to the year it’s picked', () => {
  it('counts autumn-planted garlic and overwintering crops as next year’s, and summer crops as this year’s', () => {
    const at = (id: string, sownOn: string) => cropYear({ ...makePlanting(plantOf(id), 'b', 'single', [0, 0]), sownOn }, plantOf(id));
    expect(at('garlic', '2026-10-05')).toBe(2027);
    expect(at('broad-bean-autumn-sown', '2026-11-01')).toBe(2027);
    expect(at('onion-overwintering', '2026-09-20')).toBe(2027);
    expect(at('sprouting-broccoli', '2026-04-15')).toBe(2027);
    expect(at('leek', '2026-04-01')).toBe(2026);
    expect(at('potato', '2026-04-01')).toBe(2026);
    expect(at('radish', '2026-09-15')).toBe(2026);
  });

  it('keeps a bed with garlic in it out of next year’s draft until it’s lifted, and moves this summer’s crops elsewhere', () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B'), bedAt(4000, 'C'), bedAt(6000, 'D')];
    const [a, b, c] = beds as [Feature, Feature, Feature, Feature];
    // A grew potatoes, then had garlic planted after them; D is empty.
    const pls = [rowIn(a, 'potato', grown('2026-04-01')), rowIn(a, 'garlic', { sownOn: '2026-10-05', sowing: 'direct' }), rowIn(b, 'pea', grown('2026-04-12')), rowIn(c, 'cabbage', grown('2026-04-20'))];
    const draft = draftNextYear(withAll(beds, pls), plantOf, today);
    expect(draft.items.map((i) => i.next.plantId).sort()).toEqual(['cabbage', 'pea', 'potato']);
    const bedA = draft.beds.find((x) => x.bed.id === a.id)!;
    expect(bedA.taken?.plantings.map((p) => p.plantId)).toEqual(['garlic']);
    expect(bedA.taken!.until! >= '2027-07-01').toBe(true);
    expect(bedA.next).toBe('onions');
    // Nothing new goes into A; with the empty bed free, nothing's left out.
    expect(draft.items.some((i) => i.next.featureId === a.id)).toBe(false);
    expect(draft.items.every((i) => !i.leftOut)).toBe(true);
  });

  it('swaps two beds’ crops rather than send one to a taken bed', () => {
    const beds = [bedAt(0, 'Bed 1'), bedAt(2000, 'Bed 2'), bedAt(4000, 'Bed 3')];
    const [one, two, three] = beds as [Feature, Feature, Feature];
    // Bed 1 had nothing recorded this year, and now has garlic in: two crops, two free beds.
    const pls = [rowIn(one, 'garlic', { sownOn: '2026-10-05', sowing: 'direct' }), rowIn(two, 'pea', grown('2026-04-12')), rowIn(three, 'cabbage', grown('2026-04-20'))];
    const draft = draftNextYear(withAll(beds, pls), plantOf, today);
    expect(draft.items.every((i) => !i.leftOut)).toBe(true);
    expect(Object.fromEntries(draft.items.map((i) => [i.next.plantId, i.next.featureId]))).toEqual({ pea: three.id, cabbage: two.id });
  });

  it('leaves a crop out, saying why, when the only bed for it is taken', () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B')];
    const [a, b] = beds as [Feature, Feature];
    const pls = [rowIn(a, 'potato', grown('2026-04-01')), rowIn(a, 'garlic', { sownOn: '2026-10-05', sowing: 'direct' }), rowIn(b, 'pea', grown('2026-04-12'))];
    const draft = draftNextYear(withAll(beds, pls), plantOf, today);
    const going = draft.items.filter((i) => !i.leftOut);
    expect(going).toHaveLength(1);
    expect(going[0]!.next.featureId).toBe(b.id);
    expect(draft.items.filter((i) => i.leftOut === 'taken')).toHaveLength(1);
  });

  it('counts what’s in a bed over winter together with what’s planned after it, not the larger of the two', () => {
    const bed = bedAt(0, 'A');
    const garlic = rowIn(bed, 'garlic', { sownOn: '2026-10-05', sowing: 'direct' });
    const peas = { ...rowIn(bed, 'pea', { sowBy: '2027-04-12' }), x: 900, endPoint: [900, 2700] as [number, number] };
    const beans = rowIn(bed, 'runner-bean', { sownOn: '2026-05-20', sowing: 'direct' as const, stage: 'harvesting' as const, stageDates: { harvesting: '2026-08-01' } });
    const full = (...pls: Planting[]) => howFull(withAll([bed], pls), bed, plantOf);
    expect(full(garlic, peas)).toBeCloseTo(full(garlic) + full(peas), 5);
    // Runner beans are out by November, so next April's peas don't add to them.
    expect(full(beans, peas)).toBeCloseTo(Math.max(full(beans), full(peas)), 5);
  });
});

describe('the draft', () => {
  const four = () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B'), bedAt(4000, 'C'), bedAt(6000, 'D')];
    const [a, b, c, d] = beds as [Feature, Feature, Feature, Feature];
    const pls = [rowIn(a, 'potato', grown('2026-04-01')), rowIn(b, 'pea', grown('2026-04-12')), rowIn(c, 'cabbage', grown('2026-04-20')), rowIn(d, 'carrot', grown('2026-05-02'))];
    return { g: withAll(beds, pls), beds };
  };

  it('replaces the first use when it’s used again after changing which bed takes which crops', () => {
    const { g, beds } = four();
    const first = draftNextYear(g, plantOf, today);
    const once = applyDraft(g, first.items.map((i) => i.next), first.year);
    const changed = draftNextYear(once, plantOf, today, null, swapSources(first, beds[0]!.id, beds[1]!.id));
    expect(changed.replaces).toBe(4);
    const twice = applyDraft(once, changed.items.filter((i) => !i.leftOut).map((i) => i.next), changed.year);
    const planned = twice.plantings.filter((p) => p.draft === 2027);
    expect(planned.map((p) => p.plantId).sort()).toEqual(['cabbage', 'carrot', 'pea', 'potato']);
    expect(planned.find((p) => p.plantId === 'pea')!.featureId).toBe(beds[0]!.id);
    expect(validateGarden(JSON.parse(JSON.stringify(twice)))).toEqual([]);
  });

  it('keeps a draft planting you’ve already sown, and doesn’t plan it twice', () => {
    const { g } = four();
    const first = draftNextYear(g, plantOf, today);
    const once = applyDraft(g, first.items.map((i) => i.next), first.year);
    const sown = { ...once, plantings: once.plantings.map((p) => (p.draft && p.plantId === 'pea' ? { ...p, sownOn: '2027-04-12' } : p)) };
    const again = draftNextYear(sown, plantOf, '2026-10-12');
    expect(again.items.find((i) => i.next.plantId === 'pea')!.leftOut).toBe('planned');
    const twice = applyDraft(sown, again.items.filter((i) => !i.leftOut).map((i) => i.next), again.year);
    expect(twice.plantings.filter((p) => p.draft === 2027 && p.plantId === 'pea')).toHaveLength(1);
    expect(twice.plantings.filter((p) => p.draft === 2027)).toHaveLength(4);
  });

  it('lists every bed and patch of ground, with or without crops, but not lawns, pots or anything under glass', () => {
    const { g, beds } = four();
    const empty = bedAt(8000, 'E');
    const soil: Feature = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 4000, w: 3000, h: 2000 }) }), material: 'soil', name: 'Patch' };
    const lawn: Feature = { ...makeFeature('surface', { area: rectPoints({ x: 4000, y: 4000, w: 3000, h: 2000 }) }), name: 'Lawn' };
    const pot: Feature = { ...makeFeature('pot', { circle: { centre: [9000, 5000], radiusMm: 200 } }), name: 'Pot' };
    const house: Feature = { ...makeFeature('greenhouse', { area: rectPoints({ x: 12000, y: 0, w: 2400, h: 3000 }) }), name: 'Greenhouse' };
    const under: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 12200, y: 200, w: 800, h: 2000 }) }), name: 'Border' };
    const draft = draftNextYear(withAll([empty, soil, lawn, pot, house, under], [], g), plantOf, today);
    expect(draft.beds.map((b) => b.bed.name).sort()).toEqual([...beds.map((b) => b.name), 'E', 'Patch'].sort());
    // The empty ones take crops too: five beds for four crops, none the same group again.
    expect(new Set(draft.items.map((i) => i.next.featureId)).size).toBe(4);
    for (const b of draft.beds) if (b.was && b.next) expect(b.was).not.toBe(b.next);
  });

  it('says why something in a bed stays put', () => {
    const bed = bedAt(0, 'A');
    const pls = [
      { ...makePlanting(plantOf('rhubarb'), bed.id, 'single', [300, 300]), stage: 'transplanted' as const, stageDates: { transplanted: '2025-03-01' } },
      rowIn(bed, 'carrot', { sowBy: '2026-04-15' }),
      { ...rowIn(bed, 'beetroot'), stage: 'germinated' as const },
    ];
    const draft = draftNextYear(withAll([bed], pls), plantOf, today);
    expect(Object.fromEntries(draft.beds[0]!.stays.map((s) => [s.planting.plantId, s.why]))).toEqual({ rhubarb: 'perennial', carrot: 'not-sown', beetroot: 'no-date' });
    expect(draft.items).toEqual([]);
  });

  it('takes what grew this summer when told after the fact, and moves it on', () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B')];
    const [a, b] = beds as [Feature, Feature];
    const potatoes = pastCrop(plantOf('potato'), a, 2026, today);
    const garlic = pastCrop(plantOf('garlic'), b, 2026, today);
    expect(cropYear(potatoes, plantOf('potato'))).toBe(2026);
    expect(cropYear(garlic, plantOf('garlic'))).toBe(2026);
    expect(garlic.sownOn!.startsWith('2025-')).toBe(true);
    for (const p of [potatoes, garlic]) expect(p.removedOn! <= today).toBe(true);
    const g = withAll(beds, [potatoes, garlic]);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    const draft = draftNextYear(g, plantOf, today);
    const where = Object.fromEntries(draft.items.map((i) => [i.next.plantId, i.next.featureId]));
    expect(where).toEqual({ potato: b.id, garlic: a.id });
    expect(draft.items.every((i) => !i.leftOut)).toBe(true);
  });
});

describe('autumn and early sowings', () => {
  const windows = (id: string) => plantOf(id).sowing!.map((s) => [s.method, s.months]);
  it('has hardy peas, winter salads under glass, broad beans in root trainers and sweet peas in a cold frame', () => {
    expect(windows('pea-hardy')).toEqual([['direct', [10, 11]]]);
    expect(cropYear({ ...makePlanting(plantOf('pea-hardy'), 'b', 'single', [0, 0]), sownOn: '2026-10-20' }, plantOf('pea-hardy'))).toBe(2027);
    expect(windows('lettuce-winter')).toEqual([['indoors', [9, 10]]]);
    expect(plantOf('lettuce-winter').plantOutMonths).toEqual([10, 11]);
    for (const id of ['winter-purslane', 'corn-salad']) expect(windows(id)).toContainEqual(['indoors', [9, 10]]);
    const beans = plantOf('broad-bean-autumn-sown');
    expect(beans.sowing!.find((s) => s.method === 'cold-frame')!.notes).toMatch(/root trainers/);
    expect(beans.plantOutMonths).toEqual([2, 3]);
    expect(windows('sweet-pea')).toEqual([
      ['cold-frame', [10, 11]],
      ['indoors', [2, 3]],
    ]);
  });

  it('sows hardy annuals in autumn as a window of its own', () => {
    for (const id of ['calendula', 'cornflower', 'nigella', 'ammi', 'larkspur', 'california-poppy', 'field-poppy', 'corncockle', 'poached-egg-plant']) {
      const autumn = plantOf(id).sowing!.find((s) => s.months.includes(9))!;
      expect(autumn.months, id).toEqual([9, 10]);
      expect(plantOf(id).sowing!.find((s) => s.months.includes(3))!.months.includes(9), id).toBe(false);
    }
  });
});

describe('advice that fits the season', () => {
  const tomato = plantOf('tomato');
  const planted = { ...makePlanting(tomato, 'b', 'single', [0, 0]), sownOn: '2026-03-01', sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { transplanted: '2026-10-11' } };

  it('gives a tomato outside in October no fleece or feeding, but what to do before the frost', () => {
    const tips = stageTips(tomato, 'transplanted', planted, 10).join(' ');
    expect(tips).not.toMatch(/fleece|feed/i);
    expect(tips).toMatch(/first frost/);
    expect(stageTips(tomato, 'flowering', planted, 10).join(' ')).not.toMatch(/every week|feed/i);
    expect(stageTips(tomato, 'harvesting', planted, 12).join(' ')).toMatch(/finished it/);
  });

  it('still feeds in summer, and under glass in October it isn’t the frost’s yet', () => {
    expect(stageTips(tomato, 'flowering', planted, 7).join(' ')).toMatch(/Feeding/);
    expect(stageTips(tomato, 'flowering', planted, 10, true).join(' ')).not.toMatch(/first frost/);
  });

  it('keeps the fleece for spring planting', () => {
    const hardy = library.find((p) => p.category === 'vegetable' && /^hardy/i.test(p.conditions.hardiness ?? '') && p.sowing?.[0]?.method === 'indoors' && !p.stageTips?.transplanted)!;
    const pl = { ...makePlanting(hardy, 'b', 'single', [0, 0]), sowing: 'indoors' as const };
    expect(stageTips(hardy, 'transplanted', pl, 5).join(' ')).toMatch(/fleece/);
    expect(stageTips(hardy, 'transplanted', pl, 9).join(' ')).not.toMatch(/fleece/);
  });
});

describe('the climate, checked', () => {
  it('uses Shawbury for Shropshire, not the Welsh coast', () => {
    const sy5 = averagesAt(52.65, -2.85);
    expect(sy5.stations[0]!.name).toBe('Shawbury');
    expect(sy5.stations.map((s) => s.name)).not.toContain('Aberporth');
  });

  it('gives a growing season the UK would recognise: never all year, longest on the far south-west coast', () => {
    const at = (lat: number, lon: number) => seasonDays(averagesAt(lat, lon));
    const [cornwall, bristol, shropshire, leeds, inverness] = [at(50.12, -5.54), at(51.45, -2.59), at(52.65, -2.85), at(53.8, -1.55), at(57.48, -4.22)];
    for (const d of [cornwall, bristol, shropshire, leeds, inverness]) expect(d).toBeGreaterThan(250), expect(d).toBeLessThan(345);
    expect(cornwall).toBeGreaterThan(bristol);
    expect(bristol).toBeGreaterThan(shropshire);
    expect(shropshire).toBeGreaterThan(inverness);
  });

  it('says the last frost is 50:50, and when to play safe', () => {
    expect(lastFrostText('05-03')).toBe('Last frost: 50:50 by about 3 May; play safe until about 17 May.');
  });
});

describe('save format 21', () => {
  it('checks a draft’s year, and brings schema 20 up to date', () => {
    expect(SCHEMA_VERSION).toBe(21);
    const bed = bedAt(0, 'A');
    const g = withAll([bed], [{ ...rowIn(bed, 'pea', { sowBy: '2027-04-12' }), draft: 2027 }]);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    expect(validateGarden({ ...g, plantings: g.plantings.map((p) => ({ ...p, draft: 'next' })) }).join(' ')).toMatch(/draft must be a year/);
    const migrated = migrateGarden({ ...newGarden(), schemaVersion: 20 }) as Garden;
    expect(migrated.schemaVersion).toBe(21);
    expect(validateGarden(migrated)).toEqual([]);
  });
});
