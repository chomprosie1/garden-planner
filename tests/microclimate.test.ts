// Stage 15: greenhouses and cold frames as microclimates. What's under cover,
// how much warmer it is, and what that changes: frost, hardening off, planting
// out, winter jobs, watering and the Potting Shed.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor } from '../src/calendar/jobs';
import { climateOf, climateText, coverEffects, DEFAULT_CLIMATE, frostShiftDays, microclimateAt, microclimateOf, placeClimate, shiftText } from '../src/climate/microclimate';
import { pickedBy, stageIn, timeline } from '../src/lifecycle/projection';
import {
  addDays,
  addPlace,
  frostDates,
  frostDatesUnder,
  makePlace,
  plantingNext,
  plantInFrom,
  plantOutMonthsUnder,
  readyToPlantOut,
  setTrayStage,
  sowInTray,
  traysOf,
  trayNext,
} from '../src/lifecycle/shed';
import { nextStage, pathFor } from '../src/lifecycle/stages';
import { newAppState } from '../src/model/defaults';
import { addFeature, deleteFeatures, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { stickerById, stickerFeature } from '../src/model/stickers';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, isContainer, makePlanting, unknownPlant } from '../src/planting/place';
import { parseFileText, toFile } from '../src/storage/file';
import { frostyOn, thawedOn } from '../src/ui/yearScene';

const library = [...vegetables, ...herbs, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const tomato = plantOf('tomato');
const TODAY = '2026-10-07';

/** A garden in Leeds, about 53.8° north: last frost about 9 May, first about 22 October. */
const garden = (): Garden => ({ ...newAppState().garden, latitude: 53.8, longitude: -1.55 });
const area = (kind: Feature['kind'], x: number, y: number, w: number, h: number) => makeFeature(kind, { area: rectPoints({ x, y, w, h }) });
const greenhouse = area('greenhouse', 0, 0, 2400, 1800);
const coldFrame = area('cold-frame', 5000, 0, 1200, 600);
const bed = area('bed', 8000, 0, 2400, 1200);
const withCovers = (): Garden => [greenhouse, coldFrame, bed].reduce(addFeature, garden());
const plantIn = (g: Garden, f: Feature, id: string, at: [number, number], extra: Partial<Planting> = {}): [Garden, Planting] => {
  const pl = { ...makePlanting(plantOf(id), f.id, 'single', at), ...extra };
  return [addPlanting(g, pl), pl];
};

describe('what’s under cover', () => {
  it('greenhouses and cold frames have the usual climate for their kind, or their own', () => {
    expect(climateOf(greenhouse)).toEqual({ heated: false, dayGainC: 8, nightGainC: 2 });
    expect(climateOf(coldFrame)).toEqual(DEFAULT_CLIMATE['cold-frame']);
    expect(climateOf({ ...greenhouse, climate: { heated: true, dayGainC: 10, nightGainC: 6 } })?.heated).toBe(true);
    expect(climateOf(bed)).toBeNull();
  });

  it('finds the cover over a point, the warmest when they overlap', () => {
    const inner = area('cold-frame', 200, 200, 600, 400);
    const g = addFeature(withCovers(), inner);
    expect(microclimateAt(g, [1000, 1000])?.feature.id).toBe(greenhouse.id);
    expect(microclimateAt(g, [300, 300])?.feature.id).toBe(greenhouse.id); // a cold frame in a greenhouse: the greenhouse is warmer at night
    expect(microclimateAt(g, [5500, 300])?.feature.id).toBe(coldFrame.id);
    expect(microclimateAt(g, [9000, 500])).toBeNull();
    const heated = addFeature(g, { ...area('cold-frame', 100, 100, 300, 300), climate: { heated: true, dayGainC: 5, nightGainC: 3 } });
    expect(microclimateAt(heated, [200, 200])?.climate.heated).toBe(true);
  });

  it('a planting is under cover in a greenhouse, or in a bed inside one', () => {
    const inside = area('bed', 300, 300, 1000, 600);
    let g = addFeature(withCovers(), inside);
    let a: Planting, b: Planting, c: Planting;
    [g, a] = plantIn(g, greenhouse, 'tomato', [1800, 1500]);
    [g, b] = plantIn(g, inside, 'tomato', [600, 500]);
    [g, c] = plantIn(g, bed, 'tomato', [9000, 600]);
    expect(microclimateOf(g, a)?.feature.id).toBe(greenhouse.id);
    expect(microclimateOf(g, b)?.feature.id).toBe(greenhouse.id);
    expect(microclimateOf(g, c)).toBeNull();
  });

  it('cold frames come from the dock and hold plants', () => {
    const f = stickerFeature(stickerById('cold-frame')!, [0, 0]);
    expect(f.kind).toBe('cold-frame');
    expect(isContainer(f)).toBe(true);
  });

  it('says how much warmer it is and what that changes', () => {
    expect(climateText(DEFAULT_CLIMATE.greenhouse)).toBe('about +8 °C by day and +2 °C at night');
    expect(climateText({ heated: true, dayGainC: 8, nightGainC: 2 })).toMatch(/frost-free/);
    expect(coverEffects(DEFAULT_CLIMATE.greenhouse)).toMatch(/about two weeks sooner/);
    expect(coverEffects(DEFAULT_CLIMATE['cold-frame'])).toMatch(/about a week sooner/);
    expect(coverEffects({ heated: false, dayGainC: 3, nightGainC: 0 })).toMatch(/^Plants need no hardening off/);
    expect(shiftText(42)).toBe('about six weeks');
  });
});

describe('frost under cover', () => {
  it('the last frost comes sooner and the first later, about a week for each degree warmer at night', () => {
    const g = garden();
    const out = frostDates(g);
    expect(frostShiftDays(DEFAULT_CLIMATE.greenhouse)).toBe(14);
    expect(frostShiftDays(DEFAULT_CLIMATE['cold-frame'])).toBe(7);
    const under = frostDatesUnder(g, DEFAULT_CLIMATE.greenhouse)!;
    expect(`2027-${under.lastFrost}`).toBe(addDays(`2027-${out.lastFrost}`, -14));
    expect(`2027-${under.firstFrost}`).toBe(addDays(`2027-${out.firstFrost}`, 14));
    expect(frostDatesUnder(g, { heated: true, dayGainC: 8, nightGainC: 2 })).toBeNull();
    expect(frostDatesUnder(g, null)).toEqual(out);
  });

  it('on the plan, frost stays off a greenhouse early and late in the frosts, and never settles in a heated one', () => {
    const heated = { ...area('greenhouse', 0, 3000, 2000, 2000), climate: { heated: true, dayGainC: 8, nightGainC: 2 } };
    const g = addFeature(withCovers(), heated);
    const autumn = addDays(`2026-${frostDates(g).firstFrost}`, 7);
    expect(frostyOn(g, autumn)).toBe(true);
    expect(frostyOn(g, autumn, DEFAULT_CLIMATE.greenhouse)).toBe(false);
    expect([...thawedOn(g, autumn)].sort()).toEqual([greenhouse.id, heated.id].sort());
    expect([...thawedOn(g, '2027-01-15')]).toEqual([heated.id]);
    expect(thawedOn(g, '2027-07-01').size).toBe(0);
  });
});

describe('growing under cover', () => {
  it('seedlings going under glass skip hardening off', () => {
    const pl = { ...makePlanting(tomato, 'gh', 'single', [0, 0]), sownOn: '2027-03-01', sowing: 'indoors' as const, stage: 'germinated' as const };
    expect(pathFor(tomato, pl)).toContain('hardening');
    expect(pathFor(tomato, pl, true)).not.toContain('hardening');
    expect(nextStage(tomato, pl)).toBe('hardening');
    expect(nextStage(tomato, pl, true)).toBe('transplanted');
  });

  it('they go in after four weeks to grow on, and tender ones not before the last frost under the glass', () => {
    const g = garden();
    const last = `2027-${frostDatesUnder(g, DEFAULT_CLIMATE.greenhouse)!.lastFrost}`;
    expect(plantInFrom(tomato, g, '2027-03-10', DEFAULT_CLIMATE.greenhouse)).toBe(last);
    expect(plantInFrom(tomato, g, '2027-04-20', DEFAULT_CLIMATE.greenhouse)).toBe('2027-05-18');
    expect(plantInFrom(tomato, g, '2027-03-10', { heated: true, dayGainC: 8, nightGainC: 2 })).toBe('2027-04-07');
    expect(plantInFrom(plantOf('lettuce'), g, '2027-02-10', DEFAULT_CLIMATE['cold-frame'])).toBe('2027-03-10');
  });

  it('planting-out time starts a month sooner in a greenhouse, two in a heated one; a cold frame’s week doesn’t change the month', () => {
    expect(plantOutMonthsUnder(tomato, null)).toEqual([5, 6]);
    expect(plantOutMonthsUnder(tomato, DEFAULT_CLIMATE.greenhouse)).toEqual([4, 5, 6]);
    expect(plantOutMonthsUnder(tomato, DEFAULT_CLIMATE['cold-frame'])).toEqual([5, 6]);
    expect(plantOutMonthsUnder(tomato, { heated: true, dayGainC: 8, nightGainC: 2 })).toEqual([3, 4, 5, 6]);
  });

  it('through the year, a greenhouse tomato goes in sooner, without hardening off', () => {
    let g = withCovers();
    let inside: Planting, outside: Planting;
    [g, inside] = plantIn(g, greenhouse, 'tomato', [1000, 900]);
    [g, outside] = plantIn(g, bed, 'tomato', [9000, 600]);
    const a = timeline(tomato, inside, g, TODAY);
    const b = timeline(tomato, outside, g, TODAY);
    expect(a.map((s) => s.stage)).toEqual(['sown', 'germinated', 'transplanted', 'vegetative', 'flowering', 'harvesting', 'cleared']);
    expect(b.map((s) => s.stage)).toContain('hardening');
    const out = (steps: typeof a) => steps.find((s) => s.stage === 'transplanted')!.date!;
    expect(out(a) < out(b)).toBe(true);
    expect(stageIn(a, out(a)).stage).toBe('transplanted');
  });

  it('jobs: planted out sooner with no hardening off, and no winter protection under glass', () => {
    let g = withCovers();
    [g] = plantIn(g, greenhouse, 'tomato', [1000, 900]);
    [g] = plantIn(g, bed, 'tomato', [9000, 600]);
    [g] = plantIn(g, greenhouse, 'chilli', [400, 400], { sownOn: '2027-02-01', stage: 'transplanted' });
    [g] = plantIn(g, bed, 'chilli', [9500, 600], { sownOn: '2027-02-01', stage: 'transplanted' });
    const april = jobsFor(g, plantOf, 4, 2027).filter((j) => j.kind === 'plant-out' && j.plantId === 'tomato');
    expect(april.map((j) => j.featureId)).toEqual([greenhouse.id]);
    expect(april[0]!.detail).toMatch(/harden/);
    const may = jobsFor(g, plantOf, 5, 2027).filter((j) => j.kind === 'plant-out' && j.plantId === 'tomato');
    expect(may.map((j) => j.featureId).sort()).toEqual([greenhouse.id, bed.id].sort());
    const protect = jobsFor(g, plantOf, 10, 2027).filter((j) => j.kind === 'protect');
    expect(protect.map((j) => j.featureId)).toEqual([bed.id]);
  });

  it('the water lens picks out everything under glass, which gets no rain', () => {
    let g = withCovers();
    let inside: Planting, outside: Planting;
    [g, inside] = plantIn(g, greenhouse, 'chilli', [400, 400], { sownOn: '2026-02-01', stage: 'vegetative' });
    [g, outside] = plantIn(g, bed, 'chilli', [9500, 600], { sownOn: '2026-02-01', stage: 'vegetative' });
    const at = () => ({ stage: 'vegetative' as const, guessed: false });
    const picked = pickedBy('water', g, plantOf, at, '2027-03-15');
    expect(picked.has(inside.id)).toBe(true);
    expect(picked.has(outside.id)).toBe(false);
  });
});

describe('the Potting Shed', () => {
  it('a greenhouse bench or cold frame has its usual climate, or the one on the plan it’s linked to', () => {
    const heated = { ...greenhouse, climate: { heated: true, dayGainC: 8, nightGainC: 2 } };
    const g = addFeature(garden(), heated);
    expect(placeClimate(g, makePlace('shelves'))).toBeNull();
    expect(placeClimate(g, makePlace('greenhouse-bench'))).toEqual(DEFAULT_CLIMATE.greenhouse);
    expect(placeClimate(g, makePlace('cold-frame'))).toEqual(DEFAULT_CLIMATE['cold-frame']);
    expect(placeClimate(g, { ...makePlace('greenhouse-bench'), featureId: heated.id })?.heated).toBe(true);
    expect(placeClimate(g, { ...makePlace('greenhouse-bench'), featureId: 'gone' })).toEqual(DEFAULT_CLIMATE.greenhouse);
  });

  it('tender seedlings on an unheated bench come in on cold nights; in a cold frame, hardening off is opening the lid', () => {
    const bench = makePlace('greenhouse-bench');
    const frame = makePlace('cold-frame');
    let g = addPlace(addPlace(garden(), bench), frame);
    let id: string | null;
    [g, id] = sowInTray(g, tomato, { date: '2027-03-01', placeId: bench.id });
    g = setTrayStage(g, id!, 'germinated', '2027-03-10');
    expect(trayNext(traysOf(g)[0]!, tomato, g, '2027-03-20').text).toMatch(/bring them indoors on cold nights until about/);
    [g, id] = sowInTray(g, plantOf('leek'), { date: '2027-02-01', placeId: frame.id });
    g = setTrayStage(g, id!, 'hardening', '2027-03-20');
    expect(trayNext(traysOf(g)[1]!, plantOf('leek'), g, '2027-03-22').text).toMatch(/cold frame: open it by day/);
  });

  it('a planting indoors that’s going into a greenhouse is ready without hardening off', () => {
    let g = withCovers();
    let pl: Planting;
    [g, pl] = plantIn(g, greenhouse, 'tomato', [1000, 900], { sownOn: '2027-03-01', sowing: 'indoors', stage: 'germinated', stageDates: { germinated: '2027-03-10' } });
    const from = plantInFrom(tomato, g, '2027-03-10', DEFAULT_CLIMATE.greenhouse);
    expect(plantingNext(pl, tomato, g, addDays(from, -1))).toMatchObject({ ready: false });
    expect(plantingNext(pl, tomato, g, addDays(from, -1)).text).toMatch(/go into the Greenhouse from .*no hardening off/);
    expect(plantingNext(pl, tomato, g, from)).toMatchObject({ ready: true, text: 'Ready to go into the Greenhouse. No need to harden off.' });
    expect(readyToPlantOut(g, plantOf, from).map((r) => r.id)).toEqual([pl.id]);
  });

  it('deleting a greenhouse unlinks its place in the shed, which stays', () => {
    const g = addPlace(addFeature(garden(), greenhouse), { ...makePlace('greenhouse-bench'), featureId: greenhouse.id });
    const after = deleteFeatures(g, [greenhouse.id]);
    expect(after.shedPlaces).toHaveLength(1);
    expect(after.shedPlaces![0]!.featureId).toBeUndefined();
  });
});

describe('schema 8', () => {
  it('saves and loads cold frames, climates and linked places', () => {
    const g = addPlace(addFeature(withCovers(), { ...area('greenhouse', 0, 3000, 2000, 2000), climate: { heated: true, dayGainC: 9, nightGainC: 5 } }), { ...makePlace('cold-frame'), featureId: coldFrame.id });
    const back = parseFileText(JSON.stringify(toFile({ garden: g, userPlants: [] })));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.state.garden).toEqual({ ...g, schemaVersion: SCHEMA_VERSION });
  });

  it('refuses a climate without its gains, and migrates older gardens', () => {
    const g = withCovers();
    const bad = { ...greenhouse, climate: { heated: false, dayGainC: -2, nightGainC: 1 } };
    expect(validateGarden({ ...g, features: [bad] }).length).toBe(1);
    expect(validateGarden({ ...g, features: [{ ...greenhouse, climate: { heated: 'yes' } }] }).length).toBe(1);
    expect((migrateGarden({ ...garden(), schemaVersion: 7 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });
});
