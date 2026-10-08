// Release 11a, Room to see: UV (bands, a sunny day's estimate, the forecast's),
// which way shed places face and the sun they get, and schema 14.

import { describe, expect, it } from 'vitest';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { addPlace, makePlace, sowInTray, updatePlace } from '../src/lifecycle/shed';
import { facesAWay, isSunLover, LEGGY_UNDER_HOURS, placeSun, placeSunText, sunniestPlace, windowSunInMonth, windowSunOn } from '../src/lifecycle/shedSun';
import { newAppState } from '../src/model/defaults';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { FACINGS, type Garden, type Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { snapshot } from '../src/storage/reminders';
import { loadWeather } from '../src/storage/weatherCache';
import { weatherUrls } from '../src/weather/openMeteo';
import { clearDayUv, clearSkyUv, showsUv, uvBand, uvOn } from '../src/weather/uv';
import { makeWeather, parseDaily } from '../src/weather/weather';

const LONDON = { lat: 51.5, lon: -0.12 };
const library = [...vegetables, ...herbs] as Plant[];
const plant = (id: string) => library.find((p) => p.id === id)!;

describe('UV', () => {
  it('bands the index as the WHO does, with advice from moderate up', () => {
    expect([0, 2, 3, 5, 6, 7, 8, 10, 11, 13].map(uvBand)).toEqual(['low', 'low', 'moderate', 'moderate', 'high', 'high', 'very-high', 'very-high', 'extreme', 'extreme']);
    expect(uvBand(2.4)).toBe('low');
    expect(uvBand(2.6)).toBe('moderate');
  });

  it('works out a sunny day’s UV close to what the UK sees', () => {
    expect(clearSkyUv(0)).toBe(0);
    expect(clearSkyUv(-5)).toBe(0);
    // London: about 7 to 8 at midsummer, 3 to 4 at the equinoxes, 0 to 1 at midwinter.
    const june = clearDayUv('2026-06-21', LONDON.lat, LONDON.lon);
    expect(june).toBeGreaterThan(7);
    expect(june).toBeLessThan(9);
    const march = clearDayUv('2026-03-20', LONDON.lat, LONDON.lon);
    expect(march).toBeGreaterThan(2.5);
    expect(march).toBeLessThan(4.5);
    expect(clearDayUv('2026-12-21', LONDON.lat, LONDON.lon)).toBeLessThan(1);
    // Further north, lower.
    expect(clearDayUv('2026-06-21', 57.5, -4)).toBeLessThan(june);
  });

  it('uses the forecast’s when it has the day, and the estimate when it doesn’t', () => {
    const w = makeWeather([parseDaily({ daily: { time: ['2026-07-01', '2026-07-02'], temperature_2m_max: [24, 25], temperature_2m_min: [12, 13], precipitation_sum: [0, 0], uv_index_max: [6.4, null] } })], '2026-07-01', '2026-07-01T06:00:00Z', 51.5, -0.12)!;
    expect(w.uv).toEqual([6.4, null]);
    expect(uvOn(w, '2026-07-01', LONDON.lat, LONDON.lon)).toEqual({ index: 6, band: 'high', live: true });
    const est = uvOn(w, '2026-07-02', LONDON.lat, LONDON.lon);
    expect(est.live).toBe(false);
    expect(est.index).toBeGreaterThanOrEqual(7);
    expect(uvOn(null, '2026-07-02', LONDON.lat, LONDON.lon)).toEqual(est);
    // Weather fetched before UV was asked for has none.
    const old = makeWeather([parseDaily({ daily: { time: ['2026-07-01'], temperature_2m_max: [24], temperature_2m_min: [12], precipitation_sum: [0] } })], '2026-07-01', '2026-07-01T06:00:00Z', 51.5, -0.12)!;
    expect(old.uv).toBeUndefined();
    expect(uvOn(old, '2026-07-01', LONDON.lat, LONDON.lon).live).toBe(false);
  });

  it('asks the forecast for UV, not the archive', () => {
    const urls = weatherUrls(51.5, -0.12, '2026-07-01');
    expect(urls.forecast).toContain('uv_index_max');
    expect(urls.archive).not.toContain('uv');
  });

  it('keeps weather without UV, or with UV gone wrong, readable', () => {
    const base = { from: '2026-07-01', today: '2026-07-01', fetchedAt: 'x', lat: 51.5, lon: -0.12, tmax: [20], tmin: [10], rain: [0] };
    const store = (v: unknown) => ({ getItem: () => JSON.stringify(v), setItem: () => undefined, removeItem: () => undefined });
    expect(loadWeather(store(base))!.uv).toBeUndefined();
    expect(loadWeather(store({ ...base, uv: [5] }))!.uv).toEqual([5]);
    expect(loadWeather(store({ ...base, uv: [5, 6] }))!.uv).toBeUndefined();
    expect(loadWeather(store({ ...base, uv: ['high'] }))).not.toBeNull();
  });

  it('shows on Today from April to September, at moderate or above', () => {
    expect(showsUv({ index: 4, band: 'moderate', live: false }, '2026-04-10')).toBe(true);
    expect(showsUv({ index: 2, band: 'low', live: false }, '2026-06-10')).toBe(false);
    expect(showsUv({ index: 4, band: 'moderate', live: true }, '2026-10-01')).toBe(false);
    expect(showsUv({ index: 4, band: 'moderate', live: true }, '2026-03-31')).toBe(false);
  });

  it('tells the service worker whether sun cream reminders are on', () => {
    expect(snapshot(false, 51.5, -0.12, [], null).uv).toBe(false);
    expect(snapshot(false, 51.5, -0.12, [], null, true).uv).toBe(true);
  });
});

describe('which way a window faces, and its sun', () => {
  it('a south window gets the whole short winter day; a north one none', () => {
    const south = windowSunOn('south', '2026-12-21', LONDON.lat, LONDON.lon);
    expect(south).toBeGreaterThan(7.5);
    expect(south).toBeLessThan(8.3);
    expect(windowSunOn('north', '2026-12-21', LONDON.lat, LONDON.lon)).toBe(0);
  });

  it('in summer the north window gets early and late sun, and east and west about the same', () => {
    const north = windowSunInMonth('north', 6, 2026, LONDON.lat, LONDON.lon);
    expect(north).toBeGreaterThan(0.5);
    expect(north).toBeLessThan(windowSunInMonth('south', 6, 2026, LONDON.lat, LONDON.lon));
    const east = windowSunInMonth('east', 6, 2026, LONDON.lat, LONDON.lon);
    const west = windowSunInMonth('west', 6, 2026, LONDON.lat, LONDON.lon);
    expect(Math.abs(east - west)).toBeLessThan(0.5);
    // In April, south beats south-east beats east.
    const [s, se, e] = (['south', 'south-east', 'east'] as const).map((f) => windowSunInMonth(f, 4, 2026, LONDON.lat, LONDON.lon));
    expect(s).toBeGreaterThan(se!);
    expect(se).toBeGreaterThan(e!);
  });

  it('only windowsills, shelves and propagators face a way, and only once you’ve said which', () => {
    let g: Garden = { ...newAppState().garden, latitude: LONDON.lat, longitude: LONDON.lon };
    const sill = makePlace('windowsill');
    const bench = makePlace('greenhouse-bench');
    g = addPlace(addPlace(g, sill), bench);
    expect(facesAWay(sill)).toBe(true);
    expect(facesAWay(bench)).toBe(false);
    expect(placeSun(g, sill, 4, 2026)).toBeNull();
    g = updatePlace(updatePlace(g, sill.id, { facing: 'south' }), bench.id, { facing: 'south' });
    const [s, b] = g.shedPlaces!;
    expect(placeSun(g, s!, 4, 2026)).toBeGreaterThan(8);
    expect(placeSun(g, b!, 4, 2026)).toBeNull();
    // Taken off again.
    expect(updatePlace(g, sill.id, { facing: undefined }).shedPlaces![0]!.facing).toBeUndefined();
  });

  it('suggests the sunniest place with room for sun-lovers, and warns of leggy seedlings on a north sill', () => {
    let g: Garden = { ...newAppState().garden, latitude: LONDON.lat, longitude: LONDON.lon };
    const north = { ...makePlace('windowsill', 'Hall sill'), facing: 'north' as const };
    const south = { ...makePlace('windowsill', 'Kitchen sill'), slots: 1, facing: 'south' as const };
    g = addPlace(addPlace(g, north), south);
    expect(isSunLover(plant('tomato'))).toBe(true);
    expect(isSunLover(plant('basil'))).toBe(true);
    expect(sunniestPlace(g, 4, 2026)!.place.id).toBe(south.id);
    expect(placeSun(g, north, 4, 2026)!).toBeLessThan(LEGGY_UNDER_HOURS);
    expect(placeSunText(placeSun(g, north, 4, 2026)!, 4)).toMatch(/April$/);
    // Once the south sill is full, the next sunniest with room.
    g = sowInTray(g, plant('tomato'), { date: '2026-04-01', placeId: south.id })[0];
    expect(sunniestPlace(g, 4, 2026)!.place.id).toBe(north.id);
  });
});

describe('schema 14', () => {
  it('saves as 14 or later; older gardens load unchanged, and facing is checked', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(14);
    const old = { ...newAppState().garden, schemaVersion: 13, shedPlaces: [makePlace('windowsill')] };
    const g = migrateGarden(old) as Garden;
    expect(g.schemaVersion).toBe(SCHEMA_VERSION);
    expect(g.shedPlaces).toEqual(old.shedPlaces);
    const valid = (x: Garden) => validateGarden(x);
    for (const f of FACINGS) expect(valid({ ...g, shedPlaces: [{ ...makePlace('windowsill'), facing: f }] })).toEqual([]);
    expect(valid({ ...g, shedPlaces: [{ ...makePlace('windowsill'), facing: 'up' as never }] })).not.toEqual([]);
  });
});
