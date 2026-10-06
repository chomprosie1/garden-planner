// What each kind of feature is, its sensible defaults, and the edits the
// plan's tools make. Every edit returns a new Garden, so each is one undo step.

import { bounds, type Bounds } from '../geometry/polygon';
import { thickenLine } from '../geometry/thicken';
import { newId } from './ids';
import type { Feature, FeatureKind, Garden, Point } from './types';

export type Geometry = 'area' | 'line' | 'circle';

export interface KindInfo {
  kind: FeatureKind;
  label: string;
  geometry: Geometry;
  heightMm: number;
  widthMm?: number; // lines
  radiusMm?: number; // circles
  deciduous?: boolean;
  opacityInLeaf?: number;
  opacityBare?: number;
}

export const KINDS: Record<FeatureKind, KindInfo> = {
  bed: { kind: 'bed', label: 'Bed', geometry: 'area', heightMm: 300 },
  path: { kind: 'path', label: 'Path', geometry: 'line', heightMm: 0, widthMm: 900 },
  fence: { kind: 'fence', label: 'Fence', geometry: 'line', heightMm: 1800, widthMm: 50, opacityInLeaf: 1, opacityBare: 1 },
  wall: { kind: 'wall', label: 'Wall', geometry: 'line', heightMm: 2000, widthMm: 225, opacityInLeaf: 1, opacityBare: 1 },
  hedge: { kind: 'hedge', label: 'Hedge', geometry: 'line', heightMm: 1500, widthMm: 600, deciduous: false, opacityInLeaf: 0.85, opacityBare: 0.85 },
  building: { kind: 'building', label: 'Building', geometry: 'area', heightMm: 2400, opacityInLeaf: 1, opacityBare: 1 },
  greenhouse: { kind: 'greenhouse', label: 'Greenhouse', geometry: 'area', heightMm: 2200, opacityInLeaf: 0.3, opacityBare: 0.3 },
  tree: { kind: 'tree', label: 'Tree', geometry: 'circle', heightMm: 5000, radiusMm: 2000, deciduous: true, opacityInLeaf: 0.7, opacityBare: 0.2 },
  compost: { kind: 'compost', label: 'Compost', geometry: 'area', heightMm: 1000 },
  water: { kind: 'water', label: 'Water', geometry: 'area', heightMm: 0 },
  other: { kind: 'other', label: 'Other', geometry: 'area', heightMm: 1000 },
};

/** Kinds that can swap with each other without redrawing: same geometry. */
export const kindsWithGeometry = (g: Geometry): FeatureKind[] =>
  (Object.values(KINDS) as KindInfo[]).filter((k) => k.geometry === g).map((k) => k.kind);

export function geometryOf(f: Feature): Geometry {
  if (f.circle) return 'circle';
  if (f.line) return 'line';
  return 'area';
}

export function circlePolygon(centre: Point, radius: number, sides = 32): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push([Math.round(centre[0] + radius * Math.cos(a)), Math.round(centre[1] + radius * Math.sin(a))]);
  }
  return pts;
}

/** Recomputes the footprint of a line or circle feature from its source shape. */
export function withFootprint(f: Feature): Feature {
  if (f.circle) return { ...f, footprint: circlePolygon(f.circle.centre, f.circle.radiusMm) };
  if (f.line) return { ...f, footprint: thickenLine(f.line, f.widthMm ?? KINDS[f.kind].widthMm ?? 100) };
  return f;
}

export type Shape = { area: Point[] } | { line: Point[] } | { circle: { centre: Point; radiusMm: number } };

export function makeFeature(kind: FeatureKind, shape: Shape): Feature {
  const info = KINDS[kind];
  const base: Feature = { id: newId('f'), kind, footprint: [], heightMm: info.heightMm };
  if (info.deciduous !== undefined) base.deciduous = info.deciduous;
  if (info.opacityInLeaf !== undefined) base.opacityInLeaf = info.opacityInLeaf;
  if (info.opacityBare !== undefined) base.opacityBare = info.opacityBare;
  if ('area' in shape) return { ...base, footprint: shape.area.map(roundPoint) };
  if ('line' in shape) return withFootprint({ ...base, line: shape.line.map(roundPoint), widthMm: info.widthMm ?? 100 });
  return withFootprint({ ...base, circle: { centre: roundPoint(shape.circle.centre), radiusMm: Math.round(shape.circle.radiusMm) } });
}

export const roundPoint = (p: Point): Point => [Math.round(p[0]), Math.round(p[1])];

export const featureLabel = (f: Feature) => f.name?.trim() || KINDS[f.kind].label;

// ---------- Edits ----------

export const addFeature = (g: Garden, f: Feature): Garden => ({ ...g, features: [...g.features, f] });

export function updateFeature(g: Garden, id: string, patch: Partial<Feature>): Garden {
  let changed = false;
  const features = g.features.map((f) => {
    if (f.id !== id) return f;
    changed = true;
    const next = { ...f, ...patch };
    return patch.line || patch.circle || patch.widthMm !== undefined ? withFootprint(next) : next;
  });
  return changed ? { ...g, features } : g;
}

export function deleteFeatures(g: Garden, ids: string[]): Garden {
  const set = new Set(ids);
  const features = g.features.filter((f) => !set.has(f.id));
  return features.length === g.features.length ? g : { ...g, features };
}

const shift = (p: Point, dx: number, dy: number): Point => [Math.round(p[0] + dx), Math.round(p[1] + dy)];

export function moveFeature(g: Garden, id: string, dx: number, dy: number): Garden {
  if (dx === 0 && dy === 0) return g;
  return {
    ...g,
    features: g.features.map((f) =>
      f.id !== id
        ? f
        : {
            ...f,
            footprint: f.footprint.map((p) => shift(p, dx, dy)),
            ...(f.line ? { line: f.line.map((p) => shift(p, dx, dy)) } : {}),
            ...(f.circle ? { circle: { ...f.circle, centre: shift(f.circle.centre, dx, dy) } } : {}),
          },
    ),
  };
}

/** Copies a feature, offset so it doesn't sit exactly on top. Returns the garden and the copy's id. */
export function duplicateFeature(g: Garden, id: string, offsetMm = 500): [Garden, string | null] {
  const f = g.features.find((x) => x.id === id);
  if (!f) return [g, null];
  const copy = { ...f, id: newId('f') };
  const withCopy = { ...g, features: [...g.features, copy] };
  return [moveFeature(withCopy, copy.id, offsetMm, -offsetMm), copy.id];
}

/** Moves a feature to the top (drawn last) or bottom of the stack. */
export function restack(g: Garden, id: string, to: 'top' | 'bottom'): Garden {
  const f = g.features.find((x) => x.id === id);
  if (!f) return g;
  const rest = g.features.filter((x) => x.id !== id);
  return { ...g, features: to === 'top' ? [...rest, f] : [f, ...rest] };
}

// ---------- Points: the boundary, area outlines and line centre lines ----------

export type Target = { type: 'boundary' } | { type: 'feature'; id: string };

/** The editable points of a target: the boundary, an area's outline, or a line's centre line. */
export function pointsOf(g: Garden, t: Target): Point[] | null {
  if (t.type === 'boundary') return g.boundary;
  const f = g.features.find((x) => x.id === t.id);
  if (!f || f.circle) return null;
  return f.line ?? f.footprint;
}

/** True when the target is closed (a polygon) rather than an open line. */
export function isClosed(g: Garden, t: Target): boolean {
  if (t.type === 'boundary') return true;
  const f = g.features.find((x) => x.id === t.id);
  return !!f && !f.line;
}

export function setPoints(g: Garden, t: Target, points: Point[]): Garden {
  const pts = points.map(roundPoint);
  if (t.type === 'boundary') return { ...g, boundary: pts };
  const f = g.features.find((x) => x.id === t.id);
  if (!f) return g;
  return updateFeature(g, t.id, f.line ? { line: pts } : { footprint: pts });
}

export function moveVertex(g: Garden, t: Target, index: number, p: Point): Garden {
  const pts = pointsOf(g, t);
  if (!pts || index < 0 || index >= pts.length) return g;
  return setPoints(g, t, pts.map((q, i) => (i === index ? p : q)));
}

export function insertVertex(g: Garden, t: Target, afterIndex: number, p: Point): Garden {
  const pts = pointsOf(g, t);
  if (!pts) return g;
  return setPoints(g, t, [...pts.slice(0, afterIndex + 1), p, ...pts.slice(afterIndex + 1)]);
}

export function removeVertex(g: Garden, t: Target, index: number): Garden {
  const pts = pointsOf(g, t);
  const min = isClosed(g, t) ? 3 : 2;
  if (!pts || pts.length <= min) return g;
  return setPoints(g, t, pts.filter((_, i) => i !== index));
}

// ---------- Rectangles ----------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The rectangle a 4-point outline describes, if it is an upright rectangle. */
export function asRect(points: Point[]): Rect | null {
  if (points.length !== 4) return null;
  const b = bounds(points)!;
  const corners = points.every(([x, y]) => (x === b.minX || x === b.maxX) && (y === b.minY || y === b.maxY));
  const distinct = new Set(points.map((p) => `${p[0]},${p[1]}`)).size === 4;
  return corners && distinct ? { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY } : null;
}

export const rectPoints = (r: Rect): Point[] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
];

/** Resizes an upright rectangle, keeping its top-left corner where it is. */
export function resizeRect(points: Point[], w: number, h: number): Point[] | null {
  const r = asRect(points);
  if (!r || w <= 0 || h <= 0) return null;
  const top = r.y + r.h;
  return rectPoints({ x: r.x, y: top - h, w: Math.round(w), h: Math.round(h) });
}

/** Everything drawn, for fitting the view. */
export function gardenBounds(g: Garden): Bounds | null {
  return bounds([...g.boundary, ...g.features.flatMap((f) => f.footprint)]);
}
