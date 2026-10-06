import { describe, expect, it } from 'vitest';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Garden } from '../src/model/types';
import { averageHours, hoursAt, lightBand, sunHours } from '../src/sun/hours';
import { bearingToGarden, formatClock, fromUkClock, shadowOffset, sunAt, sunDay, ukOffsetMinutes } from '../src/sun/position';
import { featureShadow, opacityFor, shadowsAt } from '../src/sun/shadow';

const LAT = 53;
const LON = -1.5;
const minutes = (d: Date | null) => {
  const [h, m] = formatClock(d!).split(':').map(Number);
  return h! * 60 + m!;
};

describe('UK clock', () => {
  it('is GMT in winter and BST in summer', () => {
    expect(ukOffsetMinutes(new Date(Date.UTC(2026, 0, 15, 12)))).toBe(0);
    expect(ukOffsetMinutes(new Date(Date.UTC(2026, 6, 15, 12)))).toBe(60);
  });

  it('changes on the last Sunday of October (25 Oct 2026)', () => {
    expect(ukOffsetMinutes(new Date(Date.UTC(2026, 9, 24, 12)))).toBe(60);
    expect(ukOffsetMinutes(new Date(Date.UTC(2026, 9, 26, 12)))).toBe(0);
    expect(fromUkClock(2026, 10, 24, 12).toISOString()).toBe('2026-10-24T11:00:00.000Z');
    expect(fromUkClock(2026, 10, 26, 12).toISOString()).toBe('2026-10-26T12:00:00.000Z');
  });

  it('changes on the last Sunday of March (29 Mar 2026)', () => {
    expect(fromUkClock(2026, 3, 28, 12).toISOString()).toBe('2026-03-28T12:00:00.000Z');
    expect(fromUkClock(2026, 3, 30, 12).toISOString()).toBe('2026-03-30T11:00:00.000Z');
  });

  it('solar noon jumps an hour on the clock across each change', () => {
    const before = minutes(sunDay(2026, 10, 24, LAT, LON).noon);
    const after = minutes(sunDay(2026, 10, 26, LAT, LON).noon);
    expect(before - after).toBeGreaterThan(58);
    expect(before - after).toBeLessThan(62);
    const spring = minutes(sunDay(2026, 3, 30, LAT, LON).noon) - minutes(sunDay(2026, 3, 28, LAT, LON).noon);
    expect(spring).toBeGreaterThan(58);
    expect(spring).toBeLessThan(62);
  });
});

describe('sun position at 53°N (NOAA equations)', () => {
  it('stands about 13.6° high at noon on midwinter day', () => {
    const noon = sunDay(2026, 12, 21, LAT, LON).noon;
    expect(minutes(noon)).toBeGreaterThanOrEqual(12 * 60 + 2);
    expect(minutes(noon)).toBeLessThanOrEqual(12 * 60 + 6);
    const s = sunAt(noon, LAT, LON);
    expect(s.altitude).toBeCloseTo(13.6, 0);
    expect(Math.abs(s.altitude - 13.6)).toBeLessThan(0.25);
    expect(Math.abs(s.azimuth - 180)).toBeLessThan(0.5);
  });

  it('stands about 60.4° high at noon on midsummer day, at 13:04 BST', () => {
    const noon = sunDay(2026, 6, 21, LAT, LON).noon;
    expect(minutes(noon)).toBeGreaterThanOrEqual(13 * 60 + 4);
    expect(minutes(noon)).toBeLessThanOrEqual(13 * 60 + 9);
    expect(Math.abs(sunAt(noon, LAT, LON).altitude - 60.45)).toBeLessThan(0.25);
  });

  it('rises about 08:17 and sets about 15:51 on midwinter day', () => {
    const d = sunDay(2026, 12, 21, LAT, LON);
    expect(Math.abs(minutes(d.sunrise) - (8 * 60 + 17))).toBeLessThanOrEqual(6);
    expect(Math.abs(minutes(d.sunset) - (15 * 60 + 51))).toBeLessThanOrEqual(6);
  });

  it('rises in the east and sets in the west at the equinox', () => {
    const d = sunDay(2027, 3, 20, LAT, LON);
    expect(Math.abs(sunAt(d.sunrise!, LAT, LON).azimuth - 90)).toBeLessThan(3);
    expect(Math.abs(sunAt(d.sunset!, LAT, LON).azimuth - 270)).toBeLessThan(3);
  });
});

describe('shadows', () => {
  it('a noon sun in the south casts shadows up the plan (north)', () => {
    const v = shadowOffset(1000, { altitude: 45, azimuth: 180 }, 0)!;
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(1000);
  });

  it('turns with north: north to the right of the plan sends noon shadows right', () => {
    const v = shadowOffset(1000, { altitude: 45, azimuth: 180 }, 90)!;
    expect(v[0]).toBeCloseTo(1000);
    expect(v[1]).toBeCloseTo(0);
    expect(bearingToGarden(90, 0)[0]).toBeCloseTo(1); // east is to the right when north is up
  });

  it('a 1.8 m fence under a 30° sun casts a 3.12 m shadow, and none at night', () => {
    const v = shadowOffset(1800, { altitude: 30, azimuth: 180 }, 0)!;
    expect(Math.hypot(v[0], v[1])).toBeCloseTo(3117.7, 0);
    expect(shadowOffset(1800, { altitude: -5, azimuth: 0 }, 0)).toBeNull();
  });

  it('deciduous things let more light through in winter', () => {
    const tree = makeFeature('tree', { circle: { centre: [0, 0], radiusMm: 2000 } });
    expect(opacityFor(tree, 7)).toBe(0.7);
    expect(opacityFor(tree, 1)).toBe(0.2);
    expect(opacityFor(makeFeature('fence', { line: [[0, 0], [1000, 0]] }), 1)).toBe(1);
  });

  it('paths and flat things cast no shadow', () => {
    const path = makeFeature('path', { line: [[0, 0], [1000, 0]] });
    expect(featureShadow(path, [0, 1], 6)).toBeNull();
  });

  it('a tree shadow starts away from the trunk and ends a full height out', () => {
    const tree = makeFeature('tree', { circle: { centre: [0, 0], radiusMm: 1000 } });
    const s = featureShadow(tree, [0, 1], 6)!; // 45° sun from the south
    const ys = s.polygons[0]!.map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(5000 + 1000, -1);
    expect(Math.min(...ys)).toBeCloseTo(5000 * 0.35 - 1000, -1);
  });
});

function openGarden(): Garden {
  return { ...newAppState().garden, latitude: LAT, longitude: LON, boundary: rectPoints({ x: 0, y: 0, w: 10000, h: 14000 }) };
}

describe('sun hours', () => {
  it('an open garden gets sun from sunrise to sunset everywhere', () => {
    const grid = sunHours(openGarden(), 6, 2026)!;
    expect(grid.cols).toBe(40);
    expect(grid.rows).toBe(56);
    expect(grid.maxHours).toBeGreaterThan(16.5);
    expect(hoursAt(grid, [5000, 7000])!).toBeCloseTo(grid.maxHours, 0);
    expect(hoursAt(grid, [20000, 7000])).toBeNull();
  });

  it('a 2 m wall along the south edge shades the strip behind it in December, not in June', () => {
    const wall = makeFeature('wall', { line: [[0, 200], [10000, 200]] });
    const g = addFeature(openGarden(), wall);
    const dec = sunHours(g, 12, 2026)!;
    expect(hoursAt(dec, [5000, 1500])!).toBeLessThan(0.3); // 1.3 m behind a 2 m wall, sun under 14°
    expect(hoursAt(dec, [5000, 13000])!).toBeCloseTo(dec.maxHours, 0);
    const jun = sunHours(g, 6, 2026)!;
    expect(hoursAt(jun, [5000, 1500])!).toBeGreaterThan(8);
  });

  it('a raised bed is not in its own shadow', () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 3000, y: 3000, w: 2000, h: 1000 }) });
    const grid = sunHours(addFeature(openGarden(), bed), 6, 2026)!;
    expect(hoursAt(grid, [4000, 3500])!).toBeCloseTo(grid.maxHours, 0);
  });

  it('see-through shade multiplies: under two 50% hedges a quarter of the light gets through', () => {
    // Two hedges 4 m tall right next to each other; a cell just north of both, in December.
    let g = openGarden();
    for (const y of [1000, 1700]) g = addFeature(g, { ...makeFeature('hedge', { line: [[-5000, y], [15000, y]] }), heightMm: 4000, opacityInLeaf: 0.5, opacityBare: 0.5 });
    const grid = sunHours(g, 12, 2026)!;
    const h = hoursAt(grid, [5000, 2500])!;
    expect(h / grid.maxHours).toBeGreaterThan(0.2);
    expect(h / grid.maxHours).toBeLessThan(0.3);
  });

  it('averages over a planting and names the light band', () => {
    const grid = sunHours(openGarden(), 6, 2026)!;
    expect(averageHours(grid, [[1000, 1000], [2000, 2000]])!).toBeGreaterThan(16);
    expect(lightBand(7)).toBe('full-sun');
    expect(lightBand(4)).toBe('part-shade');
    expect(lightBand(1)).toBe('shade');
  });

  it('works out a busy garden quickly', () => {
    let g = openGarden();
    g = addFeature(g, makeFeature('fence', { line: [[0, 0], [10000, 0], [10000, 14000], [0, 14000], [0, 0]] }));
    g = addFeature(g, makeFeature('building', { area: rectPoints({ x: 6000, y: 11000, w: 3000, h: 2500 }) }));
    for (let i = 0; i < 4; i++) g = addFeature(g, makeFeature('tree', { circle: { centre: [1500 + i * 2200, 9000], radiusMm: 1500 } }));
    for (let i = 0; i < 6; i++) g = addFeature(g, makeFeature('bed', { area: rectPoints({ x: 1000 + (i % 3) * 3000, y: 2000 + Math.floor(i / 3) * 2500, w: 2400, h: 1200 }) }));
    const t0 = performance.now();
    const grid = sunHours(g, 6, 2026)!;
    const ms = performance.now() - t0;
    console.log(`sun hours for a 10 × 14 m garden with ${g.features.length} features: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1000);
    expect(shadowsAt(g, sunAt(fromUkClock(2026, 6, 21, 9), LAT, LON), 6).length).toBe(g.features.length);
    expect(grid.hours.some((h) => h > 0)).toBe(true);
  });
});

describe('sun band outlines', () => {
  it('traces a smooth line where the hours cross a threshold', async () => {
    const { contours } = await import('../src/canvas/render');
    // A 4 × 2 grid of 1 m cells: 0, 2, 4, 6 h from west to east. The 3 h line runs north–south at x = 2 m.
    const hours = new Float32Array([0, 2, 4, 6, 0, 2, 4, 6]);
    const grid = { x0: 0, y0: 0, step: 1000, cols: 4, rows: 2, hours, inside: new Uint8Array(8).fill(1), month: 6, maxHours: 16 };
    const segs = contours(grid, 3);
    expect(segs.length).toBe(1);
    for (const p of segs[0]!) expect(p[0]).toBeCloseTo(2000);
    expect(contours(grid, 10)).toEqual([]);
  });
});
