// Walking through the garden at eye height: what you can't walk through, and
// moving with that in mind. Pure functions over a scene from scene.ts, in
// garden millimetres, so they're tested without WebGL. src/three/view.ts moves
// the camera with them.

import { distanceToSegment, pointInPolygon } from '../geometry/polygon';
import type { Point } from '../model/types';
import type { Scene3 } from './scene';

/** Eye height, mm. */
export const EYE_MM = 1600;
/** How close you can get to anything: enough to turn sideways down a 30 cm path between beds. */
export const BODY_MM = 150;
/** How far past the garden's edge you can walk, mm: the same as the view lets you move. */
export const EDGE_MM = 3000;
/** Walking pace, mm a second: an easy stroll. */
export const PACE_MM = 1400;

/** Something in the way: an outline, or a circle (a pot, a tree's trunk). */
export type Obstacle = { name: string; polygon: Point[] } | { name: string; centre: Point; radiusMm: number };

/**
 * Everything you can't walk through: buildings, greenhouses, walls, fences, hedges, beds, pots, compost bins and
 * ponds, and the trunks of trees. Lawns, paths and paving are open ground.
 */
export function obstaclesOf(s: Scene3): Obstacle[] {
  const out: Obstacle[] = [];
  for (const x of s.solids) {
    if (x.circle) out.push({ name: x.name, centre: x.circle.centre, radiusMm: x.circle.radiusMm });
    else if (x.polygon.length >= 3) out.push({ name: x.name, polygon: x.polygon });
  }
  for (const f of s.flats) if (f.material === 'water') out.push({ name: f.name, polygon: f.polygon });
  // A tree's trunk, not its canopy: you can stand under a tree.
  for (const t of s.trees) if (!t.ghost) out.push({ name: t.name, centre: t.centre, radiusMm: Math.max(100, Math.min(300, t.spreadMm * 0.04)) });
  return out;
}

/** How far a point is from an obstacle's edge; 0 or less inside it. */
function clearance(o: Obstacle, p: Point): number {
  if ('centre' in o) return Math.hypot(p[0] - o.centre[0], p[1] - o.centre[1]) - o.radiusMm;
  if (pointInPolygon(p, o.polygon)) return 0;
  let d = Infinity;
  for (let i = 0; i < o.polygon.length; i++) d = Math.min(d, distanceToSegment(p, o.polygon[i]!, o.polygon[(i + 1) % o.polygon.length]!).distance);
  return d;
}

/** How far a point is from the nearest obstacle. */
const clearOf = (obstacles: Obstacle[], p: Point) => obstacles.reduce((d, o) => Math.min(d, clearance(o, p)), Infinity);

/** The area you can walk in: the garden and a little round it. */
const inArea = (s: Scene3, p: Point) => p[0] >= s.bounds.min[0] - EDGE_MM && p[0] <= s.bounds.max[0] + EDGE_MM && p[1] >= s.bounds.min[1] - EDGE_MM && p[1] <= s.bounds.max[1] + EDGE_MM;

/** Whether you can stand here: inside the walking area, and a body's width from everything. */
export function canStand(s: Scene3, obstacles: Obstacle[], p: Point): boolean {
  return inArea(s, p) && clearOf(obstacles, p) >= BODY_MM;
}

/**
 * A step from one spot towards another. Blocked straight on, it slides along whatever's in the way (along a wall, round
 * a bed's corner), as walking does; blocked both ways, it stays put. Somewhere too close to something (a tree that grew
 * as the date moved on), any step away from it is allowed, so you're never stuck.
 */
export function step(s: Scene3, obstacles: Obstacle[], from: Point, to: Point): Point {
  // A long step (a slow frame) is taken in strides, so it can't hop a fence.
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) > BODY_MM / 2) return walk(s, obstacles, from, to);
  const here = clearOf(obstacles, from);
  const ok = (p: Point) => canStand(s, obstacles, p) || (here < BODY_MM && inArea(s, p) && clearOf(obstacles, p) > here);
  if (ok(to)) return to;
  const alongX: Point = [to[0], from[1]];
  const alongY: Point = [from[0], to[1]];
  const dx = Math.abs(to[0] - from[0]);
  const dy = Math.abs(to[1] - from[1]);
  // Slide the way you were mostly going first.
  for (const p of dx >= dy ? [alongX, alongY] : [alongY, alongX]) if ((p[0] !== from[0] || p[1] !== from[1]) && ok(p)) return p;
  return from;
}

/** Walks a distance from a spot, in small steps so it never jumps through a fence. */
export function walk(s: Scene3, obstacles: Obstacle[], from: Point, to: Point): Point {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.ceil(d / (BODY_MM / 2)));
  const stride: Point = [(to[0] - from[0]) / n, (to[1] - from[1]) / n];
  let at = from;
  for (let i = 1; i <= n; i++) {
    const moved = step(s, obstacles, at, [at[0] + stride[0], at[1] + stride[1]]);
    if (moved[0] === at[0] && moved[1] === at[1]) break;
    at = moved;
  }
  return at;
}

/**
 * Where you start walking, and which way you face: in from the bottom edge of the plan, looking up it (as from the
 * house), at the nearest spot you can stand. Searches outwards if the middle is taken.
 */
export function walkStart(s: Scene3, obstacles: Obstacle[]): { at: Point; heading: number } {
  const { min, max } = s.bounds;
  const cx = (min[0] + max[0]) / 2;
  const heading = Math.PI / 2;
  // Inside the garden first, from just in from its bottom edge, then a little outside it.
  for (const y of [min[1] + 600, min[1] + 1200, min[1] + 2000, min[1] - 600])
    for (let k = 0; k <= 40; k++) {
      const dx = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 300;
      const p: Point = [Math.round(cx + dx), Math.round(y)];
      if (p[0] < min[0] - EDGE_MM || p[0] > max[0] + EDGE_MM) continue;
      if (canStand(s, obstacles, p)) return { at: p, heading };
    }
  return { at: [Math.round(cx), Math.round(min[1] - EDGE_MM / 2)], heading };
}

/** Where a tap on the ground walks you to: the nearest spot you can stand on the way there, or null if you can't move. */
export function walkTowards(s: Scene3, obstacles: Obstacle[], from: Point, target: Point): Point | null {
  const end = walk(s, obstacles, from, target);
  return Math.hypot(end[0] - from[0], end[1] - from[1]) < 50 ? null : end;
}
