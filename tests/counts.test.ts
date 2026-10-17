// Release 45: counts you can trust. Fill keeps traditional rows apart; bulbs in a
// pot at their real density; a move asks before leaving any behind; the count
// can be changed; the list sets rows out as the plan's checks want them; beds
// that have come to overlap are moved apart; seedlings in a cold frame count as modules.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import vegetables from '../data/plants/vegetable.json';
import { bounds, pointInPolygon } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { addListBed, spreadOut } from '../src/model/listLayout';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { fillPlanting } from '../src/planting/fill';
import { howFull, isListed, moveRoom, moveToListBed, OVER_FULL, placeInList, rowsOfSowing, setPlantingCount } from '../src/planting/listPlant';
import { asGrown, isActive, makePlanting, plantCount, plantPositions, unknownPlant } from '../src/planting/place';
import { potCapacity, potProblems } from '../src/planting/pots';
import { checkGarden } from '../src/planting/rules';

const library = [...vegetables, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const listGarden = (): Garden => ({ ...newGarden(), view: 'list' });

/** A list garden with these, each at its own size. */
function beds(...made: [Parameters<typeof addListBed>[1], string, [number, number]?][]): [Garden, string[]] {
  let g = listGarden();
  const ids: string[] = [];
  for (const [kind, name, size] of made) {
    const [next, id] = addListBed(g, kind, name, size);
    g = next;
    ids.push(id);
  }
  return [g, ids];
}
const bedOf = (g: Garden, id: string) => g.features.find((f) => f.id === id)!;
function put(g: Garden, bedId: string, plantId: string, how: Parameters<typeof placeInList>[3], plants = plantOf): Garden {
  return { ...g, plantings: [...g.plantings, ...placeInList(g, bedOf(g, bedId), plants(plantId), how, plants).plantings] };
}
const inBed = (g: Garden, bedId: string) => g.plantings.filter((p) => p.featureId === bedId && isActive(p));
const total = (g: Garden, bedId: string) => inBed(g, bedId).reduce((n, p) => n + plantCount(p, plantOf(p.plantId)), 0);
const spacingWarnings = (g: Garden, plants = plantOf) => checkGarden(g, plants).filter((f) => f.kind === 'spacing');

describe('Fill keeps traditional rows apart', () => {
  it('broad beans fill a bed in rows their row spacing apart, not a block at their plant spacing', () => {
    const [g, [bed]] = beds(['bed', 'Beans', [1200, 2400]]);
    const bean = plantOf('broad-bean');
    const shape = fillPlanting(bean, bedOf(g, bed!), 'fill', [600, 1200]);
    const pl = { ...makePlanting(bean, bed!, 'block', [shape.x, shape.y], shape.endPoint) };
    // 20 cm apart along rows 60 cm apart: two rows down a 1.2 m bed, not six.
    const across = [...new Set(plantPositions(pl, bean).map((p) => p[0]))].sort((a, b) => a - b);
    expect(across).toHaveLength(2);
    expect(across[1]! - across[0]!).toBe(600);
    expect(plantCount(pl, bean)).toBeLessThan(30);
    // Close spacing is unchanged: each way at the close spacing.
    const close = asGrown(bean, 'close');
    const closeShape = fillPlanting(close, bedOf(g, bed!), 'fill', [600, 1200]);
    expect(plantCount(makePlanting(close, bed!, 'block', [closeShape.x, closeShape.y], closeShape.endPoint), close)).toBeGreaterThan(80);
  });
});

describe('bulbs in a pot', () => {
  it('a 35 cm pot takes about 10 daffodils or 16 tulips, all of them in the pot', () => {
    const [g, [pot]] = beds(['pot', 'Bulb pot', [350, 350]]);
    expect(potCapacity(bedOf(g, pot!), plantOf('daffodil'))).toBe(10);
    expect(potCapacity(bedOf(g, pot!), plantOf('tulip'))).toBe(16);
    const filled = put(g, pot!, 'daffodil', 'fill');
    expect(total(filled, pot!)).toBe(10);
    const [pl] = inBed(filled, pot!);
    expect(plantPositions(pl!, plantOf('daffodil')).every((p) => pointInPolygon(p, bedOf(g, pot!).footprint))).toBe(true);
    // Full, not over-full, and not crowded.
    expect(howFull(filled, bedOf(filled, pot!), plantOf)).toBeLessThanOrEqual(OVER_FULL);
    expect(potProblems(filled, plantOf)).toEqual([]);
    expect(validateGarden(JSON.parse(JSON.stringify(filled)))).toEqual([]);
  });

  it('a number of bulbs go in as one potful', () => {
    const [g, [pot]] = beds(['pot', 'Bulb pot', [350, 350]]);
    const next = put(g, pot!, 'tulip', 16);
    expect(inBed(next, pot!)).toHaveLength(1);
    expect(total(next, pot!)).toBe(16);
  });
});

describe('a move asks before leaving any behind', () => {
  it('16 tulips moved into a 35 cm pot are all 16', () => {
    const [g0, [bed, pot]] = beds(['bed', 'Border', [1200, 2400]], ['pot', 'Bulb pot', [350, 350]]);
    const g = put(g0, bed!, 'tulip', 16);
    const ids = inBed(g, bed!).map((p) => p.id);
    expect(total(g, bed!)).toBe(16);
    const room = moveRoom(g, ids[0]!, pot!, plantOf);
    const first = plantCount(g.plantings.find((p) => p.id === ids[0])!, plantOf('tulip'));
    expect(room).toEqual({ have: first, fit: first });
    expect(total(moveToListBed(g, ids[0]!, pot!, plantOf), pot!)).toBe(first);
  });

  it('a row too long for the bed: says how many fit, and the rest stay where they were, or all go closer', () => {
    const [g0, [big, small]] = beds(['bed', 'Big', [1200, 3000]], ['planter', 'Box', [400, 1000]]);
    const g = put(g0, big!, 'lettuce', 'row');
    const row = inBed(g, big!)[0]!;
    const have = plantCount(row, plantOf('lettuce'));
    const room = moveRoom(g, row.id, small!, plantOf)!;
    expect(room.have).toBe(have);
    expect(room.fit).toBeLessThan(have);
    const cut = moveToListBed(g, row.id, small!, plantOf);
    expect(total(cut, small!)).toBe(room.fit);
    expect(total(cut, big!)).toBe(have - room.fit);
    // The moved planting is still the same one.
    expect(cut.plantings.find((p) => p.id === row.id)!.featureId).toBe(small);
    const all = moveToListBed(g, row.id, small!, plantOf, true);
    expect(total(all, small!)).toBe(have);
    expect(total(all, big!)).toBe(0);
  });
});

describe('the count can be changed', () => {
  it('rows of one sowing, laid again as the number asked for', () => {
    const [g0, [bed]] = beds(['bed', 'Veg', [1200, 2400]]);
    const g = put(g0, bed!, 'garlic', 24);
    const first = inBed(g, bed!)[0]!;
    const ids = [first.id, ...rowsOfSowing(g, first.id)];
    expect(ids.length).toBeGreaterThan(1);
    const { garden, left } = setPlantingCount(g, ids, 40, plantOf);
    expect(left).toBe(0);
    expect(total(garden, bed!)).toBe(40);
    // Still the same planting first, and the rows still read as one sowing.
    expect(garden.plantings.some((p) => p.id === first.id)).toBe(true);
    expect(rowsOfSowing(garden, first.id).length + 1).toBe(inBed(garden, bed!).length);
    expect(setPlantingCount(garden, [first.id, ...rowsOfSowing(garden, first.id)], 10, plantOf).garden.plantings.filter(isActive).reduce((n, p) => n + plantCount(p, plantOf(p.plantId)), 0)).toBe(10);
  });

  it('a block grows or shrinks about its middle and stays in the bed; a potful is the number', () => {
    const [g0, [bed, pot]] = beds(['bed', 'Salad', [1200, 2400]], ['pot', 'Pot', [350, 350]]);
    const lettuce = asGrown(plantOf('lettuce'), 'close');
    const plants = (id: string) => (id === 'lettuce' ? lettuce : plantOf(id));
    const shape = fillPlanting(lettuce, bedOf(g0, bed!), 'fill', [600, 1200]);
    const block: Planting = makePlanting(lettuce, bed!, 'block', [shape.x, shape.y], shape.endPoint);
    const g = { ...g0, plantings: [block] };
    const most = plantCount(block, lettuce);
    const smaller = setPlantingCount(g, [block.id], 20, plants).garden.plantings[0]!;
    expect(plantCount(smaller, lettuce)).toBeGreaterThanOrEqual(20);
    expect(plantCount(smaller, lettuce)).toBeLessThan(most);
    const bigger = setPlantingCount(g, [block.id], most * 3, plants);
    expect(bigger.left).toBeGreaterThan(0);
    expect(plantPositions(bigger.garden.plantings[0]!, lettuce).every((p) => pointInPolygon(p, bedOf(g, bed!).footprint))).toBe(true);
    const potted = put(g0, pot!, 'tulip', 'fill');
    const tulips = inBed(potted, pot!)[0]!;
    expect(plantCount(setPlantingCount(potted, [tulips.id], 25, plantOf).garden.plantings.find((p) => p.id === tulips.id)!, plantOf('tulip'))).toBe(25);
  });
});

describe('the plan and the list agree on rows', () => {
  it('rows the list sets out raise no spacing check on the plan', () => {
    for (const id of ['garlic', 'onion', 'broad-bean', 'carrot', 'lettuce']) {
      const [g0, [bed]] = beds(['bed', 'Veg', [1200, 2400]]);
      const g = put(g0, bed!, id, 40);
      expect(spacingWarnings(g).map((f) => f.message), id).toEqual([]);
      // And a row added after them.
      expect(spacingWarnings(put(g, bed!, id, 'row')).map((f) => f.message), id).toEqual([]);
    }
  });

  it('beds that have come to overlap are moved apart with their plants; pots on a patio stay', () => {
    const [g0, [a, b]] = beds(['bed', 'A'], ['bed', 'B']);
    // B made big enough to cover A, as typing a size in the list can.
    const boxA = bounds(bedOf(g0, a!).footprint)!;
    let g: Garden = { ...g0, features: g0.features.map((f) => (f.id === b ? { ...f, footprint: rectPoints({ x: boxA.minX, y: boxA.minY, w: 3000, h: 3000 }) } : f)) };
    g = put(g, b!, 'garlic', 'row');
    const patio = makeFeature('surface', { area: rectPoints({ x: 20000, y: 0, w: 3000, h: 3000 }) });
    g = addFeature(g, { ...patio, material: 'paving' });
    const [g2, pot] = addListBed(g, 'pot', 'Pot');
    const onPatio = { ...g2, features: g2.features.map((f) => (f.id === pot ? { ...f, circle: { centre: [21000, 1000] as [number, number], radiusMm: 150 }, footprint: rectPoints({ x: 20850, y: 850, w: 300, h: 300 }) } : f)) };
    const spread = spreadOut(onPatio, isListed(onPatio));
    const [ba, bb] = [bounds(bedOf(spread, a!).footprint)!, bounds(bedOf(spread, b!).footprint)!];
    expect(ba.minX >= bb.maxX || bb.minX >= ba.maxX || ba.minY >= bb.maxY || bb.minY >= ba.maxY).toBe(true);
    // A stays; B moved, its garlic with it.
    expect(ba).toEqual(boxA);
    expect(inBed(spread, b!).every((p) => pointInPolygon([p.x, p.y], bedOf(spread, b!).footprint))).toBe(true);
    expect(bedOf(spread, pot).circle!.centre).toEqual([21000, 1000]);
  });
});

describe('seedlings raised in a cold frame', () => {
  it('24 sweet peas in root trainers fit a 1.2 m frame, with no checks against them', () => {
    const [g0, [frame]] = beds(['cold-frame', 'Frame', [1200, 600]]);
    const { plantings, left } = placeInList(g0, bedOf(g0, frame!), plantOf('sweet-pea'), 24, plantOf);
    expect(left).toBe(0);
    const g = { ...g0, plantings };
    expect(total(g, frame!)).toBe(24);
    expect(howFull(g, bedOf(g, frame!), plantOf)).toBeLessThan(OVER_FULL);
    expect(spacingWarnings(g)).toEqual([]);
  });

  it('lettuce grows on in a frame at its usual spacing', () => {
    const [g0, [frame]] = beds(['cold-frame', 'Frame', [1200, 600]]);
    expect(placeInList(g0, bedOf(g0, frame!), plantOf('lettuce'), 24, plantOf).left).toBeGreaterThan(0);
  });
});
