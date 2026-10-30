// Release 57a: the worst of what Nadia found. A file can't freeze the app, established fruit is ready in its own season,
// a job doesn't change on the last day of a month, a crop left on the plan ends, two tabs don't overwrite each other,
// and a replaced garden can be brought back.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { expectedText, timeline, yearDate } from '../src/lifecycle/projection';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { AppState, Feature, Garden, Plant, Planting } from '../src/model/types';
import { MAX_PLANTS, PLAN_LIMIT_MM } from '../src/model/validate';
import { addPlanting, makePlanting, MOST_SET_OUT, plantCount, plantPositions, unknownPlant } from '../src/planting/place';
import { backupFile, parseFileText, toFile } from '../src/storage/file';
import { addGarden, changesOpen, gardenKey, keepReplaced, listGardens, openGarden, peekGarden, readOpen, saveOpen, startUp, type Kv } from '../src/storage/gardens';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const byId = new Map(species.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 3000 }) }), name: 'Bed 1' };
const single = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'single', [600, 600]), ...patch });
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));
const asFile = (g: Garden) => JSON.stringify(toFile({ garden: g, userPlants: [] }));

/** Added as already in the ground: the day it went in, and growing, with no day for that. */
const established = (id: string, on: string) => single(id, { stage: 'vegetative', stageDates: { transplanted: on } });
const listOn = (g: Garden, today: string, month = Number(today.slice(5, 7)), year = Number(today.slice(0, 4))) => jobsFor(g, plantOf, month, year, { today, feeding: true });
const picks = (g: Garden, today: string, month?: number, year?: number) => listOn(g, today, month, year).filter((j) => j.kind === 'harvest').map((j) => j.plantId);

function memory(): Kv {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe('a file can’t freeze the app', () => {
  const refused = (change: (g: Garden) => Garden) => {
    const r = parseFileText(asFile(change(gardenWith(single('tomato')))));
    expect(r.ok).toBe(false);
    return r;
  };
  const moved = (patch: Partial<Planting>) => (g: Garden) => ({ ...g, plantings: g.plantings.map((p) => ({ ...p, ...patch })) });

  it('refuses a planting of a billion plants', () => {
    refused(moved({ count: 1_000_000_000 }));
  });

  it('refuses things placed kilometres away, however far', () => {
    for (const x of [10_000_000, 1e12, 1e308]) refused(moved({ x, y: x }));
    refused(moved({ layout: 'block', endPoint: [10_000_000, 10] }));
    refused((g) => ({ ...g, boundary: [[0, 0], [1e7, 0], [0, 1e7]] }));
    refused((g) => ({ ...g, features: g.features.map((f) => ({ ...f, footprint: [[0, 0], [1e9, 0], [0, 1e9]] })) }));
  });

  it('takes a garden at the limits', () => {
    const r = parseFileText(asFile(moved({ x: PLAN_LIMIT_MM, y: -PLAN_LIMIT_MM, count: MAX_PLANTS })(gardenWith(single('tomato')))));
    expect(r.ok).toBe(true);
  });

  it('still opens what’s already kept, however odd, rather than losing it', () => {
    const s = memory();
    const g = moved({ count: 1_000_000_000 })(gardenWith(single('tomato')));
    const id = addGarden(g, s, new Date(), true)!;
    expect(peekGarden(id, s)).not.toBeNull();
    expect(startUp(newGarden, s).garden.plantings[0]!.count).toBe(1_000_000_000);
  });

  it('never sets out more than the most it can draw, whatever the shape', () => {
    const lots = single('radish', { layout: 'block', x: 0, y: 0, endPoint: [1_000_000, 1_000_000] });
    expect(plantPositions(lots, plantOf('radish'))).toHaveLength(MOST_SET_OUT);
    expect(plantPositions({ ...lots, endPoint: [1_000_000, 200] }, plantOf('radish')).length).toBeLessThanOrEqual(MOST_SET_OUT);
    expect(plantPositions({ ...lots, count: 1_000_000_000 }, plantOf('radish'))).toHaveLength(MOST_SET_OUT);
    expect(plantPositions({ ...lots, layout: 'row', count: 1_000_000_000 }, plantOf('radish'))).toHaveLength(MOST_SET_OUT);
  });

  it('spreads a thinned block across the whole of it, not just one end', () => {
    const pts = plantPositions(single('radish', { layout: 'block', x: 0, y: 0, endPoint: [1_000_000, 1_000_000] }), plantOf('radish'));
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(990_000);
    expect(Math.max(...pts.map((p) => p[0]))).toBeGreaterThan(990_000);
  });

  it('sets out an ordinary block as before', () => {
    const block = single('lettuce', { layout: 'block', x: 0, y: 0, endPoint: [1200, 900] });
    expect(plantPositions(block, plantOf('lettuce'))).toHaveLength(plantCount(block, plantOf('lettuce')));
  });
});

describe('established fruit is ready in its own season', () => {
  const g = gardenWith(established('strawberry', '2024-04-01'), established('raspberry', '2024-11-01'), established('blackcurrant', '2023-11-01'));

  it('on 15 July 2027, with a strawberry that crops June and July', () => {
    expect(picks(g, '2027-07-15')).toContain('strawberry');
    expect(picks(g, '2027-07-15')).toContain('raspberry');
  });

  it('what Coming up promises for next month, that month delivers', () => {
    for (const fruit of ['strawberry', 'blackcurrant']) {
      expect(picks(g, '2027-06-15', 7, 2027)).toContain(fruit);
      expect(picks(g, '2027-07-01')).toContain(fruit);
      expect(picks(g, '2027-07-31')).toContain(fruit);
    }
  });

  it('out of season there’s nothing to pick', () => {
    expect(picks(g, '2027-02-15')).toEqual([]);
  });

  it('however long ago it was planted', () => {
    expect(picks(gardenWith(established('strawberry', '2011-04-01')), '2027-07-15')).toContain('strawberry');
    expect(picks(gardenWith(established('apple', '2005-02-01')), '2027-10-10')).toContain('apple');
  });

  it('the card agrees with the job, and a date to come can’t read as one gone', () => {
    const [pl] = g.plantings;
    expect(expectedText(timeline(plantOf('strawberry'), pl!, g, '2027-07-15'), plantOf('strawberry'), '2027-07-15')).toBe('Probably ready to pick now');
    expect(yearDate('2028-05-01', '2027-08-15')).toBe('1 May 2028');
  });
});

describe('a job doesn’t change on the last day of a month', () => {
  const g = gardenWith(
    single('tomato', { sownOn: '2026-03-10', stage: 'harvesting', stageDates: { transplanted: '2026-05-25', harvesting: '2026-08-01' } }),
    single('leek', { sownOn: '2026-03-01', stage: 'vegetative', stageDates: { transplanted: '2026-06-01' } }),
    single('parsnip', { sownOn: '2026-04-01', sowing: 'direct', stage: 'vegetative', stageDates: { germinated: '2026-04-25' } }),
  );

  it('through January, each day picks the same crops', () => {
    const lists = ['2027-01-15', '2027-01-29', '2027-01-30', '2027-01-31'].map((d) => picks(g, d).sort().join());
    expect(new Set(lists).size).toBe(1);
    expect(lists[0]).toContain('leek');
    expect(lists[0]).not.toContain('tomato');
  });

  it('nor at any other month’s end', () => {
    for (const [mid, end] of [['2027-02-15', '2027-02-28'], ['2026-12-15', '2026-12-31'], ['2027-06-15', '2027-06-30']] as const) expect(picks(g, end).sort()).toEqual(picks(g, mid).sort());
  });
});

describe('a crop left on the plan ends', () => {
  const tomato = single('tomato', { sownOn: '2026-03-10', stage: 'harvesting', stageDates: { transplanted: '2026-05-25', harvesting: '2026-08-01' } });
  const g = gardenWith(tomato);
  const kinds = (today: string) => listOn(g, today).filter((j) => j.plantId === 'tomato').map((j) => j.kind);

  it('isn’t fed or picked in the years after', () => {
    for (const d of ['2027-07-15', '2028-08-10', '2030-06-15']) expect(kinds(d)).toEqual(['tidy']);
  });

  it('is still picked and fed in its own season', () => {
    expect(kinds('2026-08-20')).toContain('harvest');
    expect(kinds('2026-08-20')).toContain('feed');
  });

  it('says so, with no date, and ticking the job clears it, and unticking brings it back', () => {
    expect(expectedText(timeline(plantOf('tomato'), tomato, g, '2027-07-15'), plantOf('tomato'), '2027-07-15')).toMatch(/season’s over/);
    const job = listOn(g, '2027-07-15').find((j) => j.plantId === 'tomato')!;
    expect(job.clears).toBe(true);
    const cleared = toggleJob(g, job, '2027-07-15', plantOf);
    expect(cleared.plantings[0]!.removedOn).toBe('2027-07-15');
    expect(listOn(cleared, '2027-07-15').filter((j) => j.plantId === 'tomato')).toEqual([]);
    expect(toggleJob(cleared, job, '2027-07-15', plantOf).plantings[0]!.removedOn).toBeUndefined();
  });

  it('never tells you to clear what comes back, however old', () => {
    const old = ['rosemary', 'chives', 'strawberry', 'apple', 'asparagus', 'rhubarb', 'mint', 'lavender'].map((id) => established(id, '2019-05-01'));
    const jobs = listOn(gardenWith(...old), '2027-07-15');
    expect(jobs.filter((j) => j.clears)).toEqual([]);
  });

  it('leaves a chilli in a pot, which may be on a windowsill', () => {
    const pot: Feature = { ...makeFeature('pot', { area: rectPoints({ x: 2000, y: 0, w: 300, h: 300 }) }) };
    const chilli = (id: string): Planting => ({ ...single('chilli', { sownOn: '2026-02-20', stage: 'harvesting', stageDates: { transplanted: '2026-06-01', harvesting: '2026-08-15' } }), featureId: id });
    const potted = addPlanting(addFeature(gardenWith(), pot), chilli(pot.id));
    expect(listOn(potted, '2027-07-15').some((j) => j.clears)).toBe(false);
    expect(listOn(gardenWith(chilli(bed.id)), '2027-07-15').some((j) => j.clears)).toBe(true);
  });
});

describe('two tabs, one garden', () => {
  it('a tab can read what another saved, and tell which keys matter', () => {
    const s = memory();
    const first = gardenWith();
    const id = addGarden(first, s, new Date(), true)!;
    const other = { ...first, name: 'Saved by the other tab' };
    expect(saveOpen({ garden: other, userPlants: [] }, s)).toBe(true);
    expect(readOpen(s)!.garden.name).toBe('Saved by the other tab');
    expect(changesOpen(gardenKey(id), s)).toBe(true);
    expect(changesOpen(gardenKey('another'), s)).toBe(false);
    expect(changesOpen(`${gardenKey(id)}:unreadable:1`, s)).toBe(false);
    expect(changesOpen('garden-planner:prefs', s)).toBe(false);
    expect(changesOpen(null, s)).toBe(false);
  });

  it('a garden opened in another tab is what this one follows', () => {
    const s = memory();
    addGarden({ ...gardenWith(), name: 'One' }, s, new Date(), true);
    const two = addGarden({ ...gardenWith(), name: 'Two' }, s)!;
    openGarden(two, s);
    expect(readOpen(s)!.garden.name).toBe('Two');
  });
});

describe('a replaced garden can be brought back', () => {
  const state = (name: string): AppState => ({ garden: { ...gardenWith(single('tomato')), name }, userPlants: [] });

  it('keeps it hidden for 30 days, leaves the open one open, and brings it back whole', () => {
    const s = memory();
    const open = addGarden(state('Mine').garden, s, new Date(), true)!;
    const kept = keepReplaced(state('Mine').garden, s)!;
    saveOpen(state('From the backup'), s);
    const l = listGardens(s);
    expect(l.open).toBe(open);
    expect(l.gardens.map((g) => g.name)).toEqual(['From the backup']);
    expect(l.hidden.map((g) => g.id)).toEqual([kept]);
    expect(peekGarden(open, s)!.name).toBe('From the backup');
    const back = openGarden(kept, s)!;
    expect(back.garden.name).toBe('Mine');
    expect(back.garden.plantings).toHaveLength(1);
  });

  it('is kept with the same trace photo', () => {
    const s = memory();
    addGarden(state('Mine').garden, s, new Date(), true);
    const kept = keepReplaced(state('Mine').garden, s)!;
    expect(listGardens(s).hidden.find((g) => g.id === kept)!.traceKey).toMatch(/^trace:/);
  });

  it('a backup file still comes back as it went', async () => {
    const r = parseFileText(await backupFile(state('Mine')).text());
    expect(r.ok && r.state.garden.name).toBe('Mine');
  });
});
