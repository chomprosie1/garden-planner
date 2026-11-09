import { describe, expect, it } from 'vitest';
import { DRAG_START_PX, HIT_PX, isDrag, perFrame } from '../src/canvas/touch';

describe('touch that means it', () => {
  it('a touch wobble is not a drag, a real move is', () => {
    expect(isDrag(6, 0, 'touch')).toBe(false);
    expect(isDrag(8, 8, 'touch')).toBe(true);
    expect(DRAG_START_PX.touch).toBe(10);
  });
  it('mouse and pen start at 3 px', () => {
    expect(isDrag(4, 0, 'mouse')).toBe(true);
    expect(isDrag(2, 2, 'mouse')).toBe(false);
    expect(isDrag(4, 0, 'pen')).toBe(true);
  });
  it('an unknown pointer type counts as mouse', () => {
    expect(isDrag(4, 0, 'gamepad')).toBe(true);
    expect(isDrag(2, 2, '')).toBe(false);
  });
  it('hit tolerances', () => {
    expect(HIT_PX.touch.planting).toBe(12);
    expect(HIT_PX.touch.feature).toBe(12);
    expect(HIT_PX.mouse.planting).toBe(3);
    expect(HIT_PX.mouse.feature).toBe(9);
    expect(HIT_PX.pen).toEqual(HIT_PX.mouse);
  });
});

describe('perFrame', () => {
  const fake = () => {
    let next: (() => void) | null = null;
    let id = 0;
    return {
      raf: (cb: () => void) => {
        next = cb;
        return ++id;
      },
      caf: () => {
        next = null;
      },
      fire: () => {
        const cb = next;
        next = null;
        cb?.();
      },
    };
  };
  it('three pushes before the frame deliver once, with the last value', () => {
    const f = fake();
    const got: number[] = [];
    const pf = perFrame<number>((v) => got.push(v), f.raf, f.caf);
    pf.push(1);
    pf.push(2);
    pf.push(3);
    f.fire();
    expect(got).toEqual([3]);
  });
  it('cancel before the frame delivers nothing', () => {
    const f = fake();
    const got: number[] = [];
    const pf = perFrame<number>((v) => got.push(v), f.raf, f.caf);
    pf.push(1);
    pf.cancel();
    f.fire();
    expect(got).toEqual([]);
  });
});
