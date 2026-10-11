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
import { addListBed, freeSpot, LIST_KINDS, moveInList, nameListBeds } from '../src/model/listLayout';
import { featureLabel } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { makeSpace, spaceInfo } from '../src/model/spaces';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { applyKit, kitsFor } from '../src/planting/kits';
import { fullText, howFull, isListed, listBeds, moveToListBed, placeInList, plantOutInList } from '../src/planting/listPlant';
import { plantPositions, unknownPlant } from '../src/planting/place';
import { applyDraft, draftNextYear } from '../src/planting/rotation';
import { checkGarden } from '../src/planting/rules';

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
  it('are set out in rows, never on top of each other, inside a boundary that grows round them', () => {
    const [g, ids] = withBeds(listGarden(), [['bed', 'Veg'], ['bed', 'Salad'], ['pot', 'Mint'], ['greenhouse', 'Glasshouse'], ['planter', 'Window box'], ['cold-frame', 'Frame'], ['ground', 'Plot'], ['bed', 'Fruit']]);
    const boxes = ids.map((id) => boxOf(g, id));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!];
        expect(a.minX >= b.maxX || b.minX >= a.maxX || a.minY >= b.maxY || b.minY >= a.maxY, `${i} and ${j}`).toBe(true);
      }
    const edge = bounds(g.boundary)!;
    for (const b of boxes) expect(b.minX >= edge.minX && b.maxX <= edge.maxX && b.minY >= edge.minY && b.maxY <= edge.maxY).toBe(true);
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
    g = plant(g, veg!, 'cabbage', 'fill');
    g = plant(g, veg!, 'courgette', 4);
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
  it('moves a planting to another bed with the same number of plants', () => {
    let [g, [a, b, pot]] = withBeds(listGarden(), [['bed', 'A'], ['bed', 'B'], ['pot', 'Pot']]);
    g = plant(g, a!, 'lettuce', 5);
    g = plant(g, a!, 'lettuce', 'fill');
    const [row, block] = g.plantings;
    const n = (x: Garden, id: string) => plantPositions(x.plantings.find((p) => p.id === id)!, plantOf('lettuce')).length;
    const rowN = n(g, row!.id);
    const blockN = n(g, block!.id);
    for (const to of [b!, pot!]) {
      const moved = moveToListBed(g, row!.id, to, plantOf);
      expect(n(moved, row!.id)).toBe(rowN);
      expect(moved.plantings.find((p) => p.id === row!.id)!.featureId).toBe(to);
    }
    expect(n(moveToListBed(g, block!.id, b!, plantOf), block!.id)).toBe(blockN);
  });

  it('plants out every seedling in a big tray, even into a full bed', () => {
    let [g, [pot]] = withBeds(listGarden(), [['planter', 'Box']]);
    g = plant(g, pot!, 'lettuce', 'fill');
    g = { ...g, trays: [{ id: 't1', plantId: 'lettuce', container: 'module-tray', count: 72, sownOn: '2026-03-01', placeId: 'p', shelf: 0, slot: 0 }] };
    const out = plantOutInList(g, 't1', g.features.find((f) => f.id === pot)!, plantOf, '2026-04-20');
    const fromTray = out.plantings.filter((p) => p.sownOn === '2026-03-01');
    expect(fromTray.reduce((t, p) => t + plantPositions(p, plantOf('lettuce')).length, 0)).toBe(72);
    expect(out.trays).toEqual([]);
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
