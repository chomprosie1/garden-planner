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
import { addPlanting, makePlanting, MOST_SET_OUT, plantCount, plantPositions, restorePlanting, unknownPlant } from '../src/planting/place';
import { backupFile, parseFileText, toFile } from '../src/storage/file';
import { addGarden, changesOpen, gardenKey, keepReplaced, listGardens, openGarden, peekGarden, readOpen, saveOpen, startUp, traceKeyOf, type Kv } from '../src/storage/gardens';

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
    for (const endPoint of [[1_000_000, 1_000_000], [1_000_000, 200], [200, 1_000_000], [1_000_000, 5000], [300_000, 700_000]] as [number, number][]) {
      const n = plantPositions({ ...lots, endPoint }, plantOf('radish')).length;
      expect(n).toBeLessThanOrEqual(MOST_SET_OUT);
      expect(n).toBeGreaterThan(1000);
    }
    expect(plantPositions({ ...lots, count: 1_000_000_000 }, plantOf('radish'))).toHaveLength(MOST_SET_OUT);
    expect(plantPositions({ ...lots, layout: 'row', count: 1_000_000_000 }, plantOf('radish'))).toHaveLength(MOST_SET_OUT);
  });

  it('keeps a long narrow block on the plan, one plant wide or a few', () => {
    for (const endPoint of [[30, 3_000_000], [120, 5_000_000], [3_000_000, 30]] as [number, number][]) {
      const pts = plantPositions(single('radish', { layout: 'block', x: 0, y: 0, endPoint }), plantOf('radish'));
      expect(pts.length).toBeGreaterThan(1000);
      expect(pts.length).toBeLessThanOrEqual(MOST_SET_OUT);
      expect(pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true);
    }
  });

  it('spreads a thinned block evenly over all of it, with no stripes or single line', () => {
    for (const endPoint of [[1_000_000, 1_000_000], [300_000, 700_000]] as [number, number][]) {
      const pts = plantPositions(single('radish', { layout: 'block', x: 0, y: 0, endPoint }), plantOf('radish'));
      const across = [...new Set(pts.map((p) => p[0]))].sort((a, b) => a - b);
      const down = [...new Set(pts.map((p) => p[1]))].sort((a, b) => a - b);
      expect(across.length).toBeGreaterThan(50);
      expect(down.length).toBeGreaterThan(50);
      expect(across[across.length - 1]!).toBeGreaterThan(endPoint[0] * 0.98);
      expect(down[down.length - 1]!).toBeGreaterThan(endPoint[1] * 0.98);
      // No gap much wider than the rest: stripes would show as one.
      const gaps = across.slice(1).map((x, i) => x - across[i]!);
      expect(Math.max(...gaps)).toBeLessThan(Math.min(...gaps) * 1.5 + 200);
    }
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

  it('agrees with its card from the day its clearing is due, not from the next month', () => {
    // Clearing due in late October, with the frost: the list and the card change together.
    const days = ['2026-11-02', '2026-11-20', '2026-11-30'];
    for (const d of days) expect(kinds(d)).toEqual(['tidy']);
    expect(timeline(plantOf('tomato'), tomato, g, '2026-11-02').some((s) => s.due && s.stage === 'cleared')).toBe(true);
    expect(timeline(plantOf('tomato'), tomato, g, '2026-08-20').some((s) => s.due && s.stage === 'cleared')).toBe(false);
  });

  it('a look back at an earlier month still shows what was on then', () => {
    expect(jobsFor(g, plantOf, 8, 2026, { today: '2027-02-10' }).filter((j) => j.plantId === 'tomato').map((j) => j.kind)).toContain('harvest');
  });

  it('clearing one sowing doesn’t tick off the other’s clear-up', () => {
    const old = single('lettuce', { sownOn: '2026-03-01', sowing: 'direct', stage: 'harvesting', stageDates: { germinated: '2026-03-20', harvesting: '2026-05-20' } });
    const fresh = single('lettuce', { sownOn: '2026-09-01', sowing: 'direct', stage: 'vegetative', stageDates: { germinated: '2026-09-15' } });
    const clears = jobsFor(gardenWith(old, fresh), plantOf, 9, 2026, { today: '2026-09-20' }).find((j) => j.clears)!;
    expect(clears.plantingIds).toEqual([old.id]);
    expect(clears.key).toContain(`:clear-${old.id}:`);
    expect(clears.where).not.toMatch(/2 plants/);
  });

  it('a second sowing that ends the same month isn’t shown as already cleared', () => {
    const lettuce = (d: string) => single('lettuce', { sownOn: d, sowing: 'direct', stage: 'harvesting', stageDates: { germinated: d, harvesting: d } });
    const first = lettuce('2026-03-01');
    const second = lettuce('2026-03-10');
    const clearJob = (x: Garden) => jobsFor(x, plantOf, 9, 2026, { today: '2026-09-20' }).find((j) => j.clears)!;
    const both = gardenWith(first);
    const ticked = toggleJob(both, clearJob(both), '2026-09-20', plantOf);
    const later = addPlanting(ticked, second);
    const job = clearJob(later);
    expect(job.plantingIds).toEqual([second.id]);
    expect(later.jobsDone.some((j) => j.key === job.key)).toBe(false);
  });

  it('put back on the plan, it has its clearing to do again', () => {
    const job = listOn(g, '2027-07-15').find((j) => j.clears)!;
    const cleared = toggleJob(g, job, '2027-07-15', plantOf);
    const back = restorePlanting(cleared, tomato.id);
    expect(back.plantings[0]!.removedOn).toBeUndefined();
    const again = listOn(back, '2027-07-15').find((j) => j.clears)!;
    expect(again.key).toBe(job.key);
    expect(back.jobsDone.some((j) => j.key === again.key)).toBe(false);
  });

  it('a quick crop sown at the end of its months goes by the warmth, not to next year’s months', () => {
    const quick: Plant = { ...plantOf('radish'), cropping: { harvestMonths: [5, 6, 7, 8, 9] }, growth: { days: [28, 35] } };
    const pl: Planting = { ...single('radish'), sownOn: '2026-09-20', sowing: 'direct', stage: 'vegetative' };
    const h = timeline(quick, pl, gardenWith(pl), '2026-09-21').find((s) => s.stage === 'harvesting' && s.date)!;
    expect(h.date! < '2027-05-01').toBe(true);
  });

  it('a crop sown too late for its months waits for the next run of them', () => {
    const carrot = single('carrot', { sownOn: '2026-11-20', sowing: 'direct', stage: 'vegetative' });
    const h = timeline(plantOf('carrot'), carrot, gardenWith(carrot), '2026-11-25').find((s) => s.stage === 'harvesting' && s.date)!;
    expect(h.date! > '2027-01-01').toBe(true);
    const peas = single('sweet-pea', { sownOn: '2026-09-25', sowing: 'direct', stage: 'vegetative' });
    const f = timeline(plantOf('sweet-pea'), peas, gardenWith(peas), '2026-09-26').find((s) => s.stage === 'flowering' && s.date)!;
    expect(plantOf('sweet-pea').flowerMonths).toContain(Number(f.date!.slice(5, 7)));
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

  it('has its own place for a trace photo, not the open garden’s', () => {
    const s = memory();
    const open = addGarden(state('Mine').garden, s, new Date(), true)!;
    const kept = keepReplaced(state('Mine').garden, s)!;
    const entry = listGardens(s).hidden.find((g) => g.id === kept)!;
    expect(traceKeyOf(entry)).not.toBe(traceKeyOf({ id: open }));
  });

  it('a new garden with no room in the list isn’t kept, and leaves the open one open', () => {
    const s = memory();
    const open = addGarden(state('Mine').garden, s, new Date(), true)!;
    const before = s.length;
    let writes = 0;
    const tight: Kv = { getItem: s.getItem, removeItem: s.removeItem, key: s.key, get length() { return s.length; }, setItem: (k, v) => { if (++writes === 2) throw new Error('full'); s.setItem(k, v); } };
    expect(addGarden(state('Another').garden, tight, new Date(), true)).toBeNull();
    expect(s.length).toBe(before);
    expect(listGardens(s).open).toBe(open);
    expect(peekGarden(open, s)!.name).toBe('Mine');
  });

  it('with no room to keep it, says so and leaves nothing half done', () => {
    const s = memory();
    addGarden(state('Mine').garden, s, new Date(), true);
    const before = s.length;
    const full: Kv = { ...s, getItem: s.getItem, removeItem: s.removeItem, key: s.key, length: s.length, setItem: () => { throw new Error('full'); } };
    expect(keepReplaced(state('Mine').garden, full)).toBeNull();
    expect(s.length).toBe(before);
    expect(listGardens(s).hidden).toEqual([]);
  });

  it('with room for the garden but not the list, leaves no orphan behind', () => {
    const s = memory();
    addGarden(state('Mine').garden, s, new Date(), true);
    const before = s.length;
    // Storage turns away the write that grows it: the shorter list that tidies up still goes in.
    let writes = 0;
    const tight: Kv = { getItem: s.getItem, removeItem: s.removeItem, key: s.key, get length() { return s.length; }, setItem: (k, v) => { if (++writes === 3) throw new Error('full'); s.setItem(k, v); } };
    expect(keepReplaced(state('Mine').garden, tight)).toBeNull();
    expect(s.length).toBe(before);
    expect(listGardens(s).gardens).toHaveLength(1);
  });

  it('a backup file still comes back as it went', async () => {
    const r = parseFileText(await backupFile(state('Mine')).text());
    expect(r.ok && r.state.garden.name).toBe('Mine');
  });
});
