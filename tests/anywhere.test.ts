// Release 6: plants on lawns and other soft ground, small, medium and large
// plants, tree types, and plants drawn by height.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor } from '../src/calendar/jobs';
import { gapsOn } from '../src/lifecycle/projection';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, placeLabel, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { stickerById, stickerFeature, treeStickerId } from '../src/model/stickers';
import { asTree, findTrees, makeTree, TREE_TYPES, treeSize, treeType } from '../src/model/trees';
import type { Feature, Garden, Material, Plant, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { defaultFill, fillsFor } from '../src/planting/fill';
import { addPlanting, byHeight, canHold, canResize, containerAt, isContainer, makePlanting, movePlanting, setPlantingMm, setPlantingSize, sizedPlant, spreadOf, unknownPlant } from '../src/planting/place';
import { checkGarden } from '../src/planting/rules';

const library = [...vegetables, ...flowers, ...fruit] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const garden = (...fs: Feature[]): Garden => fs.reduce(addFeature, newAppState().garden);
const area = (kind: Feature['kind'], x: number, y: number, w: number, h: number, material?: Material) => {
  const f = makeFeature(kind, { area: rectPoints({ x, y, w, h }) });
  return material ? { ...f, material } : f;
};
const valid = (g: Garden) => validateGarden(JSON.parse(JSON.stringify(g)));

describe('plants on soft ground', () => {
  it('go in lawn, meadow, soil, bark and gravel, but not paving, decking, paths or buildings', () => {
    for (const m of ['lawn', 'meadow', 'soil', 'bark', 'gravel'] as Material[]) expect(canHold(area('surface', 0, 0, 1000, 1000, m)), m).toBe(true);
    for (const m of ['paving', 'decking'] as Material[]) expect(canHold(area('surface', 0, 0, 1000, 1000, m)), m).toBe(false);
    expect(canHold(makeFeature('path', { line: [[0, 0], [3000, 0]] }))).toBe(false);
    expect(canHold(area('building', 0, 0, 2000, 2000))).toBe(false);
    expect(canHold(area('water', 0, 0, 2000, 2000))).toBe(false);
    // A lawn holds plants but isn't a bed: no "Clear this bed", no gaps, no kits.
    expect(isContainer(area('surface', 0, 0, 1000, 1000, 'lawn'))).toBe(false);
  });

  it('a bed on a lawn takes the plant, whichever was added first; off the bed it goes in the lawn', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    const bed = area('bed', 2000, 2000, 2000, 1000);
    for (const g of [garden(lawn, bed), garden(bed, lawn)]) {
      expect(containerAt(g, [3000, 2500])?.id).toBe(bed.id);
      expect(containerAt(g, [8000, 8000])?.id).toBe(lawn.id);
    }
    // Paving or a path on top of the lawn: nothing goes there, but a raised bed on the patio still takes plants.
    const patio = area('surface', 6000, 6000, 3000, 3000, 'paving');
    expect(containerAt(garden(lawn, patio), [7000, 7000])).toBeNull();
    const path = makeFeature('path', { line: [[0, 5000], [10000, 5000]] });
    expect(containerAt(garden(lawn, path), [5000, 5000])).toBeNull();
    const onPatio = area('bed', 7500, 7500, 1000, 1000);
    expect(containerAt(garden(lawn, onPatio, patio), [8000, 8000])?.id).toBe(onPatio.id);
    // A tree over the lawn doesn't stop bulbs going under it.
    const tree = makeTree(treeType('rowan')!, 'medium', [2000, 8000]);
    expect(containerAt(garden(lawn, tree), [2000, 8000])?.id).toBe(lawn.id);
  });

  it('a plant dropped on a lawn is one plant, not a row or the whole lawn', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    expect(defaultFill(plantOf('crocus'), lawn)).toBe('one');
    expect(defaultFill(plantOf('lettuce'), lawn)).toBe('one');
    expect(fillsFor(plantOf('crocus'), lawn)).toEqual(['one']);
  });

  it('moves onto a lawn with its new place, and is never a gap', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    const bed = area('bed', 1000, 1000, 1000, 1000);
    const pl = makePlanting(plantOf('daffodil'), bed.id, 'single', [1500, 1500]);
    const moved = movePlanting(addPlanting(garden(lawn, bed), pl), pl.id, 5000, 5000);
    expect(moved.plantings[0]!.featureId).toBe(lawn.id);
    expect(gapsOn({ ...moved, plantings: moved.plantings.map((p) => ({ ...p, removedOn: '2027-01-01' })) }, plantOf, new Map(), '2027-06-01')).toEqual([]);
  });

  it('jobs and messages say "the lawn"', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    expect(placeLabel(lawn)).toBe('the lawn');
    expect(placeLabel({ ...lawn, name: 'Front lawn' })).toBe('Front lawn');
    expect(placeLabel(area('bed', 0, 0, 1000, 1000))).toBe('Bed');
    const g = addPlanting(garden(lawn), makePlanting(plantOf('crocus'), lawn.id, 'single', [500, 500]));
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const jobs = months.flatMap((m) => jobsFor(g, plantOf, m, 2027));
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) expect(j.where).toMatch(/the lawn/);
  });

  it('a planting left on ground since paved over is warned about', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    const pl = makePlanting(plantOf('crocus'), lawn.id, 'single', [500, 500]);
    const paved = addPlanting(garden({ ...lawn, material: 'paving' }), pl);
    expect(checkGarden(paved, plantOf).find((f) => f.kind === 'no-bed')?.message).toMatch(/paving, which plants can't grow in/);
    expect(checkGarden(addPlanting(garden(lawn), pl), plantOf).filter((f) => f.kind === 'no-bed')).toEqual([]);
  });
});

describe('small, medium and large', () => {
  const apple = plantOf('apple');

  it('only trees, shrubs and big plants offer sizes', () => {
    expect(canResize(apple)).toBe(true);
    expect(canResize(plantOf('blackcurrant'))).toBe(true);
    expect(canResize(plantOf('lettuce'))).toBe(false);
    expect(canResize(plantOf('crocus'))).toBe(false);
  });

  it('scale the library spread, height and spacing; medium is the library', () => {
    const pl = makePlanting(apple, 'b', 'single', [0, 0]);
    expect(sizedPlant(apple, pl)).toBe(apple);
    const small = sizedPlant(apple, { ...pl, size: 'small' });
    const large = sizedPlant(apple, { ...pl, size: 'large' });
    expect(spreadOf(small)).toBe(1500);
    expect(small.size.heightMm).toBe(1500);
    expect(small.size.spacingMm).toBe(1500);
    expect(spreadOf(large)).toBe(4800);
    // The library plant is untouched.
    expect(spreadOf(apple)).toBe(3000);
  });

  it('exact sizes win over small, medium and large; setting a size clears them', () => {
    const pl = makePlanting(apple, 'b', 'single', [0, 0]);
    let g = addPlanting(newAppState().garden, pl);
    g = setPlantingMm(g, pl.id, 'spreadMm', 2200);
    g = setPlantingMm(g, pl.id, 'heightMm', 2500);
    const typed = g.plantings[0]!;
    expect(spreadOf(sizedPlant(apple, { ...typed, size: 'large' }))).toBe(2200);
    expect(sizedPlant(apple, typed).size.heightMm).toBe(2500);
    g = setPlantingSize(g, pl.id, 'small');
    expect(g.plantings[0]).not.toHaveProperty('spreadMm');
    expect(g.plantings[0]!.size).toBe('small');
    g = setPlantingSize(g, pl.id, 'medium');
    expect(g.plantings[0]).not.toHaveProperty('size');
    expect(setPlantingMm(g, pl.id, 'spreadMm', 0).plantings[0]).not.toHaveProperty('spreadMm');
  });

  it("rows and blocks keep the plant's spacing", () => {
    const row = makePlanting(apple, 'b', 'row', [0, 0], [9000, 0]);
    expect(sizedPlant(apple, { ...row, size: 'small' })).toBe(apple);
  });

  it('the spacing check uses the size: two small apples fit where two medium ones would clash', () => {
    const lawn = area('surface', 0, 0, 20000, 20000, 'lawn');
    const a = makePlanting(apple, lawn.id, 'single', [5000, 5000]);
    const b = makePlanting(apple, lawn.id, 'single', [7000, 5000]);
    const spacing = (g: Garden) => checkGarden(g, plantOf).filter((f) => f.kind === 'spacing');
    const g = addPlanting(addPlanting(garden(lawn), a), b);
    expect(spacing(g)).toHaveLength(1);
    const small = setPlantingSize(setPlantingSize(g, a.id, 'small'), b.id, 'small');
    expect(spacing(small)).toEqual([]);
  });

  it('bulbs under a tree are not a squeeze', () => {
    const lawn = area('surface', 0, 0, 20000, 20000, 'lawn');
    const tree = makePlanting(apple, lawn.id, 'single', [5000, 5000]);
    const bulbs = makePlanting(plantOf('daffodil'), lawn.id, 'single', [5300, 5000]);
    expect(checkGarden(addPlanting(addPlanting(garden(lawn), tree), bulbs), plantOf).filter((f) => f.kind === 'spacing')).toEqual([]);
  });

  it('tall plants are drawn (and picked) after short ones, whatever order they were added in', () => {
    const t = makePlanting(apple, 'b', 'single', [0, 0]);
    const c = makePlanting(plantOf('crocus'), 'b', 'single', [0, 0]);
    const l = makePlanting(plantOf('lettuce'), 'b', 'single', [0, 0]);
    expect(byHeight([t, c, l], plantOf).map((p) => p.plantId)).toEqual(['crocus', 'lettuce', 'apple']);
    // A small apple is still taller than the lettuce; the same height keeps the order they were added.
    expect(byHeight([c, { ...c, id: 'c2' }], plantOf).map((p) => p.id)).toEqual([c.id, 'c2']);
  });
});

describe('tree types', () => {
  it('about fifty, with unique ids, sensible sizes and shade', () => {
    expect(TREE_TYPES.length).toBeGreaterThanOrEqual(48);
    expect(new Set(TREE_TYPES.map((t) => t.id)).size).toBe(TREE_TYPES.length);
    for (const t of TREE_TYPES) {
      expect(t.id, t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.heightM, t.id).toBeGreaterThan(1);
      expect(t.heightM, t.id).toBeLessThanOrEqual(25);
      expect(t.spreadM, t.id).toBeGreaterThan(0.5);
      expect(t.inLeaf, t.id).toBeGreaterThan(0);
      expect(t.inLeaf, t.id).toBeLessThanOrEqual(1);
      if (!t.evergreen) expect(t.bare, t.id).toBeLessThan(t.inLeaf);
      if (t.foliage) expect(t.foliage, t.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('favourites come first, and search finds by common or Latin name', () => {
    const all = findTrees('');
    const firstOther = all.findIndex((t) => !t.popular);
    expect(all.slice(firstOther).every((t) => !t.popular)).toBe(true);
    expect(findTrees('birch').map((t) => t.id)).toEqual(['silver-birch', 'himalayan-birch']);
    expect(findTrees('quercus').map((t) => t.id)).toEqual(['oak']);
  });

  it('every type and size makes a valid tree, centred where dropped, with its shade', () => {
    for (const t of TREE_TYPES)
      for (const size of ['small', 'medium', 'large'] as const) {
        const f = stickerFeature(stickerById(treeStickerId(t.id, size))!, [4000, 6000]);
        expect(valid(garden(f)), `${t.id} ${size}`).toEqual([]);
        expect(f.circle!.centre).toEqual([4000, 6000]);
        expect(f.circle!.radiusMm * 2).toBe(treeSize(t, size).spreadMm);
        expect(f.heightMm).toBe(treeSize(t, size).heightMm);
        expect(f.deciduous).toBe(!t.evergreen);
        expect(f.name).toBe(t.name);
      }
  });

  it('small and large scale a typical size; an evergreen blocks the same light all year', () => {
    const birch = treeType('silver-birch')!;
    expect(treeSize(birch, 'medium')).toEqual({ heightMm: 12000, spreadMm: 5000 });
    expect(treeSize(birch, 'small').heightMm).toBeLessThan(12000);
    expect(treeSize(birch, 'large').heightMm).toBeGreaterThan(12000);
    const yew = makeTree(treeType('yew')!, 'medium', [0, 0]);
    expect(yew.opacityBare).toBe(yew.opacityInLeaf);
  });

  it('changing type or size keeps it where it is', () => {
    const f = makeTree(treeType('rowan')!, 'medium', [1000, 2000]);
    const oak = asTree(f, treeType('oak')!, 'large');
    expect(oak.id).toBe(f.id);
    expect(oak.circle!.centre).toEqual([1000, 2000]);
    expect(oak.treeType).toBe('oak');
    expect(oak.footprint.length).toBeGreaterThan(8);
  });

  it('an unknown tree sticker is nothing, and a bad size falls back to medium', () => {
    expect(stickerById('tree:baobab:medium')).toBeUndefined();
    expect(stickerById('tree:rowan:huge')?.tree?.size).toBe('medium');
  });
});

describe('schema 12', () => {
  it('saves as 12 or later; older gardens load unchanged', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(12);
    const old = { ...newAppState().garden, schemaVersion: 11 };
    expect((migrateGarden(old) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('checks sizes and tree types', () => {
    const lawn = area('surface', 0, 0, 10000, 10000, 'lawn');
    const pl = makePlanting(plantOf('apple'), lawn.id, 'single', [500, 500]);
    expect(valid(addPlanting(garden(lawn), { ...pl, size: 'small', spreadMm: 2000, heightMm: 2500 }))).toEqual([]);
    expect(valid(addPlanting(garden(lawn), { ...pl, size: 'huge' as never }))).not.toEqual([]);
    expect(valid(addPlanting(garden(lawn), { ...pl, spreadMm: -5 }))).not.toEqual([]);
    expect(valid(garden({ ...makeTree(treeType('oak')!, 'small', [0, 0] as Point), treeType: 'Not An Id!' }))).not.toEqual([]);
  });
});
