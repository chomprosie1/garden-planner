// "Where are you growing?": the space a first plan starts from. Each makes a
// boundary at the size you give (except a single bed), the ground, and a few
// beds or pots to drop plants into, so the first plant is a few taps away.

import { addFeature, makeFeature, rectPoints } from './features';
import type { Feature, FeatureKind, Garden, Point } from './types';

export type Space = 'balcony' | 'patio' | 'garden' | 'allotment' | 'bed';

export interface SpaceInfo {
  id: Space;
  label: string;
  hint: string;
  /** Width and depth to start from, mm. */
  size: [number, number];
  /** Smallest width and depth that make sense, mm. */
  min: [number, number];
}

export const SPACES: SpaceInfo[] = [
  { id: 'balcony', label: 'Balcony', hint: 'Pots and a trough along the railing', size: [3000, 1500], min: [1000, 600] },
  { id: 'patio', label: 'Patio or yard', hint: 'Paving, with pots and a raised bed', size: [5000, 4000], min: [1500, 1500] },
  { id: 'garden', label: 'Garden', hint: 'A lawn, a border and raised beds', size: [10000, 14000], min: [3000, 3000] },
  { id: 'allotment', label: 'Allotment', hint: 'A full plot is about 250 m², a half plot 125 m²', size: [10000, 25000], min: [3000, 5000] },
  { id: 'bed', label: 'Just a bed', hint: 'One raised bed, nothing round it', size: [2400, 1200], min: [300, 300] },
];

/** Allotment plots: a full plot (10 rods, about 250 m²) and a half plot. */
export const PLOTS: Record<'full' | 'half', [number, number]> = { full: [10000, 25000], half: [5000, 25000] };

/** The largest space the first run makes: 100 m each way. */
export const MAX_SPACE_MM = 100000;

export const spaceInfo = (id: Space) => SPACES.find((s) => s.id === id)!;

const box = (kind: FeatureKind, x: number, y: number, w: number, h: number, extra: Partial<Feature> = {}): Feature => ({
  ...makeFeature(kind, { area: rectPoints({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }) }),
  ...extra,
});
const pot = (x: number, y: number, r: number): Feature => makeFeature('pot', { circle: { centre: [Math.round(x), Math.round(y)], radiusMm: r } });

/** What each space starts with, in a w × d rectangle with (0, 0) at the bottom left. */
function contents(space: Space, w: number, d: number): Feature[] {
  const out: Feature[] = [];
  switch (space) {
    case 'balcony': {
      out.push(box('surface', 0, 0, w, d, { material: 'decking' }));
      // A trough along the railing, at the top of the plan.
      const deep = d >= 900 ? 300 : 200;
      const long = Math.max(600, Math.min(2000, w - 400));
      out.push(box('planter', (w - long) / 2, d - 100 - deep, long, deep));
      // Pots below it, in the right-hand corner, if there's room.
      if (d - 100 - deep - 100 >= 500) {
        out.push(pot(w - 350, 350, 250));
        if (w >= 1200) out.push(pot(w - 950, 250, 150));
      }
      break;
    }
    case 'patio': {
      out.push(box('surface', 0, 0, w, d, { material: 'paving' }));
      if (w >= 2000 && d >= 2000) out.push(box('bed', 300, d - 1500, 1200, 1200, { edging: 'timber' }));
      else out.push(box('planter', 300, d - 700, Math.min(1000, w - 600), 400));
      out.push(pot(w - 550, 550, 250));
      if (w >= 2400) out.push(pot(w - 1150, 450, 150));
      break;
    }
    case 'garden': {
      // A border along the top, raised beds below it, and a lawn below them.
      const borderTop = d - 500;
      out.push(box('bed', 500, borderTop - 1000, w - 1000, 1000, { name: 'Border' }));
      let lawnTop = borderTop - 1000 - 500;
      const bedY = borderTop - 1000 - 1000 - 1200;
      const beds = w >= 7800 ? 2 : w >= 4400 ? 1 : 0;
      if (beds && bedY >= 2500) {
        for (let i = 0; i < beds; i++) out.push(box('bed', 1000 + i * 3400, bedY, 2400, 1200, { edging: 'timber' }));
        lawnTop = bedY - 1000;
      }
      if (lawnTop - 500 >= 1500) out.push(box('surface', 500, 500, w - 1000, lawnTop - 500, { material: 'lawn' }));
      break;
    }
    case 'allotment': {
      // Beds across the plot with paths between, in its top 60%; the rest is left open, with a compost bin.
      const n = Math.max(1, Math.min(8, Math.floor((d * 0.6) / 1800)));
      for (let i = 0; i < n; i++) out.push(box('bed', 500, d - 500 - 1200 - i * 1800, w - 1000, 1200));
      out.push(box('compost', 500, 500, 1000, 1000));
      break;
    }
    case 'bed':
      out.push(box('bed', 0, 0, w, d, { edging: 'timber' }));
      break;
  }
  return out;
}

/**
 * A side return: beside the house's back extension, a narrow strip of garden runs down its side, so the garden is an
 * L. The strip is `width` wide and `length` long, on the left (or the right); the extension fills the rest of that end.
 */
export interface SideReturn {
  width: number;
  length: number;
  onRight?: boolean;
}

/** Spaces with a house at the bottom of the plan, which can have a side return. */
export const HAS_HOUSE: readonly Space[] = ['garden', 'patio'];

/** How deep the house is drawn below the garden, mm: enough for its shadow, not the whole house. */
export const HOUSE_DEPTH_MM = 4000;

/** The smallest side return: 600 mm wide and 1 m long. Beside and above it, at least 1.5 m of garden. */
const RETURN_MIN: SideReturn = { width: 600, length: 1000 };
const ROOM_MM = 1500;

/**
 * A side return that fits: at least 600 mm wide and 1 m long, leaving at least 1.5 m beside it and above it, and no
 * longer than half the garden. Null when the garden is too small for one, so it stays a rectangle.
 */
export function fitSideReturn(r: SideReturn, w: number, d: number): SideReturn | null {
  const maxWidth = w - ROOM_MM;
  const maxLength = Math.min(d / 2, d - ROOM_MM);
  if (maxWidth < RETURN_MIN.width || maxLength < RETURN_MIN.length) return null;
  return {
    width: Math.round(Math.max(RETURN_MIN.width, Math.min(maxWidth, r.width))),
    length: Math.round(Math.max(RETURN_MIN.length, Math.min(maxLength, r.length))),
    ...(r.onRight ? { onRight: true } : {}),
  };
}

/** Where the strip starts across the garden, and where the extension does. */
const sides = (w: number, s: SideReturn) => (s.onRight ? { strip: w - s.width, ext: 0 } : { strip: 0, ext: s.width });

/** The boundary: a rectangle, or an L with the side return down one side. (0, 0) is the bottom left. */
export function spaceBoundary(w: number, d: number, side: SideReturn | null = null): Point[] {
  if (!side) return rectPoints({ x: 0, y: 0, w, h: d });
  const { width, length } = side;
  if (side.onRight)
    return [
      [w - width, 0],
      [w, 0],
      [w, d],
      [0, d],
      [0, length],
      [w - width, length],
    ];
  return [
    [0, 0],
    [width, 0],
    [width, length],
    [w, length],
    [w, d],
    [0, d],
  ];
}

/** The house along the bottom of the plan, and with a side return its back extension beside the strip. */
function house(w: number, side: SideReturn | null): Feature[] {
  const out = [box('building', 0, -HOUSE_DEPTH_MM, w, HOUSE_DEPTH_MM, { name: 'House', heightMm: 7500 })];
  if (side) out.push(box('building', sides(w, side).ext, 0, w - side.width, side.length, { name: 'Extension', heightMm: 3000 }));
  return out;
}

/** Moves a feature up the plan, to sit above a side return: its outline, line, curve corners or centre. */
const raise = (f: Feature, dy: number): Feature => {
  const up = (p: Point): Point => [p[0], p[1] + dy];
  return {
    ...f,
    footprint: f.footprint.map(up),
    ...(f.line ? { line: f.line.map(up) } : {}),
    ...(f.controls ? { controls: f.controls.map(up) } : {}),
    ...(f.circle ? { circle: { ...f.circle, centre: up(f.circle.centre) } } : {}),
  };
};

/**
 * The garden with this space laid out in it, at w × d mm. A single bed has no boundary. A garden or patio gets the
 * house along the bottom, and with a side return, an L-shaped boundary with a path down the strip.
 */
export function makeSpace(g: Garden, space: Space, w: number, d: number, sideReturn: SideReturn | null = null): Garden {
  const info = spaceInfo(space);
  const W = Math.round(Math.min(MAX_SPACE_MM, Math.max(info.min[0], w)));
  const D = Math.round(Math.min(MAX_SPACE_MM, Math.max(info.min[1], d)));
  const side = sideReturn && HAS_HOUSE.includes(space) ? fitSideReturn(sideReturn, W, D) : null;
  let next: Garden = space === 'bed' || g.boundary.length >= 3 ? g : { ...g, boundary: spaceBoundary(W, D, side) };
  if (HAS_HOUSE.includes(space)) for (const f of house(W, side)) next = addFeature(next, f);
  if (side) next = addFeature(next, box('surface', sides(W, side).strip, 0, side.width, side.length, { material: 'paving', name: 'Side return' }));
  // With a side return, the rest is laid out above it, in the part that's full width.
  for (const f of contents(space, W, side ? D - side.length : D)) next = addFeature(next, side ? raise(f, side.length) : f);
  // A garden still called "My garden" is named after the space.
  if (g.name === 'My garden' && space !== 'garden' && space !== 'bed') next = { ...next, name: `My ${space === 'patio' ? 'patio' : space}` };
  return next;
}

/** Metres for a size field: "2.4", "10". */
export const metres = (mm: number) => String(+(mm / 1000).toFixed(2));
