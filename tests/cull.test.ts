import { describe, expect, it } from 'vitest';
import { CULL_PAD_MM, inView, viewBounds } from '../src/canvas/cull';
import { toScreen } from '../src/canvas/viewport';

const view = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
const box = (x: number, y: number, w = 100, h = 100) => ({ minX: x, minY: y, maxX: x + w, maxY: y + h });

describe('inView', () => {
  it('keeps what is inside, straddling or touching', () => {
    expect(inView(box(400, 400), view, 0)).toBe(true);
    expect(inView(box(950, 400), view, 0)).toBe(true);
    expect(inView(box(1000, 400), view, 0)).toBe(true);
  });
  it('drops what is far outside', () => {
    expect(inView(box(9000, 9000), view, CULL_PAD_MM)).toBe(false);
  });
  it('uses the pad', () => {
    expect(inView(box(1900, 400), view, 1000)).toBe(true); // 900 mm out
    expect(inView(box(2100, 400), view, 1000)).toBe(false); // 1100 mm out
  });
});

describe('viewBounds', () => {
  it('maps the corners back to the canvas corners', () => {
    const v = { scale: 0.05, ox: 120, oy: 700 };
    const b = viewBounds(v, 390, 844);
    const back = (x: number, y: number) => toScreen(v, [x, y]);
    const near = (p: number[], q: number[]) => {
      expect(p[0]).toBeCloseTo(q[0]!, 3);
      expect(p[1]).toBeCloseTo(q[1]!, 3);
    };
    near(back(b.minX, b.maxY), [0, 0]);
    near(back(b.maxX, b.maxY), [390, 0]);
    near(back(b.minX, b.minY), [0, 844]);
    near(back(b.maxX, b.minY), [390, 844]);
  });
});

describe('culling a big garden', () => {
  it('draws only the few near the view', () => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 1500; i++) pts.push([(i % 300) * (50000 / 300), Math.floor(i / 300) * 1200]);
    const vw = { minX: 24000, minY: 1500, maxX: 27000, maxY: 4500 };
    const r = 150;
    const got = pts.filter(([x, y]) => inView({ minX: x, minY: y, maxX: x, maxY: y }, vw, CULL_PAD_MM + r)).length;
    const want = pts.filter(([x, y]) => x + r >= vw.minX - 1000 && x - r <= vw.maxX + 1000 && y + r >= vw.minY - 1000 && y - r <= vw.maxY + 1000).length;
    expect(got).toBe(want);
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThan(225);
  });
});
