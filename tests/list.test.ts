// Release 30: a garden kept as a list. Beds set out out of sight and never on
// top of each other, plantings placed clear of each other, how full a bed is,
// the checks a list gets, everything else working the same, and schema 20.

import { describe, expect, it } from 'vitest';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { firstJob, jobsFor } from '../src/calendar/jobs';
import { bounds, pointInPolygon } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addListBed, copyListBed, freeSpot, LIST_KINDS, moveInList, nameListBeds, placeFor } from '../src/model/listLayout';
import { addFeature, featureLabel, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { makeSpace, spaceInfo } from '../src/model/spaces';
import type { Garden, Plant, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { applyKit, kitsFor } from '../src/planting/kits';
import { fullText, howFull, isListed, listBeds, moveToListBed, placeInList, plantableBeds, plantOutInList } from '../src/planting/listPlant';
import { makePlanting, plantPositions, unknownPlant } from '../src/planting/place';
import { applyDraft, draftNextYear } from '../src/planting/rotation';
import { checkGarden } from '../src/planting/rules';
import { search } from '../src/ui/search';

const library = [...vegetables, ...herbs, ...fruit] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const listGarden = (): Garden => ({ ...newGarden(), view: 'list' });

/** Adds each bed in turn. */
function withBeds(g: Garden, beds: [Parameters<typeof addListBed>[1], string][]): [Garden, string[]] {
  const ids: string[] = [];
  for (const [kind, name] of beds) {
    const [next, id] = addListBed(g, kind, name);
    g = next;
    ids.push(id);
  }
  return [g, ids];
}
/** Puts plantings from the list in a bed. */
function plant(g: Garden, bedId: string, id: string, how: Parameters<typeof placeInList>[3]): Garden {
  const bed = g.features.find((f) => f.id === bedId)!;
  return { ...g, plantings: [...g.plantings, ...placeInList(g, bed, plantOf(id), how, plantOf).plantings] };
}
const boxOf = (g: Garden, id: string) => bounds(g.features.find((f) => f.id === id)!.footprint)!;

describe('beds added from a list', () => {
  it('are set out in rows, never on top of each other, and draw no outline of their own', () => {
    const [g, ids] = withBeds(listGarden(), [['bed', 'Veg'], ['bed', 'Salad'], ['pot', 'Mint'], ['greenhouse', 'Glasshouse'], ['planter', 'Window box'], ['cold-frame', 'Frame'], ['ground', 'Plot'], ['bed', 'Fruit']]);
    const boxes = ids.map((id) => boxOf(g, id));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!];
        expect(a.minX >= b.maxX || b.minX >= a.maxX || a.minY >= b.maxY || b.minY >= a.maxY, `${i} and ${j}`).toBe(true);
      }
    expect(g.boundary).toEqual([]);
    expect(g.features.find((f) => f.id === ids[0])!.name).toBe('Veg');
    expect(g.features.find((f) => f.id === ids[2])!.circle?.radiusMm).toBe(150);
    expect(g.features.find((f) => f.id === ids[6])!.material).toBe('soil');
    expect(listBeds(g).map((f) => f.name)).toEqual(['Veg', 'Salad', 'Mint', 'Glasshouse', 'Window box', 'Frame', 'Plot', 'Fruit']);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    expect(LIST_KINDS).toHaveLength(6);
  });

  it('find room in a laid-out space without landing on its beds, paths or house', () => {
    const g = { ...makeSpace(newGarden(), 'garden', ...spaceInfo('garden').size), view: 'list' as const };
    const [next, id] = addListBed(g, 'bed', 'New bed');
    const box = boxOf(next, id);
    for (const f of g.features) {
      if (f.kind === 'surface' && (f.material ?? 'lawn') === 'lawn') continue;
      const b = bounds(f.footprint)!;
      expect(box.minX >= b.maxX || b.minX >= box.maxX || box.minY >= b.maxY || b.minY >= box.maxY, f.kind).toBe(true);
    }
    expect(freeSpot(next, 1200, 2400)).not.toEqual(freeSpot(g, 1200, 2400));
  });

  it('move up and down the list', () => {
    const [g, ids] = withBeds(listGarden(), [['bed', 'A'], ['bed', 'B'], ['bed', 'C']]);
    const up = moveInList(g, ids[2]!, true, isListed(g));
    expect(listBeds(up).map((f) => f.name)).toEqual(['A', 'C', 'B']);
    expect(moveInList(g, ids[0]!, true, isListed(g))).toBe(g);
  });

  it('numbers beds that would share a name, and leaves names you gave alone', () => {
    const g = { ...makeSpace(newGarden(), 'garden', ...spaceInfo('garden').size), view: 'list' as const };
    const named = nameListBeds(g, isListed(g), featureLabel);
    const labels = listBeds(named).map(featureLabel);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('Bed 1');
    expect(labels).toContain('Bed 2');
    const [mine] = withBeds(listGarden(), [['bed', 'Veg'], ['bed', 'Fruit']]);
    expect(nameListBeds(mine, isListed(mine), featureLabel)).toBe(mine);
  });

  it('shows soft ground only once something grows in it, or it was added as a patch', () => {
    const g = { ...makeSpace(newGarden(), 'garden', ...spaceInfo('garden').size), view: 'list' as const };
    expect(listBeds(g).some((f) => f.kind === 'surface')).toBe(false);
    expect(listBeds(g).length).toBeGreaterThan(0);
  });
});

describe('planting from the list', () => {
  const setup = () => withBeds(listGarden(), [['bed', 'Veg'], ['pot', 'Pot']]);

  it('puts rows one after another, clear of each other, and inside the bed', () => {
    let [g, [veg]] = setup();
    g = plant(g, veg!, 'carrot', 'row');
    g = plant(g, veg!, 'carrot', 'row');
    g = plant(g, veg!, 'onion', 'row');
    const bed = g.features.find((f) => f.id === veg)!;
    const rows = g.plantings.filter((p) => p.featureId === veg);
    expect(rows).toHaveLength(3);
    expect(rows.every((p) => p.layout === 'row')).toBe(true);
    const all = rows.flatMap((p) => plantPositions(p, plantOf(p.plantId)));
    expect(all.every((p) => pointInPolygon(p, bed.footprint))).toBe(true);
    // Each row along the bed's length, and apart.
    const across = rows.map((p) => p.x);
    expect(new Set(across).size).toBe(3);
  });

  it('makes as many plants as you ask for', () => {
    let [g, [veg]] = setup();
    g = plant(g, veg!, 'lettuce', 12);
    const n = g.plantings.reduce((t, p) => t + plantPositions(p, plantOf(p.plantId)).length, 0);
    expect(n).toBe(12);
    g = plant(g, veg!, 'cabbage', 1);
    expect(g.plantings.filter((p) => p.plantId === 'cabbage').map((p) => p.layout ?? 'single')).toEqual(['single']);
  });

  it('puts a second plant in a pot beside the first, and a fill in the room left', () => {
    let [g, [veg, pot]] = setup();
    g = plant(g, pot!, 'basil', 'one');
    g = plant(g, pot!, 'parsley', 'one');
    const [a, b] = g.plantings.filter((p) => p.featureId === pot);
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(50);
    g = plant(g, veg!, 'carrot', 'row');
    g = plant(g, veg!, 'lettuce', 'fill');
    const fill = g.plantings.find((p) => p.plantId === 'lettuce')!;
    expect(fill.layout).toBe('block');
    const carrot = plantPositions(g.plantings.find((p) => p.plantId === 'carrot')!, plantOf('carrot'));
    const lettuce = plantPositions(fill, plantOf('lettuce'));
    // The carrot row isn't under the lettuce.
    const minGap = Math.min(...carrot.flatMap((c) => lettuce.map((l) => Math.hypot(c[0] - l[0], c[1] - l[1]))));
    expect(minGap).toBeGreaterThan(100);
  });

  it('says how full a bed is, and flags an over-full one in place of spacing checks', () => {
    let [g, [veg]] = setup();
    const bed = () => g.features.find((f) => f.id === veg)!;
    expect(howFull(g, bed(), plantOf)).toBe(0);
    expect(fullText(0)).toBe('Empty');
    g = plant(g, veg!, 'lettuce', 'fill');
    expect(howFull(g, bed(), plantOf)).toBeGreaterThan(0.5);
    expect(checkGarden(g, plantOf).filter((f) => f.kind === 'spacing')).toEqual([]);
    // A fill with no room left plants nothing; one plant at a time still goes in, in the least crowded spot.
    expect(placeInList(g, bed(), plantOf('cabbage'), 'fill', plantOf)).toMatchObject({ plantings: [], full: true });
    for (let i = 0; i < 4; i++) g = plant(g, veg!, 'courgette', 'one');
    const share = howFull(g, bed(), plantOf);
    expect(share).toBeGreaterThan(1.15);
    expect(fullText(share)).toBe('Over-full');
    const found = checkGarden(g, plantOf).filter((f) => f.id === `full:${veg}`);
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/^Veg is over-full: its plants want about \d+% of the room it has/);
    // Not a list: the usual spacing checks.
    expect(checkGarden({ ...g, view: undefined }, plantOf).some((f) => f.id.startsWith('spacing:'))).toBe(true);
  });

  it('checks light from the sun you said a bed gets', () => {
    let [g, [veg]] = setup();
    g = plant(g, veg!, 'tomato', 'one');
    expect(checkGarden(g, plantOf).filter((f) => f.kind === 'light')).toEqual([]);
    g = { ...g, features: g.features.map((f) => (f.id === veg ? { ...f, light: 'shade' as const } : f)) };
    const light = checkGarden(g, plantOf).filter((f) => f.kind === 'light');
    expect(light).toHaveLength(1);
    expect(light[0]!.message).toMatch(/which you said is in shade; it wants full sun\.$/);
  });
});

describe('the review’s fixes', () => {
  it('moves a planting to a bed alike with the same number of plants, and to a smaller one with what fits', () => {
    let [g, [a, b, pot]] = withBeds(listGarden(), [['bed', 'A'], ['bed', 'B'], ['pot', 'Pot']]);
    g = plant(g, a!, 'lettuce', 5);
    g = plant(g, a!, 'lettuce', 'fill');
    const [row, block] = g.plantings;
    const n = (x: Garden, id: string) => plantPositions(x.plantings.find((p) => p.id === id)!, plantOf('lettuce')).length;
    const rowN = n(g, row!.id);
    const blockN = n(g, block!.id);
    const moved = moveToListBed(g, row!.id, b!, plantOf);
    expect(n(moved, row!.id)).toBe(rowN);
    expect(moved.plantings.find((p) => p.id === row!.id)!.featureId).toBe(b);
    expect(n(moveToListBed(g, block!.id, b!, plantOf), block!.id)).toBe(blockN);
    // A 30 cm pot hasn't room for a row of five: it takes what fits, all of it in the pot.
    const potted = moveToListBed(g, row!.id, pot!, plantOf);
    const inPot = potted.plantings.find((p) => p.id === row!.id)!;
    expect(n(potted, row!.id)).toBeLessThan(rowN);
    expect(plantPositions(inPot, plantOf('lettuce')).every((p) => pointInPolygon(p, potted.features.find((f) => f.id === pot)!.footprint))).toBe(true);
  });

  it('plants out what fits from a big tray, and leaves the rest in it', () => {
    let [g, [box, veg]] = withBeds(listGarden(), [['planter', 'Box'], ['bed', 'Veg']]);
    g = plant(g, box!, 'lettuce', 'fill');
    g = { ...g, trays: [{ id: 't1', plantId: 'lettuce', container: 'module-tray', count: 72, sownOn: '2026-03-01', placeId: 'p', shelf: 0, slot: 0 }] };
    const bedOf = (id: string) => g.features.find((f) => f.id === id)!;
    // Into a full planter: none, and the tray's untouched.
    const none = plantOutInList(g, 't1', bedOf(box!), plantOf, '2026-04-20');
    expect(none).toMatchObject({ planted: 0, left: 72 });
    expect(none.garden.trays).toEqual(g.trays);
    // Into a bed with room for some.
    const some = plantOutInList(g, 't1', bedOf(veg!), plantOf, '2026-04-20');
    const fromTray = some.garden.plantings.filter((p) => p.sownOn === '2026-03-01');
    const spots = fromTray.flatMap((p) => plantPositions(p, plantOf('lettuce')));
    expect(spots.length).toBe(some.planted);
    expect(some.planted).toBeGreaterThan(0);
    expect(some.planted + some.left).toBe(72);
    expect(some.garden.trays).toEqual([{ ...g.trays![0]!, count: some.left }]);
    expect(spots.every((p) => pointInPolygon(p, bedOf(veg!).footprint))).toBe(true);
  });

  it('counts together everything in a bed now, whichever year it was started', () => {
    let [g, [veg]] = withBeds(listGarden(), [['bed', 'Veg']]);
    g = plant(g, veg!, 'lettuce', 'fill');
    const bed = g.features.find((f) => f.id === veg)!;
    const one = howFull(g, bed, plantOf);
    const older = { ...g, plantings: [...g.plantings, ...g.plantings.map((p) => ({ ...p, id: `${p.id}-old`, stage: 'transplanted' as const, stageDates: { transplanted: '2025-05-01' } }))] };
    expect(howFull(older, bed, plantOf)).toBeCloseTo(one * 2, 5);
    // Next year's plan isn't added to this year's crops.
    const next = { ...g, plantings: [...g.plantings, ...g.plantings.map((p) => ({ ...p, id: `${p.id}-next`, sowBy: '2027-04-01' }))] };
    expect(howFull(next, bed, plantOf)).toBeCloseTo(one, 5);
  });

  it('checks neighbours only within a bed, and the sun as you said it only in a list, by its level', () => {
    let [g, [a, b]] = withBeds(listGarden(), [['bed', 'A'], ['bed', 'B']]);
    g = plant(g, a!, 'onion', 'one');
    g = plant(g, b!, 'pea', 'one');
    expect(checkGarden(g, plantOf).filter((f) => f.kind === 'avoid')).toEqual([]);
    const sunny = { ...g, features: g.features.map((f) => ({ ...f, light: 'full-sun' as const })) };
    const lover = library.find((p) => p.conditions.light === 'full-sun' && (p.conditions.minSunHours ?? 0) >= 8)!;
    const withLover = plant(sunny, a!, lover.id, 'one');
    expect(checkGarden(withLover, plantOf).filter((f) => f.kind === 'light')).toEqual([]);
    const shady = { ...withLover, features: withLover.features.map((f) => ({ ...f, light: 'shade' as const })) };
    expect(checkGarden(shady, plantOf).filter((f) => f.kind === 'light').length).toBeGreaterThan(0);
    expect(checkGarden({ ...shady, view: undefined }, plantOf).filter((f) => f.kind === 'light')).toEqual([]);
  });

  it('numbers names without landing on one already used', () => {
    let [g, ids] = withBeds(listGarden(), [['bed', 'Bed'], ['bed', 'Bed'], ['bed', 'Bed 1']]);
    g = nameListBeds(g, isListed(g), featureLabel);
    const labels = listBeds(g).map(featureLabel);
    expect(new Set(labels).size).toBe(3);
    expect(labels).toContain('Bed 1');
    expect(ids).toHaveLength(3);
  });
});

describe('list mode, put right (release 32)', () => {
  const allSpots = (g: Garden, bedId: string) => g.plantings.filter((p) => p.featureId === bedId).flatMap((p) => plantPositions(p, plantOf(p.plantId)));
  const closest = (pts: Point[]) => Math.min(...pts.flatMap((a, i) => pts.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))));
  /** A drawn garden, 4 m by 3 m. */
  const drawn = (): Garden => ({ ...listGarden(), boundary: rectPoints({ x: 0, y: 0, w: 4000, h: 3000 }) });

  it('keeps new beds inside a drawn garden, and says when one has to go outside it, never moving the outline', () => {
    let g = drawn();
    const outline = g.boundary;
    const outsides: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [next, id, outside] = addListBed(g, 'bed', 'Bed');
      outsides.push(outside);
      const box = boxOf(next, id);
      if (!outside) expect(box.minX >= 0 && box.maxX <= 4000 && box.minY >= 0 && box.maxY <= 3000).toBe(true);
      else expect(box.minX).toBeGreaterThan(4000);
      g = next;
    }
    expect(outsides[0]).toBe(false);
    expect(outsides).toContain(true);
    expect(g.boundary).toBe(outline);
    expect(placeFor(g, 1200, 2400).outside).toBe(true);
  });

  it('never stacks plants: a number plants what fits and says how many are left', () => {
    let [g, [veg]] = withBeds(listGarden(), [['bed', 'Veg']]);
    const bed = g.features.find((f) => f.id === veg)!;
    const out = placeInList(g, bed, plantOf('lettuce'), 200, plantOf);
    const placed = out.plantings.reduce((t, p) => t + plantPositions(p, plantOf('lettuce')).length, 0);
    expect(out.left).toBeGreaterThan(0);
    expect(placed + out.left).toBe(200);
    expect(out.full).toBe(true);
    g = { ...g, plantings: out.plantings };
    const spots = allSpots(g, veg!);
    expect(spots.every((p) => pointInPolygon(p, bed.footprint))).toBe(true);
    expect(closest(spots)).toBeGreaterThan(plantOf('lettuce').size.spacingMm * 0.5);
    // And a row with no room left plants nothing.
    expect(placeInList(g, bed, plantOf('carrot'), 'row', plantOf).plantings).toEqual([]);
  });

  it('plants a planter in rows, like a bed; only a round pot takes plants one beside another', () => {
    let [g, [box, pot]] = withBeds(listGarden(), [['planter', 'Box'], ['pot', 'Pot']]);
    g = plant(g, box!, 'carrot', 'row');
    expect(g.plantings[0]!.layout).toBe('row');
    g = plant(g, pot!, 'lettuce', 3);
    expect(g.plantings.filter((p) => p.featureId === pot).every((p) => (p.layout ?? 'single') === 'single')).toBe(true);
  });

  it('measures a pot by its round area and the plant’s spread, and one plant in a pot is never over-full', () => {
    let [g, [pot]] = withBeds(listGarden(), [['pot', 'Pot']]);
    const thePot = () => g.features.find((f) => f.id === pot)!;
    g = plant(g, pot!, 'courgette', 'one');
    expect(howFull(g, thePot(), plantOf)).toBeLessThanOrEqual(1);
    g = plant(g, pot!, 'courgette', 'one');
    expect(howFull(g, thePot(), plantOf)).toBeGreaterThan(1.15);
  });

  it('keeps a fill inside a bed that isn’t a rectangle', () => {
    const L = makeFeature('bed', { area: [[0, 0], [3000, 0], [3000, 1000], [1000, 1000], [1000, 3000], [0, 3000]] });
    let g = addFeature(listGarden(), L);
    g = plant(g, L.id, 'carrot', 'row');
    g = plant(g, L.id, 'lettuce', 'fill');
    const footprint = g.features.find((f) => f.id === L.id)!.footprint;
    expect(allSpots(g, L.id).every((p) => pointInPolygon(p, footprint))).toBe(true);
  });

  it('lists a fence with a climber on it, but doesn’t offer it for planting from the list', () => {
    const fence = makeFeature('fence', { line: [[0, 0], [3000, 0]] });
    let g = addFeature(listGarden(), fence);
    expect(listBeds(g).some((f) => f.id === fence.id)).toBe(false);
    g = { ...g, plantings: [makePlanting(plantOf('runner-bean'), fence.id, 'single', [1500, 0])] };
    expect(listBeds(g).some((f) => f.id === fence.id)).toBe(true);
    expect(plantableBeds(g).some((f) => f.id === fence.id)).toBe(false);
  });

  it('makes another bed like one, empty, the same size, sun and soil, clear of it', () => {
    let [g, [veg]] = withBeds(listGarden(), [['bed', 'Veg']]);
    g = { ...g, features: g.features.map((f) => (f.id === veg ? { ...f, light: 'part-shade' as const, soil: 'clay' as const } : f)) };
    g = plant(g, veg!, 'carrot', 'row');
    const [next, copy] = copyListBed(g, veg!)!;
    const [a, b] = [boxOf(next, veg!), boxOf(next, copy)];
    expect([b.maxX - b.minX, b.maxY - b.minY]).toEqual([a.maxX - a.minX, a.maxY - a.minY]);
    expect(a.minX >= b.maxX || b.minX >= a.maxX || a.minY >= b.maxY || b.minY >= a.maxY).toBe(true);
    expect(next.features.find((f) => f.id === copy)).toMatchObject({ light: 'part-shade', soil: 'clay' });
    expect(next.plantings.some((p) => p.featureId === copy)).toBe(false);
    const named = nameListBeds(next, isListed(next), featureLabel);
    expect(listBeds(named).map(featureLabel)).toEqual(['Veg 1', 'Veg 2']);
    // One more added later is the next number, not "Veg" again.
    const [more] = addListBed(named, 'bed', 'Veg');
    expect(listBeds(nameListBeds(more, isListed(more), featureLabel)).map(featureLabel)).toEqual(['Veg 1', 'Veg 2', 'Veg 3']);
  });

  it('searches a list for its beds and plants only, and adds a plant to a bed', () => {
    let [g, [veg]] = withBeds(drawn(), [['bed', 'Veg']]);
    g = plant(g, veg!, 'carrot', 'row');
    const ctx = { garden: g, plants: library, plantOf, locked: false };
    expect(search('boundary', ctx).some((r) => r.key === 'boundary')).toBe(false);
    expect(search('veg', ctx).some((r) => r.group === 'In your garden')).toBe(true);
    expect(search('add tomato', ctx).find((r) => r.group === 'Plants')?.detail).toBe('Add to a bed');
    expect(search('add tomato', { ...ctx, garden: { ...g, view: undefined } }).find((r) => r.group === 'Plants')?.detail).toBe('Add to the plan');
  });
});

describe('everything else, the same for a list', () => {
  it('gives jobs, a kit, the first job and next year’s draft as for a plan', () => {
    const kit = kitsFor('allotment', 10, (id) => byId.get(id) ?? null)[0]!;
    const g = { ...applyKit(makeSpace(newGarden(), 'allotment', ...spaceInfo('allotment').size), kit, (id) => byId.get(id) ?? null, '2026-10-11'), view: 'list' as const };
    expect(jobsFor(g, plantOf, 10, 2026).length).toBeGreaterThan(0);
    expect(firstJob(g, plantOf, new Date(2026, 9, 11))).not.toBeNull();
    const grown = { ...g, plantings: g.plantings.map((p) => ({ ...p, sownOn: '2026-04-01', removedOn: '2026-09-30' })) };
    const draft = draftNextYear(grown, plantOf, '2026-10-11');
    expect(applyDraft(grown, draft.items.map((i) => i.next)).plantings.length).toBeGreaterThan(grown.plantings.length);
  });

  it('keeps every bed and planting switching to a plan and back', () => {
    let [g, [veg]] = withBeds(listGarden(), [['bed', 'Veg'], ['pot', 'Pot']]);
    g = plant(g, veg!, 'carrot', 'row');
    const plan: Garden = { ...g };
    delete plan.view;
    const back: Garden = { ...plan, view: 'list' };
    expect(back.features).toBe(g.features);
    expect(back.plantings).toBe(g.plantings);
    expect(validateGarden(JSON.parse(JSON.stringify(plan)))).toEqual([]);
  });
});

describe('save format 20', () => {
  it('checks the view and a bed’s sun, and brings schema 19 up to date', () => {
    expect(SCHEMA_VERSION).toBe(20);
    const [g] = withBeds(listGarden(), [['bed', 'Veg']]);
    const lit = { ...g, features: g.features.map((f) => ({ ...f, light: 'part-shade' as const })) };
    expect(validateGarden(JSON.parse(JSON.stringify(lit)))).toEqual([]);
    expect(validateGarden({ ...lit, view: 'grid' }).join(' ')).toMatch(/view must be list/);
    expect(validateGarden({ ...lit, features: lit.features.map((f) => ({ ...f, light: 'dappled' })) }).join(' ')).toMatch(/light must be/);
    const migrated = migrateGarden({ ...newGarden(), schemaVersion: 19 }) as Garden;
    expect(migrated.schemaVersion).toBe(20);
    expect(validateGarden(migrated)).toEqual([]);
  });
});
