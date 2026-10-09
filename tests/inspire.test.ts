// Release 16: Inspire me. Ideas that suit the spot's sun, cover and size, within
// the budget, the time a week and the time frame, three of different kinds, and
// the chosen one planted where it should be.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varietyData from '../data/varieties.json';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { buyAs, costOf, DEFAULT_ANSWERS, emptyPlaces, FAMILIAR, MIXES, inspire, minutesAWeek, nothingText, plantIdea, spotOf, timingOf, type Answers, type Spot } from '../src/planting/inspire';
import { addPlanting, isContainer, makePlanting, plantPositions, unknownPlant } from '../src/planting/place';
import { KITS } from '../src/planting/kits';
import { addPacket, makePacket } from '../src/planting/seeds';
import { sunNeeded } from '../src/planting/rules';
import { pointInPolygon } from '../src/geometry/polygon';

const DIR = join(__dirname, '..', 'data', 'plants');
const species: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const library = withVarieties(species, varietyData as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const ctx = (today: string) => ({ plants: library, plantOf, today });

/** A garden with one thing in it: a 1.2 × 2.4 m bed by default. */
function withOne(kind: Feature['kind'], w = 1200, d = 2400, extra: Partial<Feature> = {}): [Garden, Feature] {
  const f = { ...makeFeature(kind, { area: rectPoints({ x: 0, y: 0, w, h: d }) }), ...extra };
  return [addFeature(newGarden(), f), f];
}
const spotWith = (g: Garden, f: Feature, hours: number | null): Spot => spotOf(g, f, plantOf, hours === null ? null : () => hours);
const answers = (a: Partial<Answers> = {}): Answers => ({ ...DEFAULT_ANSWERS, ...a });

describe('ideas that suit the spot', () => {
  it('suggests three ideas for an empty bed, all suited to its sun', () => {
    for (const hours of [1.5, 4, 8]) {
      const [g, bed] = withOne('bed');
      const ideas = inspire(g, spotWith(g, bed, hours), answers(), ctx('2027-03-10'));
      expect(ideas.length, `${hours} h`).toBe(3);
      for (const i of ideas)
        for (const id of i.plants) {
          const p = plantOf(id);
          expect(sunNeeded(p), `${id} in ${hours} h`).toBeLessThanOrEqual(hours + 0.5);
          if (p.conditions.light === 'shade') expect(hours).toBeLessThanOrEqual(6);
        }
    }
  });

  it('puts full-sun crops in the sun and shade plants in the shade', () => {
    const [g, bed] = withOne('bed');
    const sunny = inspire(g, spotWith(g, bed, 9), answers(), ctx('2027-04-05')).flatMap((i) => i.plants);
    const shady = inspire(g, spotWith(g, bed, 1), answers(), ctx('2027-04-05')).flatMap((i) => i.plants);
    expect(sunny.some((id) => plantOf(id).conditions.light === 'full-sun')).toBe(true);
    expect(shady.every((id) => plantOf(id).conditions.light !== 'full-sun')).toBe(true);
  });

  it('gives three different kinds of idea, never two of one plant', () => {
    const [g, bed] = withOne('bed');
    const ideas = inspire(g, spotWith(g, bed, 7), answers({ budget: 50, time: 600 }), ctx('2027-04-05'));
    const kinds = ideas.map((i) => (i.mix ? 'mix' : plantOf(i.plants[0]!).category));
    expect(new Set(kinds).size).toBe(3);
    const roots = ideas.map((i) => plantOf(i.plants[0]!).varietyOf ?? i.plants[0]);
    expect(new Set(roots).size).toBe(ideas.length);
  });

  it('only suggests what fits: no tree in a pot, nothing wider than the bed', () => {
    const [g, pot] = withOne('pot', 400, 400);
    const ideas = inspire(g, spotWith(g, pot, 7), answers({ budget: 50, when: 'years', time: 600 }), ctx('2027-03-10'));
    for (const i of ideas) {
      const p = plantOf(i.plants[0]!);
      expect(buyAs(p)).not.toBe('tree');
      expect(p.size.spreadMm ?? p.size.spacingMm).toBeLessThanOrEqual(440);
    }
  });

  it('suggests trees, shrubs and bulbs for a lawn, one at a time, in its most open part', () => {
    const [g0, lawn] = withOne('surface', 8000, 6000, { material: 'lawn' });
    // An apple tree already near one corner.
    const g = addPlanting(g0, makePlanting(plantOf('apple'), lawn.id, 'single', [1000, 1000]));
    const spot = spotWith(g, lawn, 7);
    expect(Math.hypot(spot.at[0] - 1000, spot.at[1] - 1000)).toBeGreaterThan(3000);
    const ideas = inspire(g, spot, answers({ budget: 50, when: 'years' }), ctx('2027-10-10'));
    expect(ideas.length).toBeGreaterThan(0);
    for (const i of ideas) expect(['tree', 'shrub', 'bulb']).toContain(buyAs(plantOf(i.plants[0]!)));
  });

  it('treats a patch of bare soil like a bed, not a lawn', () => {
    const [g, soil] = withOne('surface', 3000, 2000, { material: 'soil' });
    const ideas = inspire(g, spotWith(g, soil, 7), answers(), ctx('2027-04-05'));
    expect(ideas.some((i) => ['packet', 'potted', 'runner'].includes(buyAs(plantOf(i.plants[0]!))))).toBe(true);
    for (const i of ideas) expect(i.mix).toBeUndefined();
  });

  it('suggests tender crops under glass, and no trees or bulbs there', () => {
    const [g, house] = withOne('greenhouse', 2400, 1800);
    const ideas = inspire(g, spotWith(g, house, 8), answers({ budget: 25 }), ctx('2027-04-01'));
    expect(ideas.length).toBe(3);
    for (const i of ideas) for (const id of i.plants) expect(['tree', 'shrub', 'bulb']).not.toContain(buyAs(plantOf(id)));
    expect(ideas.some((i) => i.why.some((w) => /glass gives it/.test(w)))).toBe(true);
  });

  it('still suggests something when the sun is not known yet', () => {
    const [g, bed] = withOne('bed');
    expect(inspire(g, spotWith(g, bed, null), answers(), ctx('2027-05-01')).length).toBe(3);
  });
});

describe('budget, time and when', () => {
  it('keeps within the budget', () => {
    const [g, bed] = withOne('bed', 3000, 4000);
    for (const budget of [10, 25] as const) {
      const ideas = inspire(g, spotWith(g, bed, 7), answers({ budget, when: 'years' }), ctx('2027-03-10'));
      for (const i of ideas) expect(i.cost.high, i.title).toBeLessThanOrEqual(budget);
    }
  });

  it('plants fewer of something dear to keep in budget, rather than leaving it out', () => {
    const [g, bed] = withOne('bed', 3000, 4000);
    const ideas = inspire(g, spotWith(g, bed, 7), answers({ budget: 25, when: 'years', time: 600 }), ctx('2027-03-10'));
    const bought = ideas.filter((i) => buyAs(plantOf(i.plants[0]!)) !== 'packet' && !i.mix);
    for (const i of bought) expect(i.cost.high).toBeLessThanOrEqual(25);
  });

  it('a packet in the seed tin costs nothing and comes up first', () => {
    const [g0, bed] = withOne('bed');
    const g = addPacket(g0, makePacket('beetroot', '2027-01-01', { count: 100 }));
    const ideas = inspire(g, spotWith(g, bed, 7), answers(), ctx('2027-04-05'));
    const beet = ideas.find((i) => i.plants.includes('beetroot'));
    expect(beet).toBeTruthy();
    expect(beet!.cost.inTin).toBe(true);
    expect(beet!.why[0]).toMatch(/seed already/);
  });

  it('keeps within the time a week, near enough', () => {
    const [g, bed] = withOne('bed');
    const ideas = inspire(g, spotWith(g, bed, 7), answers({ time: 10 }), ctx('2027-04-05'));
    for (const i of ideas) expect(i.minutes).toBeLessThanOrEqual(15);
  });

  it('counts sowing indoors, hungry crops and pots as more work', () => {
    const [g, bed] = withOne('bed');
    const [, pot] = withOne('pot', 400, 400);
    const bedSpot = spotWith(g, bed, 7);
    expect(minutesAWeek(plantOf('tomato'), bedSpot, 2)).toBeGreaterThan(minutesAWeek(plantOf('radish'), bedSpot, 2));
    expect(minutesAWeek(plantOf('lavender'), bedSpot, 2)).toBeLessThan(minutesAWeek(plantOf('lettuce'), bedSpot, 2));
    expect(minutesAWeek(plantOf('lettuce'), { feature: pot, cover: null }, 0.2)).toBeGreaterThan(minutesAWeek(plantOf('lettuce'), bedSpot, 0.2));
  });

  it('something quick goes in soon and is ready within four months', () => {
    const [g, bed] = withOne('bed');
    const today = '2027-05-01';
    const ideas = inspire(g, spotWith(g, bed, 7), answers({ when: 'soon' }), ctx(today));
    expect(ideas.length).toBeGreaterThan(0);
    for (const i of ideas) {
      expect(i.timing.start <= '2027-06-12').toBe(true);
      expect(i.timing.ready! <= '2027-08-29').toBe(true);
    }
  });

  it('for years to come means things that come back', () => {
    const [g, bed] = withOne('bed');
    const ideas = inspire(g, spotWith(g, bed, 7), answers({ when: 'years', budget: 50 }), ctx('2027-03-10'));
    expect(ideas.length).toBe(3);
    for (const i of ideas) for (const id of i.plants) expect(buyAs(plantOf(id)), id).not.toBe('packet');
  });

  it('this year leaves out trees, which take years to fruit', () => {
    const [g0, lawn] = withOne('surface', 8000, 6000, { material: 'lawn' });
    const ideas = inspire(g0, spotWith(g0, lawn, 7), answers({ budget: 50, when: 'year' }), ctx('2027-10-10'));
    for (const i of ideas) expect(buyAs(plantOf(i.plants[0]!))).not.toBe('tree');
  });

  it('a gap before a planned crop gets only what will be done in time', () => {
    const [g0, bed] = withOne('bed');
    const later = { ...makePlanting(plantOf('leek'), bed.id, 'row', [200, 200], [1000, 200]), sowBy: '2027-07-01' };
    const g = addPlanting(g0, later);
    const spot = spotWith(g, bed, 7);
    expect(spot.until).toBe('2027-07-01');
    const ideas = inspire(g, spot, answers(), ctx('2027-04-01'));
    expect(ideas.length).toBeGreaterThan(0);
    for (const i of ideas) {
      expect(i.mix).toBeUndefined();
      expect(timingOf(plantOf(i.plants[0]!), '2027-04-01', null)!.done! <= '2027-07-01').toBe(true);
    }
  });

  it('says why when nothing fits', () => {
    const [g, bed] = withOne('bed');
    const a = answers({ when: 'soon', budget: 10, time: 10 });
    const spot = spotWith(g, bed, 0.5);
    expect(inspire(g, spot, a, ctx('2027-12-01'))).toEqual([]);
    expect(nothingText(spot, a, '2027-12-01')).toMatch(/December/);
  });
});

describe('planting an idea', () => {
  it('plants it inside the bed, as one change, and puts seed on the sowing list', () => {
    const [g, bed] = withOne('bed');
    const spot = spotWith(g, bed, 7);
    const ideas = inspire(g, spot, answers(), ctx('2027-04-05'));
    for (const idea of ideas) {
      const next = plantIdea(g, spot, idea, plantOf, '2027-04-05');
      expect(validateGarden(JSON.parse(JSON.stringify(next)))).toEqual([]);
      const added = next.plantings.filter((p) => !g.plantings.includes(p));
      expect(added.length, idea.title).toBeGreaterThan(0);
      for (const pl of added) {
        expect(pl.featureId).toBe(bed.id);
        for (const q of plantPositions(pl, plantOf(pl.plantId))) expect(pointInPolygon(q, bed.footprint) || q[0] === 0 || q[1] === 0, idea.title).toBe(true);
      }
      for (const id of idea.plants) if (buyAs(plantOf(id)) === 'packet') expect(next.wishlist).toContain(id);
    }
  });

  it('plants a drift of bulbs or a tree on the lawn, where there is room', () => {
    const [g, lawn] = withOne('surface', 8000, 6000, { material: 'lawn' });
    const spot = spotWith(g, lawn, 7);
    const ideas = inspire(g, spot, answers({ budget: 50, when: 'years' }), ctx('2027-10-10'));
    for (const idea of ideas) {
      const next = plantIdea(g, spot, idea, plantOf, '2027-10-10');
      const pl = next.plantings[next.plantings.length - 1]!;
      expect(pl.featureId).toBe(lawn.id);
      for (const q of plantPositions(pl, plantOf(pl.plantId))) expect(pointInPolygon(q, lawn.footprint)).toBe(true);
    }
  });

  it('the familiar plants and the mixes are all in the library', () => {
    for (const id of FAMILIAR) expect(byId.has(id), id).toBe(true);
    for (const m of MIXES) expect(KITS.find((k) => k.id === m.kit)?.beds[m.bed], m.id).toBeTruthy();
  });

  it('costs a packet of seed, or so much a plant', () => {
    const g = newGarden();
    expect(costOf(plantOf('carrot'), 200, g, plantOf)).toEqual({ low: 1, high: 3, inTin: false });
    expect(costOf(plantOf('lavender'), 4, g, plantOf).low).toBe(12);
    expect(buyAs(plantOf('apple'))).toBe('tree');
    expect(buyAs(plantOf('strawberry'))).toBe('runner');
  });

  it('finds the empty places: nothing growing or planned in them', () => {
    const [g0, bed] = withOne('bed');
    const pot = makeFeature('pot', { area: rectPoints({ x: 3000, y: 0, w: 400, h: 400 }) });
    let g = addFeature(g0, pot);
    expect(emptyPlaces(g).map((f) => f.id)).toEqual([bed.id, pot.id]);
    g = addPlanting(g, makePlanting(plantOf('tomato'), pot.id, 'single', [3200, 200]));
    expect(emptyPlaces(g).map((f) => f.id)).toEqual([bed.id]);
    expect(emptyPlaces(g).every(isContainer)).toBe(true);
  });
});
