import { describe, expect, it } from 'vitest';
import vegetables from '../data/plants/vegetable.json';
import { hitEdge, hitFeature, hitVertex, pickAt } from '../src/canvas/hit';
import { parseLength, snapPoint, snapStepFor } from '../src/canvas/snap';
import { fit, formatArea, formatLength, gridStep, scaleBarLength, toScreen, toWorld, zoomAt } from '../src/canvas/viewport';
import { centroid, lineLength, polygonArea } from '../src/geometry/polygon';
import { newAppState } from '../src/model/defaults';
import {
  addFeature,
  asRect,
  deleteFeatures,
  duplicateFeature,
  insertVertex,
  makeFeature,
  moveFeature,
  moveVertex,
  rectPoints,
  removeVertex,
  resizeRect,
  restack,
  updateFeature,
} from '../src/model/features';
import { createStore, updateGarden } from '../src/model/store';
import type { Garden, Plant, Planting, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';

const garden = (): Garden => ({ ...newAppState().garden, boundary: rectPoints({ x: 0, y: 0, w: 10000, h: 14000 }) });

describe('viewport', () => {
  const v = { scale: 0.05, ox: 100, oy: 800 };

  it('round-trips between garden and screen, with y pointing up in the garden', () => {
    const p: Point = [3450, 1200];
    const s = toScreen(v, p);
    expect(s).toEqual([100 + 3450 * 0.05, 800 - 1200 * 0.05]);
    const back = toWorld(v, s);
    expect(back[0]).toBeCloseTo(3450);
    expect(back[1]).toBeCloseTo(1200);
  });

  it('zooms around the cursor without moving the point under it', () => {
    const at: Point = [400, 300];
    const before = toWorld(v, at);
    const after = toWorld(zoomAt(v, 2, at), at);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('fits a 10 × 14 m garden inside the screen', () => {
    const f = fit({ minX: 0, minY: 0, maxX: 10000, maxY: 14000 }, 800, 600, 40);
    const [x0, y0] = toScreen(f, [0, 14000]);
    const [x1, y1] = toScreen(f, [10000, 0]);
    expect(x0).toBeGreaterThanOrEqual(39.9);
    expect(y0).toBeGreaterThanOrEqual(39.9);
    expect(x1).toBeLessThanOrEqual(760.1);
    expect(y1).toBeLessThanOrEqual(560.1);
  });

  it('picks a readable grid and scale bar for the zoom', () => {
    expect(gridStep(0.2).minor).toBe(100);
    expect(gridStep(0.02).minor).toBe(1000);
    expect(scaleBarLength(0.06)).toBe(2000);
  });

  it('formats lengths and areas', () => {
    expect(formatLength(850)).toBe('850 mm');
    expect(formatLength(3450)).toBe('3.45 m');
    expect(formatLength(12000)).toBe('12 m');
    expect(formatArea(140_000_000)).toBe('140.0 m²');
  });
});

describe('snapping', () => {
  const base = { vertices: [[1000, 1000]] as Point[], gridMm: 100, toleranceMm: 80 };

  it('prefers an existing corner', () => {
    expect(snapPoint([1040, 960], base)).toEqual({ point: [1000, 1000], kind: 'vertex' });
  });

  it('locks to 45° from the last point when close, keeping a grid length', () => {
    const r = snapPoint([3020, 70], { ...base, from: [0, 0] });
    expect(r.kind).toBe('angle');
    expect(r.point).toEqual([3000, 0]);
  });

  it('falls back to the grid, and Alt turns snapping off', () => {
    expect(snapPoint([2349, 5551], base)).toEqual({ point: [2300, 5600], kind: 'grid' });
    expect(snapPoint([2349.4, 5551.2], { ...base, free: true })).toEqual({ point: [2349, 5551], kind: 'none' });
  });

  it('uses a finer step when zoomed in', () => {
    expect(snapStepFor(1)).toBe(10);
    expect(snapStepFor(0.05)).toBe(250);
  });

  it('reads typed lengths in mm, cm or m', () => {
    expect(parseLength('3450')).toBe(3450);
    expect(parseLength('3.45')).toBe(3450);
    expect(parseLength('3.45m')).toBe(3450);
    expect(parseLength('345cm')).toBe(3450);
    expect(parseLength('3,45 m')).toBe(3450);
    expect(parseLength('abc')).toBeNull();
    expect(parseLength('0')).toBeNull();
  });
});

describe('features', () => {
  it('makes a bed with its kind’s defaults', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 500, y: 500, w: 3000, h: 1200 }) });
    expect(bed).toMatchObject({ kind: 'bed', heightMm: 300 });
    expect(polygonArea(bed.footprint)).toBe(3_600_000);
  });

  it('makes a fence from its centre line, 50 mm thick and 1.8 m high', () => {
    const fence = makeFeature('fence', { line: [[0, 0], [10000, 0]] });
    expect(fence).toMatchObject({ widthMm: 50, heightMm: 1800, opacityInLeaf: 1 });
    expect(polygonArea(fence.footprint)).toBe(500_000);
    expect(lineLength(fence.line!)).toBe(10000);
  });

  it('makes a deciduous tree as a circle', () => {
    const tree = makeFeature('tree', { circle: { centre: [5000, 7000], radiusMm: 2000 } });
    expect(tree).toMatchObject({ deciduous: true, opacityInLeaf: 0.7, opacityBare: 0.2 });
    expect(tree.footprint).toHaveLength(32);
    expect(centroid(tree.footprint)[0]).toBeCloseTo(5000, -1);
  });

  it('moves, duplicates, restacks and deletes', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1000, h: 1000 }) });
    let g = addFeature(garden(), bed);
    g = moveFeature(g, bed.id, 250, -100);
    expect(g.features[0]!.footprint[0]).toEqual([250, -100]);
    const [g2, copyId] = duplicateFeature(g, bed.id);
    expect(g2.features).toHaveLength(2);
    expect(g2.features[1]!.id).toBe(copyId);
    expect(g2.features[1]!.footprint[0]).toEqual([750, -600]);
    expect(restack(g2, bed.id, 'top').features[1]!.id).toBe(bed.id);
    expect(deleteFeatures(g2, [bed.id]).features.map((f) => f.id)).toEqual([copyId]);
  });

  it('moves a fence by its centre line, and regenerates the outline when thickness changes', () => {
    const fence = makeFeature('fence', { line: [[0, 0], [2000, 0]] });
    let g = addFeature(garden(), fence);
    g = moveFeature(g, fence.id, 0, 500);
    expect(g.features[0]!.line).toEqual([[0, 500], [2000, 500]]);
    g = updateFeature(g, fence.id, { widthMm: 200 });
    expect(polygonArea(g.features[0]!.footprint)).toBe(400_000);
  });

  it('edits corners on the boundary and on features', () => {
    const t = { type: 'boundary' } as const;
    let g = garden();
    g = moveVertex(g, t, 2, [10500, 14000]);
    expect(g.boundary[2]).toEqual([10500, 14000]);
    g = insertVertex(g, t, 0, [5000, -200]);
    expect(g.boundary).toHaveLength(5);
    g = removeVertex(g, t, 1);
    expect(g.boundary).toHaveLength(4);
    const tri = removeVertex(removeVertex(g, t, 0), t, 0);
    expect(tri.boundary).toHaveLength(3);
    expect(removeVertex(tri, t, 0).boundary).toHaveLength(3); // never fewer than three
  });

  it('recognises and resizes upright rectangles from the top-left corner', () => {
    const pts = rectPoints({ x: 1000, y: 2000, w: 3000, h: 1200 });
    expect(asRect(pts)).toEqual({ x: 1000, y: 2000, w: 3000, h: 1200 });
    expect(asRect([[0, 0], [10, 0], [12, 10], [0, 10]])).toBeNull();
    expect(asRect(resizeRect(pts, 2400, 1000)!)).toEqual({ x: 1000, y: 2200, w: 2400, h: 1000 });
  });

  it('keeps a garden with every kind of feature valid', () => {
    let g = garden();
    g = addFeature(g, makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 100, h: 100 }) }));
    g = addFeature(g, makeFeature('hedge', { line: [[0, 0], [100, 100], [200, 0]] }));
    g = addFeature(g, makeFeature('tree', { circle: { centre: [0, 0], radiusMm: 500 } }));
    expect(validateGarden(g)).toEqual([]);
  });

  it('undoes a drawn feature in one step', () => {
    const store = createStore(newAppState());
    store.apply(updateGarden((g) => addFeature(g, makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1000, h: 500 }) }))));
    expect(store.get().garden.features).toHaveLength(1);
    store.undo();
    expect(store.get().garden.features).toHaveLength(0);
  });
});

describe('hit testing', () => {
  const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2000, h: 1000 }) });
  const shed = makeFeature('building', { area: rectPoints({ x: 1500, y: 500, w: 2000, h: 2000 }) });
  const fence = makeFeature('fence', { line: [[0, 5000], [5000, 5000]] });
  const tree = makeFeature('tree', { circle: { centre: [8000, 8000], radiusMm: 1500 } });
  const g = [bed, shed, fence, tree].reduce(addFeature, garden());

  it('finds the topmost feature', () => {
    expect(hitFeature(g, [1700, 700], 0)?.id).toBe(shed.id);
    expect(hitFeature(g, [500, 500], 0)?.id).toBe(bed.id);
  });

  it('finds thin fences with a tolerance, and trees by their canopy', () => {
    expect(hitFeature(g, [2500, 5060], 50)?.id).toBe(fence.id);
    expect(hitFeature(g, [2500, 5300], 50)).toBeNull();
    expect(hitFeature(g, [9000, 9000], 0)?.id).toBe(tree.id);
  });

  it('finds corners and edges', () => {
    expect(hitVertex(bed.footprint, [2030, 980], 50)).toBe(2);
    expect(hitEdge(bed.footprint, true, [1000, 20], 50)).toEqual({ index: 0, point: [1000, 0] });
    expect(hitEdge(bed.footprint, true, [1000, 500], 50)).toBeNull();
  });
});

describe('what a tap picks: set ground (release 22b)', () => {
  // A lawn with a bed of lettuce on it, and a pot on the bed.
  const library = vegetables as Plant[];
  const plantOf = (id: string) => library.find((p) => p.id === id)!;
  const lawn = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 8000, h: 6000 }) }), material: 'lawn' as const };
  const bed = makeFeature('bed', { area: rectPoints({ x: 2000, y: 2000, w: 3000, h: 1200 }) });
  const pot = makeFeature('pot', { circle: { centre: [4500, 2600], radiusMm: 200 } });
  const lettuce: Planting = { id: 'pl-lettuce', plantId: 'lettuce', featureId: bed.id, x: 2500, y: 2600 };
  const g: Garden = { ...[lawn, bed, pot].reduce(addFeature, garden()), plantings: [lettuce] };
  const tol = { planting: 30, feature: 30 };
  const tap = (p: Point, selected: Parameters<typeof pickAt>[4], layoutOnly = false) => pickAt(g, plantOf, p, tol, selected, layoutOnly);

  it('reaches a bed or plant on the lawn, even with the lawn selected', () => {
    const lawnSelected = { type: 'feature' as const, id: lawn.id };
    expect(tap([3500, 2300], lawnSelected)).toEqual({ type: 'feature', id: bed.id });
    expect(tap([2500, 2600], lawnSelected)).toEqual({ type: 'planting', id: lettuce.id });
    expect(tap([3500, 2300], null)).toEqual({ type: 'feature', id: bed.id });
  });

  it('picks set ground where nothing is on it, and keeps it set', () => {
    expect(tap([500, 500], null)).toEqual({ type: 'feature', id: lawn.id });
    expect(tap([500, 500], { type: 'feature', id: lawn.id })).toEqual({ type: 'feature', id: lawn.id });
  });

  it('brings unlocked ground to the front, and keeps it unlocked', () => {
    const open = { type: 'feature' as const, id: lawn.id, open: true as const };
    expect(tap([3500, 2300], open)).toEqual(open);
    expect(tap([2500, 2600], open)).toEqual(open);
    expect(tap([500, 500], open)).toEqual(open);
  });

  it('still lets a selected pot be dragged off what is under it', () => {
    const lettuceUnderPot: Planting = { ...lettuce, id: 'pl-under', x: 4500, y: 2600 };
    const withPlant = { ...g, plantings: [lettuce, lettuceUnderPot] };
    const sel = { type: 'feature' as const, id: pot.id };
    expect(pickAt(withPlant, plantOf, [4500, 2600], tol, sel, false)).toEqual(sel);
    expect(pickAt(withPlant, plantOf, [4500, 2600], tol, null, false)).toEqual({ type: 'planting', id: 'pl-under' });
  });

  it('skips plants when only the layout is being drawn', () => {
    expect(tap([2500, 2600], null, true)).toEqual({ type: 'feature', id: bed.id });
  });
});
