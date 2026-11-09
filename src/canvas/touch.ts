/** How far a press must travel, in screen px, before it starts moving the thing under it. */
export const DRAG_START_PX = { mouse: 3, pen: 3, touch: 10 } as const;

/** How close a press must land, in screen px, to pick a planting or a feature. */
export const HIT_PX = {
  mouse: { planting: 3, feature: 9 },
  pen: { planting: 3, feature: 9 },
  touch: { planting: 12, feature: 12 },
} as const;

export type PointerKind = keyof typeof DRAG_START_PX;

/** An unknown pointer type counts as a mouse. */
export function pointerKind(pointerType: string): PointerKind {
  return pointerType === 'touch' || pointerType === 'pen' ? pointerType : 'mouse';
}

/** True when a press has moved far enough to count as a drag. */
export function isDrag(dxPx: number, dyPx: number, pointerType: string): boolean {
  return Math.hypot(dxPx, dyPx) > DRAG_START_PX[pointerKind(pointerType)];
}

/** Delivers only the latest pushed value, once per animation frame. */
export function perFrame<T>(
  deliver: (v: T) => void,
  raf: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
  caf: (id: number) => void = (id) => cancelAnimationFrame(id),
) {
  let latest: T;
  let id = 0;
  let pending = false;
  return {
    push(v: T) {
      latest = v;
      if (pending) return;
      pending = true;
      id = raf(() => {
        pending = false;
        deliver(latest);
      });
    },
    cancel() {
      if (!pending) return;
      pending = false;
      caf(id);
    },
  };
}
