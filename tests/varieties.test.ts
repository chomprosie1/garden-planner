// Release 15: 500 plants, varieties and the seed tin. The bigger library (every
// plant valid, with a family and its value to pollinators), varieties that take
// everything from their plant but what they change, the kitchen for varieties,
// and the seed tin.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varietyData from '../data/varieties.json';
import { drawPlant, stageLook } from '../src/art/plants';
import { drawPlantSide } from '../src/art/side';
import { jobsFor } from '../src/calendar/jobs';
import { KITCHEN } from '../src/kitchen/data';
import { cropOf, croppingNow, harvestWorth } from '../src/kitchen/recipes';
import { emptyFilter, filterPlants, isVariety, mergeVariety, varietiesOf, withVarieties, type VarietyEntry } from '../src/library/library';
import { pathFor } from '../src/lifecycle/stages';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden, validatePlant } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { addPacket, makePacket, packetDetail, packetsFor, removePacket, seedPrice, seedState, updatePacket, useSeeds } from '../src/planting/seeds';
import { photoIds } from '../src/storage/photos';

const DIR = join(__dirname, '..', 'data', 'plants');
const species: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const varieties = varietyData as VarietyEntry[];
const library = withVarieties(species, varieties);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const P = (id: string) => byId.get(id)!;

describe('the bigger library', () => {
  it('has 500 or so plants besides the weeds, and fifty more of each kind', () => {
    const grown = species.filter((p) => p.category !== 'weed');
    expect(grown.length).toBeGreaterThanOrEqual(500);
    const count = (c: Plant['category']) => species.filter((p) => p.category === c).length;
    expect(count('vegetable')).toBeGreaterThanOrEqual(130);
    expect(count('herb')).toBeGreaterThanOrEqual(75);
    expect(count('fruit')).toBeGreaterThanOrEqual(75);
    expect(count('flower')).toBeGreaterThanOrEqual(125);
    expect(count('shrub')).toBeGreaterThanOrEqual(80);
  });

  it('gives every plant a botanical family and its value to pollinators', () => {
    for (const p of species) {
      expect(p.family, p.id).toMatch(/^[A-Z][a-z]+aceae$/);
      expect(p.pollinators, p.id).toBeDefined();
      if (p.pollinators!.rating !== 'none') {
        expect(p.pollinators!.visitors!.length, p.id).toBeGreaterThan(0);
        expect(p.pollinators!.months!.length, p.id).toBeGreaterThan(0);
      }
    }
    // The families crop rotation needs are there.
    expect(P('cabbage').family).toBe('Brassicaceae');
    expect(P('potato').family).toBe('Solanaceae');
    expect(P('broad-bean').family).toBe('Fabaceae');
    expect(P('onion').family).toBe('Amaryllidaceae');
    expect(P('carrot').family).toBe('Apiaceae');
    expect(P('courgette').family).toBe('Cucurbitaceae');
    // Bee plants, and crops picked before they flower.
    expect(P('phacelia').pollinators!.rating).toBe('good');
    expect(P('lavender').pollinators!.rating).not.toBe('none');
    expect(P('lettuce').pollinators!.rating).toBe('none');
  });

  it('refuses a made-up family or pollinator', () => {
    const tomato = P('tomato');
    expect(validatePlant({ ...tomato, family: 'nightshades' })).toHaveLength(1);
    expect(validatePlant({ ...tomato, pollinators: { rating: 'great' } as never })).toHaveLength(1);
    expect(validatePlant({ ...tomato, pollinators: { rating: 'good', visitors: ['wasps'], months: [6] } as never })).toHaveLength(1);
    expect(validatePlant({ ...tomato, pollinators: { rating: 'good' } })).toHaveLength(1);
  });
});

describe('varieties', () => {
  it('has three to six kinds for each of 25 crops, all valid and drawable', () => {
    const parents = new Set(varieties.map((v) => v.varietyOf));
    expect(parents.size).toBeGreaterThanOrEqual(25);
    for (const id of parents) {
      expect(byId.has(id), id).toBe(true);
      const n = varietiesOf(library, id).length;
      expect(n >= 2 && n <= 6, `${id}: ${n}`).toBe(true);
    }
    expect(new Set(library.map((p) => p.id)).size).toBe(library.length);
    for (const v of library.filter(isVariety)) {
      expect(validatePlant(v), v.id).toEqual([]);
      expect(v.verified).toBe(false);
      for (const s of ['planned', ...pathFor(v)] as const) {
        expect(() => drawPlant(fakeCtx(), { art: v.art!, look: stageLook(s, v), r: 20, paint: { style: 'wash', mode: 'light', ink: '#333333', paper: '#ffffff', soil: '#7a5a40' }, seed: 1 })).not.toThrow();
        expect(() => drawPlantSide(fakeCtx(), { art: v.art!, look: stageLook(s, v), w: 100, h: 140, seed: 1 })).not.toThrow();
      }
    }
  });

  it('takes everything from its plant but what it changes', () => {
    const tomato = P('tomato');
    const cherry = P('tomato-cherry');
    expect(cherry).toMatchObject({ varietyOf: 'tomato', variety: 'Cherry', commonName: 'Tomato, cherry', latinName: tomato.latinName, category: 'vegetable' });
    expect(cherry.sowing).toEqual(tomato.sowing);
    expect(cherry.feeding).toEqual(tomato.feeding);
    expect(cherry.companions).toEqual(tomato.companions);
    expect(cherry.growth).toEqual({ ...tomato.growth, days: [50, 70] });
    expect(cherry.art).toEqual({ ...tomato.art, crop: { kind: 'fruit', colour: '#e0402a' } });
  });

  it('merges a level deep: a bush tomato keeps its plant’s other stage advice, a maincrop potato its spread', () => {
    const bush = P('tomato-bush');
    expect(bush.stageTips!.vegetative![0]).toMatch(/no pinching out/);
    expect(bush.stageTips!.flowering).toEqual(P('tomato').stageTips!.flowering);
    expect(bush.size.heightMm).toBe(600);
    const main = P('potato-maincrop');
    expect(main.size.spreadMm).toBe(P('potato').size.spreadMm);
    expect(main.size.spacingMm).toBe(400);
    expect(main.cropping!.harvestMonths).toEqual([9, 10]);
  });

  it('leaves out a variety of a plant that isn’t there, and never changes the plant itself', () => {
    const before = JSON.stringify(P('tomato'));
    expect(withVarieties(species, [{ id: 'ghost-blue', varietyOf: 'ghost', variety: 'Blue', commonName: 'Ghost, blue' }]).length).toBe(species.length);
    mergeVariety(P('tomato'), { id: 'x', varietyOf: 'tomato', variety: 'X', commonName: 'X', size: { heightMm: 1 } });
    expect(JSON.stringify(P('tomato'))).toBe(before);
  });

  it('is kept out of the plain list, but found by name', () => {
    const all = filterPlants(library, emptyFilter);
    expect(all.some(isVariety)).toBe(false);
    expect(filterPlants(library, { ...emptyFilter, query: 'cherry tomato' }).map((p) => p.id)).toContain('tomato-cherry');
    expect(filterPlants(library, { ...emptyFilter, query: 'first early' }).map((p) => p.id)).toEqual(['potato-first-early']);
  });

  it('gets its own jobs from its own months', () => {
    const { g: g0, bed } = garden();
    const g = put(g0, bed, 'potato-first-early');
    expect(jobsFor(g, plantOf, 3, 2027).map((j) => `${j.kind} ${j.plantId}`)).toEqual(['sow-direct potato-first-early']);
    expect(jobsFor(g, plantOf, 5, 2027)).toEqual([]);
  });

  it('uses its plant’s kitchen notes and recipes, and its price', () => {
    expect(cropOf(KITCHEN, 'tomato-cherry', plantOf)).toBe('tomato');
    expect(cropOf(KITCHEN, 'tomato-cherry')).toBeNull();
    const { g: g0, bed } = garden();
    const g = put(g0, bed, 'tomato-cherry', { picks: [{ date: '2027-08-10', grams: 1000 }] });
    expect(croppingNow(g, plantOf, KITCHEN, '2027-08-12')).toEqual(['tomato']);
    expect(harvestWorth(g, KITCHEN, 2027, plantOf).pounds).toBe(KITCHEN.crops.tomato!.kg);
  });
});

describe('the seed tin', () => {
  const today = '2026-10-08';
  it('adds, changes and throws out packets', () => {
    let g = newAppState().garden;
    const k = makePacket('tomato-cherry', today, { name: 'Sungold', count: 20, sowBy: '2027-12', price: 2.5 });
    g = addPacket(g, k);
    expect(g.seeds).toHaveLength(1);
    g = updatePacket(g, k.id, { count: 12, name: '' });
    expect(g.seeds![0]).toMatchObject({ count: 12, sowBy: '2027-12' });
    expect(g.seeds![0]!.name).toBeUndefined();
    g = removePacket(g, k.id);
    expect(g.seeds).toEqual([]);
  });

  it('counts a packet of a variety as seed for its plant, and the other way round', () => {
    let g = newAppState().garden;
    g = addPacket(g, makePacket('tomato-cherry', today, { count: 20, price: 2.5 }));
    g = addPacket(g, makePacket('tomato', today, { price: 1.99 }));
    g = addPacket(g, makePacket('carrot', today, { count: 0 }));
    expect(packetsFor(g, P('tomato'), plantOf)).toHaveLength(2);
    expect(packetsFor(g, P('tomato-beefsteak'), plantOf)).toHaveLength(2);
    expect(packetsFor(g, P('carrot'), plantOf)).toEqual([]); // none left
    expect(seedPrice(g, P('tomato'), plantOf)).toBe(1.99);
    expect(seedPrice(g, P('lettuce'), plantOf)).toBeNull();
  });

  it('knows when seed is getting old, and takes sown seed out of the packet', () => {
    const k = makePacket('carrot', today, { count: 50 });
    expect(seedState(k, today)).toBe('good');
    expect(seedState({ ...k, sowBy: '2026-12' }, today)).toBe('soon');
    expect(seedState({ ...k, sowBy: '2027-01' }, today)).toBe('soon');
    expect(seedState({ ...k, sowBy: '2027-06' }, today)).toBe('good');
    expect(seedState({ ...k, sowBy: '2026-09' }, today)).toBe('old');
    let g = addPacket(newAppState().garden, k);
    g = useSeeds(g, k.id, 30);
    g = useSeeds(g, k.id, 30);
    expect(g.seeds![0]!.count).toBe(0);
    expect(packetDetail({ ...k, count: 1, sowBy: '2027-12', price: 2 })).toBe('about 1 seed, sow by Dec 2027, £2.00');
  });

  it('keeps packet photos with the garden’s photos, so they aren’t tidied away', () => {
    const g = addPacket(newAppState().garden, makePacket('carrot', today, { photo: 'photo-abc123' }));
    expect(photoIds(g).has('photo-abc123')).toBe(true);
  });

  it('saves and loads (schema 16), and refuses a bad packet', () => {
    const old = { ...newAppState().garden, schemaVersion: 15, feedShelf: ['bonemeal'] };
    const g = migrateGarden(old) as Garden;
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(16);
    expect(g.schemaVersion).toBe(SCHEMA_VERSION);
    expect(g.feedShelf).toEqual(['bonemeal']);
    const k = makePacket('carrot', today, { count: 5, sowBy: '2027-03', price: 1.5 });
    expect(validateGarden({ ...g, seeds: [k] })).toEqual([]);
    expect(validateGarden({ ...g, seeds: [{ ...k, sowBy: 'next spring' }] })).toHaveLength(1);
    expect(validateGarden({ ...g, seeds: [{ ...k, count: -2 }] })).toHaveLength(1);
    expect(validateGarden({ ...g, seeds: [{ ...k, plantId: undefined }] })).toHaveLength(1);
  });
});

/** A 3 × 1.2 m bed, and a way to put a plant in it. */
function garden(): { g: Garden; bed: string } {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
  return { g: addFeature(newAppState().garden, bed), bed: bed.id };
}
const put = (g: Garden, bed: string, id: string, extra: Partial<Planting> = {}): Garden => addPlanting(g, { ...makePlanting(P(id), bed, 'single', [500, 500]), ...extra });

/** A canvas that accepts anything, for checking drawing doesn't throw. */
function fakeCtx(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  // Calls give back something that takes any call too, such as a gradient's addColorStop.
  const anything = (): unknown => new Proxy(() => undefined, { get: () => anything, apply: () => anything() });
  return new Proxy(state, { get: (t, k) => (k in t ? t[k] : () => anything()), set: (t, k, v) => ((t[k] = v), true) }) as unknown as CanvasRenderingContext2D;
}
