// Release 26, along the fence: climbers along fences, walls and hedges, and up
// a trellis, arch or obelisk; soil for the garden and each bed; and shade from
// next door.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { distanceToSegment } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, moveFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { stickerById, stickerFeature } from '../src/model/stickers';
import type { Feature, Garden, Plant, Planting, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { defaultFill, fillPlanting, fillsFor } from '../src/planting/fill';
import { addPlanting, canHold, containerAt, makePlanting, movePlanting, placeCopy, plantPositions } from '../src/planting/place';
import { checkGarden } from '../src/planting/rules';
import { phOf, soilClash, soilNeeds, soilOf } from '../src/planting/soil';
import { alongSupport, boundaryFence, climbs, forSupports, holdsPoint, isSupport, OFFSET_MM, supportFills, wherePhrase } from '../src/planting/supports';
import { hoursAt, sunHours } from '../src/sun/hours';
import { SIMPLE_STICKERS } from '../src/ui/planMode';

const DIR = join(__dirname, '../data/plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id)!;
const plantOf = (id: string) => byId.get(id) ?? plant('lettuce');

/** A 6 m fence along y = 0, from x = 0 to 6000: its left side is y > 0. */
const fence = (): Feature => makeFeature('fence', { line: [[0, 0], [6000, 0]] });
const bed = (x: number, y: number, w: number, h: number) => makeFeature('bed', { area: rectPoints({ x, y, w, h }) });
const lawn = () => ({ ...makeFeature('surface', { area: rectPoints({ x: -2000, y: -3000, w: 10000, h: 6000 }) }), material: 'lawn' as const });
const offFence = (f: Feature, p: Point) => distanceToSegment(p, f.line![0]!, f.line![1]!).distance;

describe('climbers along a fence', () => {
  it('holds plants along it, on the side they are dropped, just off its face', () => {
    const f = fence();
    expect(isSupport(f)).toBe(true);
    expect(canHold(f)).toBe(true);
    const clematis = plant('clematis');
    const above = alongSupport(f, clematis, 'one', [2000, 300]);
    expect(above).toEqual({ layout: 'single', x: 2000, y: 25 + OFFSET_MM });
    const below = alongSupport(f, clematis, 'one', [2500, -150]);
    expect(below).toEqual({ layout: 'single', x: 2500, y: -(25 + OFFSET_MM) });
    expect(holdsPoint(f, [above.x, above.y])).toBe(true);
    expect(holdsPoint(f, [2000, 1500])).toBe(false);
  });

  it('makes a row along the stretch, spaced by the plant, half a spacing in from each end', () => {
    const f = fence();
    const pea = plant('sweet-pea');
    const s = pea.size.spacingMm;
    const row = alongSupport(f, pea, 'row', [3000, 200]);
    expect(row.layout).toBe('row');
    expect(row.x).toBe(Math.round(s / 2));
    expect(row.endPoint![0]).toBe(Math.round(6000 - s / 2));
    const pl = { id: 'r', plantId: pea.id, featureId: f.id, ...row } as Planting;
    const pts = plantPositions(pl, pea);
    expect(pts.length).toBe(row.count);
    expect(pts.length).toBe(Math.floor((6000 - s) / s) + 1);
    for (const p of pts) expect(offFence(f, p)).toBe(25 + OFFSET_MM);
    for (let i = 1; i < pts.length; i++) expect(pts[i]![0] - pts[i - 1]![0]).toBeGreaterThanOrEqual(s - 1);
  });

  it('gives a fence too short for two plants one, and offers no row', () => {
    const short = makeFeature('fence', { line: [[0, 0], [1200, 0]] });
    const wisteria = plant('wisteria'); // 3 m apart
    expect(alongSupport(short, wisteria, 'row', [600, 100]).layout).toBe('single');
    expect(supportFills(short, wisteria, [600, 100])).toEqual(['one']);
    expect(fillsFor(wisteria, short, [600, 100])).toEqual(['one']);
    expect(fillsFor(plant('sweet-pea'), short, [600, 100])).toEqual(['one', 'row']);
    expect(defaultFill(plant('sweet-pea'), short)).toBe('one');
  });

  it('sends a climber dropped in a bed by the fence up the fence, but not a lettuce, and not out of a pot', () => {
    const f = fence();
    const b = bed(0, 0, 6000, 1200);
    let g = addFeature(addFeature(newGarden(), b), f);
    expect(containerAt(g, [2000, 300], plant('clematis'))?.id).toBe(f.id);
    expect(containerAt(g, [2000, 300], plant('apple'))?.id).toBe(f.id); // trained flat
    expect(containerAt(g, [2000, 300], plant('lettuce'))?.id).toBe(b.id);
    expect(containerAt(g, [2000, 900], plant('clematis'))?.id).toBe(b.id); // too far from it
    const pot = makeFeature('pot', { circle: { centre: [4000, 250], radiusMm: 200 } });
    g = addFeature(g, pot);
    expect(containerAt(g, [4000, 250], plant('clematis'))?.id).toBe(pot.id);
  });

  it('leaves sweet peas, beans and cucumbers in the bed they are dropped in, and anything in a greenhouse', () => {
    const f = fence();
    const b = bed(0, 0, 6000, 1200);
    let g = addFeature(addFeature(newGarden(), b), f);
    for (const id of ['sweet-pea', 'runner-bean', 'cucumber']) expect(containerAt(g, [2000, 300], plant(id))?.id, id).toBe(b.id);
    // On open ground by the fence, they go along it.
    const open = addFeature(addFeature(newGarden(), lawn()), f);
    expect(containerAt(open, [2000, 300], plant('sweet-pea'))?.id).toBe(f.id);
    // A bed in a greenhouse against the fence keeps even a clematis.
    const glass = makeFeature('greenhouse', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 2000 }) });
    g = { ...g, features: [glass, b, f] };
    expect(containerAt(g, [2000, 300], plant('clematis'))?.id).toBe(b.id);
    expect(containerAt(g, [4000, 300], plant('clematis'))?.id).toBe(f.id);
  });

  it('pastes a copy along a fence, beside it, as a plant that does not climb too', () => {
    const f = fence();
    const g = addFeature(addFeature(newGarden(), lawn()), f);
    const lavender = makePlanting(plant('lavender'), 'elsewhere', 'single', [9000, 9000]);
    const copy = placeCopy(g, lavender, plantOf, [3000, -100], f)!;
    expect(copy.featureId).toBe(f.id);
    expect(copy.y).toBe(-(25 + OFFSET_MM));
    expect(wherePhrase(f)).toBe('along the fence');
    expect(wherePhrase(stickerFeature(stickerById('obelisk')!, [0, 0]))).toBe('up the obelisk');
  });

  it('holds anything by it where nothing else would', () => {
    const f = fence();
    const g = addFeature(newGarden(), f);
    expect(containerAt(g, [1000, 200])?.id).toBe(f.id);
    expect(containerAt(g, [1000, 2000])).toBeNull();
    const withLawn = addFeature(addFeature(newGarden(), lawn()), f);
    expect(containerAt(withLawn, [1000, 200], plant('lettuce'))?.kind).toBe('surface');
  });

  it('keeps a planting on the fence when nudged along it, and moves it with the fence', () => {
    const f = fence();
    let g = addFeature(addFeature(newGarden(), lawn()), f);
    const at = alongSupport(f, plant('clematis'), 'one', [2000, 300]);
    const pl = { ...makePlanting(plant('clematis'), f.id, 'single', [at.x, at.y]) };
    g = addPlanting(g, pl);
    g = movePlanting(g, pl.id, 500, 0);
    expect(g.plantings[0]!.featureId).toBe(f.id);
    g = moveFeature(g, f.id, 0, 3000);
    expect(g.plantings[0]!.y).toBe(at.y + 3000);
    expect(checkGarden(g, plantOf).filter((x) => x.kind === 'outside' || x.kind === 'no-bed')).toEqual([]);
  });

  it('says when plants are too far from the fence to grow up it', () => {
    const f = fence();
    const g = addPlanting(addFeature(newGarden(), f), makePlanting(plant('clematis'), f.id, 'single', [2000, 2000]));
    const out = checkGarden(g, plantOf).find((x) => x.kind === 'outside');
    expect(out?.message).toMatch(/too far from Fence to grow up it/);
  });

  it("doesn't count a washing line or next door's fence", () => {
    const line = stickerFeature(stickerById('washing-line')!, [0, 0]);
    expect(isSupport(line)).toBe(false);
    expect(isSupport({ ...fence(), nextDoor: true })).toBe(false);
  });
});

describe('a fence along the boundary', () => {
  const garden = (): Garden => ({ ...newGarden(), boundary: [[0, 0], [8000, 0], [8000, 10000], [0, 10000]] });

  it('puts one up along the nearest side, for a climber dropped by the boundary', () => {
    const f = boundaryFence(garden(), [4000, 9800])!;
    expect(f.kind).toBe('fence');
    expect(f.line).toEqual([[8000, 10000], [0, 10000]]);
    const at = alongSupport(f, plant('clematis'), 'one', [4000, 9800]);
    expect(at.y).toBe(10000 - 25 - OFFSET_MM); // inside the garden
  });

  it('puts none up away from the boundary, or where there is a fence already', () => {
    expect(boundaryFence(garden(), [4000, 5000])).toBeNull();
    const there = addFeature(garden(), makeFeature('fence', { line: [[0, 10000], [8000, 10000]] }));
    expect(boundaryFence(there, [4000, 9800])).toBeNull();
    expect(boundaryFence(newGarden(), [0, 0])).toBeNull();
    // A wall along part of that side, out of reach of the drop: still no second fence over it.
    const part = addFeature(garden(), makeFeature('wall', { line: [[0, 10000], [2500, 10000]] }));
    expect(boundaryFence(part, [6000, 9800])).toBeNull();
  });
});

describe('trellis, arch and obelisk', () => {
  it('are in Trees and structures, in Simple too, each a support', () => {
    for (const id of ['trellis', 'arch', 'obelisk']) {
      const s = stickerById(id)!;
      expect(s.group, id).toBe('build');
      expect(SIMPLE_STICKERS, id).toContain(id);
      const f = stickerFeature(s, [0, 0]);
      expect(f.support, id).toBe(id);
      expect(isSupport(f), id).toBe(true);
      expect(f.opacityInLeaf!, id).toBeLessThan(0.5);
    }
  });

  it('puts the climber in the middle of an obelisk and at the nearer leg of an arch', () => {
    const ob = stickerFeature(stickerById('obelisk')!, [1000, 1000]);
    expect(alongSupport(ob, plant('clematis'), 'row', [1100, 900])).toEqual({ layout: 'single', x: 1000, y: 1000 });
    const arch = stickerFeature(stickerById('arch')!, [0, 0]); // 1.4 m across x, 0.5 m deep
    const right = alongSupport(arch, plant('climbing-rose'), 'one', [600, 0]);
    const left = alongSupport(arch, plant('climbing-rose'), 'one', [-500, 100]);
    expect(right.x).toBe(600);
    expect(left.x).toBe(-600);
    expect(fillsFor(plant('sweet-pea'), arch, [0, 0])).toEqual(['one']);
  });

  it('holds one climber: no room for a copy, and a check for two', () => {
    const ob = stickerFeature(stickerById('obelisk')!, [1000, 1000]);
    const one = makePlanting(plant('clematis'), ob.id, 'single', [1000, 1000]);
    let g = addPlanting(addFeature(newGarden(), ob), one);
    expect(placeCopy(g, one, plantOf, [1000, 1000])).toBeNull();
    g = addPlanting(g, makePlanting(plant('sweet-pea'), ob.id, 'single', [1000, 1000]));
    const f = checkGarden(g, plantOf).find((x) => x.kind === 'support');
    expect(f?.message).toMatch(/Obelisk has 2 climbers on it \(clematis, sweet pea\)/);
  });
});

describe('climbers offered first', () => {
  it('lists climbers that come back first, then trained fruit, then annual climbers, with no weeds or varieties', () => {
    const list = forSupports(library);
    const ids = list.map((p) => p.id);
    for (const id of ['clematis', 'honeysuckle', 'wisteria', 'star-jasmine', 'climbing-rose', 'apple', 'pear', 'sweet-pea', 'runner-bean']) expect(ids, id).toContain(id);
    expect(ids).not.toContain('bindweed');
    expect(list.every((p) => !p.varietyOf)).toBe(true);
    const at = (id: string) => ids.indexOf(id);
    expect(at('clematis')).toBeLessThan(at('apple'));
    expect(at('apple')).toBeLessThan(at('sweet-pea'));
    expect(climbs(plant('lettuce'))).toBe(false);
  });
});

describe('soil', () => {
  it("reads what each plant's card says it wants", () => {
    expect(soilNeeds(plant('blueberry'))).toMatchObject({ acid: 'acid' });
    expect(soilNeeds(plant('raspberry'))).toMatchObject({ acid: 'slightly' });
    expect(soilNeeds(plant('lilac'))).toMatchObject({ lime: true });
    expect(soilNeeds(plant('lilac'))?.acid).toBeUndefined();
    expect(soilNeeds(plant('lavender'))).toMatchObject({ drained: true });
    expect(soilNeeds(plant('water-mint'))).toMatchObject({ wet: true });
    expect(soilNeeds(plant('lettuce'))).toBeNull();
    // Copes with heavy soil given grit, or wants it damp: not flagged on clay.
    expect(soilNeeds(plant('garlic'))?.drained).toBeUndefined();
    expect(soilNeeds(plant('chinese-artichoke'))?.drained).toBeUndefined();
  });

  it("is a bed's own, or compost in a pot, or the garden's", () => {
    const g: Garden = { ...newGarden(), soil: 'clay', soilPh: 7.8 };
    const b = bed(0, 0, 2000, 1000);
    const pot = makeFeature('pot', { circle: { centre: [0, 0], radiusMm: 150 } });
    expect(soilOf(g, b)).toBe('clay');
    expect(phOf(g, b)).toBe(7.8);
    expect(soilOf(g, pot)).toBe('compost');
    expect(phOf(g, pot)).toBeNull();
    expect(soilOf(g, { ...b, soil: 'ericaceous' })).toBe('ericaceous');
    expect(phOf(g, { ...b, soil: 'ericaceous' })).toBeNull();
    expect(phOf(g, { ...b, ph: 5 })).toBe(5);
    expect(soilOf(newGarden(), b)).toBeNull();
  });

  it('flags only clear clashes, and nothing when the soil is not known', () => {
    const blueberry = plant('blueberry');
    expect(soilClash(blueberry, 'chalky', null, 'Bed 1')).toMatch(/wants acid soil .* Bed 1 is chalky/);
    expect(soilClash(blueberry, 'compost', null, 'the pot')).toMatch(/ordinary compost/);
    expect(soilClash(blueberry, 'ericaceous', null, 'the pot')).toBeNull();
    expect(soilClash(blueberry, 'loam', 7.5, 'Bed 1')).toMatch(/pH 7.5/);
    expect(soilClash(blueberry, 'loam', 6, 'Bed 1')).toBeNull();
    expect(soilClash(plant('raspberry'), 'loam', 7, 'Bed 1')).toBeNull();
    expect(soilClash(plant('raspberry'), 'loam', 7.5, 'Bed 1')).toMatch(/slightly acid/);
    expect(soilClash(plant('lavender'), 'clay', null, 'Bed 1')).toMatch(/free-draining .* clay/);
    expect(soilClash(plant('lavender'), 'sandy', null, 'Bed 1')).toBeNull();
    expect(soilClash(plant('lilac'), 'ericaceous', null, 'the pot')).toMatch(/doesn't want acid/);
    expect(soilClash(plant('lilac'), 'loam', 5.5, 'Bed 1')).toMatch(/pH 5.5/);
    expect(soilClash(plant('water-mint'), 'sandy', null, 'Bed 1')).toMatch(/wet ground/);
    expect(soilClash(blueberry, null, null, 'Bed 1')).toBeNull();
    expect(soilClash(plant('lettuce'), 'chalky', 8, 'Bed 1')).toBeNull();
  });

  it('checks the garden: a bed of its own soil, and a pot of compost, as light is checked', () => {
    const b = { ...bed(0, 0, 2000, 1000), name: 'Fruit bed' };
    let g: Garden = { ...addFeature(newGarden(), b), soil: 'chalky' };
    g = addPlanting(g, makePlanting(plant('blueberry'), b.id, 'single', [500, 500]));
    const soil = checkGarden(g, plantOf).filter((x) => x.kind === 'soil');
    expect(soil.length).toBe(1);
    expect(soil[0]!.message).toMatch(/^Blueberry wants acid soil .* Fruit bed is chalky/);
    const fixed = { ...g, features: [{ ...b, soil: 'ericaceous' as const }] };
    expect(checkGarden(fixed, plantOf).filter((x) => x.kind === 'soil')).toEqual([]);
  });
});

describe('next door', () => {
  it("has next door's house and tree in Trees and structures, marked as next door's", () => {
    const house = stickerFeature(stickerById('next-door-house')!, [0, 0]);
    const tree = stickerFeature(stickerById('next-door-tree')!, [0, 0]);
    expect(house.nextDoor).toBe(true);
    expect(house.kind).toBe('building');
    expect(house.heightMm).toBe(7500);
    expect(tree.nextDoor).toBe(true);
    expect(tree.kind).toBe('tree');
    expect(tree.name).toBe('Next door’s tree');
    expect(tree.heightMm).toBeGreaterThan(5000);
    expect(canHold(house) || canHold(tree)).toBe(false);
  });

  it('casts shade into the garden from outside the boundary', () => {
    // North is up; next door's house stands just south of the garden.
    const g: Garden = { ...newGarden(), boundary: [[0, 0], [8000, 0], [8000, 10000], [0, 10000]] };
    const house = stickerFeature(stickerById('next-door-house')!, [4000, -3500]);
    const shaded = addFeature(g, house);
    const before = hoursAt(sunHours(g, 3, 2027)!, [4000, 1000])!;
    const after = hoursAt(sunHours(shaded, 3, 2027)!, [4000, 1000])!;
    expect(after).toBeLessThan(before - 2);
  });
});

describe('saving', () => {
  it('is schema 18, with soil, pH, supports and next door checked, and schema 17 brought up to date', () => {
    expect(SCHEMA_VERSION).toBe(18);
    const ob = stickerFeature(stickerById('obelisk')!, [0, 0]);
    const g: Garden = { ...addFeature(addFeature(newGarden(), { ...bed(0, 0, 1000, 1000), soil: 'peaty', ph: 5.2 }), ob), soil: 'loam', soilPh: 6.5 };
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    const bad = (patch: Partial<Garden>, f: Partial<Feature> = {}) => validateGarden(JSON.parse(JSON.stringify({ ...g, ...patch, features: [{ ...g.features[0]!, ...f }] }))).join(' ');
    expect(bad({ soil: 'compost' as never })).toMatch(/soil must be clay/);
    expect(bad({ soilPh: 12 })).toMatch(/soilPh/);
    expect(bad({}, { soil: 'mud' as never })).toMatch(/soil is not a known soil/);
    expect(bad({}, { ph: 2 })).toMatch(/ph must be/);
    expect(bad({}, { support: 'pergola' as never })).toMatch(/trellis, arch or obelisk/);
    expect(bad({}, { nextDoor: 'yes' as never })).toMatch(/nextDoor/);
    const old = { ...newGarden(), schemaVersion: 17 };
    const migrated = migrateGarden(old) as Garden;
    expect(migrated.schemaVersion).toBe(18);
    expect(validateGarden(migrated)).toEqual([]);
  });

  it('keeps a planting along a fence through a save, as an ordinary planting', () => {
    const f = fence();
    const at = fillPlanting(plant('sweet-pea'), f, 'row', [3000, 200]);
    const g = addPlanting(addFeature(newGarden(), f), { ...makePlanting(plant('sweet-pea'), f.id, 'row', [at.x, at.y], at.endPoint), ...at });
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
  });
});
