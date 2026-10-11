// Release 29, trim and tidy: the core 150 first and the rest under "More plants
// (still being checked)", the first job after setting up, Getting started
// folding after the first day, and the new preferences. (The welcome once a day
// is in welcome.test.ts.)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstJob } from '../src/calendar/jobs';
import { sowList } from '../src/lifecycle/sowList';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { CORE, isCore, POPULAR, splitCore } from '../src/library/order';
import { newGarden } from '../src/model/defaults';
import { makeSpace, spaceInfo } from '../src/model/spaces';
import type { Plant } from '../src/model/types';
import { kitsFor, applyKit } from '../src/planting/kits';
import { unknownPlant } from '../src/planting/place';
import { sanitisePrefs } from '../src/theme/prefs';
import { setupFolded } from '../src/ui/setup';
import varieties from '../data/varieties.json';

const DIR = join(__dirname, '../data/plants');
const species: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

describe('the core 150', () => {
  it('is 150 real plants, once each, the most-grown first', () => {
    expect(CORE).toHaveLength(150);
    expect(new Set(CORE).size).toBe(150);
    expect(CORE.filter((id) => !byId.has(id))).toEqual([]);
    expect(CORE.slice(0, POPULAR.length)).toEqual(POPULAR);
    // Only plants to grow: no weeds or varieties.
    expect(CORE.filter((id) => plantOf(id).category === 'weed' || plantOf(id).varietyOf)).toEqual([]);
  });

  it('keeps in the main lists the core and its varieties, checked plants, your own and weeds', () => {
    const variety = library.find((p) => p.varietyOf === 'tomato')!;
    expect(isCore(plantOf('tomato'))).toBe(true);
    expect(isCore(variety)).toBe(true);
    expect(isCore(plantOf('oca'))).toBe(false);
    expect(isCore({ ...plantOf('oca'), verified: true })).toBe(true);
    expect(isCore({ ...plantOf('oca'), id: 'user-1', userAdded: true })).toBe(true);
    expect(isCore(library.find((p) => p.category === 'weed')!)).toBe(true);
  });

  it('splits a list in two, each in its order, with most plants waiting under More plants', () => {
    const list = [plantOf('oca'), plantOf('tomato'), plantOf('yacon'), plantOf('carrot')];
    const { core, more } = splitCore(list);
    expect(core.map((p) => p.id)).toEqual(['tomato', 'carrot']);
    expect(more.map((p) => p.id)).toEqual(['oca', 'yacon']);
    const all = splitCore(species.filter((p) => p.category !== 'weed'));
    expect(all.core).toHaveLength(150);
    expect(all.more.length).toBeGreaterThan(300);
  });

  it('puts the sowing list’s plants still being checked in a group of their own, unless you search', () => {
    const o = { month: 3, kind: 'all' as const, query: '', weeds: false, tin: new Set<string>() };
    const list = sowList(library, o);
    const grouped = [...list.now, ...list.later, ...list.other];
    expect(grouped.every(isCore)).toBe(true);
    expect(list.more.length).toBeGreaterThan(0);
    expect(list.more.some(isCore)).toBe(false);
    const searched = sowList(library, { ...o, query: 'oca' });
    expect(searched.more).toEqual([]);
    expect([...searched.now, ...searched.later, ...searched.other].map((p) => p.id)).toContain('oca');
  });
});

describe('after setting up', () => {
  it('lands on the first job, with its plants picked out', () => {
    const kit = kitsFor('garden', 10, (id) => byId.get(id) ?? null)[0]!;
    const g = applyKit(makeSpace(newGarden(), 'garden', ...spaceInfo('garden').size), kit, (id) => byId.get(id) ?? null, '2026-10-11');
    const first = firstJob(g, plantOf, new Date(2026, 9, 11));
    expect(first).not.toBeNull();
    expect(g.plantings.some((p) => p.id === first!.target.id)).toBe(true);
    expect(first!.note).toMatch(/^Your first job: [A-Z][\w ’'-]*, [a-z ]+ (in|for|on|along|up) .+\.$/);
  });

  it('has no first job for an empty garden', () => {
    expect(firstJob(newGarden(), plantOf, new Date(2026, 9, 11))).toBeNull();
  });
});

describe('Getting started, and the new preferences', () => {
  it('folds after the first day it showed', () => {
    expect(setupFolded(null, '2026-10-11')).toBe(false);
    expect(setupFolded('2026-10-11', '2026-10-11')).toBe(false);
    expect(setupFolded('2026-10-11', '2026-10-12')).toBe(true);
  });

  it('keeps the UV off Today unless turned on, and the days kept as dates', () => {
    const d = sanitisePrefs({});
    expect([d.uvOnToday, d.welcomedOn, d.setupFrom]).toEqual([false, null, null]);
    const p = sanitisePrefs({ uvOnToday: true, setupFrom: '2026-10-11', welcomedOn: '2026-10-11' });
    expect([p.uvOnToday, p.setupFrom, p.welcomedOn]).toEqual([true, '2026-10-11', '2026-10-11']);
    expect(sanitisePrefs({ setupFrom: 12 }).setupFrom).toBeNull();
  });
});
