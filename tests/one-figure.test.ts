// Release 49: one figure everywhere. Each of these is two screens that disagreed
// for a tester: checks, room, spacing, counts and feeds now have one source.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobsFor } from '../src/calendar/jobs';
import { nextFor } from '../src/lifecycle/shed';
import { timeline } from '../src/lifecycle/projection';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { formatSpacing } from '../src/canvas/viewport';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { fullText, howFull, moveRoom, moveToListBed, OVER_FULL, placeInList, plantingsCount, setPlantingCount } from '../src/planting/listPlant';
import { addPlanting, makePlanting, plantCount, stillWanted, unknownPlant } from '../src/planting/place';
import { potProblems } from '../src/planting/pots';
import { checkGarden } from '../src/planting/rules';
import { shoppingList } from '../src/planting/shopping';
import type { SunGrid } from '../src/sun/hours';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const TODAY = '2026-10-29';
const bedAt = (x: number, w: number, h: number, name: string, extra: Partial<Feature> = {}): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y: 0, w, h }) }), name, ...extra });
const potAt = (x: number, across: number, name: string, extra: Partial<Feature> = {}): Feature => ({ ...makeFeature('pot', { circle: { centre: [x, 5000], radiusMm: across / 2 } }), name, ...extra });
const listOf = (...fs: Feature[]): Garden => fs.reduce(addFeature, { ...newGarden(), view: 'list' as const });
const planOf = (...fs: Feature[]): Garden => fs.reduce(addFeature, newGarden());
const single = (id: string, f: Feature, at: [number, number] = [f.footprint[0]![0] + 100, f.footprint[0]![1] + 100]): Planting => makePlanting(plantOf(id), f.id, 'single', at);
const warns = (g: Garden, sun: SunGrid | null = null) => checkGarden(g, plantOf, sun).filter((f) => f.level === 'warn');
const put = (g: Garden, bed: Feature, id: string, how: Parameters<typeof placeInList>[3]) => {
  const { plantings } = placeInList(g, bed, plantOf(id), how, plantOf);
  return { ...g, plantings: [...g.plantings, ...plantings] };
};

describe('things to check: one figure', () => {
  const pot = potAt(500, 300, 'Basil pot', { light: 'part-shade' });
  const withBasil = (g: Garden) => addPlanting(g, single('basil', pot, [500, 5000]));

  it('shade you said counts in a list, on a plan and on Today alike (Sam: 19 against 6)', () => {
    const light = (fs: { kind: string }[]) => fs.filter((f) => f.kind === 'light').length;
    expect(light(warns(withBasil(listOf(pot))))).toBe(1);
    expect(light(warns(withBasil(planOf(pot))))).toBe(1);
  });

  it('the sun worked out on the plan never overrules what you said', () => {
    const g = withBasil(planOf(pot));
    const sunny: SunGrid = { x0: -10000, y0: -10000, step: 40000, cols: 2, rows: 2, hours: new Float32Array(4).fill(8), inside: new Uint8Array(4).fill(1), month: 6, maxHours: 16 };
    const found = warns(g, sunny).filter((f) => f.kind === 'light');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/you said is in part shade/);
  });
});

describe('spacing: only between plants that share the ground', () => {
  it('the same problem in two beds is two problems, though it reads the same', () => {
    const a = bedAt(0, 1200, 1200, 'A');
    const b = bedAt(2000, 1200, 1200, 'B');
    const row = (f: Feature, y: number) => ({ ...makePlanting(plantOf('carrot'), f.id, 'row', [f.footprint[0]![0] + 100, y], [f.footprint[0]![0] + 1100, y]), count: 40 });
    const g = [row(a, 300), row(a, 400), row(b, 300), row(b, 400)].reduce(addPlanting, planOf(a, b));
    expect(warns(g).filter((f) => f.kind === 'row')).toHaveLength(2);
  });

  it('bushes the list packed into a fruit cage raise nothing on a plan', () => {
    const cage = bedAt(0, 4000, 3000, 'Fruit cage', { fruitCage: true });
    let g = put(listOf(cage), cage, 'raspberry', 'row');
    g = put(g, cage, 'blackcurrant', 3);
    g = put(g, cage, 'gooseberry', 2);
    expect(warns({ ...g, view: undefined }).filter((f) => f.kind === 'spacing').map((f) => f.message)).toEqual([]);
  });

  it('no spacing or neighbour checks between plants in separate pots (Sam, Priya)', () => {
    const a = potAt(500, 300, 'Mint pot');
    const b = potAt(1000, 300, 'Rosemary pot');
    const g = addPlanting(addPlanting(planOf(a, b), single('mint', a, [500, 5000])), single('rosemary', b, [1000, 5000]));
    expect(warns(g).filter((f) => f.kind === 'spacing' || f.kind === 'avoid')).toEqual([]);
  });

  it('two potfuls in one pot are not "overlapping" (Priya)', () => {
    const pot = potAt(500, 350, 'Bulb pot');
    let g = put(planOf(pot), pot, 'tulip', 6);
    g = put(g, pot, 'tulip', 6);
    expect(warns(g).filter((f) => f.kind === 'spacing')).toEqual([]);
  });

  it('sweet peas in a cold frame stand at module spacing (Margaret: 50 mm against 230)', () => {
    const frame = { ...makeFeature('cold-frame', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 600 }) }), name: 'Frame' };
    const pl = { ...makePlanting(plantOf('sweet-pea'), frame.id, 'row', [100, 300], [1100, 300]), count: 20 };
    expect(warns(addPlanting(planOf(frame), pl)).filter((f) => f.kind === 'row')).toEqual([]);
  });
});

describe('room: one figure', () => {
  it('a crowded pot says so once, and the badge agrees (Sam: 590% beside 144%)', () => {
    const tower = potAt(500, 350, 'Tower');
    let g: Garden = listOf(tower);
    for (let i = 0; i < 8; i++) g = addPlanting(g, single('strawberry', tower, [500, 5000]));
    const found = warns(g).filter((f) => f.kind === 'pot' || f.kind === 'spacing');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/^Too crowded/);
    expect(found[0]!.message).not.toMatch(/%/);
    expect(fullText(howFull(g, tower, plantOf))).toBe('Over-full');
  });

  it('crowded and over-full are the same line', () => {
    const pot = potAt(500, 300, 'Pot');
    for (let n = 1; n <= 12; n++) {
      let g: Garden = listOf(pot);
      for (let i = 0; i < n; i++) g = addPlanting(g, single('parsley', pot, [500, 5000]));
      const crowded = potProblems(g, plantOf).some((p) => p.kind === 'crowded');
      if (n > 1) expect(crowded).toBe(howFull(g, pot, plantOf) > OVER_FULL);
    }
  });

  it('next year\'s draft in a pot does not make it crowded now, so the warning and the badge agree', () => {
    const pot = potAt(500, 300, 'Pot');
    const later = { ...single('tomato', pot, [500, 5000]), sowBy: '2027-03-15' };
    const g = addPlanting(addPlanting(listOf(pot), single('tomato', pot, [500, 5000])), later);
    expect(potProblems(g, plantOf).filter((p) => p.kind === 'crowded')).toEqual([]);
    expect(fullText(howFull(g, pot, plantOf))).not.toBe('Over-full');
  });

  it('lowering a squeezed row\'s count keeps the row where it is', () => {
    const bed = bedAt(0, 2400, 1200, 'Bed');
    const row = { ...makePlanting(plantOf('broad-bean'), bed.id, 'row', [300, 300], [1200, 300]), count: 20 };
    const g = addPlanting(listOf(bed), row);
    const { garden } = setPlantingCount(g, [row.id], 19, plantOf);
    expect(garden.plantings).toHaveLength(1);
    expect(garden.plantings[0]!.id).toBe(row.id);
    expect(garden.plantings[0]!.count).toBe(19);
  });

  it('a move counts what is in the pot already (Priya: "room for 16", then 175%)', () => {
    const full = potAt(500, 350, 'Bulb pot 3');
    const other = potAt(1000, 500, 'Pot 1');
    let g = put(listOf(full, other), full, 'grape-hyacinth', 'fill');
    g = put(g, other, 'tulip', 24);
    const tulips = g.plantings.find((p) => p.plantId === 'tulip')!;
    const room = moveRoom(g, tulips.id, full.id, plantOf)!;
    expect(room.fit).toBeLessThan(6);
    const moved = moveToListBed(g, tulips.id, full.id, plantOf);
    expect(howFull(moved, full, plantOf)).toBeLessThanOrEqual(OVER_FULL);
    const total = moved.plantings.filter((p) => p.plantId === 'tulip').reduce((t, p) => t + plantCount(p, plantOf('tulip')), 0);
    expect(total).toBe(24);
  });

  it('a bed with room takes another row (Priya: "Plenty of room", then "no room left")', () => {
    const bed = bedAt(0, 2400, 1200, 'Raised bed 1');
    let g = put(listOf(bed), bed, 'garlic', 10);
    g = put(g, bed, 'onion', 12);
    expect(fullText(howFull(g, bed, plantOf))).not.toMatch(/Nearly|Over/);
    expect(placeInList(g, bed, plantOf('corn-salad'), 'row', plantOf).plantings.length).toBeGreaterThan(0);
  });

  it('so does one whose rows were moved on the plan, with no clear strip left', () => {
    const bed = bedAt(0, 2400, 1200, 'Raised bed 1');
    // A short row near the far side: nothing past it, and a gap all along the rest.
    const row = { ...makePlanting(plantOf('garlic'), bed.id, 'row', [100, 1050], [1000, 1050]), count: 8 };
    const g = addPlanting(listOf(bed), row);
    expect(fullText(howFull(g, bed, plantOf))).not.toMatch(/Nearly|Over/);
    const { plantings, full } = placeInList(g, bed, plantOf('corn-salad'), 'row', plantOf);
    expect(plantings.length).toBeGreaterThan(0);
    expect(full).toBe(false);
  });

  it('a 4 × 3 m fruit cage holds a raspberry row and five bushes (Margaret)', () => {
    const cage = bedAt(0, 4000, 3000, 'Fruit cage', { fruitCage: true });
    let g = put(listOf(cage), cage, 'raspberry', 'row');
    for (const [id, n] of [['blackcurrant', 3], ['gooseberry', 2]] as const) {
      const { plantings, left } = placeInList(g, cage, plantOf(id), n, plantOf);
      expect(left).toBe(0);
      g = { ...g, plantings: [...g.plantings, ...plantings] };
    }
    expect(fullText(howFull(g, cage, plantOf))).not.toBe('Over-full');
  });

  it('raising a row\'s count in a list makes it longer, not closer (Priya: 70 mm apart)', () => {
    const bed = bedAt(0, 2400, 1200, 'Bed');
    const g = put(listOf(bed), bed, 'broad-bean', 7);
    const { garden, left } = setPlantingCount(g, g.plantings.map((p) => p.id), 14, plantOf);
    expect(left).toBe(0);
    expect(garden.plantings.reduce((t, p) => t + plantCount(p, plantOf('broad-bean')), 0)).toBe(14);
    expect(warns(garden).filter((f) => f.kind === 'row')).toEqual([]);
  });

  it('more than one row will hold goes into a second row', () => {
    const bed = bedAt(0, 2400, 1200, 'Bed');
    const g = put(listOf(bed), bed, 'broad-bean', 7);
    const { garden, left } = setPlantingCount(g, g.plantings.map((p) => p.id), 24, plantOf);
    expect(left).toBe(0);
    expect(garden.plantings.length).toBeGreaterThan(1);
  });
});

describe('counts: one figure', () => {
  it('rows of one sowing are one planting (Ruth: 13 for 8 listed; Margaret: 12 for 10)', () => {
    const bed = bedAt(0, 2400, 1200, 'Bed');
    const g = put(listOf(bed), bed, 'garlic', 60);
    expect(g.plantings.length).toBeGreaterThan(1);
    expect(plantingsCount(g, plantOf)).toBe(1);
  });

  it('eight strawberries in a tower are one planting (Sam)', () => {
    const tower = potAt(500, 350, 'Tower');
    let g: Garden = listOf(tower);
    for (let i = 0; i < 8; i++) g = addPlanting(g, single('strawberry', tower, [500, 5000]));
    expect(plantingsCount(g, plantOf)).toBe(1);
  });

  it('weeds and cleared plantings do not count', () => {
    const bed = bedAt(0, 2400, 1200, 'Bed');
    const g = addPlanting(addPlanting(listOf(bed), single('dandelion', bed)), { ...single('garlic', bed), removedOn: TODAY });
    expect(plantingsCount(g, plantOf)).toBe(0);
  });
});

describe('spacing in words', () => {
  it('is in cm under a metre', () => {
    expect(formatSpacing(150)).toBe('15 cm');
    expect(formatSpacing(300)).toBe('30 cm');
    expect(formatSpacing(1500)).toBe('1.5 m');
  });

  it('small ones keep their half centimetre: a depth of 15 mm is not 2 cm', () => {
    expect(formatSpacing(15)).toBe('1.5 cm');
    expect(formatSpacing(25)).toBe('2.5 cm');
    expect(formatSpacing(26)).not.toBe(formatSpacing(30));
    expect(formatSpacing(1040)).not.toBe(formatSpacing(1000));
  });

  it('a warning says cm', () => {
    const bed = bedAt(0, 1200, 600, 'Bed');
    const pl = { ...makePlanting(plantOf('broad-bean'), bed.id, 'row', [100, 300], [800, 300]), count: 16 };
    expect(warns(addPlanting(planOf(bed), pl)).find((f) => f.kind === 'row')!.message).toMatch(/\d+ cm apart; they need about \d+ cm/);
  });
});

describe('feeds: one source', () => {
  const bed = bedAt(0, 1200, 1200, 'Bed');
  const crocus = { ...makePlanting(plantOf('crocus'), bed.id, 'block', [100, 100], [600, 600]) };
  const job = (g: Garden) => jobsFor(g, plantOf, 10, 2026, { today: TODAY, feeding: true }).find((j) => j.plantId === 'crocus')!;
  const feedLine = (g: Garden) => shoppingList(g, plantOf, TODAY, { feeding: true }).filter((i) => i.kind === 'feed').map((i) => i.name);

  it('a first garden is told to use the feed on its list (Priya, Ruth, Margaret)', () => {
    const g = addPlanting(planOf(bed), crocus);
    expect(job(g).detail).toMatch(/blood, fish and bone, a small handful in the hole/);
    expect(job(g).detail).not.toMatch(/bonemeal/i);
    expect(feedLine(g)).toContain('Blood, fish and bone');
  });

  it('a feed for one thing is bought and named as itself, and the two agree', () => {
    const fruit = library.find((p) => p.feeding?.steps.some((s) => s.feed === 'sulphate-of-potash'))!;
    const pl = makePlanting(fruit, bed.id, 'single', [600, 600]);
    const g = addPlanting(planOf(bed), pl);
    expect(shoppingList(g, plantOf, TODAY, { feeding: true }).filter((i) => i.kind === 'feed').map((i) => i.name)).toContain('Sulphate of potash');
  });

  it('with bonemeal on the shelf, it says bonemeal', () => {
    const g = { ...addPlanting(planOf(bed), crocus), feedShelf: ['bonemeal'] };
    expect(job(g).detail).toMatch(/bonemeal, a small handful in the hole/);
  });
});

describe('the Shed and the timeline say one date', () => {
  it('seedlings due: the same day as the timeline (Margaret: 5 Nov against 12 Nov)', () => {
    const sown = '2026-10-29';
    const plant = plantOf('sweet-pea');
    const pl = { ...makePlanting(plant, 'x', 'single', [0, 0]), sownOn: sown, sowing: 'indoors' as const };
    const up = timeline(plant, pl, newGarden(), sown).find((s) => s.stage === 'germinated')!;
    const [, mm, dd] = up.date!.split('-');
    const next = nextFor(plant, newGarden(), 'sown', sown, {}, sown);
    expect(next.text).toContain(`about ${Number(dd)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mm) - 1]}`);
  });
});

describe('Want to grow', () => {
  const bed = bedAt(0, 1200, 1200, 'Bed');

  it('what is planted comes off, in its kinds too (Priya, Sam)', () => {
    let g: Garden = { ...planOf(bed), wishlist: ['garlic', 'tulip', 'strawberry', 'kale'] };
    g = addPlanting(g, single('garlic', bed));
    g = addPlanting(g, single('strawberry-everbearer', bed));
    expect(stillWanted(g, plantOf)).toEqual(['tulip', 'kale']);
  });

  it('the shopping list agrees (Sam)', () => {
    let g: Garden = { ...planOf(bed), wishlist: ['strawberry'] };
    g = addPlanting(g, { ...single('strawberry-everbearer', bed), stage: 'transplanted' as const });
    expect(shoppingList(g, plantOf, TODAY).filter((i) => i.plantId === 'strawberry')).toEqual([]);
  });
});
