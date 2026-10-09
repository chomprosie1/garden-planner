// Release 21: pots, properly. How big a pot is and what a plant wants, pots
// too small or too crowded, a second plant going beside the first, potting on,
// and trees from the Trees list going in a pot as their plant.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { TREE_TYPES } from '../src/model/trees';
import type { Feature, Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, makePlanting, plantCount, unknownPlant } from '../src/planting/place';
import { isPot, potNeeds, potOn, potOnChoices, potProblems, potSize, sizeText, spotInPot, treeAsPlant } from '../src/planting/pots';
import { checkGarden } from '../src/planting/rules';

const DIR = join(__dirname, '..', 'data', 'plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const P = (id: string) => plantOf(id);

const pot = (r: number, at: [number, number] = [1000, 1000]): Feature => makeFeature('pot', { circle: { centre: at, radiusMm: r } });
const withPot = (r: number): [Garden, Feature] => {
  const f = pot(r);
  return [addFeature(newGarden(), f), f];
};
const plantIn = (g: Garden, f: Feature, id: string, at: [number, number] = [1000, 1000]) => addPlanting(g, makePlanting(P(id), f.id, 'single', at));

describe('pot sizes', () => {
  it('measures a round pot, and a window box by its narrow side', () => {
    const s = potSize(pot(150))!;
    expect(s.across).toBe(300);
    expect(s.litres).toBeCloseTo((Math.PI * 150 ** 2 * 300) / 1e6, 1);
    expect(sizeText(s)).toBe('30 cm across');
    const box = makeFeature('planter', { area: rectPoints({ x: 0, y: 0, w: 800, h: 200 }) });
    const b = potSize(box)!;
    expect(b.across).toBe(200);
    expect(b.long).toBe(800);
    expect(sizeText(b)).toBe('80 cm long and 20 cm wide');
    expect(potSize(makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1000, h: 1000 }) }))).toBeNull();
  });

  it('wants about 30 cm for a tomato, 45 cm for fruit trees and bushes, 15 cm for salad (RHS)', () => {
    expect(potNeeds(P('tomato'))).toBe(300);
    expect(potNeeds(P('chilli'))).toBe(300);
    expect(potNeeds(P('fig'))).toBe(450);
    expect(potNeeds(P('apple'))).toBe(450);
    expect(potNeeds(P('blueberry'))).toBe(450);
    expect(potNeeds(P('lettuce'))).toBe(150);
    expect(potNeeds(P('lavender'))).toBe(300);
  });
});

describe('pots too small or too crowded', () => {
  it('warns of a fig in a small pot, and not in a big one', () => {
    const [g0, small] = withPot(150);
    const g = plantIn(g0, small, 'fig');
    const probs = potProblems(g, plantOf);
    expect(probs).toHaveLength(1);
    expect(probs[0]!.kind).toBe('small');
    expect(probs[0]!.message).toMatch(/Fig wants a pot about 45 cm across or more; this pot is 30 cm across/);
    const [h0, big] = withPot(250);
    expect(potProblems(plantIn(h0, big, 'fig'), plantOf)).toEqual([]);
    expect(checkGarden(g, plantOf).some((f) => f.kind === 'pot' && f.featureIds.includes(small.id))).toBe(true);
  });

  it('lets several plants share a pot, and says when there are too many', () => {
    const [g0, f] = withPot(250);
    let g = plantIn(g0, f, 'basil', [900, 1000]);
    g = plantIn(g, f, 'parsley', [1100, 1000]);
    expect(potProblems(g, plantOf)).toEqual([]);
    g = plantIn(g, f, 'tomato', [1000, 1100]);
    g = plantIn(g, f, 'chilli', [1000, 900]);
    g = plantIn(g, f, 'sweet-pepper', [1050, 950]);
    const crowded = potProblems(g, plantOf).find((p) => p.kind === 'crowded');
    expect(crowded).toBeTruthy();
    expect(crowded!.message).toMatch(/^Too crowded: the basil, parsley, tomato, chilli pepper and sweet pepper want a pot about \d+ cm across between them; this pot is 50 cm/);
  });

  it('checks a pot as a pot: no bed-style spacing warnings between plants sharing it', () => {
    const [g0, f] = withPot(250);
    let g = plantIn(g0, f, 'basil', [950, 1000]);
    g = plantIn(g, f, 'parsley', [1050, 1000]);
    expect(checkGarden(g, plantOf).filter((x) => x.kind === 'spacing')).toEqual([]);
  });

  it('says poor companions are in the same pot', () => {
    const avoid = library.find((p) => p.companions?.avoid.length && byId.has(p.companions.avoid[0]!) && p.category !== 'weed')!;
    const other = avoid.companions!.avoid[0]!;
    const [g0, f] = withPot(300);
    let g = plantIn(g0, f, avoid.id, [900, 1000]);
    g = plantIn(g, f, other, [1100, 1000]);
    const found = checkGarden(g, plantOf).find((x) => x.kind === 'avoid');
    expect(found?.message).toMatch(/in the same pot/);
  });

  it('counts plants, not plantings: a block is several plants, each wanting its spacing', () => {
    const [g0, f] = withPot(150);
    // A block of basil at its spacing, planted across a 30 cm pot: one planting, several plants.
    const block = makePlanting(P('basil'), f.id, 'block', [700, 700], [1300, 1300]);
    const n = plantCount(block, P('basil'));
    expect(n).toBeGreaterThanOrEqual(4);
    const crowded = potProblems(addPlanting(g0, block), plantOf);
    expect(crowded.find((p) => p.kind === 'crowded')?.plantings).toHaveLength(1);
    // Radishes sown at their spacing across a pot aren't crowded, however many.
    const [h0, big] = withPot(200);
    const radish = makePlanting(P('radish'), big.id, 'block', [870, 870], [1130, 1130]);
    expect(potProblems(addPlanting(h0, radish), plantOf).filter((p) => p.kind === 'crowded')).toEqual([]);
  });

  it('still checks the spacing of rows and blocks in a planter', () => {
    const box = makeFeature('planter', { area: rectPoints({ x: 0, y: 0, w: 2000, h: 400 }) });
    let g = addFeature(newGarden(), box);
    g = addPlanting(g, makePlanting(P('carrot'), box.id, 'row', [100, 200], [1900, 200]));
    g = addPlanting(g, makePlanting(P('carrot'), box.id, 'row', [100, 210], [1900, 210]));
    expect(checkGarden(g, plantOf).some((x) => x.kind === 'spacing')).toBe(true);
  });

  it('leaves weeds out of it', () => {
    const weed = library.find((p) => p.category === 'weed')!;
    const [g0, f] = withPot(100);
    expect(potProblems(plantIn(g0, f, weed.id), plantOf)).toEqual([]);
  });
});

describe('a second plant in a pot', () => {
  it('goes where it was dropped in an empty pot, and beside the first in a pot with something in it', () => {
    const [g0, f] = withPot(250);
    expect(spotInPot(g0, f, [1000, 1000], plantOf)).toEqual([1000, 1000]);
    const g = plantIn(g0, f, 'basil', [1000, 1000]);
    const at = spotInPot(g, f, [1000, 1000], plantOf);
    expect(Math.hypot(at[0] - 1000, at[1] - 1000)).toBeGreaterThan(120);
    expect(pointInPolygon(at, f.footprint)).toBe(true);
  });
});

describe('potting on', () => {
  const start = () => {
    const [g0, small] = withPot(150);
    const g = plantIn(g0, small, 'fig');
    return { g, small, pl: g.plantings[0]! };
  };

  it('offers a new pot of the size it wants, bigger pots on the plan, and the beds', () => {
    const { g: g0, small, pl } = start();
    const bigger = pot(300, [3000, 1000]);
    const tiny = pot(100, [5000, 1000]);
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 3000, w: 2000, h: 1000 }) });
    const g = addFeature(addFeature(addFeature(g0, bigger), tiny), bed);
    const c = potOnChoices(g, pl.id, plantOf)!;
    expect(c.suggested).toBeGreaterThanOrEqual(450);
    expect(c.pots.map((f) => f.id)).toEqual([bigger.id]);
    expect(c.beds.map((f) => f.id)).toEqual([bed.id]);
    expect(c.pots.some((f) => f.id === small.id)).toBe(false);
    expect(potOnChoices(g, 'nope', plantOf)).toBeNull();
  });

  it('moves it into a new pot beside the old one, with a note, and the old pot stays', () => {
    const { g, small, pl } = start();
    const next = potOn(g, pl.id, { kind: 'new', acrossMm: 450 }, plantOf, '2027-04-03');
    expect(validateGarden(JSON.parse(JSON.stringify(next)))).toEqual([]);
    const made = next.features.find((f) => !g.features.includes(f))!;
    expect(isPot(made)).toBe(true);
    expect(potSize(made)!.across).toBe(450);
    expect(next.features.some((f) => f.id === small.id)).toBe(true);
    const moved = next.plantings.find((p) => p.id === pl.id)!;
    expect(moved.featureId).toBe(made.id);
    expect(pointInPolygon([moved.x, moved.y], made.footprint)).toBe(true);
    expect(next.notes.find((n) => n.plantingId === pl.id)?.text).toBe('Potted on into a 45 cm pot.');
    expect(potProblems(next, plantOf)).toEqual([]);
  });

  it('moves it into a pot already on the plan, beside what’s there, or out into a bed', () => {
    const { g: g0, pl } = start();
    const bigger = pot(300, [3000, 1000]);
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 3000, w: 2000, h: 1000 }) });
    let g = addFeature(addFeature(g0, bigger), bed);
    g = plantIn(g, bigger, 'basil', [3000, 1000]);
    const intoPot = potOn(g, pl.id, { kind: 'pot', featureId: bigger.id }, plantOf, '2027-04-03');
    const inPot = intoPot.plantings.find((p) => p.id === pl.id)!;
    expect(inPot.featureId).toBe(bigger.id);
    expect(Math.hypot(inPot.x - 3000, inPot.y - 1000)).toBeGreaterThan(100);
    const intoBed = potOn(g, pl.id, { kind: 'bed', featureId: bed.id }, plantOf, '2027-04-03');
    const inBed = intoBed.plantings.find((p) => p.id === pl.id)!;
    expect(inBed.featureId).toBe(bed.id);
    expect(pointInPolygon([inBed.x, inBed.y], bed.footprint)).toBe(true);
    expect(intoBed.notes.at(-1)?.text).toMatch(/^Planted out from the pot into/);
  });

  it('puts a new pot clear of a long window box, not inside it', () => {
    const box = makeFeature('planter', { area: rectPoints({ x: 0, y: 0, w: 800, h: 200 }) });
    let g = addFeature(newGarden(), box);
    g = addPlanting(g, makePlanting(P('tomato'), box.id, 'single', [400, 100]));
    const pl = g.plantings[0]!;
    const next = potOn(g, pl.id, { kind: 'new', acrossMm: 300 }, plantOf, '2027-05-01');
    const made = next.features.find((f) => f.id !== box.id)!;
    expect(made.circle!.centre[0] - made.circle!.radiusMm).toBeGreaterThan(800);
  });

  it('keeps everything else about the planting: its stages, dates and picks', () => {
    const { g: g0, pl } = start();
    const g = { ...g0, plantings: g0.plantings.map((p) => ({ ...p, stage: 'vegetative' as const, sownOn: '2026-04-01', picks: [{ date: '2026-08-01', grams: 200 }] })) };
    const next = potOn(g, pl.id, { kind: 'new', acrossMm: 450 }, plantOf, '2027-04-03');
    const moved = next.plantings.find((p) => p.id === pl.id)!;
    expect(moved.stage).toBe('vegetative');
    expect(moved.sownOn).toBe('2026-04-01');
    expect(moved.picks).toHaveLength(1);
  });
});

describe('trees in pots', () => {
  it('finds the library plant for a tree from the Trees list, by its id or its name', () => {
    const tree = (id: string) => TREE_TYPES.find((t) => t.id === id)!;
    expect(treeAsPlant(tree('olive'), library)?.id).toBe('olive');
    expect(treeAsPlant(tree('japanese-maple'), library)?.id).toBe('japanese-maple');
    expect(treeAsPlant(tree('cornus-kousa'), library)?.id).toBe('chinese-dogwood');
    expect(treeAsPlant(tree('silver-birch'), library)).toBeNull();
  });
});
