import { describe, expect, it } from 'vitest';
import { newAppState } from '../src/model/defaults';
import { SCHEMA_VERSION } from '../src/model/migrate';
import type { AppState, Plant } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { parseFile, parseFileText, toFile } from '../src/storage/file';
import v0 from './fixtures/garden-v0.json';

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
          canopy: { centre: [5, 5], radiusMm: 2000 },
        },
      ],
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

  it('migrates a v0 user plant with a single sowing', () => {
    const old = { ...userPlant, sowing: { method: 'direct', months: [3, 4] }, verified: undefined };
    const result = parseFile({ app: 'garden-planner', schemaVersion: 0, garden: v0, userPlants: [old] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.userPlants[0]?.sowing).toEqual([{ method: 'direct', months: [3, 4] }]);
      expect(result.state.userPlants[0]?.verified).toBe(false);
    }
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
