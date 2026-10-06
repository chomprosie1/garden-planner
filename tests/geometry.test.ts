import { describe, expect, it } from 'vitest';
import type { Point } from '../src/model/types';
import { convexHull } from '../src/geometry/hull';
import { distance, perimeter, pointInPolygon, polygonArea, signedArea } from '../src/geometry/polygon';
import { pointAtLength, snapAngle, snapToGrid, snapToVertex } from '../src/geometry/snap';
import { thickenLine } from '../src/geometry/thicken';

const square: Point[] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
const lShape: Point[] = [[0, 0], [2000, 0], [2000, 1000], [1000, 1000], [1000, 2000], [0, 2000]];

describe('polygon', () => {
  it('measures distance, area and perimeter in mm', () => {
    expect(distance([0, 0], [3000, 4000])).toBe(5000);
    expect(polygonArea(square)).toBe(1_000_000);
    expect(polygonArea(lShape)).toBe(3_000_000);
    expect(perimeter(square)).toBe(4000);
  });

  it('gives anticlockwise polygons a positive signed area', () => {
    expect(signedArea(square)).toBeGreaterThan(0);
    expect(signedArea([...square].reverse())).toBeLessThan(0);
  });

  it('tests points inside a concave shape', () => {
    expect(pointInPolygon([500, 500], lShape)).toBe(true);
    expect(pointInPolygon([1500, 1500], lShape)).toBe(false); // the notch
    expect(pointInPolygon([2500, 500], lShape)).toBe(false);
  });
});

describe('snap', () => {
  it('snaps to the grid', () => {
    expect(snapToGrid([149, 251], 100)).toEqual([100, 300]);
  });

  it('snaps angles to 45° and keeps the length', () => {
    expect(snapAngle([0, 0], [1000, 80])).toEqual([1003, 0]);
    const p = snapAngle([0, 0], [700, 760]);
    expect(p[0]).toBe(p[1]);
    expect(distance([0, 0], p)).toBeCloseTo(distance([0, 0], [700, 760]), -1);
  });

  it('snaps to the nearest vertex within tolerance', () => {
    expect(snapToVertex([990, 15], square, 50)).toEqual([1000, 0]);
    expect(snapToVertex([500, 500], square, 50)).toBeNull();
  });

  it('places a typed length along the drag direction', () => {
    expect(pointAtLength([0, 0], [10, 0], 3450)).toEqual([3450, 0]);
    expect(pointAtLength([100, 100], [100, 900], 2000)).toEqual([100, 2100]);
  });
});

describe('convexHull', () => {
  it('wraps the L shape into its outline without the notch', () => {
    const hull = convexHull(lShape);
    expect(hull).toHaveLength(5);
    expect(polygonArea(hull)).toBe(3_500_000);
    expect(signedArea(hull)).toBeGreaterThan(0);
  });
});

describe('thickenLine', () => {
  it('turns a straight fence into a rectangle of the right width', () => {
    const poly = thickenLine([[0, 0], [5000, 0]], 100);
    expect(poly).toHaveLength(4);
    expect(polygonArea(poly)).toBe(500_000);
  });

  it('mitres a right-angle corner', () => {
    const poly = thickenLine([[0, 0], [2000, 0], [2000, 2000]], 100);
    expect(poly).toHaveLength(6);
    expect(poly).toContainEqual([1950, 50]);
    expect(poly).toContainEqual([2050, -50]);
    expect(polygonArea(poly)).toBe(400_000);
  });
});
