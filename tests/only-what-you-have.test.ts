// Release 55: only the jobs a garden can do, herbs that don't nag, a welcome that
// doesn't keep coming back, a list you can shop from, and the last few words.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bedMade, jobsFor, makeBedJobs, toggleJob } from '../src/calendar/jobs';
import { spillsOver } from '../src/geometry/polygon';
import { glossed } from '../src/content/glossary';
import { howTo } from '../src/content/howto';
import { generalJobs } from '../src/content/seasons';
import { newGarden } from '../src/model/defaults';
import { makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { makePlanting } from '../src/planting/place';
import { potsOnly, shedName } from '../src/planting/pots';
import { shopGroups, shoppingList, shoppingText } from '../src/planting/shopping';
import { sanitisePrefs } from '../src/theme/prefs';
import { welcomeDue } from '../src/ui/launch';
import { setupFolded, setupLeft } from '../src/ui/setup';

const DIR = join(__dirname, '..', 'data', 'plants');
const plants: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(plants.map((p) => [p.id, p]));
const plantOf = (id: string): Plant => byId.get(id)!;

const bed = (extra: Partial<Feature> = {}): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Veg', ...extra });
const pot = (): Feature => makeFeature('pot', { circle: { centre: [5000, 500], radiusMm: 200 } });
const house = (kind: 'greenhouse' | 'cold-frame'): Feature => makeFeature(kind, { area: rectPoints({ x: 8000, y: 0, w: 2000, h: 2000 }) });
const growing = (id: string, f: Feature): Planting => ({ ...makePlanting(plantOf(id), f.id, 'single', [f.footprint[0]![0] + 100, f.footprint[0]![1] + 100]), stage: 'transplanted', stageDates: { transplanted: '2026-04-01' } });
const garden = (features: Feature[], plantings: Planting[] = [], extra: Partial<Garden> = {}): Garden => ({ ...newGarden(), features, plantings, ...extra });
const said = (month: number, g: Garden) => generalJobs(month, g, (id) => byId.get(id) ?? null).map((j) => j.text).join(' | ');

describe('only what you have', () => {
  it('has no greenhouse or cold frame jobs without one, with no plants as well', () => {
    expect(said(11, garden([bed()]))).not.toMatch(/greenhouse|cold frame/i);
    expect(said(11, garden([]))).not.toMatch(/greenhouse|cold frame/i);
    expect(said(11, garden([bed(), house('greenhouse')]))).toMatch(/greenhouse/i);
    expect(said(11, garden([bed(), house('cold-frame')], [growing('kale', bed())]))).toMatch(/cold frame/i);
  });

  it('gives a balcony no leaf mould, bare-root trees, tools or next year’s beds', () => {
    const b = garden([pot()], [], { balcony: { facing: 'north' } });
    expect(said(10, b)).not.toMatch(/leaf mould/i);
    expect(said(11, b)).not.toMatch(/bare-root|tools/i);
    expect(said(12, b)).not.toMatch(/next year/i);
    expect(said(9, b)).not.toMatch(/green manure/i);
    expect(said(10, garden([bed()]))).toMatch(/leaf mould/i);
  });

  it('keeps a job’s tick in place when others are hidden', () => {
    const jobs = generalJobs(11, garden([pot()], [], { balcony: {} }));
    expect(jobs.map((j) => j.i)).not.toContain(0);
    expect(jobs.some((j) => j.i === 1)).toBe(true);
  });

  it('only says fleece for tender plants to a garden growing something tender', () => {
    const b = bed();
    expect(said(11, garden([b], [growing('kale', b)]))).not.toMatch(/tender/i);
    expect(said(11, garden([b], [growing('lettuce', b)]))).not.toMatch(/tender/i);
    expect(said(11, garden([b], [growing('chilli', b)]))).toMatch(/tender/i);
  });

  it('knows a garden of pots, and calls the Shed something else', () => {
    expect(potsOnly(garden([pot()]))).toBe(true);
    expect(potsOnly(garden([pot(), bed()]))).toBe(false);
    expect(potsOnly(garden([]))).toBe(false);
    expect(potsOnly(garden([], [], { balcony: {} }))).toBe(true);
    // A bed added to a balcony changes things; a cold frame doesn't.
    expect(potsOnly(garden([pot(), bed()], [], { balcony: {} }))).toBe(false);
    expect(potsOnly(garden([pot(), house('cold-frame')], [], { balcony: {} }))).toBe(true);
    expect(shedName(garden([pot()]))).toBe('Seedlings');
    expect(shedName(garden([bed()]))).toBe('Shed');
  });

  it('gives a bed worked sitting down hand tools, not a hoe', () => {
    const [a, b] = [bed({ handTools: true }), bed({ handTools: true, name: 'Other' })];
    const weed = jobsFor(garden([a, b], [growing('kale', a), growing('kale', b)]), plantOf, 5, 2027, { weeding: true }).find((j) => j.key.startsWith('weed:beds'))!;
    expect(weed.detail).not.toMatch(/hoe/i);
    const how = howTo(weed, 'seed');
    expect([...how.need, ...how.steps].join(' ')).not.toMatch(/hoe/i);
    const plain = bed();
    const usual = jobsFor(garden([plain], [growing('kale', plain)]), plantOf, 5, 2027, { weeding: true });
    expect(usual.find((j) => j.key.startsWith('weed:beds'))!.detail).toMatch(/hoe/i);
  });

  it('saves the switch, and an older garden moves up', () => {
    expect(validateGarden(garden([bed({ handTools: true })]))).toEqual([]);
    expect(validateGarden(garden([bed({ handTools: 'yes' as never })])).length).toBeGreaterThan(0);
    const old = { ...newGarden(), schemaVersion: 26 };
    expect(migrateGarden(old)).toEqual({ ...old, schemaVersion: SCHEMA_VERSION });
  });
});

describe('herbs', () => {
  const herbJob = (id: string, month: number) => {
    const b = bed();
    return jobsFor(garden([b], [growing(id, b)]), plantOf, month, 2027, { today: `2027-${String(month).padStart(2, '0')}-10` }).some((j) => j.kind === 'harvest');
  };

  it('says ready to pick as a herb’s months start, and not every month', () => {
    for (const id of ['thyme', 'parsley', 'chives']) {
      const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => herbJob(id, m));
      expect(months.length, id).toBeLessThanOrEqual(2);
    }
  });
});

describe('the welcome', () => {
  it('comes for a new month, and once for news', () => {
    expect(welcomeDue('2026-10-15', '2026-10-16')).toBe(false);
    expect(welcomeDue('2026-10-31', '2026-11-01')).toBe(true);
    expect(welcomeDue('2026-10-15', '2026-10-16', true)).toBe(true);
    expect(welcomeDue('2026-10-15', '2026-10-16', false)).toBe(false);
  });

  it('keeps what it’s said, and the reminder’s day', () => {
    expect(sanitisePrefs({ welcomedNews: 'x' }).welcomedNews).toBe('x');
    expect(sanitisePrefs({}).welcomedNews).toBeNull();
    expect(sanitisePrefs({ reminderDay: 5 }).reminderDay).toBe(5);
    expect(sanitisePrefs({ reminderDay: 9 }).reminderDay).toBe(1);
    expect(sanitisePrefs({ reminderDay: 0 }).reminderDay).toBe(0);
  });
});

describe('Getting started', () => {
  const g = garden([bed()]);
  const prefs = { northChecked: false, lastBackup: null, setupHidden: false, setupFrom: '2026-10-29' };

  it('leaves Today after its first day, and the ··· has it', () => {
    expect(setupFolded('2026-10-29', '2026-10-29')).toBe(false);
    expect(setupLeft(g, prefs, '2026-10-29')).toBe(false);
    expect(setupLeft(g, prefs, '2026-10-30')).toBe(true);
    expect(setupLeft(g, { ...prefs, setupHidden: true }, '2026-10-30')).toBe(false);
  });
});

describe('a list you can shop from', () => {
  const b = bed();
  const today = '2026-10-29';

  it('has an amount on every line', () => {
    const g = garden([b], [makePlanting(plantOf('garlic'), b.id, 'single', [100, 100])], { wishlist: ['tomato', 'strawberry', 'tulip', 'potato'] });
    const list = shoppingList(g, plantOf, today, { feeding: true });
    expect(list.length).toBeGreaterThan(3);
    for (const i of list) expect(i.amount, i.key).toBeTruthy();
    expect(list.find((i) => i.key === 'seed:tomato')!.amount).toBe('a packet');
  });

  it('splits what to buy now from what can wait, in order', () => {
    const g = garden([b], [makePlanting(plantOf('garlic'), b.id, 'single', [100, 100])], { wishlist: ['tomato'] });
    const groups = shopGroups(shoppingList(g, plantOf, today));
    expect(groups[0]!.label).toBe('Buy now');
    expect(groups[0]!.list.map((i) => i.key)).toContain('bulb:garlic');
    const later = groups.find((x) => x.list.some((i) => i.key === 'seed:tomato'))!;
    expect(later.label).toBe('Buy by January');
    expect(shoppingText(shoppingList(g, plantOf, today), 'Home')).toContain('Buy by January');
  });

  it('leaves a feed off until it’s wanted', () => {
    const p = pot();
    const list = (on: string) => shoppingList(garden([p], [makePlanting(plantOf('daffodil'), p.id, 'single', [5000, 500])]), plantOf, on, { feeding: true }).filter((i) => i.kind === 'feed').map((i) => i.key);
    expect(list('2026-10-29')).not.toContain('feed:tomato-feed');
  });
});

describe('fixes from the code review', () => {
  const square: [number, number][] = [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
  ];
  const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  it('doesn’t call a bed a hair over the edge outside, and does a bed well over', () => {
    expect(spillsOver(rect(800, 200, 1005, 400), square)).toBe(false);
    expect(spillsOver(rect(800, 200, 1200, 400), square)).toBe(true);
  });

  it('sees a bed filling a notch exactly', () => {
    const u: [number, number][] = [
      [0, 0],
      [3000, 0],
      [3000, 3000],
      [2000, 3000],
      [2000, 1500],
      [1000, 1500],
      [1000, 3000],
      [0, 3000],
    ];
    expect(spillsOver(rect(500, 1500, 2500, 3000), u)).toBe(true);
    expect(spillsOver(rect(100, 100, 900, 2900), u)).toBe(false);
  });

  it('counts a bed marked as made as its job ticked, so it can be unticked', () => {
    const f = bed({ toMake: true });
    const made = bedMade(garden([f]), f.id, '2026-10-30');
    expect(made.features[0]!.toMake).toBeUndefined();
    const job = makeBedJobs(made, 10, 2026)[0]!;
    expect(made.jobsDone.map((j) => j.key)).toContain(job.key);
    expect(toggleJob(made, job, '2026-10-30').features[0]!.toMake).toBe(true);
  });
});

describe('the last few words', () => {
  const ids = (text: string) => glossed(text).map((s) => s.word?.id).filter(Boolean);

  it('explains what Jordan had to look up', () => {
    expect(ids('Last frost: 50:50 by about 9 May')).toContain('fifty-fifty');
    expect(ids('Half-hardy')).toContain('half-hardy');
    expect(ids('Tender: keep above 10°C')).toContain('tender');
    expect(ids('slightly acidic')).toContain('slightly-acidic');
    expect(ids('A bulb planter')).toContain('bulb-planter');
  });

  it('tells half-hardy from tender', () => {
    expect(ids('Half-hardy')).not.toContain('tender');
    expect(ids('Pick the leaves while young and tender.')).toEqual([]);
  });
});
