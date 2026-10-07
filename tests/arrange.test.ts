// Stage 13a and 13b: stickers from the dock, pots and planters, dropping a plant
// into a bed and filling it, and rectangles turned to any angle.

import { describe, expect, it } from 'vitest';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { bounds, pointInPolygon } from '../src/geometry/polygon';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectCorners, rectInfo, rectPoints, resizeRectAny, rotateFeature } from '../src/model/features';
import { STICKERS, stickerById, stickerFeature } from '../src/model/stickers';
import type { Feature, Garden, Plant, Planting, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { defaultFill, fillPlanting, fillsFor } from '../src/planting/fill';
import { addPlanting, containerAt, isContainer, makePlanting, plantCount, plantPositions, unknownPlant } from '../src/planting/place';

const library = [...vegetables, ...herbs] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);
const sticker = (id: string, at: Point = [0, 0]) => stickerFeature(stickerById(id)!, at);
const withFeatures = (...fs: Feature[]): Garden => fs.reduce(addFeature, newAppState().garden);

/** A planting made the way a drop makes one: the fill's shape on a fresh planting. */
function dropped(id: string, bed: Feature, at: Point, fill = defaultFill(plant(id), bed)): Planting {
  const shape = fillPlanting(plant(id), bed, fill, at);
  return { ...makePlanting(plant(id), bed.id, 'single', [shape.x, shape.y]), ...shape };
}
const allInside = (pl: Planting, bed: Feature) => plantPositions(pl, plant(pl.plantId)).every((q) => pointInPolygon(q, bed.footprint));

describe('stickers', () => {
  it('each makes a valid feature, centred where it was dropped', () => {
    for (const s of STICKERS) {
      const f = stickerFeature(s, [5000, 7000]);
      expect(validateGarden(JSON.parse(JSON.stringify(withFeatures(f)))), s.id).toEqual([]);
      const b = bounds(f.footprint)!;
      expect(Math.abs((b.minX + b.maxX) / 2 - 5000), s.id).toBeLessThanOrEqual(1);
      expect(Math.abs((b.minY + b.maxY) / 2 - 7000), s.id).toBeLessThanOrEqual(1);
    }
  });

  it('are their real sizes, labelled in one unit', () => {
    const bed = rectInfo(sticker('raised-bed').footprint)!;
    expect([Math.round(bed.w), Math.round(bed.h)]).toEqual([2400, 1200]);
    expect(stickerById('raised-bed')!.size).toBe('2.4 × 1.2 m');
    expect(stickerById('trough')!.size).toBe('100 × 40 cm');
    expect(sticker('pot').circle?.radiusMm).toBe(150);
    expect(sticker('fence').line).toEqual([[-1500, 0], [1500, 0]]);
  });

  it('bring their materials and edging', () => {
    expect(sticker('lawn')).toMatchObject({ kind: 'surface', material: 'lawn' });
    expect(sticker('raised-bed').edging).toBe('timber');
    expect(sticker('long-bed').edging).toBeUndefined();
  });
});

describe('pots and planters', () => {
  it('hold plants, as beds do; trees and fences don’t', () => {
    for (const id of ['raised-bed', 'pot', 'big-pot', 'window-box', 'trough', 'grow-bag', 'greenhouse']) expect(isContainer(sticker(id)), id).toBe(true);
    for (const id of ['tree', 'lawn', 'fence', 'shed']) expect(isContainer(sticker(id)), id).toBe(false);
  });

  it('are found under a point, so plants dropped on them go in them', () => {
    const pot = sticker('big-pot', [3000, 3000]);
    const g = withFeatures(sticker('lawn', [3000, 3000]), pot);
    expect(containerAt(g, [3100, 3000])?.id).toBe(pot.id);
    expect(containerAt(g, [4000, 3000])).toBeNull();
  });
});

describe('dropping a plant into a bed', () => {
  const raised = sticker('raised-bed', [2000, 2000]);
  const windowBox = sticker('window-box', [0, 0]);

  it('picks the usual way for the plant', () => {
    expect(defaultFill(plant('carrot'), raised)).toBe('row');
    expect(defaultFill(plant('onion'), raised)).toBe('row');
    expect(defaultFill(plant('lettuce'), raised)).toBe('fill');
    expect(defaultFill(plant('courgette'), raised)).toBe('one');
    // A window box only has room for one row.
    expect(defaultFill(plant('basil'), windowBox)).toBe('row');
    // A pot of carrots; a pot with room for one lettuce.
    expect(defaultFill(plant('carrot'), sticker('pot'))).toBe('fill');
    expect(defaultFill(plant('lettuce'), sticker('pot'))).toBe('one');
  });

  it('offers only the ways that fit', () => {
    expect(fillsFor(plant('lettuce'), raised)).toEqual(['one', 'row', 'fill']);
    expect(fillsFor(plant('lettuce'), sticker('pot'))).toEqual(['one']);
    expect(fillsFor(plant('courgette'), sticker('small-bed'))).toEqual(['one']);
  });

  it('fills the bed at the plant’s spacing, every plant inside it', () => {
    const pl = dropped('lettuce', raised, [2000, 2000]);
    expect(pl.layout).toBe('block');
    // 250 mm apart in 2.4 × 1.2 m: 9 × 4.
    expect(plantCount(pl, plant('lettuce'))).toBe(36);
    expect(allInside(pl, raised)).toBe(true);
  });

  it('plants a row along the bed through the drop point, half a spacing in from each end', () => {
    const pl = dropped('carrot', raised, [1500, 1800]);
    expect(pl.layout).toBe('row');
    expect([pl.x, pl.y]).toEqual([830, 1800]);
    expect(pl.endPoint).toEqual([3170, 1800]);
    expect(allInside(pl, raised)).toBe(true);
  });

  it('runs a row the long way in a bed that is taller than wide', () => {
    const tall = withFeatures(raised).features[0]!;
    const turned = rotateFeature(withFeatures(tall), tall.id, 90).features[0]!;
    const pl = dropped('carrot', turned, [2000, 2000]);
    expect(pl.x).toBe(2000);
    expect(pl.endPoint![0]).toBe(2000);
    expect(Math.abs(pl.endPoint![1] - pl.y)).toBeGreaterThan(2000);
  });

  it('fills round pots and beds at an angle without spilling over the edge', () => {
    const pot = sticker('big-pot', [0, 0]);
    const inPot = dropped('carrot', pot, [0, 0]);
    expect(inPot.layout).toBe('block');
    expect(plantCount(inPot, plant('carrot'))).toBeGreaterThan(10);
    expect(allInside(inPot, pot)).toBe(true);

    const g = withFeatures(raised);
    const angled = rotateFeature(g, raised.id, 30).features[0]!;
    const pl = dropped('lettuce', angled, [2000, 2000], 'fill');
    expect(pl.layout).toBe('block');
    expect(allInside(pl, angled)).toBe(true);
  });

  it('falls back to one plant where there is no room for more', () => {
    const pl = dropped('lettuce', sticker('pot', [500, 500]), [520, 480], 'fill');
    expect(pl.layout).toBe('single');
    expect([pl.x, pl.y]).toEqual([500, 500]);
  });

  it('makes plantings that save and load', () => {
    const g = addPlanting(withFeatures(raised), dropped('lettuce', raised, [2000, 2000]));
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
  });
});

describe('rectangles at any angle', () => {
  it('are recognised square to the page and turned', () => {
    expect(rectInfo(rectPoints({ x: 0, y: 0, w: 3000, h: 1000 }))).toMatchObject({ cx: 1500, cy: 500, w: 3000, h: 1000, angle: 0 });
    const turned = rectCorners({ cx: 0, cy: 0, w: 2000, h: 1000, angle: Math.PI / 6, turn: 1 });
    const r = rectInfo(turned)!;
    expect(r.w).toBeCloseTo(2000, -1);
    expect(r.h).toBeCloseTo(1000, -1);
    expect(r.angle).toBeCloseTo(Math.PI / 6, 2);
    expect(rectInfo([[0, 0], [3000, 0], [3000, 1000], [500, 1000]])).toBeNull();
    expect(rectInfo([[0, 0], [1, 0], [1, 1]])).toBeNull();
  });

  it('resize about their middle and keep their angle', () => {
    const turned = rectCorners({ cx: 1000, cy: 1000, w: 2000, h: 1000, angle: Math.PI / 4, turn: 1 });
    const resized = rectInfo(resizeRectAny(turned, 3000, 500)!)!;
    expect(resized.w).toBeCloseTo(3000, -1);
    expect(resized.h).toBeCloseTo(500, -1);
    expect(resized.cx).toBeCloseTo(1000, -1);
    expect(resized.cy).toBeCloseTo(1000, -1);
    expect(resized.angle).toBeCloseTo(Math.PI / 4, 2);
    expect(resizeRectAny(turned, 0, 500)).toBeNull();
  });
});

describe('turning things', () => {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), id: 'bed' };
  const planted = (pl: Planting) => addPlanting(withFeatures(bed), pl);

  it('turns a bed about its middle', () => {
    const g = rotateFeature(withFeatures(bed), 'bed', 90);
    const b = bounds(g.features[0]!.footprint)!;
    expect(b).toEqual({ minX: 600, minY: -600, maxX: 1800, maxY: 1800 });
  });

  it('takes its plants with it', () => {
    const row = makePlanting(plant('carrot'), 'bed', 'row', [200, 600], [2200, 600]);
    const g = rotateFeature(planted(row), 'bed', 90);
    const pl = g.plantings[0]!;
    expect([pl.x, pl.y]).toEqual([1200, -400]);
    expect(pl.endPoint).toEqual([1200, 1600]);
    expect(plantPositions(pl, plant('carrot')).every((q) => pointInPolygon(q, g.features[0]!.footprint))).toBe(true);
  });

  it('leaves round things, whole turns and other plantings alone', () => {
    const pot = sticker('pot', [5000, 5000]);
    const g = withFeatures(bed, pot);
    expect(rotateFeature(g, pot.id, 45)).toBe(g);
    expect(rotateFeature(g, 'bed', 360)).toBe(g);
    const other = makePlanting(plant('lettuce'), pot.id, 'single', [5000, 5000]);
    const turned = rotateFeature(addPlanting(g, other), 'bed', 30);
    expect(turned.plantings[0]).toEqual(other);
  });

  it('keeps a turned rectangle a rectangle, with its size', () => {
    const g = rotateFeature(withFeatures(bed), 'bed', 30);
    const r = rectInfo(g.features[0]!.footprint)!;
    expect(r.w).toBeCloseTo(2400, -1);
    expect(r.h).toBeCloseTo(1200, -1);
  });
});
