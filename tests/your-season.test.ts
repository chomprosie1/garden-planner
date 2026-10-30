// Release 50: your season, not the south's. Callum's spreadsheet is the yardstick:
// a garden 250 m up in a Strathspey frost hollow, with his own frost dates, should
// come out near his dates, and a garden in the middle of England shouldn't move.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobsFor } from '../src/calendar/jobs';
import { averagesAt, averagesHere, coolerAt, LAPSE_C_PER_100M, OWN_STATION_KM, seasonDays, STATIONS, stationNames } from '../src/climate/warmth';
import { generalJobs } from '../src/content/seasons';
import { monthsLater, plantHere, seasonShift } from '../src/lifecycle/growth';
import { timeline } from '../src/lifecycle/projection';
import { frostDates, frostEstimate, nextFor } from '../src/lifecycle/shed';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const AVIEMORE = { latitude: 57.19, longitude: -3.83 };
const callum = (patch: Partial<Garden> = {}): Garden => ({ ...newGarden(), ...AVIEMORE, heightM: 250, frostHollow: true, ...patch });
const own = (patch: Partial<Garden> = {}) => callum({ lastFrost: '06-05', firstFrost: '09-05', ...patch });
const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) });
const planned = (g: Garden, id: string) => {
  const pl = makePlanting(plantOf(id), bed.id, 'row', [100, 300], [2900, 300]);
  return { g: addPlanting(addFeature(g, bed), pl), pl };
};
const firstDate = (g: Garden, id: string, today = '2027-01-10') => {
  const { g: full, pl } = planned(g, id);
  return timeline(plantOf(id), pl, full, today).find((s) => s.date !== null)!.date!;
};

describe('the climate follows the garden', () => {
  it('cools 0.7 °C for each 100 m above its stations', () => {
    const base = averagesAt(AVIEMORE.latitude, AVIEMORE.longitude);
    const up = averagesHere({ ...AVIEMORE, heightM: base.heightM + 100 });
    expect(up.tmax[6]).toBeCloseTo(base.tmax[6]! - LAPSE_C_PER_100M, 1);
    expect(up.tmin[0]).toBeCloseTo(base.tmin[0]! - LAPSE_C_PER_100M, 1);
  });

  it('a frost hollow is colder at night, not by day', () => {
    const base = averagesAt(AVIEMORE.latitude, AVIEMORE.longitude);
    const hollow = averagesHere({ ...AVIEMORE, frostHollow: true });
    expect(hollow.tmax[6]).toBe(base.tmax[6]);
    expect(hollow.tmin[6]).toBeCloseTo(base.tmin[6]! - 1, 1);
  });

  it('with nothing said, nothing changes', () => {
    expect(averagesHere({ ...AVIEMORE })).toBe(averagesAt(AVIEMORE.latitude, AVIEMORE.longitude));
    expect(coolerAt({ ...AVIEMORE })).toEqual({ day: 0, night: 0 });
  });

  it('Strathspey at 250 m in a hollow has a Highland season (Callum: about 180 days, not 280)', () => {
    const days = seasonDays(averagesHere(callum()));
    expect(days).toBeGreaterThan(165);
    expect(days).toBeLessThan(245);
    expect(days).toBeLessThan(seasonDays(averagesAt(AVIEMORE.latitude, AVIEMORE.longitude)) - 25);
  });

  it('its frosts come in from both ends (Callum: first frost in early September, not 5 October)', () => {
    const est = frostEstimate(callum());
    expect(est.firstFrost < '09-20').toBe(true);
    expect(est.lastFrost > '06-01').toBe(true);
    expect(est.lastFrost < '06-25').toBe(true);
  });

  it('a station close by speaks alone (Margaret: Shawbury, not Birmingham and Manchester)', () => {
    const near = averagesAt(52.7, -2.78);
    expect(stationNames(near)).toEqual(['Shawbury']);
    expect(near.tmin).toEqual(STATIONS.find((s) => s.id === 'shawbury')!.tmin);
  });

  it('every station has a height', () => {
    for (const s of STATIONS) expect(s.heightM).toBeGreaterThanOrEqual(0);
    expect(OWN_STATION_KM).toBeGreaterThan(10);
  });
});

describe('a garden in the middle of England does not move', () => {
  const g = newGarden();
  it('by months', () => {
    expect(monthsLater(g)).toBe(0);
    for (const p of library.slice(0, 80)) expect(plantHere(p, g)).toBe(p);
  });
});

describe('dates against Callum’s spreadsheet', () => {
  it('months move a month or more', () => {
    expect(monthsLater(own())).toBeGreaterThanOrEqual(1);
    expect(monthsLater(callum())).toBeGreaterThanOrEqual(1);
  });

  it('broad beans go out mid-April, not 1 February', () => {
    const d = firstDate(own(), 'broad-bean');
    expect(d >= '2027-04-01').toBe(true);
    expect(d <= '2027-05-01').toBe(true);
  });

  it('second early potatoes go in late May, not 1 April', () => {
    const d = firstDate(own(), 'potato-second-early');
    expect(d >= '2027-05-15').toBe(true);
    expect(d <= '2027-06-10').toBe(true);
  });

  it('tomatoes are sown from March on the windowsill, not 1 February', () => {
    expect(firstDate(own(), 'tomato') >= '2027-03-01').toBe(true);
  });

  it('courgettes are sown in May, not 1 April', () => {
    const d = firstDate(own(), 'courgette');
    expect(d >= '2027-05-01').toBe(true);
    expect(d <= '2027-06-01').toBe(true);
  });

  it('leeks and kale, which were right, stay right', () => {
    const leek = firstDate(own(), 'leek');
    expect(leek >= '2027-03-15').toBe(true);
    expect(leek <= '2027-05-01').toBe(true);
    expect(plantHere(plantOf('leek'), own()).plantOutMonths).toEqual([6, 7]);
    expect(plantHere(plantOf('kale'), own()).plantOutMonths).toEqual([6, 7]);
  });

  it('garlic still goes in in October', () => {
    const months = plantHere(plantOf('garlic'), own()).sowing!.flatMap((s) => s.months);
    expect(months).toContain(10);
  });

  it('your own frost dates move it all (Callum: "I did, and it didn’t listen")', () => {
    const estimate = callum({ frostHollow: false, heightM: undefined });
    const later = { ...estimate, lastFrost: '06-20' };
    expect(seasonShift(later, null, 4)).toBeGreaterThan(seasonShift(estimate, null, 4));
    expect(firstDate(later, 'potato-second-early') > firstDate(estimate, 'potato-second-early')).toBe(true);
  });

  it('harvests move too: garlic later than the south’s, in the card’s date', () => {
    const planted = { ...makePlanting(plantOf('garlic'), bed.id, 'row', [100, 300], [2900, 300]), sownOn: '2026-10-20', sowing: 'direct' as const };
    const south = addPlanting(addFeature(newGarden(), bed), planted);
    const north = addPlanting(addFeature(own(), bed), planted);
    const ready = (g: Garden) => timeline(plantOf('garlic'), planted, g, '2026-10-29').find((s) => s.stage === 'harvesting')!.date!;
    expect(ready(north) > ready(south)).toBe(true);
    expect(ready(north) >= '2027-07-01').toBe(true);
  });

  it('jobs follow: no potato job in April, one in May', () => {
    const { g } = planned(own(), 'potato-second-early');
    const sow = (m: number) => jobsFor(g, plantOf, m, 2027, { today: `2027-0${m}-05` }).filter((j) => j.kind === 'sow-direct');
    expect(sow(4)).toEqual([]);
    expect(sow(5)).toHaveLength(1);
  });

  it('the Shed follows: hardening off goes by the same months', () => {
    const next = nextFor(plantOf('kale'), own(), 'germinated', '2027-05-01', { germinated: '2027-05-10' }, '2027-05-12');
    expect(next.text).toMatch(/Start hardening off from/);
  });

  it('no autumn broad beans where they won’t stand the winter', () => {
    expect(generalJobs(10, own()).map((j) => j.text)).not.toContain('Sow overwintering broad beans outdoors');
    expect(generalJobs(10, newGarden()).map((j) => j.text)).toContain('Sow overwintering broad beans outdoors');
  });

  it('nothing tender goes out before the play-safe date, in a late garden', () => {
    const plant = plantOf('french-bean');
    const pl = { ...makePlanting(plant, bed.id, 'row', [100, 300], [2900, 300]), sowing: 'direct' as const };
    const g = addPlanting(addFeature({ ...newGarden(), lastFrost: '06-15' }, bed), pl);
    expect(timeline(plant, pl, g, '2027-01-10').find((s) => s.stage === 'sown')!.date! >= '2027-06-29').toBe(true);
  });

  it('a garden whose own first frost is all it has said keeps its season by the warmth', () => {
    const g = callum({ firstFrost: '09-05' });
    expect(seasonShift(g, null, 4)).toBe(seasonShift(callum(), null, 4));
  });

  it('a crop’s warmth is measured at its usual months, not the moved ones: a courgette’s ready date moves by the cold alone', () => {
    const plant = plantOf('courgette');
    const planted = { ...makePlanting(plant, bed.id, 'single', [100, 300]), sownOn: '2027-05-05', sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { transplanted: '2027-06-05' } };
    const ready = (g: Garden) => timeline(plant, planted, addPlanting(addFeature(g, bed), planted), '2027-06-06').find((s) => s.stage === 'harvesting' || s.stage === 'flowering')!.date!;
    // Over an extra month it's the warmth that matters: it's later than a mild garden's, but not pushed past the season.
    expect(ready(own()) < '2027-08-20').toBe(true);
  });

  it('no autumn broad beans for a planting in a late garden either', () => {
    const months = plantHere(plantOf('broad-bean'), own()).sowing!.filter((s) => s.method === 'direct').flatMap((s) => s.months);
    expect(months.some((m) => m >= 8)).toBe(false);
    expect(months).toContain(4);
  });

  it('a kit’s batches go by the months here', () => {
    expect(plantHere(plantOf('lettuce'), own()).sowing!.flatMap((s) => s.months)).not.toContain(2);
  });

  it('a garden further south with its own late frost moves, an early one stays', () => {
    const southern = { ...newGarden(), latitude: 51.45, longitude: -2.6 };
    expect(monthsLater(southern)).toBe(0);
    expect(monthsLater({ ...southern, lastFrost: '06-15' })).toBeGreaterThanOrEqual(1);
  });
});

describe('the save format', () => {
  it('a v22 garden comes through unchanged but for its version', () => {
    const { schemaVersion: _v, ...old } = newGarden();
    const out = migrateGarden({ ...old, schemaVersion: 22, lastFrost: '05-14' }) as Garden;
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.lastFrost).toBe('05-14');
    expect(out.heightM).toBeUndefined();
    expect(validateGarden(JSON.parse(JSON.stringify(out)))).toEqual([]);
  });

  it('a height and a frost hollow save, and nonsense does not', () => {
    expect(validateGarden(JSON.parse(JSON.stringify(callum())))).toEqual([]);
    expect(validateGarden(JSON.parse(JSON.stringify(callum({ heightM: 9000 })))).length).toBeGreaterThan(0);
    expect(frostDates(callum()).estimated).toBe(true);
  });
});
