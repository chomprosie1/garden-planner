// The shadow each feature casts on flat ground.
//
// Something with a footprint and a height is a prism. Its shadow is its
// footprint plus, for each edge, the band the edge sweeps as it is pushed
// along the shadow direction. That is exact for any outline, convex or not.
// A tree is its canopy: a disc lifted off the ground, whose shadow runs from
// the canopy's underside to its top.

import { circlePolygon } from '../model/features';
import { convexHull } from '../geometry/hull';
import { signedArea } from '../geometry/polygon';
import type { Feature, Garden, Point } from '../model/types';
import { shadowOffset, type Sun } from './position';

/** The part of a tree's height that is bare trunk, below the canopy. */
export const TRUNK_SHARE = 0.35;
/** Months deciduous trees and hedges are in leaf (UK average). */
export const LEAF_MONTHS = [5, 6, 7, 8, 9, 10];

export interface Shade {
  featureId: string;
  /** Polygons whose union is the shadow, all anticlockwise. */
  polygons: Point[][];
  /** Share of light blocked, 0 to 1. */
  opacity: number;
  /** The feature's own footprint: things on top of it aren't in its shadow. */
  own: Point[];
}

/** How much light a feature blocks in a month. Solid things block it all. */
export function opacityFor(f: Feature, month: number): number {
  const inLeaf = !f.deciduous || LEAF_MONTHS.includes(month);
  const o = inLeaf ? f.opacityInLeaf : (f.opacityBare ?? f.opacityInLeaf);
  return Math.max(0, Math.min(1, o ?? 1));
}

const anticlockwise = (poly: Point[]): Point[] => (signedArea(poly) < 0 ? [...poly].reverse() : poly);
const add = (p: Point, v: Point, k = 1): Point => [p[0] + v[0] * k, p[1] + v[1] * k];

/** The shadow of one feature, given where the top of a 1 mm tall thing's shadow falls. null if it casts none. */
export function featureShadow(f: Feature, perMm: Point, month: number): Shade | null {
  const h = f.heightMm ?? 0;
  const opacity = opacityFor(f, month);
  if (h <= 0 || opacity <= 0 || f.footprint.length < 3) return null;
  const v: Point = [perMm[0] * h, perMm[1] * h];

  if (f.circle) {
    const { centre, radiusMm } = f.circle;
    const ring = circlePolygon(centre, radiusMm, 32);
    const low = ring.map((p) => add(p, v, TRUNK_SHARE));
    const high = ring.map((p) => add(p, v));
    return { featureId: f.id, polygons: [convexHull([...low, ...high])], opacity, own: f.footprint };
  }

  const base = anticlockwise(f.footprint);
  const polygons: Point[][] = [base];
  for (let i = 0; i < base.length; i++) {
    const a = base[i]!;
    const b = base[(i + 1) % base.length]!;
    const band = anticlockwise([a, b, add(b, v), add(a, v)]);
    if (Math.abs(signedArea(band)) > 1) polygons.push(band);
  }
  return { featureId: f.id, polygons, opacity, own: f.footprint };
}

/** Every shadow in the garden at one moment. Empty when the sun is down. */
export function shadowsAt(g: Garden, sun: Sun, month: number): Shade[] {
  const unit = shadowOffset(1000, sun, g.northRotationDeg);
  if (!unit) return [];
  const perMm: Point = [unit[0] / 1000, unit[1] / 1000];
  return g.features.map((f) => featureShadow(f, perMm, month)).filter((s): s is Shade => s !== null);
}
