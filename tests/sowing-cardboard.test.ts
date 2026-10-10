// Release 22: the Seedlings sowing list (now first, by kind, weeds hidden),
// and cardboard over weeds (a ground you plant through, the day it was laid,
// a job when it's likely to have rotted, and the save format, schema 17).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDBOARD_MONTHS, cardboardJobs, jobsFor, toggleJob } from '../src/calendar/jobs';
import { sowList, isKind, type SowListOptions } from '../src/lifecycle/sowList';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, materialPatch, rectPoints, MATERIAL_LABEL } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { STICKERS } from '../src/model/stickers';
import type { Feature, Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { canHold, containerAt, unknownPlant } from '../src/planting/place';

const DIR = join(__dirname, '..', 'data', 'plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const opts = (o: Partial<SowListOptions> = {}): SowListOptions => ({ month: 3, kind: 'all', query: '', weeds: false, tin: new Set(), ...o });

describe('the sowing list', () => {
  it('puts what to sow under cover this month first, and the rest later or elsewhere', () => {
    const l = sowList(library, opts({ month: 3 }));
    expect(l.now.map((p) => p.id)).toContain('tomato');
    expect(l.now.every((p) => p.sowing!.some((s) => s.method !== 'direct' && s.months.includes(3)))).toBe(true);
    expect(l.later.every((p) => !p.sowing!.some((s) => s.method !== 'direct' && s.months.includes(3)))).toBe(true);
    expect(l.other.every((p) => !p.sowing?.some((s) => s.method !== 'direct'))).toBe(true);
    // Every plant once, in one group.
    const all = [...l.now, ...l.later, ...l.other].map((p) => p.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('hides weeds unless asked for them', () => {
    const groups = (w: boolean) => {
      const l = sowList(library, opts({ weeds: w }));
      return [...l.now, ...l.later, ...l.other];
    };
    expect(groups(false).some((p) => p.category === 'weed')).toBe(false);
    expect(groups(true).some((p) => p.category === 'weed')).toBe(true);
  });

  it('narrows to a kind: vegetables, herbs, fruit, flowers, shrubs or trees', () => {
    for (const kind of ['vegetable', 'herb', 'fruit', 'flower', 'shrub', 'tree'] as const) {
      const l = sowList(library, opts({ kind }));
      const shown = [...l.now, ...l.later, ...l.other];
      expect(shown.length, kind).toBeGreaterThan(0);
      expect(shown.every((p) => isKind(p, kind)), kind).toBe(true);
    }
    expect(isKind(plantOf('apple'), 'tree')).toBe(true);
    expect(isKind(plantOf('apple'), 'fruit')).toBe(false);
    expect(isKind(plantOf('strawberry'), 'fruit')).toBe(true);
  });

  it('searches by name, and shows varieties only when searched for or in the tin', () => {
    const plain = sowList(library, opts());
    expect([...plain.now, ...plain.later, ...plain.other].some((p) => p.varietyOf)).toBe(false);
    const found = sowList(library, opts({ query: 'tom' }));
    expect([...found.now, ...found.later, ...found.other].every((p) => /tom/i.test(`${p.commonName} ${p.latinName ?? ''}`))).toBe(true);
    const tin = sowList(library, opts({ tin: new Set(['carrot', 'tomato']) }));
    expect(tin.tin.map((p) => p.id)).toEqual(['carrot', 'tomato']);
    // Shown once, in the tin, not again in its group.
    expect([...tin.now, ...tin.later, ...tin.other].some((p) => p.id === 'tomato' || p.id === 'carrot')).toBe(false);
  });
});

describe('cardboard over weeds', () => {
  const sheet = (laidOn?: string): Feature => ({ ...makeFeature('surface', { area: rectPoints({ x: 0, y: 0, w: 2000, h: 1200 }) }), material: 'cardboard', ...(laidOn ? { laidOn } : {}) });

  it('is a ground you can plant through, under Ground, called Cardboard', () => {
    expect(MATERIAL_LABEL.cardboard).toBe('Cardboard');
    expect(canHold(sheet())).toBe(true);
    const g = addFeature(newGarden(), sheet());
    expect(containerAt(g, [1000, 600])?.material).toBe('cardboard');
    const st = STICKERS.find((s) => s.id === 'cardboard')!;
    expect(st.group).toBe('ground');
    expect(st.material).toBe('cardboard');
  });

  it('keeps the day it was laid while it stays cardboard, and never makes one up', () => {
    const lawn = { ...sheet(), material: 'lawn' as const };
    // Drawn, not laid: no date until you say it's down.
    expect(materialPatch(lawn, 'cardboard')).toEqual({ material: 'cardboard', laidOn: undefined });
    expect(materialPatch(sheet('2027-01-10'), 'cardboard').laidOn).toBe('2027-01-10');
    expect(materialPatch(sheet('2027-01-10'), 'bark')).toEqual({ material: 'bark', laidOn: undefined });
  });

  it('has a job to check it from about six months after it was laid until it’s ticked off', () => {
    const g = addFeature(newGarden(), sheet('2027-03-15'));
    expect(CARDBOARD_MONTHS).toBe(6);
    expect(cardboardJobs(g, 8, 2027)).toEqual([]);
    expect(cardboardJobs(g, 9, 2027)).toHaveLength(1);
    // Not ticked: still there the month after.
    expect(cardboardJobs(g, 10, 2027)).toHaveLength(1);
    const job = jobsFor(g, plantOf, 9, 2027).find((j) => j.key.startsWith('check:cardboard:'))!;
    expect(job.plant).toBe('Cardboard');
    expect(job.where).toBe('laid 15 Mar');
    expect(job.featureId).toBe(g.features[0]!.id);
    expect(job.plantingIds).toEqual([]);
    // Ticked in September: it stays ticked in September, and is gone from October.
    const done = toggleJob(g, job, '2027-09-20', plantOf);
    expect(done.jobsDone.some((d) => d.key === job.key)).toBe(true);
    expect(cardboardJobs(done, 9, 2027)).toHaveLength(1);
    expect(cardboardJobs(done, 10, 2027)).toEqual([]);
    // A named patch says where it is.
    const named = addFeature(newGarden(), { ...sheet('2027-03-15'), name: 'Back corner' });
    expect(cardboardJobs(named, 9, 2027)[0]!.where).toBe('on Back corner, laid 15 Mar');
    // Without a laid date, or on a path, there's no job.
    expect(cardboardJobs(addFeature(newGarden(), sheet()), 9, 2027)).toEqual([]);
    const path = { ...makeFeature('path', { line: [[0, 0], [3000, 0]] }), material: 'cardboard' as const, laidOn: '2027-03-15' };
    expect(cardboardJobs(addFeature(newGarden(), path), 9, 2027)).toEqual([]);
  });

  it('saves and loads: schema 17, a valid laid date, and older gardens brought up to date', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(17);
    const g: Garden = addFeature(newGarden(), sheet('2027-03-15'));
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    const bad = { ...g, features: [{ ...g.features[0]!, laidOn: 'last spring' }] };
    expect(validateGarden(JSON.parse(JSON.stringify(bad))).join(' ')).toMatch(/laidOn must be a date/);
    const old = { ...newGarden(), schemaVersion: 16 };
    const migrated = migrateGarden(old) as Garden;
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateGarden(migrated)).toEqual([]);
  });
});
