// Plants along a fence, wall or hedge, and up a trellis, arch or obelisk. A
// planting along a line is an ordinary planting: one plant, or a row, set just
// off the line on the side it was dropped. Pure functions.

import { centroid, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import { centreLineOf, featureLabel, KINDS, makeFeature, placeLabel } from '../model/features';
import { FRUIT_TREE_PLANTS } from '../model/trees';
import type { Feature, FeatureKind, Garden, Plant, Planting, Point } from '../model/types';

/** Lines plants can grow along. A trellis is a fence. */
export const LINE_SUPPORT_KINDS: FeatureKind[] = ['fence', 'wall', 'hedge'];

/** A dropped plant this near a line's face still counts as along it. */
export const REACH_MM = 400;
/** Plants along a line sit this far out from its face. */
export const OFFSET_MM = 200;
/** A dropped plant this near an arch or obelisk counts as on it. */
const FRAME_REACH_MM = 250;

/**
 * A fence, wall or hedge: plants can go along either side. Not next door's, and not something almost see-through (a
 * washing line).
 */
export const isLineSupport = (f: Feature) => LINE_SUPPORT_KINDS.includes(f.kind) && !!f.line && f.line.length >= 2 && !f.nextDoor && (f.opacityInLeaf ?? 1) >= 0.2;

/** An arch or obelisk: a frame with one climber, at a leg or in the middle. */
export const isFrame = (f: Feature) => (f.support === 'arch' || f.support === 'obelisk') && f.footprint.length >= 3;

export const isSupport = (f: Feature) => isLineSupport(f) || isFrame(f);

/** A trellis, arch or obelisk holds one climber. */
export const holdsOne = (f: Feature) => !!f.support;

/** Fruit trees often trained flat against a fence or wall, as cordons, espaliers or fans. */
export const TRAINED_FRUIT = FRUIT_TREE_PLANTS.filter((id) => ['apple', 'pear', 'plum', 'cherry', 'morello-cherry', 'fig', 'peach', 'apricot', 'greengage'].includes(id));

/** A climber, or fruit to train: it goes up a fence it's dropped by, rather than in the bed in front. */
export const climbs = (p: Plant) => p.category !== 'weed' && (p.art?.form === 'climber' || TRAINED_FRUIT.includes(p.varietyOf ?? p.id));

/** A climber that comes back each year (clematis, a vine), or fruit to train: not an annual such as sweet peas or beans. */
export const trainsUp = (p: Plant) => climbs(p) && (p.art?.form !== 'climber' || p.category === 'shrub' || p.category === 'fruit');

/**
 * What to offer for a fence, wall or frame: climbers that come back each year first, then trained fruit, then annual
 * climbers (sweet peas, beans). Each group keeps the order given. Varieties are left out, as in the plant lists.
 */
export function forSupports(plants: Plant[]): Plant[] {
  const rank = (p: Plant) => (p.art?.form !== 'climber' ? 1 : p.category === 'shrub' || p.category === 'fruit' ? 0 : 2);
  // The ones most people know, first in each group; the rest keep the order given.
  const known = (p: Plant) => {
    const i = FAMILIAR_CLIMBERS.indexOf(p.id);
    return i < 0 ? FAMILIAR_CLIMBERS.length : i;
  };
  return plants
    .filter((p) => !p.varietyOf && climbs(p))
    .map((p, i) => ({ p, i, r: rank(p), k: known(p) }))
    .sort((a, b) => a.r - b.r || a.k - b.k || a.i - b.i)
    .map((x) => x.p);
}

/** Climbers most people know, in the order they're offered. */
const FAMILIAR_CLIMBERS = ['clematis', 'climbing-rose', 'honeysuckle', 'star-jasmine', 'wisteria', 'common-jasmine', 'passion-flower', 'climbing-hydrangea', 'winter-jasmine', 'grape-vine', 'apple', 'pear', 'plum', 'cherry', 'fig', 'sweet-pea', 'runner-bean', 'pea', 'cucumber'];

const halfWidth = (f: Feature) => (f.widthMm ?? KINDS[f.kind].widthMm ?? 100) / 2;

interface OnLine {
  /** From the centre line. */
  d: number;
  point: Point;
  a: Point;
  b: Point;
  /** 1 on the left of the line looking from a to b, -1 on the right. */
  side: 1 | -1;
}

/** The nearest point on a line feature's centre line to p, the stretch it's on, and which side p is. */
export function nearestOnLine(f: Feature, p: Point): OnLine | null {
  const line = centreLineOf(f);
  let best: OnLine | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const r = distanceToSegment(p, a, b);
    if (best && r.distance >= best.d) continue;
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    best = { d: r.distance, point: r.point, a, b, side: cross < 0 ? -1 : 1 };
  }
  return best;
}

const distanceToOutline = (p: Point, poly: Point[]) => Math.min(...poly.map((a, i) => distanceToSegment(p, a, poly[(i + 1) % poly.length]!).distance));

/** True when a point is near enough a support for a plant there to be on it. */
export function holdsPoint(f: Feature, p: Point): boolean {
  if (isLineSupport(f)) {
    const n = nearestOnLine(f, p);
    return !!n && n.d <= halfWidth(f) + REACH_MM;
  }
  if (isFrame(f)) return pointInPolygon(p, f.footprint) || distanceToOutline(p, f.footprint) <= FRAME_REACH_MM;
  return false;
}

/** The nearest support that would hold a plant at p: a frame before a line, as it stands in front of it. */
export function supportAt(g: Garden, p: Point): Feature | null {
  let best: { f: Feature; d: number } | null = null;
  for (const f of g.features) {
    if (!isSupport(f) || !holdsPoint(f, p)) continue;
    const d = isFrame(f) ? -1 : nearestOnLine(f, p)!.d;
    if (!best || d < best.d) best = { f, d };
  }
  return best?.f ?? null;
}

/** Where a planting is, in words: "in Bed 1", "along the fence", "up the obelisk". */
export function wherePhrase(f: Feature | undefined): string {
  if (!f) return 'in a bed';
  if (isLineSupport(f)) return `along the ${featureLabel(f).toLowerCase()}`;
  if (isFrame(f)) return `up the ${featureLabel(f).toLowerCase()}`;
  return `in ${placeLabel(f)}`;
}

/** Which way a line runs at p, radians in garden coordinates: plants along it are trained that way. Null off a line. */
export function trainedAngle(f: Feature, p: Point): number | null {
  if (!isLineSupport(f)) return null;
  const n = nearestOnLine(f, p);
  return n ? Math.atan2(n.b[1] - n.a[1], n.b[0] - n.a[0]) : null;
}

/** p moved onto the line that runs beside a support, on one side, just off its face. */
function beside(f: Feature, n: OnLine, at: Point, side: 1 | -1): Point {
  const len = Math.hypot(n.b[0] - n.a[0], n.b[1] - n.a[1]) || 1;
  const nx = (-(n.b[1] - n.a[1]) / len) * side;
  const ny = ((n.b[0] - n.a[0]) / len) * side;
  const off = halfWidth(f) + OFFSET_MM;
  return [Math.round(at[0] + nx * off), Math.round(at[1] + ny * off)];
}

/** The two legs of an arch: the middles of its short sides, a little in. */
function legs(f: Feature): [Point, Point] {
  const pts = f.footprint;
  const mid = centroid(pts);
  const sides = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    return { len: Math.hypot(b[0] - a[0], b[1] - a[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point };
  });
  const short = [...sides].sort((x, y) => x.len - y.len).slice(0, 2);
  const inward = (m: Point): Point => {
    const d = Math.hypot(mid[0] - m[0], mid[1] - m[1]) || 1;
    const k = Math.min(100, d) / d;
    return [Math.round(m[0] + (mid[0] - m[0]) * k), Math.round(m[1] + (mid[1] - m[1]) * k)];
  };
  return [inward(short[0]!.m), inward(short[1]!.m)];
}

/** Where a frame's climber goes: an obelisk's middle, or an arch's nearer leg. */
function framePoint(f: Feature, at: Point): Point {
  const p = f.support === 'obelisk' ? (f.circle?.centre ?? centroid(f.footprint)) : nearer(legs(f), at);
  return [Math.round(p[0]), Math.round(p[1])];
}

export type SupportFill = 'one' | 'row';
type Placed = Pick<Planting, 'layout' | 'x' | 'y'> & Partial<Pick<Planting, 'endPoint' | 'count'>>;

/**
 * Where a plant dropped by a support goes: on a line, one beside it where it was dropped, or a row along the whole
 * stretch of it there, half a spacing in from each end, on the side it was dropped; on an obelisk, in the middle; on an
 * arch, at the nearer leg. A stretch too short for two plants gets one.
 */
export function alongSupport(f: Feature, plant: Plant, fill: SupportFill, at: Point): Placed {
  if (isFrame(f)) {
    const [x, y] = framePoint(f, at);
    return { layout: 'single', x, y };
  }
  const n = nearestOnLine(f, at);
  if (!n) return { layout: 'single', x: Math.round(at[0]), y: Math.round(at[1]) };
  const one = (): Placed => {
    const [x, y] = beside(f, n, n.point, n.side);
    return { layout: 'single', x, y };
  };
  if (fill === 'one') return one();
  const s = plant.size.spacingMm;
  const len = Math.hypot(n.b[0] - n.a[0], n.b[1] - n.a[1]);
  if (len < s * 1.5) return one();
  const k = s / 2 / len;
  const start = beside(f, n, [n.a[0] + (n.b[0] - n.a[0]) * k, n.a[1] + (n.b[1] - n.a[1]) * k], n.side);
  const end = beside(f, n, [n.b[0] - (n.b[0] - n.a[0]) * k, n.b[1] - (n.b[1] - n.a[1]) * k], n.side);
  return { layout: 'row', x: start[0], y: start[1], endPoint: end, count: Math.floor(Math.hypot(end[0] - start[0], end[1] - start[1]) / s + 1e-6) + 1 };
}

/** A row or single plant drawn by hand by a support: its ends moved beside the line, on the side of its middle. */
export function besideSupport(f: Feature, start: Point, end?: Point): [Point, Point | undefined] {
  if (isFrame(f)) return [framePoint(f, start), undefined];
  const middle: Point = end ? [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] : start;
  const side = nearestOnLine(f, middle)?.side ?? 1;
  const move = (p: Point): Point => {
    const n = nearestOnLine(f, p);
    return n ? beside(f, n, n.point, side) : p;
  };
  return [move(start), end ? move(end) : undefined];
}

/** Which fills make sense on a support: a row needs a stretch of line with room for two plants. */
export function supportFills(f: Feature, plant: Plant, at: Point): SupportFill[] {
  if (!isLineSupport(f)) return ['one'];
  const n = nearestOnLine(f, at);
  const len = n ? Math.hypot(n.b[0] - n.a[0], n.b[1] - n.a[1]) : 0;
  return len >= plant.size.spacingMm * 2 ? ['one', 'row'] : ['one'];
}

/**
 * Most gardens have their boundary drawn but not the fence along it. A climber dropped by the boundary, with no fence,
 * wall or hedge there, gets a fence along that side of the boundary to grow up: this is it, or null away from the
 * boundary.
 */
export function boundaryFence(g: Garden, p: Point): Feature | null {
  const b = g.boundary;
  if (b.length < 3 || supportAt(g, p)) return null;
  let best: { a: Point; c: Point; d: number } | null = null;
  for (let i = 0; i < b.length; i++) {
    const a = b[i]!;
    const c = b[(i + 1) % b.length]!;
    const d = distanceToSegment(p, a, c).distance;
    if (!best || d < best.d) best = { a, c, d };
  }
  const half = (KINDS.fence.widthMm ?? 50) / 2;
  if (!best || best.d > half + REACH_MM) return null;
  // A fence, wall or hedge already drawn along part of this side: no second one over it.
  const { a, c } = best;
  const alongEdge = (q: Point) => distanceToSegment(q, a, c).distance <= half + REACH_MM;
  const line = (f: Feature) => centreLineOf(f);
  if (g.features.some((f) => isLineSupport(f) && line(f).some((q, i, l) => i > 0 && alongEdge(q) && alongEdge(l[i - 1]!)))) return null;
  return makeFeature('fence', { line: [a, c] });
}

const nearer = ([a, b]: [Point, Point], p: Point): Point => (Math.hypot(a[0] - p[0], a[1] - p[1]) <= Math.hypot(b[0] - p[0], b[1] - p[1]) ? a : b);
