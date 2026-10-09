// Release 25, build the garden: the house and everyday things, garden shapes
// with a side return, typed lengths, the tape measure and straightening a photo.

import { describe, expect, it } from 'vitest';
import { bounds, pointInPolygon, polygonArea } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, rectInfo, rectPoints, setEdgeLength } from '../src/model/features';
import { goodCorners, homography, project, straightenPlan } from '../src/geometry/straighten';
import type { Point } from '../src/model/types';
import { fitSideReturn, HOUSE_DEPTH_MM, makeSpace, spaceBoundary } from '../src/model/spaces';
import { stickerById, stickerFeature, STICKERS } from '../src/model/stickers';
import { validateGarden } from '../src/model/validate';
import { buildScene } from '../src/three/scene';
import { obstaclesOf, walkStart } from '../src/three/walk';
import { unknownPlant } from '../src/planting/place';
import { SIMPLE_STICKERS } from '../src/ui/planMode';

describe('a house and everyday things', () => {
  const ids = ['house', 'water-butt', 'gate', 'bench', 'table', 'bins', 'washing-line', 'steps', 'bird-bath', 'bird-feeder', 'bee-hotel'];

  it('makes each one at its size, named, with its height', () => {
    for (const id of ids) {
      const s = stickerById(id)!;
      expect(s, id).toBeTruthy();
      const f = stickerFeature(s, [5000, 5000]);
      expect(featureLabel(f), id).toBe(s.label);
      if (s.heightMm !== undefined) expect(f.heightMm, id).toBe(s.heightMm);
      expect(f.footprint.length, id).toBeGreaterThanOrEqual(3);
    }
    const house = stickerFeature(stickerById('house')!, [0, 0]);
    expect(house.kind).toBe('building');
    expect(Math.abs(polygonArea(house.footprint)) / 1e6).toBe(35);
  });

  it('draws a washing line thin, blocking almost no light', () => {
    const f = stickerFeature(stickerById('washing-line')!, [0, 0]);
    expect(f.widthMm).toBe(20);
    expect(f.opacityInLeaf).toBeLessThan(0.1);
    const b = bounds(f.footprint)!;
    expect(b.maxY - b.minY).toBeLessThanOrEqual(20);
  });

  it('offers them in Simple too', () => {
    for (const id of ids) expect(SIMPLE_STICKERS.includes(id), id).toBe(true);
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
  });
});

describe('the house and the shape of the garden', () => {
  it('puts the house along the bottom of a garden or patio, outside it', () => {
    for (const space of ['garden', 'patio'] as const) {
      const g = makeSpace(newGarden(), space, 8000, 12000);
      const house = g.features.find((f) => f.name === 'House')!;
      const b = bounds(house.footprint)!;
      expect(b, space).toEqual({ minX: 0, minY: -HOUSE_DEPTH_MM, maxX: 8000, maxY: 0 });
      expect(house.heightMm).toBeGreaterThan(6000);
    }
    for (const space of ['balcony', 'allotment', 'bed'] as const) expect(makeSpace(newGarden(), space, 3000, 5000).features.some((f) => f.name === 'House'), space).toBe(false);
  });

  it('makes an L with a side return, on the left or the right', () => {
    const left = spaceBoundary(8000, 12000, { width: 1200, length: 3000 });
    expect(Math.abs(polygonArea(left))).toBe(8000 * 12000 - 6800 * 3000);
    expect(pointInPolygon([600, 1500], left)).toBe(true);
    expect(pointInPolygon([5000, 1500], left)).toBe(false);
    const right = spaceBoundary(8000, 12000, { width: 1200, length: 3000, onRight: true });
    expect(Math.abs(polygonArea(right))).toBe(Math.abs(polygonArea(left)));
    expect(pointInPolygon([7400, 1500], right)).toBe(true);
    expect(pointInPolygon([600, 1500], right)).toBe(false);
  });

  it('lays out the garden above the side return, with the extension beside it and a path down it', () => {
    for (const onRight of [false, true]) {
      const g = makeSpace(newGarden(), 'garden', 8000, 14000, { width: 1200, length: 3000, onRight });
      expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
      const ext = g.features.find((f) => f.name === 'Extension')!;
      const strip = g.features.find((f) => f.name === 'Side return')!;
      expect(bounds(ext.footprint)).toEqual(onRight ? { minX: 0, minY: 0, maxX: 6800, maxY: 3000 } : { minX: 1200, minY: 0, maxX: 8000, maxY: 3000 });
      expect(bounds(strip.footprint)).toEqual(onRight ? { minX: 6800, minY: 0, maxX: 8000, maxY: 3000 } : { minX: 0, minY: 0, maxX: 1200, maxY: 3000 });
      // Everything else is in the full-width part, above the return.
      for (const f of g.features.filter((x) => !['House', 'Extension', 'Side return'].includes(x.name ?? ''))) expect(bounds(f.footprint)!.minY, featureLabel(f)).toBeGreaterThanOrEqual(3000);
    }
  });

  it('keeps a side return sensible', () => {
    expect(fitSideReturn({ width: 50, length: 100 }, 8000, 12000)).toEqual({ width: 600, length: 1000 });
    // Too small for one: the garden stays a rectangle.
    expect(fitSideReturn({ width: 1200, length: 3000 }, 1500, 1500)).toBeNull();
    const small = makeSpace(newGarden(), 'patio', 1500, 1500, { width: 1200, length: 3000 });
    expect(small.boundary).toHaveLength(4);
    expect(fitSideReturn({ width: 9000, length: 20000 }, 8000, 12000)).toEqual({ width: 6500, length: 6000 });
    expect(fitSideReturn({ width: 1000, length: 2000, onRight: true }, 8000, 12000)).toEqual({ width: 1000, length: 2000, onRight: true });
  });

  it('starts a walk in the garden, not in the house or the extension', () => {
    const g = makeSpace(newGarden(), 'garden', 8000, 14000, { width: 1200, length: 3000 });
    const s = buildScene({ garden: g, plantOf: unknownPlant, date: '2027-07-01' });
    const { at } = walkStart(s, obstaclesOf(s));
    expect(pointInPolygon(at, g.boundary)).toBe(true);
    expect(at[1]).toBeGreaterThan(3000);
  });
});

describe('typed lengths', () => {
  const g0 = newGarden();
  const g = { ...g0, boundary: spaceBoundary(8000, 12000) };

  it('stretches a rectangle from its far side, keeping it square', () => {
    const next = setEdgeLength(g, { type: 'boundary' }, 0, 10000);
    expect(next.boundary).toEqual([
      [0, 0],
      [10000, 0],
      [10000, 12000],
      [0, 12000],
    ]);
  });

  it('stretches an L along its long side, and moves only one corner where the next edge isn’t square', () => {
    const l = { ...g0, boundary: spaceBoundary(8000, 12000, { width: 1200, length: 3000 }) };
    // The side return's length (edge 1, from (1200, 0) to (1200, 3000)) to 4 m: the extension's top edge moves up with it.
    const next = setEdgeLength(l, { type: 'boundary' }, 1, 4000);
    expect(next.boundary.slice(1, 4)).toEqual([
      [1200, 0],
      [1200, 4000],
      [8000, 4000],
    ]);
    const tri = { ...g0, boundary: [[0, 0], [4000, 0], [0, 3000]] as [number, number][] };
    const t2 = setEdgeLength(tri, { type: 'boundary' }, 0, 5000);
    expect(t2.boundary).toEqual([
      [0, 0],
      [5000, 0],
      [0, 3000],
    ]);
  });

  it('lengthens a bed and a fence', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) });
    const fence = makeFeature('fence', { line: [[0, 0], [3000, 0]] });
    let h = addFeature(addFeature(newGarden(), bed), fence);
    h = setEdgeLength(h, { type: 'feature', id: bed.id }, 1, 1500);
    expect(rectInfo(h.features[0]!.footprint)).toMatchObject({ w: 2400, h: 1500 });
    h = setEdgeLength(h, { type: 'feature', id: fence.id }, 0, 4500);
    expect(h.features[1]!.line).toEqual([
      [0, 0],
      [4500, 0],
    ]);
  });

  it('ignores a length of nothing', () => {
    expect(setEdgeLength(g, { type: 'boundary' }, 0, 0)).toBe(g);
  });
});

describe('straightening a photo', () => {
  // A camera looking down the garden at an angle: ground (mm) to photo (px), with the far end squeezed.
  const camera = homography(
    [
      [0, 0],
      [6000, 0],
      [6000, 9000],
      [0, 9000],
    ],
    [
      [200, 1400],
      [1800, 1400],
      [1350, 500],
      [650, 500],
    ],
  )!;

  it('finds the transform that takes four points to four others', () => {
    expect(project(camera, [0, 0])[0]).toBeCloseTo(200, 6);
    expect(project(camera, [6000, 9000])[1]).toBeCloseTo(500, 6);
    // Straight lines stay straight: the middle of the near edge is between its ends.
    const mid = project(camera, [3000, 0]);
    expect(mid[1]).toBeCloseTo(1400, 6);
  });

  it('makes a picture whose pixels come from the right places in the photo', () => {
    const corners: Point[] = [
      [0, 0],
      [3000, 0],
      [3000, 4000],
      [0, 4000],
    ].map((p) => project(camera, p as Point));
    const plan = straightenPlan(corners, 3000, 4000, { width: 2000, height: 1600 })!;
    expect(plan).toBeTruthy();
    // The rectangle's first corner is at (0, 0) on the ground: picture pixel (−minX, maxY) in scale.
    const scale = plan.width / (plan.maxX - plan.minX);
    const at = (x: number, y: number) => project(plan.toPhoto, [(x - plan.minX) * scale, (plan.maxY - y) * scale]);
    for (const [gx, gy] of [
      [0, 0],
      [3000, 0],
      [3000, 4000],
      [1500, 2000],
    ]) {
      const want = project(camera, [gx!, gy!]);
      const got = at(gx!, gy!);
      expect(got[0]).toBeCloseTo(want[0], 3);
      expect(got[1]).toBeCloseTo(want[1], 3);
    }
    expect(plan.width).toBeLessThanOrEqual(2400);
    expect(plan.height).toBeLessThanOrEqual(2400);
    expect(plan.minX).toBeGreaterThanOrEqual(-3000);
    expect(plan.maxY).toBeLessThanOrEqual(8000);
  });

  it('refuses corners that cross over or sit on top of each other', () => {
    expect(goodCorners([[0, 0], [100, 100], [100, 0], [0, 100]])).toBe(false);
    expect(goodCorners([[0, 0], [2, 2], [100, 100], [0, 100]])).toBe(false);
    expect(goodCorners([[0, 0], [100, 0], [100, 100], [0, 100]])).toBe(true);
    expect(straightenPlan([[0, 0], [100, 100], [100, 0], [0, 100]], 1000, 1000, { width: 200, height: 200 })).toBeNull();
  });
});
