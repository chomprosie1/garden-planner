// Drawing upgrade (Stage 9): curves through corners, hand-drawn strokes,
// surfaces and their materials, and the sketch layer.

import { describe, expect, it } from 'vitest';
import { hitFeature } from '../src/canvas/hit';
import { smoothClosed, smoothOpen } from '../src/geometry/curve';
import { polygonArea } from '../src/geometry/polygon';
import { simplify, simplifyClosed } from '../src/geometry/simplify';
import { newAppState } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, moveFeature, pointsOf, rectPoints, setPoints, setSmooth } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { addSketch, clearSketches, deleteSketches, makeSketch, sketchesAt } from '../src/model/sketches';
import type { Garden, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { containerAt } from '../src/planting/place';
import { featureShadow } from '../src/sun/shadow';
import { parseFileText, toFile } from '../src/storage/file';

const square: Point[] = rectPoints({ x: 0, y: 0, w: 2000, h: 2000 });
const has = (pts: Point[], p: Point) => pts.some((q) => q[0] === p[0] && q[1] === p[1]);
const garden = (): Garden => newAppState().garden;

describe('curves', () => {
  it('a closed curve passes through every corner and bulges smoothly between them', () => {
    const curve = smoothClosed(square);
    for (const c of square) expect(has(curve, c)).toBe(true);
    expect(curve.length).toBeGreaterThan(30);
    const area = polygonArea(curve);
    expect(area).toBeGreaterThan(polygonArea(square));
    expect(area).toBeLessThan(Math.PI * 1414 ** 2 * 1.05);
  });

  it('an open curve runs from the first point to the last, through the middle ones', () => {
    const pts: Point[] = [[0, 0], [1000, 800], [2000, 0], [3000, 800]];
    const curve = smoothOpen(pts);
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[curve.length - 1]).toEqual([3000, 800]);
    expect(has(curve, [1000, 800])).toBe(true);
    expect(has(curve, [2000, 0])).toBe(true);
  });

  it('leaves two-point lines and triangles of repeated points alone', () => {
    expect(smoothOpen([[0, 0], [100, 0]])).toEqual([[0, 0], [100, 0]]);
    expect(smoothClosed([[0, 0], [0, 0], [5, 5]]).length).toBeLessThan(3);
  });
});

describe('hand-drawn strokes', () => {
  it('a wobbly straight stroke becomes its two ends', () => {
    const wobbly: Point[] = Array.from({ length: 50 }, (_, i) => [i * 100, i % 2 ? 8 : -8]);
    expect(simplify(wobbly, 20)).toEqual([[0, -8], [4900, 8]]);
  });
  it('keeps a real corner', () => {
    const l: Point[] = [...Array.from({ length: 20 }, (_, i): Point => [i * 100, 0]), ...Array.from({ length: 20 }, (_, i): Point => [1900, (i + 1) * 100])];
    const out = simplify(l, 20);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual([1900, 0]);
  });
  it('a loop drawn round a circle keeps enough corners for a curved outline', () => {
    const loop: Point[] = Array.from({ length: 120 }, (_, i) => [Math.round(1000 * Math.cos((i / 120) * Math.PI * 2)), Math.round(1000 * Math.sin((i / 120) * Math.PI * 2))]);
    const corners = simplifyClosed(loop, 30);
    expect(corners.length).toBeGreaterThanOrEqual(6);
    expect(corners.length).toBeLessThan(30);
    // The curve through them is close to the circle drawn.
    expect(polygonArea(smoothClosed(corners))).toBeCloseTo(Math.PI * 1000 ** 2, -5);
  });
});

describe('curved features', () => {
  it('a curved bed keeps its corners to edit and is measured and planted along the curve', () => {
    const bed = makeFeature('bed', { area: square }, { smooth: true });
    expect(bed.controls).toEqual(square);
    expect(bed.footprint.length).toBeGreaterThan(30);
    const g = addFeature(garden(), bed);
    expect(pointsOf(g, { type: 'feature', id: bed.id })).toEqual(square);
    // Just outside the square's edge but inside the curve's bulge.
    expect(containerAt(g, [1000, 2150])?.id).toBe(bed.id);
  });

  it('curves can be turned on and off, getting the corners back exactly', () => {
    const bed = makeFeature('bed', { area: square });
    let g = addFeature(garden(), bed);
    g = setSmooth(g, bed.id, true);
    expect(g.features[0]!.controls).toEqual(square);
    g = setSmooth(g, bed.id, false);
    expect(g.features[0]!.footprint).toEqual(square);
    expect(g.features[0]!.controls).toBeUndefined();
    expect(g.features[0]!.smooth).toBeUndefined();
  });

  it('moving a corner or the whole shape redraws the curve', () => {
    const bed = makeFeature('bed', { area: square }, { smooth: true });
    let g = addFeature(garden(), bed);
    const before = polygonArea(g.features[0]!.footprint);
    g = setPoints(g, { type: 'feature', id: bed.id }, [[0, 0], [4000, 0], [4000, 2000], [0, 2000]]);
    expect(polygonArea(g.features[0]!.footprint)).toBeGreaterThan(before * 1.5);
    g = moveFeature(g, bed.id, 500, 0);
    expect(g.features[0]!.controls![0]).toEqual([500, 0]);
    expect(has(g.features[0]!.footprint, [500, 0])).toBe(true);
  });

  it('a curved path is thickened along its curve', () => {
    const path = makeFeature('path', { line: [[0, 0], [2000, 1000], [4000, 0]] }, { smooth: true });
    const straight = makeFeature('path', { line: [[0, 0], [2000, 1000], [4000, 0]] });
    expect(path.footprint.length).toBeGreaterThan(straight.footprint.length);
  });
});

describe('surfaces', () => {
  it('start as lawn and are named after what they are made of', () => {
    const lawn = makeFeature('surface', { area: square });
    expect(lawn.material).toBe('lawn');
    expect(featureLabel(lawn)).toBe('Lawn');
    expect(featureLabel({ ...lawn, material: 'gravel' })).toBe('Gravel');
    expect(featureLabel({ ...lawn, material: 'gravel', name: 'Front' })).toBe('Front');
  });

  it('lie underneath: a bed on a lawn is picked first, even if the lawn was drawn later', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 500, y: 500, w: 500, h: 500 }) });
    const lawn = makeFeature('surface', { area: square });
    const g = addFeature(addFeature(garden(), bed), lawn);
    expect(hitFeature(g, [700, 700], 0)?.id).toBe(bed.id);
    expect(hitFeature(g, [1800, 1800], 0)?.id).toBe(lawn.id);
  });

  it('are flat, so cast no shade; plants go in a lawn but not on paving', () => {
    const lawn = makeFeature('surface', { area: square });
    expect(featureShadow(lawn, [0.5, 0.5], 6)).toBeNull();
    expect(containerAt(addFeature(garden(), lawn), [1000, 1000])?.id).toBe(lawn.id);
    expect(containerAt(addFeature(garden(), { ...lawn, material: 'paving' }), [1000, 1000])).toBeNull();
  });
});

describe('sketches', () => {
  it('a pen stroke is thinned to the points that keep its shape', () => {
    const k = makeSketch('pen', 'red', Array.from({ length: 40 }, (_, i): Point => [i * 50, 0]), { toleranceMm: 10 });
    expect(k.points).toEqual([[0, 0], [1950, 0]]);
    expect(k.widthMm).toBeGreaterThan(0);
  });

  it('an arrow keeps its tail and head; empty words and zero-length arrows are not added', () => {
    const arrow = makeSketch('arrow', 'blue', [[0, 0], [100, 100], [500, 0]]);
    expect(arrow.points).toEqual([[0, 0], [500, 0]]);
    const g = garden();
    expect(addSketch(g, makeSketch('text', 'ink', [[0, 0]], { text: '  ' }))).toBe(g);
    expect(addSketch(g, makeSketch('arrow', 'ink', [[5, 5], [5, 5]]))).toBe(g);
  });

  it('are found under the pointer, rubbed out, and cleared, each one undo step', () => {
    let g = garden();
    const line = makeSketch('pen', 'green', [[0, 0], [1000, 0]]);
    const words = makeSketch('text', 'ink', [[0, 2000]], { text: 'Pond here?' });
    g = addSketch(addSketch(g, line), words);
    expect(sketchesAt(g, [500, 30], 10).map((k) => k.id)).toEqual([line.id]);
    expect(sketchesAt(g, [600, 2000], 10).map((k) => k.id)).toEqual([words.id]);
    expect(sketchesAt(g, [500, 800], 10)).toEqual([]);
    g = deleteSketches(g, [line.id]);
    expect(g.sketches).toHaveLength(1);
    expect(clearSketches(g).sketches).toEqual([]);
    expect(clearSketches(clearSketches(g))).toEqual(clearSketches(g));
  });
});

describe('schema 5', () => {
  it('saves and loads surfaces, curves and sketches without losing anything', () => {
    let g = addFeature(garden(), { ...makeFeature('surface', { area: square }, { smooth: true }), material: 'meadow' });
    g = addFeature(g, makeFeature('path', { line: [[0, 0], [1000, 500], [2000, 0]] }, { smooth: true }));
    g = addSketch(g, makeSketch('text', 'yellow', [[100, 100]], { text: 'Shady corner' }));
    const result = parseFileText(JSON.stringify(toFile({ garden: g, userPlants: [] })));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.garden).toEqual({ ...g, schemaVersion: SCHEMA_VERSION });
  });

  it('older gardens load, and unknown materials or sketch colours are refused', () => {
    expect((migrateGarden({ ...garden(), schemaVersion: 4 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
    const lawn = makeFeature('surface', { area: square });
    expect(validateGarden({ ...garden(), features: [{ ...lawn, material: 'astroturf' }] }).length).toBe(1);
    const k = makeSketch('pen', 'red', [[0, 0], [10, 10]]);
    expect(validateGarden({ ...garden(), sketches: [{ ...k, colour: 'purple' }] }).length).toBe(1);
    expect(validateGarden({ ...garden(), features: [{ ...lawn, smooth: true, controls: [[0, 0]] }] }).length).toBe(1);
  });
});
