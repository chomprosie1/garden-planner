// Release 51: a plan you can trust. A drag never pulls plants out of their bed
// without asking, switching from a list makes a garden that fits, labels don't
// pile up, and sizes are read as a gardener types them.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { hitPlanting, plantingDrag } from '../src/canvas/hit';
import { claim } from '../src/canvas/labels';
import { parseLength, sizeMm } from '../src/canvas/snap';
import { pointInPolygon } from '../src/geometry/polygon';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, closeGround, freshTarget, isSetGround, makeFeature, rectPoints } from '../src/model/features';
import { LIST_SIZE, planFromList } from '../src/model/listLayout';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { isListed } from '../src/planting/listPlant';
import { addPlanting, leftItsBed, makePlanting, movePlanting, unknownPlant } from '../src/planting/place';
import { checkGarden } from '../src/planting/rules';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bedAt = (x: number, y: number, w: number, h: number, name: string): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y, w, h }) }), name });
const potAt = (x: number, y: number, across: number, name: string): Feature => ({ ...makeFeature('pot', { circle: { centre: [x, y], radiusMm: across / 2 } }), name });
const warns = (g: Garden, kind?: string) => checkGarden(g, plantOf).filter((f) => f.level === 'warn' && (!kind || f.kind === kind));

describe('a drag on a bed moves the bed (Ruth)', () => {
  const base = { plantEdits: true, touch: false, wasSelected: false, bedMovable: true };
  it('a press on a plant not yet picked drags its bed', () => {
    expect(plantingDrag(base)).toBe('bed');
  });
  it('a plant you have picked drags itself', () => {
    expect(plantingDrag({ ...base, wasSelected: true })).toBe('planting');
  });
  it('with the bed locked or on the lawn, the plant drags itself', () => {
    expect(plantingDrag({ ...base, bedMovable: false })).toBe('planting');
  });
  it('on a touch screen, a first press only picks and pans', () => {
    expect(plantingDrag({ ...base, touch: true })).toBe('pan');
    expect(plantingDrag({ ...base, touch: true, wasSelected: true })).toBe('planting');
  });
  it('when planting can’t be edited, it pans', () => {
    expect(plantingDrag({ ...base, plantEdits: false })).toBe('pan');
  });
});

describe('dragging a planting out of its bed asks first', () => {
  const bed = bedAt(0, 0, 1800, 900, 'Raised bed 2');
  const other = bedAt(3000, 0, 1800, 900, 'Raised bed 3');
  const row: Planting = { ...makePlanting(plantOf('strawberry'), bed.id, 'row', [200, 300], [1600, 300]), count: 6 };
  const g = addPlanting(addFeature(addFeature(newGarden(), bed), other), row);
  it('out onto the lawn: asks', () => {
    expect(leftItsBed(g, movePlanting(g, row.id, 0, 2000), row.id, plantOf)).toBe(true);
  });
  it('half out: asks', () => {
    expect(leftItsBed(g, movePlanting(g, row.id, 900, 0), row.id, plantOf)).toBe(true);
  });
  it('a row on the very edge of its bed still counts as in it', () => {
    const edge: Planting = { ...makePlanting(plantOf('strawberry'), bed.id, 'row', [200, 900], [1600, 900]), count: 6 };
    const h = addPlanting(addFeature(newGarden(), bed), edge);
    expect(leftItsBed(h, movePlanting(h, edge.id, 0, 2000), edge.id, plantOf)).toBe(true);
  });
  it('within the bed: doesn’t', () => {
    expect(leftItsBed(g, movePlanting(g, row.id, 0, 200), row.id, plantOf)).toBe(false);
  });
  it('wholly into another bed: doesn’t', () => {
    expect(leftItsBed(g, movePlanting(g, row.id, 3000, 0), row.id, plantOf)).toBe(false);
  });
  it('a plant on the lawn was never in a bed', () => {
    const lawn = makeFeature('surface', { area: rectPoints({ x: 0, y: 2000, w: 3000, h: 2000 }) });
    const tree = makePlanting(plantOf('crocus'), lawn.id, 'single', [500, 2500]);
    const h = addPlanting(addFeature(newGarden(), lawn), tree);
    expect(leftItsBed(h, movePlanting(h, tree.id, 800, 0), tree.id, plantOf)).toBe(false);
  });
});

describe('switching from a list makes a garden that fits (Priya, twice)', () => {
  const edge = rectPoints({ x: 0, y: 0, w: 4000, h: 4000 });
  const patio: Feature = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 2500, h: 2500 }) }), material: 'paving', name: 'Patio' };
  const list = (...fs: Feature[]): Garden => fs.reduce(addFeature, { ...newGarden(), view: 'list' as const, boundary: edge });

  it('everything ends up inside the boundary', () => {
    const big = bedAt(4600, 0, 2400, 1200, 'Raised bed 2');
    const g = planFromList(list(big), isListed(list(big)));
    for (const p of g.features.find((f) => f.id === big.id)!.footprint) expect(pointInPolygon(p, g.boundary) || g.boundary.some((b) => b[0] === p[0] || b[1] === p[1])).toBe(true);
  });

  it('pots outside the garden stand on the paving', () => {
    const pots = [0, 1, 2, 3].map((i) => potAt(5000 + i * 600, 500, 300, `Pot ${i + 1}`));
    const start = list(patio, ...pots);
    const g = planFromList(start, isListed(start));
    for (const pot of pots) {
      const f = g.features.find((x) => x.id === pot.id)!;
      expect(pointInPolygon(f.circle!.centre, patio.footprint)).toBe(true);
    }
    const centres = pots.map((pot) => g.features.find((x) => x.id === pot.id)!.circle!.centre);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(Math.hypot(centres[i]![0] - centres[j]![0], centres[i]![1] - centres[j]![1])).toBeGreaterThanOrEqual(300);
  });

  it('a neighbour’s patio is not somewhere to stand your pots', () => {
    const pot = potAt(5000, 500, 300, 'Pot');
    const start = list({ ...patio, nextDoor: true }, pot);
    const g = planFromList(start, isListed(start));
    expect(pointInPolygon(g.features.find((x) => x.id === pot.id)!.circle!.centre, patio.footprint)).toBe(false);
  });

  it('a boundary at an angle keeps its shape', () => {
    const turned: Garden['boundary'] = [[0, 2000], [2000, 0], [4000, 2000], [2000, 4000]];
    const bed = bedAt(6000, 0, 1200, 1200, 'Bed');
    const start = { ...list(bed), boundary: turned };
    expect(planFromList(start, isListed(start)).boundary).toEqual(turned);
  });

  it('a pot takes its plants with it', () => {
    const pot = potAt(5000, 500, 300, 'Bay pot');
    const pl = makePlanting(plantOf('bay'), pot.id, 'single', [5000, 500]);
    const start = addPlanting(list(patio, pot), pl);
    const g = planFromList(start, isListed(start));
    const c = g.features.find((x) => x.id === pot.id)!.circle!.centre;
    expect([g.plantings[0]!.x, g.plantings[0]!.y]).toEqual(c);
  });

  it('with no paving, the boundary grows to hold them', () => {
    const pot = potAt(6000, 500, 300, 'Pot');
    const start = list(pot);
    const g = planFromList(start, isListed(start));
    expect(pointInPolygon(g.features.find((x) => x.id === pot.id)!.circle!.centre, g.boundary)).toBe(true);
  });

  it('a garden with nothing outside keeps its boundary', () => {
    const bed = bedAt(500, 500, 1200, 1200, 'Bed');
    const start = list(bed);
    expect(planFromList(start, isListed(start)).boundary).toEqual(edge);
  });

  it('leaves a list with no outline alone', () => {
    const bed = bedAt(500, 500, 1200, 1200, 'Bed');
    const start = { ...list(bed), boundary: [] };
    expect(planFromList(start, isListed(start)).boundary).toEqual([]);
  });
});

describe('a tree in a pot', () => {
  it('is picked where it’s drawn, not 2 m away', () => {
    const pot = potAt(1000, 1000, 300, 'Apple pot');
    const pl = makePlanting(plantOf('apple'), pot.id, 'single', [1000, 1000]);
    const g = addPlanting(addFeature(newGarden(), pot), pl);
    expect(hitPlanting(g, plantOf, [1050, 1000], 10)?.id).toBe(pl.id);
    expect(hitPlanting(g, plantOf, [2500, 1000], 10)).toBeNull();
  });
});

describe('warnings for what lands in the wrong place', () => {
  const lawn = makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 5000, h: 5000 }) });
  it('a row of leeks on the lawn says so (Callum)', () => {
    const row = makePlanting(plantOf('leek'), lawn.id, 'row', [500, 500], [2500, 500]);
    const found = warns(addPlanting(addFeature(newGarden(), lawn), row), 'outside');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/on the lawn/);
  });
  it('crocuses in the lawn are meant to be there', () => {
    const pl = makePlanting(plantOf('crocus'), lawn.id, 'single', [500, 500]);
    expect(warns(addPlanting(addFeature(newGarden(), lawn), pl), 'outside')).toEqual([]);
  });
  it('a bed drawn over another says so, and pots in a greenhouse don’t', () => {
    const a = bedAt(0, 0, 2000, 1200, 'Bed 1');
    const b = bedAt(1500, 300, 2000, 1200, 'Bed 2');
    expect(warns(addFeature(addFeature(newGarden(), a), b), 'overlap')).toHaveLength(1);
    const house = { ...makeFeature('greenhouse', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1800 }) }), name: 'Greenhouse' };
    const pot = potAt(500, 500, 300, 'Pot');
    expect(warns(addFeature(addFeature(newGarden(), house), pot), 'overlap')).toEqual([]);
  });
  it('beds clear of each other say nothing, nor do beds touching along an edge', () => {
    const a = bedAt(0, 0, 2000, 1200, 'Bed 1');
    for (const x of [2600, 2000]) expect(warns(addFeature(addFeature(newGarden(), a), bedAt(x, 0, 2000, 1200, 'Bed 2')), 'overlap')).toEqual([]);
  });
  it('beds crossed like a plus sign do overlap, though no corner is inside the other', () => {
    const a = bedAt(0, 900, 3000, 600, 'Bed 1');
    const b = bedAt(1200, 0, 600, 2400, 'Bed 2');
    expect(warns(addFeature(addFeature(newGarden(), a), b), 'overlap')).toHaveLength(1);
  });
  it('herbs on a lawn are left alone: a chamomile lawn is a lawn', () => {
    const pl = makePlanting(plantOf('thyme'), lawn.id, 'single', [500, 500]);
    expect(warns(addPlanting(addFeature(newGarden(), lawn), pl), 'outside').filter((f) => /on the lawn/.test(f.message))).toEqual([]);
  });
});

describe('labels don’t pile up (Jordan, Margaret, Ruth)', () => {
  it('a label that would land on one already there is left off', () => {
    const taken: Parameters<typeof claim>[0] = [];
    expect(claim(taken, { x: 0, y: 0, w: 60, h: 18 })).toBe(true);
    expect(claim(taken, { x: 40, y: 5, w: 60, h: 18 })).toBe(false);
    expect(claim(taken, { x: 70, y: 0, w: 60, h: 18 })).toBe(true);
    expect(taken).toHaveLength(2);
  });
});

describe('Set this ground does what it says (Jordan)', () => {
  it('new ground is unlocked, and setting it sets it', () => {
    const f = makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 1000, h: 1000 }) });
    expect(isSetGround(f, freshTarget(f))).toBe(false);
    closeGround(f.id);
    expect(isSetGround(f, { type: 'feature', id: f.id })).toBe(true);
  });
});

describe('sizes as a gardener types them', () => {
  it('feet and inches (Margaret: "6 ft" was 6 metres)', () => {
    expect(parseLength('6 ft')).toBe(1829);
    expect(parseLength('8ft')).toBe(2438);
    expect(parseLength("6'")).toBe(1829);
    expect(parseLength('6 ft 6 in')).toBe(1981);
    expect(parseLength(`5' 6"`)).toBe(1676);
    expect(parseLength('10 inches')).toBe(254);
  });
  it('reads them as people type them', () => {
    expect(parseLength('6 ft 6')).toBe(1981);
    expect(parseLength(`5'6`)).toBe(1676);
    expect(parseLength('2 metres')).toBe(2000);
    expect(parseLength('0 ft')).toBeNull();
    expect(sizeMm('1.', 'm')).toBe(1000);
    expect(sizeMm('2 metres', 'm')).toBe(2000);
  });
  it('still reads what it did', () => {
    expect(parseLength('3450')).toBe(3450);
    expect(parseLength('3.45m')).toBe(3450);
    expect(parseLength('45 cm')).toBe(450);
    expect(parseLength('nonsense')).toBeNull();
  });
  it('a bare number is in the field’s own unit', () => {
    expect(sizeMm('1.2', 'm')).toBe(1200);
    expect(sizeMm('6 ft', 'm')).toBe(1829);
    expect(sizeMm('25', 'cm')).toBe(250);
    expect(sizeMm('30 cm', 'cm')).toBe(300);
    expect(sizeMm('', 'm')).toBeNull();
  });
  it('a pot typed in metres out of habit is still read as metres', () => {
    expect(sizeMm('0.3', 'cm')).toBe(300);
  });
  it('the usual sizes stand', () => {
    expect(LIST_SIZE.pot[0]).toBe(300);
  });
});
