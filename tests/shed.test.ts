// The Potting Shed (Stage 12): places and trays, moving them about, stages
// and what's next, frost dates, and planting a tray out into a bed.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import {
  addDays,
  daysBetween,
  estimateFrost,
  failTray,
  freeSpot,
  frostDates,
  hardenFrom,
  isTender,
  moveTray,
  placesOf,
  plantingsIndoors,
  plantOutTray,
  readyToPlantOut,
  removePlace,
  setTrayStage,
  sowInTray,
  traysOf,
  trayNext,
  updatePlace,
} from '../src/lifecycle/shed';
import { currentStage } from '../src/lifecycle/stages';
import { jobsFor } from '../src/calendar/jobs';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { parseFileText, toFile } from '../src/storage/file';

const library = [...vegetables, ...herbs, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const tomato = plantOf('tomato');
const leek = plantOf('leek');

/** A garden in Leeds, about 53.8° north. */
const garden = (): Garden => ({ ...newAppState().garden, latitude: 53.8, longitude: -1.55 });
const sow = (g: Garden, p: Plant, date = '2027-03-01', placeId?: string) => sowInTray(g, p, { date, ...(placeId ? { placeId } : {}) });

describe('dates', () => {
  it('adds days and counts them across months and years', () => {
    expect(addDays('2027-02-27', 3)).toBe('2027-03-02');
    expect(addDays('2027-12-30', 5)).toBe('2028-01-04');
    expect(daysBetween('2027-03-01', '2027-03-15')).toBe(14);
  });

  it('estimates frosts later in spring and earlier in autumn further north', () => {
    const south = estimateFrost(50.5);
    const north = estimateFrost(57.5);
    expect(south.lastFrost < north.lastFrost).toBe(true);
    expect(south.firstFrost > north.firstFrost).toBe(true);
    expect(estimateFrost(53.8).lastFrost).toMatch(/^0[45]-\d\d$/);
  });

  it('uses your own frost dates when you set them', () => {
    expect(frostDates({ ...garden(), lastFrost: '05-20' })).toMatchObject({ lastFrost: '05-20', estimated: false });
    expect(frostDates(garden()).estimated).toBe(true);
  });
});

describe('places and trays', () => {
  it('sowing the first tray sets up a windowsill, a propagator and shelves', () => {
    const [g, id] = sow(garden(), tomato);
    expect(placesOf(g).map((p) => p.kind)).toEqual(['windowsill', 'propagator', 'shelves']);
    const t = traysOf(g).find((x) => x.id === id)!;
    expect(t).toMatchObject({ plantId: 'tomato', sownOn: '2027-03-01', placeId: placesOf(g)[0]!.id, shelf: 0, slot: 0 });
    expect(t.count).toBeGreaterThan(0);
  });

  it('fills the chosen place first, then anywhere, then puts up more shelves', () => {
    let g = garden();
    for (let i = 0; i < 4 + 3 + 12; i++) [g] = sow(g, tomato);
    expect(freeSpot(g)).toBeNull();
    const [full, id] = sow(g, tomato);
    expect(placesOf(full)).toHaveLength(4);
    expect(traysOf(full).find((t) => t.id === id)!.placeId).toBe(placesOf(full)[3]!.id);
  });

  it('moving a tray onto another swaps them', () => {
    let g = garden();
    let a: string | null;
    let b: string | null;
    [g, a] = sow(g, tomato);
    [g, b] = sow(g, leek);
    const ta = traysOf(g).find((t) => t.id === a)!;
    const tb = traysOf(g).find((t) => t.id === b)!;
    g = moveTray(g, a!, { placeId: tb.placeId, shelf: tb.shelf, slot: tb.slot });
    expect(traysOf(g).find((t) => t.id === a)).toMatchObject({ shelf: tb.shelf, slot: tb.slot });
    expect(traysOf(g).find((t) => t.id === b)).toMatchObject({ shelf: ta.shelf, slot: ta.slot });
    // Off the end of a shelf: nothing moves.
    expect(moveTray(g, a!, { placeId: ta.placeId, shelf: 0, slot: 99 })).toBe(g);
  });

  it('shrinking a place moves trays that no longer fit; a place with trays on it can’t be removed', () => {
    let g = garden();
    let id: string | null;
    [g] = sow(g, tomato);
    const shelves = placesOf(g)[2]!;
    [g, id] = sow(g, leek, '2027-03-01', shelves.id);
    g = moveTray(g, id!, { placeId: shelves.id, shelf: 2, slot: 3 });
    g = updatePlace(g, shelves.id, { shelves: 1, slots: 2 });
    const t = traysOf(g).find((x) => x.id === id)!;
    const place = placesOf(g).find((p) => p.id === t.placeId)!;
    expect(t.shelf < place.shelves && t.slot < place.slots).toBe(true);
    expect(removePlace(g, placesOf(g)[0]!.id)).toBe(g);
  });
});

describe('stages and what’s next', () => {
  it('expects seedlings within the plant’s germination time, and worries when they’re late', () => {
    const [g, id] = sow(garden(), tomato);
    const t = traysOf(g).find((x) => x.id === id)!;
    expect(trayNext(t, tomato, g, '2027-03-03')).toMatchObject({ due: false, ready: false });
    expect(trayNext(t, tomato, g, '2027-03-12').due).toBe(true);
    expect(trayNext(t, tomato, g, '2027-04-20').text).toMatch(/failed/);
  });

  it('tender plants harden off two weeks before the last frost and go out after it', () => {
    expect(isTender(tomato)).toBe(true);
    expect(isTender(leek)).toBe(false);
    let [g, id] = sow(garden(), tomato);
    const lastFrost = `2027-${frostDates(g).lastFrost}`;
    expect(hardenFrom(tomato, g, 2027)).toBe(addDays(lastFrost, -14));
    g = setTrayStage(g, id!, 'germinated', '2027-03-10');
    expect(trayNext(traysOf(g)[0]!, tomato, g, addDays(lastFrost, -20)).due).toBe(false);
    expect(trayNext(traysOf(g)[0]!, tomato, g, addDays(lastFrost, -10)).text).toMatch(/harden/i);
    g = setTrayStage(g, id!, 'hardening', addDays(lastFrost, -14));
    expect(traysOf(g)[0]!.stageDates).toMatchObject({ germinated: '2027-03-10' });
    expect(trayNext(traysOf(g)[0]!, tomato, g, addDays(lastFrost, -3)).ready).toBe(false);
    expect(trayNext(traysOf(g)[0]!, tomato, g, lastFrost).ready).toBe(true);
    expect(readyToPlantOut(g, plantOf, lastFrost).map((r) => r.kind)).toEqual(['tray']);
  });

  it('hardy plants are ready after a week of hardening, frost or not', () => {
    let [g, id] = sow(garden(), leek, '2027-02-01');
    g = setTrayStage(g, id!, 'hardening', '2027-03-20');
    expect(trayNext(traysOf(g)[0]!, leek, g, '2027-03-27').ready).toBe(true);
  });

  it('going back a stage drops the later dates', () => {
    let [g, id] = sow(garden(), tomato);
    g = setTrayStage(g, id!, 'hardening', '2027-05-01');
    g = setTrayStage(g, id!, 'sown', '2027-05-02');
    expect(traysOf(g)[0]!.stage).toBeUndefined();
    expect(traysOf(g)[0]!.stageDates).toBeUndefined();
  });

  it('a failed tray goes, with a note in the journal', () => {
    let [g, id] = sow(garden(), tomato);
    g = failTray(g, id!, 'Tomato', '2027-04-01');
    expect(traysOf(g)).toHaveLength(0);
    expect(g.notes[0]!.text).toMatch(/Tomato/);
  });
});

describe('planting out', () => {
  it('turns a tray into a planting in a bed, keeping its sowing date and stages', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) });
    let [g, id] = sow(addFeature(garden(), bed), tomato, '2027-03-01');
    g = setTrayStage(g, id!, 'hardening', '2027-05-01');
    const pl = makePlanting(tomato, bed.id, 'row', [300, 600], [2700, 600]);
    g = plantOutTray(g, id!, pl, '2027-05-20');
    expect(traysOf(g)).toHaveLength(0);
    expect(g.plantings).toHaveLength(1);
    expect(g.plantings[0]).toMatchObject({ sownOn: '2027-03-01', sowing: 'indoors', stage: 'transplanted', stageDates: { hardening: '2027-05-01', transplanted: '2027-05-20' } });
    expect(currentStage(g.plantings[0]!)).toBe('transplanted');
  });

  it('plantings on the plan sown indoors and not yet out show in the shed too', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) });
    let g = addFeature(garden(), bed);
    g = addPlanting(g, { ...makePlanting(tomato, bed.id, 'single', [500, 500]), sownOn: '2027-03-01' });
    g = addPlanting(g, { ...makePlanting(plantOf('carrot'), bed.id, 'single', [900, 500]), sownOn: '2027-04-01', sowing: 'direct' });
    g = addPlanting(g, { ...makePlanting(tomato, bed.id, 'single', [1500, 500]), sownOn: '2027-03-01', stage: 'transplanted' });
    expect(plantingsIndoors(g, plantOf).map((p) => p.plantId)).toEqual(['tomato']);
  });
});

describe('frost dates time the winter jobs', () => {
  it('protect tender plants the month before the first frost: earlier in the north', () => {
    const chilli = plantOf('chilli');
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) });
    const at = (latitude: number, firstFrost?: string) =>
      addPlanting(addFeature({ ...garden(), latitude, ...(firstFrost ? { firstFrost } : {}) }, bed), { ...makePlanting(chilli, bed.id, 'single', [500, 500]), sownOn: '2027-02-01', stage: 'transplanted' as const });
    const protectMonths = (g: Garden) => Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => jobsFor(g, plantOf, m, 2027).some((j) => j.kind === 'protect'));
    expect(protectMonths(at(52.5))).toEqual([10]);
    expect(protectMonths(at(58.5))).toEqual([9]);
    expect(protectMonths(at(52.5, '11-25'))).toEqual([11]);
  });
});

describe('schema 6', () => {
  it('saves and loads the shed and frost dates', () => {
    let [g] = sow({ ...garden(), lastFrost: '05-10', firstFrost: '10-15' }, tomato);
    g = setTrayStage(g, traysOf(g)[0]!.id, 'germinated', '2027-03-10');
    const back = parseFileText(JSON.stringify(toFile({ garden: g, userPlants: [] })));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.state.garden).toEqual({ ...g, schemaVersion: SCHEMA_VERSION });
  });

  it('refuses trays on places that don’t exist, and bad frost dates', () => {
    const [g] = sow(garden(), tomato);
    expect(validateGarden({ ...g, trays: [{ ...traysOf(g)[0]!, placeId: 'nowhere' }] }).length).toBe(1);
    expect(validateGarden({ ...g, lastFrost: '13-40' }).length).toBe(1);
    expect((migrateGarden({ ...garden(), schemaVersion: 5 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });
});
