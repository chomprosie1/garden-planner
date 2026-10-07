// Stage 17: this year's weather (opt-in Open-Meteo), frost warnings, the
// Water lens with real rain, sowing in batches, and What's new.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { actualTable, averagesAt, dailyTable, daysUntil, yearSoFar } from '../src/climate/warmth';
import { latestNews, unseenNews, WHATS_NEW } from '../src/content/whatsNew';
import { atRiskOn, frostAdvice, frostHeadline, frostWarning, whenText } from '../src/lifecycle/frostWatch';
import { readyFrom } from '../src/lifecycle/growth';
import { fillersFor, pickedBy, timeline, wetness } from '../src/lifecycle/projection';
import { makePlace, sowInTray, setTrayStage } from '../src/lifecycle/shed';
import { addDays, daysBetween } from '../src/model/dates';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { batchDates, batchesOf, batchLabel, canSowInBatches, maxBatches, setSowBy, splitIntoBatches, splitShape } from '../src/planting/batches';
import { addPlanting, makePlanting, plantCount, plantPositions, unknownPlant } from '../src/planting/place';
import { clearWeather, loadWeather, saveWeather } from '../src/storage/weatherCache';
import { sanitisePrefs } from '../src/theme/prefs';
import { fetchWeather, weatherUrls } from '../src/weather/openMeteo';
import { coldNights, isFresh, lastDay, makeWeather, parseDaily, rainOver, roundPlace, usableFor, weatherOn, type Weather } from '../src/weather/weather';
import forecast from './fixtures/open-meteo-forecast.json';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);

const LEEDS: Garden = { ...newGarden(), latitude: 53.8, longitude: -1.55 };

/** Weather for Leeds from a day, with the same day and night temperature and rain every day. */
function steady(from: string, days: number, max: number, min: number, rain = 0, today = from): Weather {
  const day = { max, min, rain };
  const replies = [new Map(Array.from({ length: days }, (_, i) => [addDays(from, i), day]))];
  return makeWeather(replies, today, `${today}T09:00:00.000Z`, roundPlace(53.8), roundPlace(-1.55))!;
}

const area = (kind: Feature['kind'], x: number, y: number, w: number, h: number) => makeFeature(kind, { area: rectPoints({ x, y, w, h }) });

describe('reading Open-Meteo', () => {
  it('reads a real forecast: each day’s warmest, coolest and rain', () => {
    const days = parseDaily(forecast);
    expect(days.size).toBe(forecast.daily.time.length);
    const first = days.get(forecast.daily.time[0]!)!;
    expect(first.max).toBe(forecast.daily.temperature_2m_max[0]);
    expect(first.rain).toBe(forecast.daily.precipitation_sum[0]);
  });

  it('refuses something that isn’t a daily reply, and skips missing values', () => {
    expect(() => parseDaily({ error: true, reason: 'nope' })).toThrow();
    expect(() => parseDaily(null)).toThrow();
    const days = parseDaily({ daily: { time: ['2026-10-01', 'bad'], temperature_2m_max: [null], temperature_2m_min: [5], precipitation_sum: [0] } });
    expect([...days.keys()]).toEqual(['2026-10-01']);
    expect(days.get('2026-10-01')).toEqual({ min: 5, rain: 0 });
  });

  it('joins the archive and the forecast, the forecast winning where both have a day, gaps left empty', () => {
    const archive = new Map([
      ['2026-09-01', { max: 18, min: 9, rain: 1 }],
      ['2026-09-02', { max: 17, min: 8, rain: 0 }],
    ]);
    const fc = new Map([
      ['2026-09-02', { max: 20, min: 10, rain: 2 }],
      ['2026-09-04', { max: 15, min: 5, rain: 0 }],
    ]);
    const w = makeWeather([archive, fc], '2026-09-03', '2026-09-03T08:00:00Z', 53.8, -1.55)!;
    expect(w.from).toBe('2026-09-01');
    expect(w.tmax).toEqual([18, 20, null, 15]);
    expect(weatherOn(w, '2026-09-02')).toEqual({ max: 20, min: 10, rain: 2 });
    expect(weatherOn(w, '2026-09-03')).toBeNull();
    expect(lastDay(w)).toBe('2026-09-04');
    expect(makeWeather([], '2026-09-03', '', 0, 0)).toBeNull();
  });

  it('asks for the place rounded to about a kilometre, the past year and the next fortnight', () => {
    const urls = weatherUrls(53.80123, -1.554321, '2026-10-07');
    expect(urls.forecast).toContain('latitude=53.8&longitude=-1.55');
    expect(urls.forecast).toContain('forecast_days=16');
    expect(urls.archive).toContain('start_date=2025-09-02');
    expect(urls.archive).toContain('end_date=2026-10-01');
    expect(urls.archive).not.toContain('53.80123');
  });

  it('fetches both, manages with the forecast alone, and fails without it', async () => {
    const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    const archive = { daily: { time: ['2026-09-01'], temperature_2m_max: [18], temperature_2m_min: [9], precipitation_sum: [1] } };
    const both: typeof fetch = (url) => (String(url).includes('archive') ? ok(archive) : ok(forecast));
    const w = await fetchWeather(53.8, -1.55, '2026-10-07', new Date('2026-10-07T09:00:00Z'), both);
    expect(w.from).toBe('2026-09-01');
    expect(w.today).toBe('2026-10-07');
    expect(w.fetchedAt).toBe('2026-10-07T09:00:00.000Z');
    const noArchive: typeof fetch = (url) => (String(url).includes('archive') ? Promise.resolve(new Response('', { status: 500 })) : ok(forecast));
    expect((await fetchWeather(53.8, -1.55, '2026-10-07', new Date(), noArchive)).from).toBe(forecast.daily.time[0]);
    const noForecast: typeof fetch = (url) => (String(url).includes('archive') ? ok(archive) : Promise.reject(new Error('offline')));
    await expect(fetchWeather(53.8, -1.55, '2026-10-07', new Date(), noForecast)).rejects.toThrow('offline');
  });

  it('is fresh for a few hours, for the same place, and usable while the forecast covers today', () => {
    const w = steady('2026-10-01', 20, 15, 5, 0, '2026-10-07');
    expect(isFresh(w, 53.8, -1.55, new Date('2026-10-07T12:00:00Z'))).toBe(true);
    expect(isFresh(w, 53.8, -1.55, new Date('2026-10-07T16:00:00Z'))).toBe(false);
    expect(isFresh(w, 51.5, -0.12, new Date('2026-10-07T10:00:00Z'))).toBe(false);
    expect(usableFor(w, 53.801, -1.549, '2026-10-15')).toBe(w);
    expect(usableFor(w, 53.8, -1.55, '2026-10-25')).toBeNull();
    expect(usableFor(w, 57.2, -2.2, '2026-10-10')).toBeNull();
  });

  it('adds up the rain over the last few days, if it has them all', () => {
    const w = steady('2026-10-01', 10, 15, 5, 2.5);
    expect(rainOver(w, '2026-10-05', 3)).toBe(7.5);
    expect(rainOver(w, '2026-10-02', 3)).toBeNull();
  });
});

describe('kept on the device', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };
  it('keeps the weather, reads it back, and forgets it', () => {
    const s = memory();
    const w = steady('2026-10-01', 5, 15, 5);
    saveWeather(w, s);
    expect(loadWeather(s)).toEqual(w);
    clearWeather(s);
    expect(loadWeather(s)).toBeNull();
  });
  it('ignores anything unreadable', () => {
    const s = memory();
    s.setItem('garden-planner:weather', '{"from":"2026-10-01","tmax":[1],"tmin":[],"rain":[]}');
    expect(loadWeather(s)).toBeNull();
    s.setItem('garden-planner:weather', 'not json');
    expect(loadWeather(s)).toBeNull();
  });
  it('is off until you turn it on', () => {
    expect(sanitisePrefs({}).weather).toBe(false);
    expect(sanitisePrefs({ weather: true }).weather).toBe(true);
    expect(sanitisePrefs({ weather: 'yes' }).weather).toBe(false);
  });
});

describe('growing degree days from the real weather', () => {
  it('counts the days the weather has as they were, and the rest as usual', () => {
    const av = averagesAt(53.8, -1.55);
    const table = dailyTable(av, 10);
    const hot = steady('2027-06-01', 30, 28, 16);
    const usual = daysUntil(table, '2027-06-01', 150)!;
    const real = daysUntil(table, '2027-06-01', 150, 730, actualTable(hot, 10))!;
    expect(real).toBeLessThan(usual);
    // Each hot day: (28 + 16) / 2 − 10 = 12 degree days.
    expect(real).toBe(13);
    // Past the weather, it carries on with the usual.
    expect(daysUntil(table, '2027-06-01', 1000, 730, actualTable(hot, 10))).toBeGreaterThan(30);
  });

  it('brings a crop on sooner in a hot spell and later in a cold one', () => {
    const tomato = plant('tomato');
    const pl = { ...makePlanting(tomato, 'bed', 'single', [0, 0]), sowing: 'indoors' as const };
    const start = '2027-05-20';
    const days = (w: Weather | null) => daysBetween(start, readyFrom(tomato, pl, LEEDS, start, null, 1, w)!);
    expect(days(steady(start, 45, 27, 15))).toBeLessThan(days(null));
    expect(days(steady(start, 45, 15, 6))).toBeGreaterThan(days(null));
  });

  it('carries this year’s weather into the year’s projections', () => {
    const carrot = plant('carrot');
    const pl: Planting = { ...makePlanting(carrot, 'bed', 'single', [0, 0]), sowing: 'direct', sownOn: '2027-05-01' };
    const harvest = (w: Weather | null) => timeline(carrot, pl, LEEDS, '2027-05-02', w).find((s) => s.stage === 'harvesting')!.date!;
    expect(harvest(steady('2027-05-01', 40, 25, 13)) < harvest(null)).toBe(true);
  });

  it('says how this year compares with the usual since 1 January', () => {
    const av = averagesAt(53.8, -1.55);
    const warm = steady('2027-01-01', 120, 14, 6, 0, '2027-05-01');
    const r = yearSoFar(warm, av, '2027-05-01')!;
    expect(r.actual).toBeGreaterThan(r.usual);
    expect(yearSoFar(steady('2027-03-01', 30, 14, 6), av, '2027-03-20')).toBeNull();
  });
});

describe('frost in the forecast', () => {
  const bed = area('bed', 5000, 0, 2400, 1200);
  const greenhouse = area('greenhouse', 0, 0, 2400, 1800);
  const base = [bed, greenhouse].reduce(addFeature, LEEDS);
  const tomatoOut: Planting = { ...makePlanting(plant('tomato'), bed.id, 'single', [6000, 500]), sowing: 'indoors', sownOn: '2026-03-01', stage: 'vegetative' };
  const tomatoIn: Planting = { ...makePlanting(plant('tomato'), greenhouse.id, 'single', [1000, 900]), sowing: 'indoors', sownOn: '2026-03-01', stage: 'vegetative' };
  const kale: Planting = { ...makePlanting(plant('kale'), bed.id, 'single', [7000, 500]), stage: 'vegetative' };
  const g = [tomatoOut, tomatoIn, kale].reduce(addPlanting, base);

  it('finds cold nights, and a greenhouse’s night gain keeps some off', () => {
    const w = steady('2026-10-07', 7, 9, 2);
    expect(coldNights(w, '2026-10-07')).toHaveLength(7);
    expect(coldNights(w, '2026-10-07')[0]).toEqual({ date: '2026-10-07', min: 2, level: 'ground' });
    expect(coldNights(w, '2026-10-07', 7, 2)).toHaveLength(0);
    expect(coldNights(steady('2026-10-07', 3, 6, -1), '2026-10-07')[0]!.level).toBe('frost');
  });

  it('warns about tender plants outside on a ground frost, and under glass only on a hard one', () => {
    const ground = frostWarning(g, plant, steady('2026-10-07', 7, 9, 2), '2026-10-07')!;
    expect(ground.atRisk.map((a) => a.id)).toEqual([tomatoOut.id]);
    expect(ground.atRisk[0]!.where).toMatch(/^in /);
    const hard = frostWarning(g, plant, steady('2026-10-07', 7, 5, -3), '2026-10-07')!;
    expect(hard.atRisk.map((a) => a.id).sort()).toEqual([tomatoIn.id, tomatoOut.id].sort());
    // Hardy kale is never on the list; a heated greenhouse never frosts.
    const heated = { ...g, features: g.features.map((f) => (f.id === greenhouse.id ? { ...f, climate: { heated: true, dayGainC: 8, nightGainC: 2 } } : f)) };
    expect(frostWarning(heated, plant, steady('2026-10-07', 7, 5, -3), '2026-10-07')!.atRisk.map((a) => a.id)).toEqual([tomatoOut.id]);
  });

  it('warns about tender seedlings hardening off, and on an unheated bench', () => {
    const places = [makePlace('greenhouse-bench'), makePlace('windowsill')];
    let s: Garden = { ...LEEDS, shedPlaces: places };
    const bench = places[0]!.id;
    const sill = places[1]!.id;
    let hardening: string, onBench: string, onSill: string;
    [s, hardening] = sowInTray(s, plant('courgette'), { date: '2027-04-01', placeId: sill }) as [Garden, string];
    s = setTrayStage(s, hardening, 'hardening', '2027-05-01');
    [s, onBench] = sowInTray(s, plant('tomato'), { date: '2027-04-01', placeId: bench }) as [Garden, string];
    [s, onSill] = sowInTray(s, plant('basil'), { date: '2027-04-01', placeId: sill }) as [Garden, string];
    const risk = atRiskOn(s, plant, { date: '2027-05-05', min: -2, level: 'frost' });
    expect(risk.map((r) => r.id).sort()).toEqual([hardening, onBench].sort());
    expect(risk.map((r) => r.id)).not.toContain(onSill);
    expect(frostAdvice({ night: { date: '2027-05-05', min: -2, level: 'frost' }, atRisk: risk })).toMatch(/indoors for the night.*Fleece seedlings in the greenhouse/);
  });

  it('says nothing with no forecast, or no cold nights', () => {
    expect(frostWarning(g, plant, null, '2026-10-07')).toBeNull();
    expect(frostWarning(g, plant, steady('2026-10-07', 7, 15, 8), '2026-10-07')).toBeNull();
  });

  it('says when, in words', () => {
    expect(whenText('2026-10-07', '2026-10-07')).toBe('early this morning');
    expect(whenText('2026-10-08', '2026-10-07')).toBe('tonight, into tomorrow morning');
    expect(whenText('2026-10-10', '2026-10-07')).toBe('early on Saturday');
    const w = frostWarning(g, plant, steady('2026-10-08', 7, 5, -1.4, 0, '2026-10-07'), '2026-10-07')!;
    expect(frostHeadline(w, '2026-10-07')).toBe('Frost likely tonight, into tomorrow morning: about −1 °C.');
  });
});

describe('the Water lens, with real rain', () => {
  const bed = area('bed', 5000, 0, 2400, 1200);
  const pot = makeFeature('pot', { circle: { centre: [9000, 500], radiusMm: 250 } });
  const greenhouse = area('greenhouse', 0, 0, 2400, 1800);
  const carrot: Planting = { ...makePlanting(plant('carrot'), bed.id, 'single', [6000, 500]), sowing: 'direct', stage: 'vegetative' };
  const basil: Planting = { ...makePlanting(plant('basil'), pot.id, 'single', [9000, 500]), stage: 'vegetative' };
  const tomato: Planting = { ...makePlanting(plant('tomato'), greenhouse.id, 'single', [1000, 900]), stage: 'vegetative' };
  const g = [carrot, basil, tomato].reduce(addPlanting, [bed, pot, greenhouse].reduce(addFeature, LEEDS));
  const at = (pl: Planting) => ({ stage: pl.stage ?? ('planned' as const), guessed: false });
  const water = (w: Weather) => [...pickedBy('water', g, plant, at, '2027-07-10', w)].sort();

  it('after a soaking, picks out only what’s under glass', () => {
    expect(water(steady('2027-07-01', 10, 22, 12, 5))).toEqual([tomato.id]);
  });
  it('after a little rain on a warm day, the pot dries out but the beds are fine', () => {
    expect(water(steady('2027-07-01', 10, 22, 12, 1.5)).sort()).toEqual([basil.id, tomato.id].sort());
  });
  it('in a dry, warm spell, everything in the ground', () => {
    expect(water(steady('2027-07-01', 10, 24, 12, 0))).toEqual([basil.id, carrot.id, tomato.id].sort());
  });
  it('reads how wet it’s been, and falls back to the months where the weather doesn’t reach', () => {
    expect(wetness(steady('2027-07-01', 10, 24, 12, 4), '2027-07-10')).toMatchObject({ soaked: true, rain3: 12 });
    expect(wetness(steady('2027-07-01', 10, 24, 12, 0), '2027-08-10')).toBeNull();
    expect(pickedBy('water', g, plant, at, '2027-08-10', steady('2027-07-01', 10, 24, 12, 9)).has(basil.id)).toBe(true);
  });
});

describe('sowing in batches', () => {
  const lettuce = plant('lettuce');
  const bed = area('bed', 0, 0, 3000, 1200);
  const row: Planting = { ...makePlanting(lettuce, bed.id, 'row', [100, 300], [2500, 300]), sowing: 'direct' };
  const block = makePlanting(plant('radish'), bed.id, 'block', [100, 600], [2900, 1100]);
  const g = [row, block].reduce(addPlanting, addFeature(LEEDS, bed));

  it('is for rows and blocks raised from seed, not sown yet', () => {
    expect(canSowInBatches(lettuce, row)).toBe(true);
    expect(canSowInBatches(lettuce, { ...row, sownOn: '2027-04-01' })).toBe(false);
    expect(canSowInBatches(lettuce, { ...row, layout: 'single' })).toBe(false);
    expect(canSowInBatches(plant('strawberry'), { ...row, plantId: 'strawberry' })).toBe(false);
  });

  it('splits a row into shorter rows with the same plants in the same places', () => {
    const pieces = splitShape(row, lettuce, 3);
    expect(pieces.map((p) => p.count)).toEqual([3, 3, 3].map((_, i) => Math.floor(plantCount(row, lettuce) / 3) + (i < plantCount(row, lettuce) % 3 ? 1 : 0)));
    const before = plantPositions(row, lettuce);
    const after = pieces.flatMap((p) => plantPositions({ ...row, x: p.start[0], y: p.start[1], endPoint: p.end, count: p.count! }, lettuce));
    // To the millimetre, give or take rounding where the batches meet.
    expect(after).toHaveLength(before.length);
    after.forEach((p, i) => expect(Math.hypot(p[0] - before[i]![0], p[1] - before[i]![1])).toBeLessThanOrEqual(1.5));
  });

  it('splits a block into strips across its longer side', () => {
    const strips = splitShape(block, plant('radish'), 4);
    expect(strips).toHaveLength(4);
    expect(strips[0]!.start).toEqual([100, 600]);
    expect(strips[3]!.end).toEqual([2900, 1100]);
    expect(strips.every((s) => s.start[1] === 600 && s.end[1] === 1100)).toBe(true);
  });

  it('makes each batch its own planting, sown a few weeks after the last', () => {
    const split = splitIntoBatches(g, row.id, lettuce, 3, 21, '2027-04-05');
    const set = batchesOf(split, split.plantings.find((p) => p.id === row.id)!);
    expect(set.map((p) => p.sowBy)).toEqual(['2027-04-05', '2027-04-26', '2027-05-17']);
    expect(set.map(batchLabel)).toEqual(['Batch 1 of 3', 'Batch 2 of 3', 'Batch 3 of 3']);
    expect(set[0]!.id).toBe(row.id);
    expect(new Set(set.map((p) => p.batch!.group)).size).toBe(1);
    expect(split.plantings).toHaveLength(4);
    expect(validateGarden(JSON.parse(JSON.stringify(split)))).toEqual([]);
    expect(batchDates('2027-04-05', 2, 14)).toEqual(['2027-04-05', '2027-04-19']);
    // Not for one already in batches, or more than fit.
    expect(splitIntoBatches(split, row.id, lettuce, 2, 14, '2027-04-05')).toBe(split);
    expect(splitIntoBatches(g, row.id, lettuce, maxBatches(row, lettuce) + 1, 14, '2027-04-05')).toBe(g);
  });

  it('projects each batch from its own sowing date', () => {
    const split = splitIntoBatches(g, row.id, lettuce, 3, 21, '2027-04-05');
    const [b1, , b3] = batchesOf(split, split.plantings[0]!);
    const sown = (pl: Planting) => timeline(lettuce, pl, split, '2027-03-01').find((s) => s.stage === 'sown')!.date;
    expect(sown(b1!)).toBe('2027-04-05');
    expect(sown(b3!)).toBe('2027-05-17');
    expect(sown(setSowBy(split, b3!.id, '2027-06-01').plantings.find((p) => p.id === b3!.id)!)).toBe('2027-06-01');
  });

  it('gives each batch its own sowing job in its month, late ones the month after, and ticking sows only that batch', () => {
    const split = splitIntoBatches(g, row.id, lettuce, 3, 21, '2027-04-05');
    const sowJobs = (m: number, garden = split) => jobsFor(garden, plant, m, 2027).filter((j) => j.kind === 'sow-direct' && j.plantId === 'lettuce');
    expect(sowJobs(4).map((j) => j.where)).toEqual(['in Bed (batch 1 of 3)', 'in Bed (batch 2 of 3)']);
    expect(sowJobs(4)[0]!.detail).toMatch(/^Sow about 5 Apr\./);
    expect(sowJobs(5).map((j) => j.where)).toEqual(['in Bed (batch 1 of 3)', 'in Bed (batch 2 of 3)', 'in Bed (batch 3 of 3)']);
    expect(sowJobs(5)[0]!.detail).toMatch(/^Running late/);
    const ticked = toggleJob(split, sowJobs(4)[0]!, '2027-04-06', plant);
    const [b1, b2] = batchesOf(ticked, ticked.plantings[0]!);
    expect(b1!.sownOn).toBe('2027-04-06');
    expect(b2!.sownOn).toBeUndefined();
    // Once sown, it stays in April's list and isn't late in May.
    expect(sowJobs(4, ticked).map((j) => j.where)).toEqual(['in Bed (batch 1 of 3)', 'in Bed (batch 2 of 3)']);
    expect(sowJobs(5, ticked).map((j) => j.where)).toEqual(['in Bed (batch 2 of 3)', 'in Bed (batch 3 of 3)']);
  });

  it('suggests plants from your sowing list first for an empty bed', () => {
    const maybe = (id: string) => byId.get(id) ?? null;
    expect(fillersFor(5, maybe)).toEqual(['lettuce', 'radish']);
    expect(fillersFor(5, maybe, ['beetroot', 'strawberry', 'nothing'])).toEqual(['beetroot', 'lettuce']);
  });

  it('saves as schema 9, and checks a batch’s fields', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(9);
    expect((migrateGarden({ ...LEEDS, schemaVersion: 8 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
    const bad = { ...g, plantings: [{ ...row, sowBy: 'soon', batch: { group: 'b', n: 4, of: 3 } }] };
    expect(validateGarden(bad)).toHaveLength(2);
  });
});

describe('What’s new', () => {
  it('lists changes newest first, each with its own id, a date and plain words', () => {
    expect(new Set(WHATS_NEW.map((e) => e.id)).size).toBe(WHATS_NEW.length);
    const dates = WHATS_NEW.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const e of WHATS_NEW) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
      // For people using the app: no build stages, code or jargon.
      for (const text of [e.title, ...e.items]) expect(text).not.toMatch(/\bStage \d|schema|`|\bGDD\b|\bAPI\b|degree days|refactor/i);
    }
  });

  it('knows what you haven’t seen', () => {
    expect(unseenNews(null)).toEqual(WHATS_NEW);
    expect(unseenNews(latestNews().id)).toEqual([]);
    expect(unseenNews(WHATS_NEW[2]!.id)).toEqual(WHATS_NEW.slice(0, 2));
    expect(sanitisePrefs({ seenNews: 'x' }).seenNews).toBe('x');
    expect(sanitisePrefs({}).seenNews).toBeNull();
  });
});
