// A garden kept as a list still has shapes underneath: each bed added from the
// list is set out for you on a hidden plan, in rows, never on top of anything
// else, so everything that reads shapes (jobs, checks, the plan if you switch to
// it) works as before. Pure functions: a garden in, a new garden out.

import { bounds, type Bounds } from '../geometry/polygon';
import { addFeature, makeFeature, rectPoints } from './features';
import type { Feature, FeatureKind, Garden, Point } from './types';

/** What can be added from a list, and its usual size, mm (width × depth, or across for a pot). */
export const LIST_KINDS = ['bed', 'pot', 'planter', 'greenhouse', 'cold-frame', 'ground'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

export const LIST_KIND_LABEL: Record<ListKind, string> = {
  bed: 'A bed',
  pot: 'A pot',
  planter: 'A planter or window box',
  greenhouse: 'A greenhouse',
  'cold-frame': 'A cold frame',
  ground: 'A patch of ground',
};

export const LIST_SIZE: Record<ListKind, [number, number]> = {
  bed: [1200, 2400],
  pot: [300, 300],
  planter: [1000, 400],
  greenhouse: [1800, 2400],
  'cold-frame': [1200, 600],
  ground: [3000, 2000],
};

/** The space left between beds, and round the edge of the garden. */
const GAP = 600;
/** Rows of beds run this wide before starting a new row, unless the garden is wider. */
const ROW_MM = 10000;
/** The grid it looks for room on. */
const STEP = 300;

/** What a new bed must keep clear of: everything except lawns and meadows, which beds sit in. */
const inTheWay = (f: Feature) => !(f.kind === 'surface' && (f.material === 'lawn' || f.material === 'meadow' || f.material === undefined)) && !f.nextDoor;

const overlaps = (a: Bounds, b: Bounds) => a.minX < b.maxX + GAP && b.minX < a.maxX + GAP && a.minY < b.maxY + GAP && b.minY < a.maxY + GAP;

/** The first free place for something w × d: along rows from the bottom left of the garden, keeping clear of the rest. */
export function freeSpot(g: Garden, w: number, d: number): Point {
  const taken = g.features.filter(inTheWay).map((f) => bounds(f.footprint)).filter((b): b is Bounds => !!b);
  const edge = bounds(g.boundary);
  const x0 = (edge?.minX ?? 0) + GAP;
  const y0 = (edge?.minY ?? 0) + GAP;
  const xMax = Math.max(x0 + ROW_MM, (edge?.maxX ?? 0) - GAP) - w;
  for (let y = y0; y < y0 + 200 * STEP * 10; y += STEP)
    for (let x = x0; x <= Math.max(x0, xMax); x += STEP) {
      const box = { minX: x, minY: y, maxX: x + w, maxY: y + d };
      if (!taken.some((t) => overlaps(box, t))) return [x, y];
    }
  return [x0, y0];
}

/** The boundary grown to take in a box, with a margin: a rectangle round both. Left alone if it already does. */
function growBoundary(g: Garden, box: Bounds): Point[] {
  const edge = bounds(g.boundary);
  const inside = edge && box.minX >= edge.minX && box.minY >= edge.minY && box.maxX <= edge.maxX && box.maxY <= edge.maxY;
  if (g.boundary.length >= 3 && inside) return g.boundary;
  const minX = Math.min(edge?.minX ?? box.minX - GAP, box.minX - GAP);
  const minY = Math.min(edge?.minY ?? box.minY - GAP, box.minY - GAP);
  const maxX = Math.max(edge?.maxX ?? box.maxX + GAP, box.maxX + GAP);
  const maxY = Math.max(edge?.maxY ?? box.maxY + GAP, box.maxY + GAP);
  return rectPoints({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
}

/**
 * A bed (or pot, planter, greenhouse, cold frame, patch of ground) added from the list: named, at its size or the usual
 * one, in the first free place, with the boundary grown round it if need be. Returns the garden and the new bed's id.
 */
export function addListBed(g: Garden, kind: ListKind, name: string, size?: [number, number]): [Garden, string] {
  const [w, d] = size ?? LIST_SIZE[kind];
  const [x, y] = freeSpot(g, w, d);
  const featureKind: FeatureKind = kind === 'ground' ? 'surface' : kind;
  const shape = kind === 'pot' ? { circle: { centre: [x + w / 2, y + w / 2] as Point, radiusMm: w / 2 } } : { area: rectPoints({ x, y, w, h: d }) };
  let f = makeFeature(featureKind, shape);
  if (kind === 'ground') f = { ...f, material: 'soil' };
  if (name.trim()) f = { ...f, name: name.trim() };
  const box = bounds(f.footprint)!;
  return [{ ...addFeature(g, f), boundary: growBoundary(g, box) }, f.id];
}

/** Moves a bed up or down the list, past the next bed in the list (`isListed` says which features the list shows). */
export function moveInList(g: Garden, id: string, up: boolean, isListed: (f: Feature) => boolean): Garden {
  const listed = g.features.map((f, i) => [f, i] as const).filter(([f]) => isListed(f));
  const at = listed.findIndex(([f]) => f.id === id);
  const other = listed[up ? at - 1 : at + 1];
  if (at < 0 || !other) return g;
  const features = [...g.features];
  const [i, j] = [listed[at]![1], other[1]];
  [features[i], features[j]] = [features[j]!, features[i]!];
  return { ...g, features };
}

/**
 * Names for a list: beds that would show the same name ("Bed", "Bed") are numbered, "Bed 1", "Bed 2", so each card
 * can be told apart. Names you gave that are already different are left alone.
 */
export function nameListBeds(g: Garden, isListed: (f: Feature) => boolean, labelOf: (f: Feature) => string): Garden {
  const listed = g.features.filter(isListed);
  const counts = new Map<string, number>();
  for (const f of listed) counts.set(labelOf(f), (counts.get(labelOf(f)) ?? 0) + 1);
  const used = new Set(listed.map(labelOf));
  const renamed = new Map<string, string>();
  for (const f of listed) {
    const label = labelOf(f);
    if ((counts.get(label) ?? 0) < 2) continue;
    let n = 1;
    while (used.has(`${label} ${n}`)) n++;
    used.add(`${label} ${n}`);
    renamed.set(f.id, `${label} ${n}`);
  }
  if (!renamed.size) return g;
  return { ...g, features: g.features.map((f) => (renamed.has(f.id) ? { ...f, name: renamed.get(f.id)! } : f)) };
}
