import { describe, expect, it } from 'vitest';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { applyChecks, createChecksStore } from '../src/library/checks';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { addNote, makeNote } from '../src/model/notes';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, harvestPlantings, makePlanting, plantingStatus, setStatus, unknownPlant } from '../src/planting/place';
import { WARN_COLOUR } from '../src/canvas/render';
import { LOOK_IDS, LOOKS } from '../src/theme/looks';
import { sanitisePrefs } from '../src/theme/prefs';
import { backupDue, daysSinceBackup, setupSteps } from '../src/ui/setup';
import { contrast } from './colour';

const library = vegetables as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

function withBed(): { g: Garden; bed: string } {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
  return { g: addFeature({ ...newAppState().garden, boundary: rectPoints({ x: 0, y: 0, w: 10000, h: 14000 }) }, bed), bed: bed.id };
}

describe('planting status (U3)', () => {
  it('follows the dates, with growing set directly for plants already in the ground', () => {
    const { bed } = withBed();
    const pl = makePlanting(plantOf('tomato'), bed, 'single', [100, 100]);
    expect(plantingStatus(pl)).toBe('planned');
    expect(plantingStatus({ ...pl, sownOn: '2027-03-01' })).toBe('sown');
    expect(plantingStatus({ ...pl, stage: 'transplanted' })).toBe('growing');
    expect(plantingStatus({ ...pl, sownOn: '2027-03-01', stage: 'hardening' })).toBe('sown');
    expect(plantingStatus({ ...pl, stage: 'transplanted', removedOn: '2027-10-01' })).toBe('cleared');
    expect(plantingStatus(makePlanting(plantOf('tomato'), bed, 'single', [0, 0], undefined, true))).toBe('growing');
  });

  it('can be set and set back, keeping a sowing date when there is one', () => {
    const { g: g0, bed } = withBed();
    const pl = makePlanting(plantOf('carrot'), bed, 'row', [100, 100], [2900, 100]);
    let g = addPlanting(g0, pl);
    g = setStatus(g, [pl.id], 'sown', '2027-04-02');
    expect(g.plantings[0]!.sownOn).toBe('2027-04-02');
    g = setStatus(g, [pl.id], 'growing', '2027-05-01');
    expect(g.plantings[0]).toMatchObject({ stage: 'transplanted', sownOn: '2027-04-02' });
    g = setStatus(g, [pl.id], 'planned', '2027-05-01');
    expect(g.plantings[0]!.sownOn).toBeUndefined();
    expect(g.plantings[0]!.stage).toBeUndefined();
  });

  it('plants already growing skip sowing and go straight to harvest', () => {
    const { g: g0, bed } = withBed();
    const g = addPlanting(g0, makePlanting(plantOf('tomato'), bed, 'single', [500, 500], undefined, true));
    expect(jobsFor(g, plantOf, 3, 2027)).toEqual([]); // no "sow indoors"
    expect(jobsFor(g, plantOf, 5, 2027)).toEqual([]); // no "plant out"
    expect(jobsFor(g, plantOf, 8, 2027).map((j) => j.kind)).toEqual(['harvest']);
  });

  it('ticking plant out marks the plants growing, and the ticked job stays for the month', () => {
    const { g: g0, bed } = withBed();
    let g = addPlanting(g0, { ...makePlanting(plantOf('tomato'), bed, 'single', [500, 500]), sownOn: '2027-03-10' });
    const job = jobsFor(g, plantOf, 5, 2027).find((j) => j.kind === 'plant-out')!;
    g = toggleJob(g, job, '2027-05-20');
    expect(g.plantings[0]!.stage).toBe('transplanted');
    expect(jobsFor(g, plantOf, 5, 2027).find((j) => j.kind === 'plant-out')?.key).toBe(job.key);
    expect(jobsFor(g, plantOf, 6, 2027).filter((j) => j.kind === 'plant-out')).toEqual([]);
  });

  it('saves as the current schema, and older gardens load', () => {
    expect(SCHEMA_VERSION).toBe(7);
    const { g: g0, bed } = withBed();
    const g = addPlanting(g0, makePlanting(plantOf('tomato'), bed, 'single', [0, 0], undefined, true));
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    expect(validateGarden({ ...g, plantings: [{ ...g.plantings[0]!, stage: 'wilting' as never }] }).length).toBe(1);
    const v2 = { ...g0, schemaVersion: 2 };
    expect((migrateGarden(v2) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('getting started (U4)', () => {
  const prefs = { northChecked: false, lastBackup: null as string | null };

  it('starts with everything to do, in order', () => {
    const steps = setupSteps(newAppState().garden, prefs);
    expect(steps.map((s) => s.id)).toEqual(['boundary', 'bed', 'location', 'north', 'plants', 'backup']);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it('ticks steps off from the garden itself', () => {
    const { g: g0, bed } = withBed();
    const g = { ...addPlanting(g0, makePlanting(plantOf('carrot'), bed, 'single', [100, 100])), latitude: 53.8, longitude: -1.55 };
    const done = (p = prefs) => setupSteps(g, p).filter((s) => s.done).map((s) => s.id);
    expect(done()).toEqual(['boundary', 'bed', 'location', 'plants']);
    expect(done({ northChecked: true, lastBackup: '2026-10-01' })).toEqual(['boundary', 'bed', 'location', 'north', 'plants', 'backup']);
    expect(setupSteps({ ...g, northRotationDeg: 15 }, prefs).find((s) => s.id === 'north')!.done).toBe(true);
  });

  it('reminds you to back up only when there is something to keep, and monthly', () => {
    const now = new Date(2026, 9, 6);
    expect(backupDue(newAppState().garden, null, now)).toBe(false);
    const g = addNote(newAppState().garden, makeNote('Bought seeds', '2026-10-01'));
    expect(backupDue(g, null, now)).toBe(true);
    expect(backupDue(g, '2026-09-20', now)).toBe(false);
    expect(backupDue(g, '2026-09-05', now)).toBe(true);
    expect(daysSinceBackup('2026-09-06', now)).toBe(30);
  });

  it('keeps the new preferences, and drops bad values', () => {
    const p = sanitisePrefs({ layoutLocked: true, lastBackup: '2026-10-01', northChecked: true, setupHidden: 'yes' });
    expect(p).toMatchObject({ layoutLocked: true, lastBackup: '2026-10-01', northChecked: true, setupHidden: false });
    expect(sanitisePrefs({ layoutLocked: 'yes', lastBackup: 'last week' })).toMatchObject({ layoutLocked: false, lastBackup: null });
  });
});

describe('checking plants (U5)', () => {
  function memory() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }

  it('remembers checks on this device and applies them to library plants only', () => {
    const storage = memory();
    const store = createChecksStore(storage);
    store.check('carrot', '2026-10-06');
    expect(createChecksStore(storage).get()).toEqual({ carrot: '2026-10-06' });
    const mine: Plant = { ...plantOf('carrot'), id: 'user-x', userAdded: true, verified: false };
    const out = applyChecks([plantOf('carrot'), plantOf('onion'), mine], { carrot: '2026-10-06', 'user-x': '2026-10-06' });
    expect(out[0]).toMatchObject({ verified: true, lastChecked: '2026-10-06' });
    expect(out[1]!.verified).toBe(false);
    expect(out[2]!.verified).toBe(false);
    store.uncheck('carrot');
    expect(store.get()).toEqual({});
  });

  it('ignores unreadable or malformed checks', () => {
    const storage = memory();
    storage.setItem('garden-planner:checks', JSON.stringify({ carrot: 'yesterday', onion: '2026-10-06', bad: 3 }));
    expect(createChecksStore(storage).get()).toEqual({ onion: '2026-10-06' });
    storage.setItem('garden-planner:checks', '{nope');
    expect(createChecksStore(storage).get()).toEqual({});
  });
});

describe('deleting with undo (U1)', () => {
  it('says what else goes with a bed', async () => {
    const { deletedMessage } = await import('../src/ui/PlanCanvas');
    const { g: g0, bed } = withBed();
    const pl = makePlanting(plantOf('carrot'), bed, 'row', [100, 100], [2900, 100]);
    let g = addPlanting(g0, pl);
    g = addNote(g, makeNote('Thinned', '2027-05-01', { plantingId: pl.id }));
    const f = g.features[0]!;
    expect(deletedMessage(g, f)).toBe('Veg bed deleted, with 1 planting and 1 note.');
    expect(deletedMessage(g0, f)).toBe('Veg bed deleted.');
    // Cleared plantings still go with the bed, and are counted.
    const cleared = harvestPlantings(g, [pl.id], '2027-09-01');
    expect(deletedMessage(cleared, f)).toBe('Veg bed deleted, with 1 planting and 1 note.');
  });
});

describe('plan colours (U6)', () => {
  for (const id of LOOK_IDS)
    for (const mode of ['light', 'dark'] as const)
      it(`${id} ${mode}: warning outlines stand out from the paper and lawn (3:1)`, () => {
        const plan = LOOKS[id][mode].plan;
        expect(contrast(WARN_COLOUR[mode], plan.paper)).toBeGreaterThanOrEqual(3);
        expect(contrast(WARN_COLOUR[mode], plan.lawn)).toBeGreaterThanOrEqual(3);
      });
});
