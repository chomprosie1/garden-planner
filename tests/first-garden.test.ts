// Release 47: a first garden, and the plan on a phone. Kits always get their
// beds; a narrow garden's beds turn to run down it; the border is optional; a
// lawn-only garden is offered its first bed; a tapped sticker lands somewhere
// clear; a box drawn by hand is a rectangle; new ground stays unlocked.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import varieties from '../data/varieties.json';
import { jobsFor } from '../src/calendar/jobs';
import { bounds, pointInPolygon } from '../src/geometry/polygon';
import { rectangleOf } from '../src/geometry/hull';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, freshTarget, isSetGround, makeFeature, rectPoints } from '../src/model/features';
import { makeSpace } from '../src/model/spaces';
import { clearSpot, stickerById, stickerFeature } from '../src/model/stickers';
import type { Feature, Garden, Plant, Point } from '../src/model/types';
import { firstBedCompost, needsFirstBed } from '../src/planting/firstBed';
import { applyKit, KITS } from '../src/planting/kits';
import { isActive, isContainer, plantCount, unknownPlant } from '../src/planting/place';
import { shoppingList } from '../src/planting/shopping';
import { search } from '../src/ui/search';

const library = withVarieties([...vegetables, ...herbs, ...fruit, ...flowers] as Plant[], varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const kit = (id: string) => KITS.find((k) => k.id === id)!;
const beds = (g: Garden) => g.features.filter((f) => f.kind === 'bed' && f.name !== 'Border');
const sizeOf = (f: Feature) => {
  const b = bounds(f.footprint)!;
  return [b.maxX - b.minX, b.maxY - b.minY];
};
const plantedIn = (g: Garden, f: Feature) => g.plantings.filter((p) => p.featureId === f.id && isActive(p)).map((p) => p.plantId);

describe('a garden’s beds', () => {
  it('a wide garden is laid out as before: a border, and two beds lying across', () => {
    const g = makeSpace(newGarden(), 'garden', 10000, 14000);
    expect(g.features.some((f) => f.name === 'Border')).toBe(true);
    expect(beds(g).map(sizeOf)).toEqual([
      [2400, 1200],
      [2400, 1200],
    ]);
  });

  it('a narrow one (4 × 7 m) turns its beds to run down it, so a kit has somewhere to go', () => {
    const g = makeSpace(newGarden(), 'garden', 4000, 7000);
    expect(beds(g).map(sizeOf)).toEqual([
      [1200, 2400],
      [1200, 2400],
    ]);
    for (const f of beds(g)) expect(f.footprint.every((p) => pointInPolygon(p, g.boundary) || g.boundary.some((q) => q[0] === p[0] || q[1] === p[1]))).toBe(true);
    // Jordan's garden: the bulbs in the border, the garlic and onions in one bed, the broad beans in the other.
    const planted = applyKit(g, kit('autumn-garden'), plantOf, '2026-10-12');
    const [a, b] = beds(planted);
    expect(plantedIn(planted, planted.features.find((f) => f.name === 'Border')!)).toEqual(['crocus', 'daffodil', 'tulip', 'ornamental-allium']);
    expect(new Set(plantedIn(planted, a!))).toEqual(new Set(['garlic', 'onion-overwintering']));
    expect(new Set(plantedIn(planted, b!))).toEqual(new Set(['broad-bean-autumn-sown']));
  });

  it('the border is optional: without it, the veg still gets its beds and the flowers wait on Want to grow', () => {
    const g = makeSpace(newGarden(), 'garden', 10000, 14000, null, { border: false });
    expect(g.features.some((f) => f.name === 'Border')).toBe(false);
    const planted = applyKit(g, kit('veg-and-flowers'), plantOf, '2026-04-01');
    const [a, b] = beds(planted);
    expect(plantedIn(planted, a!)).toContain('carrot');
    expect(plantedIn(planted, b!)).toContain('potato');
    expect(planted.plantings.some((p) => p.plantId === 'lavender')).toBe(false);
    expect(planted.wishlist).toContain('lavender');
  });

  it('a kit that needs more beds than the space has adds them inside the garden, clear of the rest', () => {
    // 3 × 3 m: room for the border and no raised beds.
    const g = makeSpace(newGarden(), 'garden', 3000, 3000);
    expect(beds(g)).toHaveLength(0);
    const planted = applyKit(g, kit('autumn-garden'), plantOf, '2026-10-12');
    const added = beds(planted);
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(planted.plantings.some((p) => p.plantId === 'garlic')).toBe(true);
    const boxes = planted.features.filter((f) => isContainer(f)).map((f) => bounds(f.footprint)!);
    for (const f of added) {
      const b = bounds(f.footprint)!;
      expect([[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].every((p) => pointInPolygon(p as Point, planted.boundary))).toBe(true);
      for (const o of boxes) if (o !== b && !(o.minX === b.minX && o.minY === b.minY)) expect(b.minX >= o.maxX || o.minX >= b.maxX || b.minY >= o.maxY || o.minY >= b.maxY).toBe(true);
    }
  });

  it('a kit’s pot of bulbs is a potful, as close as bulbs go in a pot', () => {
    const g = applyKit(makeSpace(newGarden(), 'balcony', 3000, 1500), kit('autumn-balcony'), plantOf, '2026-10-12');
    const daffs = g.plantings.find((p) => p.plantId === 'daffodil')!;
    expect(daffs.layout).toBe('block');
    expect(daffs.count).toBeGreaterThan(4);
    expect(plantCount(daffs, plantOf('daffodil'))).toBe(daffs.count);
  });
});

describe('a garden that’s all lawn', () => {
  const lawn = () => addFeature(newGarden(), { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 8000, h: 6000 }) }), material: 'lawn' });

  it('is offered its first bed: a job with how to make it, and the cardboard and compost on the shopping list', () => {
    const g = lawn();
    expect(needsFirstBed(g)).toBe(true);
    const job = jobsFor(g, plantOf, 10, 2026).find((j) => j.key.startsWith('check:first-bed:'));
    expect(job).toBeTruthy();
    expect(job!.verb).toBe('Make your first bed');
    expect(job!.detail).toMatch(/two layers thick/);
    expect(job!.detail).toMatch(/10 to 15 cm/);
    expect(firstBedCompost()).toEqual({ litres: [290, 430], bags: [8, 11] });
    const keys = shoppingList(g, plantOf, '2026-10-17').map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['compost:first-bed', 'compost:first-bed-card']));
  });

  it('isn’t, once there’s a bed, or once it’s been done', () => {
    const withBed = addFeature(lawn(), makeFeature('bed', { area: rectPoints({ x: 500, y: 500, w: 2400, h: 1200 }) }));
    expect(needsFirstBed(withBed)).toBe(false);
    expect(jobsFor(withBed, plantOf, 10, 2026).some((j) => j.key.startsWith('check:first-bed:'))).toBe(false);
    const done = { ...lawn(), jobsDone: [{ key: 'check:first-bed:2026-09', date: '2026-09-20' }] };
    expect(jobsFor(done, plantOf, 10, 2026).some((j) => j.key.startsWith('check:first-bed:'))).toBe(false);
  });

  it('search finds it from “dig up lawn”', () => {
    const results = search('dig up lawn', { garden: lawn(), plants: library, plantOf, locked: false });
    expect(results.some((r) => r.command.kind === 'help' && /cardboard/.test(r.command.id))).toBe(true);
  });
});

describe('the plan on a phone', () => {
  it('a sticker tapped onto the plan lands inside the garden, clear of the beds already there', () => {
    const g = addFeature({ ...newGarden(), boundary: rectPoints({ x: 0, y: 0, w: 6000, h: 6000 }) }, makeFeature('bed', { area: rectPoints({ x: 1800, y: 2400, w: 2400, h: 1200 }) }));
    const st = stickerById('raised-bed') ?? stickerById('bed')!;
    const mid: Point = [3000, 3000];
    const at = clearSpot(g, stickerFeature(st, mid), mid, 300)!;
    const placed = bounds(stickerFeature(st, at).footprint)!;
    const bed = bounds(g.features[0]!.footprint)!;
    expect(placed.minX >= bed.maxX || bed.minX >= placed.maxX || placed.minY >= bed.maxY || bed.minY >= placed.maxY).toBe(true);
    expect([[placed.minX, placed.minY], [placed.maxX, placed.maxY]].every((p) => pointInPolygon(p as Point, g.boundary))).toBe(true);
    // No room anywhere: null, and the plan drops it in the middle as before.
    const full = addFeature(g, makeFeature('building', { area: rectPoints({ x: 0, y: 0, w: 6000, h: 6000 }) }));
    expect(clearSpot(full, stickerFeature(st, mid), mid, 300)).toBeNull();
    // Ground goes where it's put.
    expect(clearSpot(g, { ...makeFeature('surface', { area: rectPoints({ x: 2000, y: 2000, w: 2000, h: 2000 }) }), material: 'paving' }, mid, 300)).toEqual(mid);
  });

  it('a box drawn by hand is a rectangle; a circle drawn by hand isn’t', () => {
    const wobble = (i: number) => Math.round(Math.sin(i * 1.7) * 30);
    const box: Point[] = [];
    for (let i = 0; i <= 20; i++) box.push([i * 120, wobble(i)]);
    for (let i = 0; i <= 10; i++) box.push([2400 + wobble(i), i * 120]);
    for (let i = 20; i >= 0; i--) box.push([i * 120, 1200 + wobble(i)]);
    for (let i = 10; i >= 0; i--) box.push([wobble(i), i * 120]);
    const r = rectangleOf(box)!;
    expect(r).toHaveLength(4);
    const b = bounds(r)!;
    expect(r.every(([x, y]) => (x === b.minX || x === b.maxX) && (y === b.minY || y === b.maxY))).toBe(true);
    expect(Math.abs(b.maxX - b.minX - 2400)).toBeLessThan(100);
    const circle: Point[] = Array.from({ length: 40 }, (_, i) => [Math.round(1000 * Math.cos((i / 40) * 2 * Math.PI)), Math.round(1000 * Math.sin((i / 40) * 2 * Math.PI))]);
    expect(rectangleOf(circle)).toBeNull();
    // At a slant, it keeps the slant.
    const t = Math.PI / 6;
    const slant = box.map(([x, y]) => [Math.round(x * Math.cos(t) - y * Math.sin(t)), Math.round(x * Math.sin(t) + y * Math.cos(t))] as Point);
    const s = rectangleOf(slant)!;
    expect(s).toHaveLength(4);
    expect(new Set(s.map((p) => p[0])).size).toBe(4);
  });

  it('new ground stays unlocked after tapping away, for the rest of the visit', () => {
    const patio = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 3000 }) }), material: 'paving' as const };
    const other = { ...makeFeature('surface', { area: rectPoints({ x: 4000, y: 0, w: 3000, h: 3000 }) }), material: 'paving' as const };
    freshTarget(patio);
    expect(isSetGround(patio, null)).toBe(false);
    expect(isSetGround(patio, { type: 'feature', id: patio.id })).toBe(false);
    // Ground that was already there is set, as before.
    expect(isSetGround(other, { type: 'feature', id: other.id })).toBe(true);
  });
});
