// A garden kept as a list still has shapes underneath: each bed added from the
// list is set out for you on a hidden plan, in rows, never on top of anything
// else and inside the garden's outline where there's room, so everything that
// reads shapes (jobs, checks, the plan if you switch to it) works as before.
// Pure functions: a garden in, a new garden out.

import { bounds, pointInPolygon, type Bounds } from '../geometry/polygon';
import { addFeature, makeFeature, moveFeature, rectPoints } from './features';
import type { Feature, FeatureKind, Garden, Point } from './types';

/** What can be added from a list, and its usual size, mm (width × depth, or across for a pot). */
export const LIST_KINDS = ['bed', 'pot', 'planter', 'greenhouse', 'cold-frame', 'fruit-cage', 'ground', 'cardboard'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

export const LIST_KIND_LABEL: Record<ListKind, string> = {
  bed: 'A bed',
  pot: 'A pot',
  planter: 'A planter or window box',
  greenhouse: 'A greenhouse',
  'cold-frame': 'A cold frame',
  'fruit-cage': 'A fruit cage',
  ground: 'A patch of ground',
  cardboard: 'Cardboard over weeds',
};

export const LIST_SIZE: Record<ListKind, [number, number]> = {
  bed: [1200, 2400],
  pot: [300, 300],
  planter: [1000, 400],
  greenhouse: [1800, 2400],
  'cold-frame': [1200, 600],
  'fruit-cage': [3000, 4000],
  ground: [3000, 2000],
  cardboard: [2000, 1200],
};

/** The space left between beds. */
const GAP = 600;
/** The space left inside the edge of the garden. */
const EDGE = GAP / 2;
/** Rows of beds run this wide before starting a new row, unless the garden is wider. */
const ROW_MM = 10000;
/** The grid it looks for room on. */
const STEP = 300;

/** What a new bed must keep clear of: everything except lawns and meadows, which beds sit in. */
const inTheWay = (f: Feature) => !(f.kind === 'surface' && (f.material === 'lawn' || f.material === 'meadow' || f.material === undefined)) && !f.nextDoor;

const overlaps = (a: Bounds, b: Bounds) => a.minX < b.maxX + GAP && b.minX < a.maxX + GAP && a.minY < b.maxY + GAP && b.minY < a.maxY + GAP;

/** Clear of everything in the way, with a gap. */
const clear = (box: Bounds, taken: Bounds[]) => !taken.some((t) => overlaps(box, t));

/** Inside the outline, with a little room to spare at each corner. */
const within = (box: Bounds, outline: Point[]) =>
  [
    [box.minX - EDGE / 2, box.minY - EDGE / 2],
    [box.maxX + EDGE / 2, box.minY - EDGE / 2],
    [box.maxX + EDGE / 2, box.maxY + EDGE / 2],
    [box.minX - EDGE / 2, box.maxY + EDGE / 2],
    [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2],
  ].every((p) => pointInPolygon(p as Point, outline));

/** The first clear place along rows, from (x0, y0), rows up to rowMm wide. */
function alongRows(taken: Bounds[], w: number, d: number, x0: number, y0: number, rowMm: number): Point {
  for (let y = y0; y < y0 + 2000 * STEP; y += STEP)
    for (let x = x0; x <= x0 + Math.max(0, rowMm - w); x += STEP) if (clear({ minX: x, minY: y, maxX: x + w, maxY: y + d }, taken)) return [x, y];
  return [x0, y0];
}

/**
 * Where something w × d goes. With an outline (a garden that's drawn, or set up from a template): the first clear place
 * inside it, along rows from the bottom left; with no room inside, to one side of it, and `outside` says so. The outline
 * is never changed. With no outline (a list started from nothing): along rows from the corner.
 */
export function placeFor(g: Garden, w: number, d: number): { at: Point; outside: boolean } {
  const taken = g.features.filter(inTheWay).map((f) => bounds(f.footprint)).filter((b): b is Bounds => !!b);
  const edge = g.boundary.length >= 3 ? bounds(g.boundary) : null;
  if (!edge) return { at: alongRows(taken, w, d, GAP, GAP, ROW_MM), outside: false };
  for (let y = edge.minY + EDGE; y + d <= edge.maxY - EDGE; y += STEP)
    for (let x = edge.minX + EDGE; x + w <= edge.maxX - EDGE; x += STEP) {
      const box = { minX: x, minY: y, maxX: x + w, maxY: y + d };
      if (clear(box, taken) && within(box, g.boundary)) return { at: [x, y], outside: false };
    }
  return { at: alongRows(taken, w, d, edge.maxX + GAP, edge.minY, ROW_MM), outside: true };
}

/**
 * Beds set out by a list moved apart where they've come to overlap (one made bigger in the list, or set out by a kit),
 * before the plan is shown: each one on top of another goes to the next free place, its plants with it. Only `which`
 * are moved, and everything else is settled first, so the house and paths stay put; of two that may move, the first
 * in the list stays.
 */
export function spreadOut(g: Garden, which: (f: Feature) => boolean): Garden {
  let next = g;
  const kept: { f: Feature; b: Bounds }[] = [];
  // Pots stand on a patio or path, and in a greenhouse or cold frame: only a bed or pot on top of another, or on a
  // building or pond, is in the wrong place.
  const solid = (k: Feature) => k.kind !== 'surface' && k.kind !== 'path';
  const standsIn = (f: Feature, k: Feature) => (f.kind === 'pot' || f.kind === 'planter') && (k.kind === 'greenhouse' || k.kind === 'cold-frame');
  const over = (a: Bounds, k: Bounds) => a.minX < k.maxX && k.minX < a.maxX && a.minY < k.maxY && k.minY < a.maxY;
  for (const f of [...g.features.filter((x) => !which(x)), ...g.features.filter(which)]) {
    if (!inTheWay(f)) continue;
    const b = bounds(f.footprint);
    if (!b) continue;
    const onTop = solid(f) && kept.some((k) => solid(k.f) && !standsIn(f, k.f) && !standsIn(k.f, f) && over(b, k.b));
    if (onTop && which(f)) {
      // Somewhere clear of everything but itself.
      const { at } = placeFor({ ...next, features: next.features.filter((x) => x.id !== f.id) }, b.maxX - b.minX, b.maxY - b.minY);
      next = moveFeature(next, f.id, at[0] - b.minX, at[1] - b.minY);
      kept.push({ f, b: { minX: at[0], minY: at[1], maxX: at[0] + b.maxX - b.minX, maxY: at[1] + b.maxY - b.minY } });
    } else kept.push({ f, b });
  }
  return next;
}

/** The first free place for something w × d: see `placeFor`. */
export const freeSpot = (g: Garden, w: number, d: number): Point => placeFor(g, w, d).at;

/**
 * A bed (or pot, planter, greenhouse, cold frame, patch of ground) added from the list: named, at its size or the usual
 * one, in the first free place. Returns the garden, the new bed's id, and whether it had to go outside the garden's
 * outline for want of room (the outline itself is left as it is).
 */
export function addListBed(g: Garden, kind: ListKind, name: string, size?: [number, number]): [Garden, string, boolean] {
  const [w, d] = size ?? LIST_SIZE[kind];
  const { at: [x, y], outside } = placeFor(g, w, kind === 'pot' ? w : d);
  const featureKind: FeatureKind = kind === 'ground' || kind === 'cardboard' ? 'surface' : kind === 'fruit-cage' ? 'bed' : kind;
  const shape = kind === 'pot' ? { circle: { centre: [x + w / 2, y + w / 2] as Point, radiusMm: w / 2 } } : { area: rectPoints({ x, y, w, h: d }) };
  let f = makeFeature(featureKind, shape);
  if (kind === 'ground') f = { ...f, material: 'soil' };
  // Cardboard laid over a weedy patch, to plant into its mulch; it gets a job to check it once it's rotted down.
  if (kind === 'cardboard') f = { ...f, material: 'cardboard' };
  // A fruit cage is a bed netted over: canes and bushes, kept out of the rotation.
  if (kind === 'fruit-cage') f = { ...f, fruitCage: true };
  if (name.trim()) f = { ...f, name: name.trim() };
  return [addFeature(g, f), f.id, outside];
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
 * Names for a list: beds that would show the same name ("Bed", "Bed") are numbered, "Bed 1", "Bed 2", and a "Bed" added
 * after them is "Bed 3", so each card can be told apart. Names you gave that are already different are left alone.
 */
export function nameListBeds(g: Garden, isListed: (f: Feature) => boolean, labelOf: (f: Feature) => string): Garden {
  const listed = g.features.filter(isListed);
  const counts = new Map<string, number>();
  for (const f of listed) counts.set(labelOf(f), (counts.get(labelOf(f)) ?? 0) + 1);
  const used = new Set(listed.map(labelOf));
  // "Bed" beside "Bed 1" and "Bed 2" is numbered too: it's the next one added.
  const numbered = (label: string) => [...used].some((u) => u.startsWith(`${label} `) && /^\d+$/.test(u.slice(label.length + 1)));
  const renamed = new Map<string, string>();
  for (const f of listed) {
    const label = labelOf(f);
    if ((counts.get(label) ?? 0) < 2 && !numbered(label)) continue;
    let n = 1;
    while (used.has(`${label} ${n}`)) n++;
    used.add(`${label} ${n}`);
    renamed.set(f.id, `${label} ${n}`);
  }
  if (!renamed.size) return g;
  return { ...g, features: g.features.map((f) => (renamed.has(f.id) ? { ...f, name: renamed.get(f.id)! } : f)) };
}

/** The kind to add from the list that a bed is, if it's one the list adds. */
export function listKindOf(f: Feature): ListKind | null {
  const kind = f.kind === 'surface' ? (f.material === 'cardboard' ? 'cardboard' : 'ground') : f.fruitCage ? 'fruit-cage' : f.kind;
  return (LIST_KINDS as readonly string[]).includes(kind) ? (kind as ListKind) : null;
}

/** The next free name after this one: "Bed 3" after "Bed 2", "Veg 2" after "Veg". */
export function nextName(label: string, used: Set<string>): string {
  const m = /^(.*\S)\s+(\d+)$/.exec(label);
  const stem = m ? m[1]! : label;
  let n = m ? Number(m[2]) + 1 : 2;
  while (used.has(`${stem} ${n}`)) n++;
  return `${stem} ${n}`;
}

/**
 * Another bed like this one, empty: the same kind, size, sun and soil, in the next free place, under the next free name
 * ("Bed 3" after "Bed 2"), so the one copied keeps its own. Null for something the list doesn't add. Returns the garden,
 * the copy's id, and whether it went outside the outline.
 */
export function copyListBed(g: Garden, id: string, labelOf: (f: Feature) => string = (x) => x.name ?? ''): [Garden, string, boolean] | null {
  const f = g.features.find((x) => x.id === id);
  const kind = f && listKindOf(f);
  const b = f && bounds(f.footprint);
  if (!f || !kind || !b) return null;
  const size: [number, number] = f.circle ? [f.circle.radiusMm * 2, f.circle.radiusMm * 2] : [Math.round(b.maxX - b.minX), Math.round(b.maxY - b.minY)];
  const label = labelOf(f);
  const name = label ? nextName(label, new Set(g.features.map(labelOf))) : '';
  const [next, copy, outside] = addListBed(g, kind, name, size);
  const keep: Partial<Feature> = { ...(f.light ? { light: f.light } : {}), ...(f.soil ? { soil: f.soil } : {}), ...(f.ph !== undefined ? { ph: f.ph } : {}), ...(f.edging ? { edging: f.edging } : {}) };
  return [{ ...next, features: next.features.map((x) => (x.id === copy ? { ...x, ...keep } : x)) }, copy, outside];
}
