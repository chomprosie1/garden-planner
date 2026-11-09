/** What the cached ground layer depends on. The hover is left out on purpose: it is drawn on the live layer. */
export interface GroundInputs {
  garden: unknown;
  look?: unknown;
  mode?: unknown;
  findings?: unknown;
  focusFinding?: unknown;
  traceImage?: unknown;
  plantOf?: unknown;
  shadows?: unknown;
  sunGrid?: unknown;
  time?: unknown;
  focus?: unknown;
  month?: unknown;
  sketches?: unknown;
  depth?: unknown;
  drawing?: unknown;
  w: number;
  h: number;
  dpr: number;
}

export function groundKey(i: GroundInputs): unknown[] {
  return [i.garden, i.look, i.mode, i.findings, i.focusFinding, i.traceImage, i.plantOf, i.shadows, i.sunGrid, i.time, i.focus, i.month, i.sketches, i.depth, i.drawing, i.w, i.h, i.dpr];
}

/** Whether two keys mean the same ground: every part identical. */
export function sameKey(a: readonly unknown[] | undefined, b: readonly unknown[]): boolean {
  return !!a && a.length === b.length && b.every((k, i) => k === a[i]);
}
