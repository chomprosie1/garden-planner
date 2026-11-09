import { describe, expect, it } from 'vitest';
import { newAppState } from '../src/model/defaults';
import { SCHEMA_VERSION } from '../src/model/migrate';
import type { AppState, Plant } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { parseFile, parseFileText, toFile } from '../src/storage/file';
import v0 from './fixtures/garden-v0.json';
import v3 from './fixtures/garden-v3.json';
import badDates from './fixtures/attack-bad-dates.json';
import dupIds from './fixtures/attack-duplicate-ids.json';
import missingBed from './fixtures/attack-missing-bed.json';

const userPlant: Plant = {
  id: 'user-abc12345',
  commonName: 'Runner bean',
  category: 'vegetable',
  conditions: { light: 'full-sun' },
  size: { spacingMm: 150 },
  sowing: [
    { method: 'indoors', months: [4, 5] },
    { method: 'direct', months: [5, 6] },
  ],
  companions: { good: ['sweetcorn'], avoid: ['onion'] },
  verified: false,
  userAdded: true,
};

function fullState(): AppState {
  const s = newAppState();
  return {
    userPlants: [userPlant],
    garden: {
      ...s.garden,
      name: 'Test garden',
      boundary: [[0, 0], [8000, 0], [8000, 15000], [0, 15000]],
      features: [
        {
          id: 'f1',
          kind: 'tree',
          footprint: [[0, 0], [10, 0], [10, 10]],
          heightMm: 5000,
          deciduous: true,
          opacityInLeaf: 0.7,
          opacityBare: 0.2,
          circle: { centre: [5, 5], radiusMm: 2000 },
        },
        { id: 'f2', kind: 'fence', footprint: [[0, -25], [5000, -25], [5000, 25], [0, 25]], line: [[0, 0], [5000, 0]], widthMm: 50, heightMm: 1800 },
      ],
      trace: { x: -500, y: -500, widthMm: 12000, opacity: 0.5, calibrated: true },
      plantings: [
        { id: 'p1', plantId: 'user-abc12345', featureId: 'f1', x: 5, y: 5, layout: 'row', endPoint: [1000, 5], count: 7, removedOn: '2026-09-30' },
      ],
      wishlist: ['carrot'],
      jobsDone: [{ key: 'sow-direct:carrot:2026-04', date: '2026-04-10' }],
      notes: [{ id: 'n1', date: '2026-10-06', text: 'Started.', featureId: 'f1' }],
    },
  };
}

describe('export and import', () => {
  it('round-trips without losing anything', () => {
    const state = fullState();
    const result = parseFileText(JSON.stringify(toFile(state)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(state);
  });

  it('stamps files with the app name and schema version', () => {
    const file = toFile(newAppState(), new Date('2026-10-06T12:00:00Z'));
    expect(file.app).toBe('garden-planner');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.exportedAt).toBe('2026-10-06T12:00:00.000Z');
  });

  it('migrates a v0 garden from the first plan', () => {
    const result = parseFile(v0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const g = result.state.garden;
    expect(g.schemaVersion).toBe(SCHEMA_VERSION);
    expect(g.wishlist).toEqual([]);
    expect(g.jobsDone).toEqual([]);
    const tree = g.features.find((f) => f.id === 'f3')!;
    expect(tree).toMatchObject({ opacityInLeaf: 0.6, opacityBare: 0.6 });
    expect(tree).not.toHaveProperty('opacity');
    expect(g.plantings[0]?.plantId).toBe('carrot');
  });

  it('migrates a v1 tree canopy to a circle', () => {
    const v1 = {
      ...toFile(newAppState()),
      schemaVersion: 1,
      garden: {
        ...newAppState().garden,
        schemaVersion: 1,
        features: [{ id: 't', kind: 'tree', footprint: [[0, 0], [1, 0], [1, 1]], canopy: { centre: [0, 0], radiusMm: 1500 } }],
      },
    };
    const result = parseFile(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.garden.features[0]).toMatchObject({ circle: { centre: [0, 0], radiusMm: 1500 } });
      expect(result.state.garden.features[0]).not.toHaveProperty('canopy');
    }
  });

  it('migrates a v0 user plant with a single sowing', () => {
    const old = { ...userPlant, sowing: { method: 'direct', months: [3, 4] }, verified: undefined };
    const result = parseFile({ app: 'garden-planner', schemaVersion: 0, garden: v0, userPlants: [old] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.userPlants[0]?.sowing).toEqual([{ method: 'direct', months: [3, 4] }]);
      expect(result.state.userPlants[0]?.verified).toBe(false);
    }
  });

  it('loads a schema 27 garden as 28 with its garden and own plants unchanged', () => {
    const s = fullState();
    const old = { ...toFile(s), schemaVersion: 27, garden: { ...s.garden, schemaVersion: 27 } };
    const result = parseFile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.garden.schemaVersion).toBe(28);
    expect(result.state.garden).toEqual({ ...s.garden, schemaVersion: 28 });
    expect(result.state.userPlants).toEqual(s.userPlants);
  });

  it('refuses files from a newer version', () => {
    const file = { ...toFile(newAppState()), garden: { ...newAppState().garden, schemaVersion: SCHEMA_VERSION + 1 } };
    const result = parseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/newer version/);
  });

  it('rejects junk with readable reasons', () => {
    expect(parseFileText('not json')).toEqual({ ok: false, errors: ['The file is not valid JSON.'] });
    expect(parseFile({ hello: 'world' }).ok).toBe(false);
    const bad = toFile(newAppState());
    (bad.garden as unknown as Record<string, unknown>).latitude = 200;
    const result = parseFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('latitude must be between -90 and 90.');
  });
});

describe('a restore refuses data it can not use', () => {
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const text = (x: unknown) => JSON.stringify(x);
  const errorsOf = (x: unknown) => {
    const r = parseFileText(text(x));
    return r.ok ? null : r.errors;
  };

  it('refuses dates that are not real days', () => {
    expect(errorsOf(badDates)).toEqual(["This file has a date that isn't a real day (banana), so it can't be restored."]);
    const fixed = clone(badDates);
    fixed.garden.plantings[0]!.sownOn = '2026-04-10';
    delete (fixed.garden.plantings[1] as Record<string, unknown>).removedOn;
    expect(parseFileText(text(fixed)).ok).toBe(true);
  });

  it('refuses two beds or two plantings with one id', () => {
    const errors = errorsOf(dupIds)!;
    expect(errors).toContain("Two beds in this file share one id, so it can't be restored.");
    expect(errors).toContain("Two plantings in this file share one id, so it can't be restored.");
    const fixed = clone(dupIds);
    fixed.garden.plantings[1]!.id = 'pl2';
    fixed.garden.features[1]!.id = 'bed2';
    fixed.garden.plantings[1]!.featureId = 'bed2';
    expect(parseFileText(text(fixed)).ok).toBe(true);
  });

  it('refuses a planting in a bed that is not there', () => {
    expect(errorsOf(missingBed)).toEqual(["A plant in this file sits in a bed that isn't there, so it can't be restored."]);
    const fixed = clone(missingBed);
    fixed.garden.plantings[1]!.featureId = 'bed2';
    expect(parseFileText(text(fixed)).ok).toBe(true);
  });

  it('refuses duplicate ids among your own plants', () => {
    const s = fullState();
    s.userPlants = [userPlant, userPlant];
    expect(errorsOf(toFile(s))).toContain("Two things in this file share one id, so it can't be restored.");
  });

  it('leaves the app loading its own garden unchanged', () => {
    expect(parseFile(dupIds).ok).toBe(true);
    expect(parseFile(badDates).ok).toBe(true);
    expect(parseFile(missingBed).ok).toBe(true);
  });

  it('still accepts old files and a normal round trip', () => {
    expect(parseFileText(text(v0)).ok).toBe(true);
    expect(parseFileText(text(v3)).ok).toBe(true);
    expect(parseFileText(text(toFile(fullState()))).ok).toBe(true);
  });

  it('knows leap days', () => {
    const withDay = (d: string) => {
      const f = clone(missingBed);
      f.garden.plantings[1]!.featureId = 'bed2';
      f.garden.plantings[0]!.sownOn = d;
      return parseFileText(text(f)).ok;
    };
    expect(withDay('2028-02-29')).toBe(true);
    expect(withDay('2027-02-29')).toBe(false);
  });
});

describe('validatePlant', () => {
  it('accepts a minimal plant', () => {
    const minimal = {
      id: 'user-x',
      commonName: 'Mint',
      category: 'herb',
      conditions: { light: 'part-shade' },
      size: { spacingMm: 300 },
      verified: false,
      userAdded: true,
    };
    expect(validatePlant(minimal)).toEqual([]);
  });

  it('catches bad months and missing spacing', () => {
    const errors = validatePlant({ ...userPlant, size: {}, plantOutMonths: [0, 13] });
    expect(errors).toContain('Runner bean: needs a spacing above 0 mm.');
    expect(errors).toContain('Runner bean: plantOutMonths must be months 1 to 12.');
  });
});
