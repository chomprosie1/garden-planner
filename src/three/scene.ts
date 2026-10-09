// The garden in 3D, worked out without WebGL: what stands where, how tall,
// and what it's made of, on a chosen day. Beds stand to their edging, walls,
// fences, hedges and buildings to their heights, trees take their shape (bare
// in winter), and each plant is placed at its stage on top of its bed or pot.
// The sun comes from the real sky over the garden that day.
//
// Everything is in garden millimetres: x along the plan, y up the plan, z up
// from the ground. src/three/view.ts turns this into three.js objects.

import { artFor, seasonal, stageLook, type Look } from '../art/plants';
import { lookKey } from '../art/sprites';
import { STAGE_LABEL, currentStage, type LifeStage } from '../lifecycle/stages';
import { isCover, microclimateAt } from '../climate/microclimate';
import { LAWN_BY_MONTH } from '../lifecycle/seasons';
import { frostDatesUnder } from '../lifecycle/shed';
import { featureLabel, pivotOf, placeLabel, rectInfo } from '../model/features';
import { treeType, type TreeLeaf, type TreeShape } from '../model/trees';
import type { Feature, Garden, Material, Plant, PlantArt, Planting, Point, Sketch } from '../model/types';
import { plantPositions, sizedPlant, spreadOf } from '../planting/place';
import { bearingToGarden, fromUkClock, sunAt } from '../sun/position';
import { LEAF_MONTHS, TRUNK_SHARE } from '../sun/shadow';

export interface Bounds3 {
  min: Point;
  max: Point;
}

/** Something flat on the ground: a lawn, a patio, a path, a pond. Later in the list is on top. */
export interface Flat {
  id: string;
  name: string;
  polygon: Point[];
  /** What it's made of; a plain path, or water. */
  material: Material | 'path' | 'water';
  layer: number;
}

export type SolidKind = 'bed' | 'planter' | 'pot' | 'cold-frame' | 'greenhouse' | 'building' | 'compost' | 'fence' | 'wall' | 'hedge' | 'other';

/** A pitched roof over a rectangle: its ridge, and how far the roof runs either side of it. */
export interface Roof {
  ridge: [Point, Point];
  /** Unit vector across the ridge, in plan. */
  across: Point;
  halfSpan: number;
  eavesMm: number;
}

/** Something that stands up: its outline (or circle), and its height. */
export interface Solid {
  id: string;
  name: string;
  kind: SolidKind;
  polygon: Point[];
  circle?: { centre: Point; radiusMm: number };
  heightMm: number;
  edging?: Feature['edging'];
  roof?: Roof;
  /** A deciduous hedge in winter. */
  bare?: boolean;
  /** Inside a greenhouse or cold frame (or one itself): no frost on it. */
  covered?: boolean;
}

export interface Tree3 {
  id: string;
  name: string;
  centre: Point;
  heightMm: number;
  spreadMm: number;
  shape: TreeShape;
  /** Deciduous, in winter: branches only. */
  bare: boolean;
  foliage: string;
  /** In blossom, or showing fruit: a fruit tree planted as a plant. */
  blossom?: string;
  fruit?: string;
  /** Only planned (or cleared by then): drawn faintly. */
  ghost?: boolean;
  /** The planting it is, for a fruit tree planted as a plant. */
  plantingId?: string;
  /** The shape of its leaves, for the leaf clusters its canopy is made of. */
  leaf: TreeLeaf;
}

/** One plant on the plan. */
export interface PlantSpot {
  x: number;
  y: number;
  /** The soil it grows in, above the ground. */
  baseMm: number;
  spreadMm: number;
  heightMm: number;
  /** A turn about its stem, radians, fixed by where it is. */
  turn: number;
  plantingId: string;
}

/** Plants drawn the same way: the same plant at the same stage, so one picture serves them all. */
export interface PlantGroup {
  key: string;
  plantId: string;
  art: PlantArt;
  look: Look;
  /** Its full size, for the picture's shape. */
  spreadMm: number;
  heightMm: number;
  spots: PlantSpot[];
}

export interface Sun3 {
  altitude: number;
  /** Unit vector towards the sun: x and y in plan, z up. */
  dir: [number, number, number];
}

export interface Scene3 {
  bounds: Bounds3;
  /** The garden's own ground: inside its boundary, or round everything if there isn't one. */
  ground: Point[];
  flats: Flat[];
  solids: Solid[];
  trees: Tree3[];
  groups: PlantGroup[];
  /** Plant pictures in all: what has to be drawn. */
  plantCount: number;
  /** Words for each planting, for a tap on it. */
  names: Record<string, string>;
  sun: Sun3 | null;
  month: number;
  /** The lawn in its season: above 0 greener (spring), below 0 paler (a dry August). */
  lawn: number;
  /** Frost on the ground on a frosty day: thick first thing, thinner once the sun's been on it (0 to 1). */
  frost: number;
  /** Pen marks, arrows and words from the plan, lying on the ground. */
  sketches: Sketch[];
}

export interface SceneInput {
  garden: Garden;
  plantOf: (id: string) => Plant;
  /** Each planting's stage on the day, from the year's timeline. Absent: as marked now. */
  stageOf?: (pl: Planting) => { stage: LifeStage; guessed?: boolean };
  /** ISO date. */
  date: string;
  /** Minutes after midnight on the UK clock, for the sun. Default 1 pm. */
  minutes?: number;
}

/** Most plant pictures drawn at once; past this, a garden is drawn with fewer (every few in a big block). */
export const MAX_PLANTS = 20000;

const SOLID_KINDS: Record<string, SolidKind> = {
  bed: 'bed',
  planter: 'planter',
  pot: 'pot',
  'cold-frame': 'cold-frame',
  greenhouse: 'greenhouse',
  building: 'building',
  compost: 'compost',
  fence: 'fence',
  wall: 'wall',
  hedge: 'hedge',
  other: 'other',
};

/** Height of a thing, with the usual for its kind. A bed without edging is a low mound of soil. */
export function solidHeight(f: Feature): number {
  if (f.kind === 'bed') return f.edging ? (f.heightMm ?? 300) : 60;
  const usual: Partial<Record<Feature['kind'], number>> = { planter: 300, pot: 300, 'cold-frame': 400, greenhouse: 2200, building: 2400, compost: 1000, fence: 1800, wall: 2000, hedge: 1500, other: 1000 };
  return f.heightMm && f.heightMm > 0 ? f.heightMm : (usual[f.kind] ?? 1000);
}

/** Where the soil is in something that holds plants: a little under the rim of a raised bed or pot. */
export function soilHeight(f: Feature | undefined): number {
  if (!f) return 0;
  switch (f.kind) {
    case 'bed':
      return f.edging ? Math.max(0, solidHeight(f) - 40) : 60;
    case 'pot':
    case 'planter':
      return Math.max(0, solidHeight(f) - 30);
    case 'cold-frame':
      return 80;
    default:
      return 0;
  }
}

/** A pitched roof over a building or greenhouse that's a rectangle, its ridge along the longer side. */
export function roofOf(f: Feature, heightMm: number): Roof | undefined {
  if (f.kind !== 'building' && f.kind !== 'greenhouse') return undefined;
  const r = rectInfo(f.footprint);
  if (!r) return undefined;
  const long = r.w >= r.h;
  const u: Point = [Math.cos(r.angle), Math.sin(r.angle)];
  const v: Point = [-u[1], u[0]];
  const along = long ? u : v;
  const across = long ? v : u;
  const half = (long ? r.w : r.h) / 2;
  const span = (long ? r.h : r.w) / 2;
  return {
    ridge: [
      [r.cx - along[0] * half, r.cy - along[1] * half],
      [r.cx + along[0] * half, r.cy + along[1] * half],
    ],
    across,
    halfSpan: span,
    // The walls stop about three quarters of the way up; a steeper pitch on a narrow building.
    eavesMm: Math.round(heightMm * 0.75),
  };
}

const usualHeight = (p: Plant): number => p.size.heightMm ?? Math.max(150, Math.min(1500, spreadOf(p)));

function boundsOf(points: Point[]): Bounds3 {
  if (!points.length) return { min: [-5000, -5000], max: [5000, 5000] };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
}

/** A turn for a plant, fixed by where it is, so it never changes between pictures. */
const turnAt = (p: Point) => ((((Math.imul(p[0], 73856093) ^ Math.imul(p[1], 19349663)) >>> 0) % 360) * Math.PI) / 180;

/** The sun at a time on a day, as a direction in the garden. null when it's down. */
export function sunIn(g: Garden, date: string, minutes = 13 * 60): Sun3 | null {
  const at = fromUkClock(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)), Math.floor(minutes / 60), minutes % 60);
  const s = sunAt(at, g.latitude, g.longitude);
  if (s.altitude <= 0) return null;
  const [hx, hy] = bearingToGarden(s.azimuth, g.northRotationDeg);
  const alt = (s.altitude * Math.PI) / 180;
  return { altitude: s.altitude, dir: [hx * Math.cos(alt), hy * Math.cos(alt), Math.sin(alt)] };
}

export function buildScene(input: SceneInput): Scene3 {
  const { garden: g, plantOf, date } = input;
  const month = Number(date.slice(5, 7));
  const leafy = LEAF_MONTHS.includes(month);
  const flats: Flat[] = [];
  const solids: Solid[] = [];
  const trees: Tree3[] = [];
  const byId = new Map(g.features.map((f) => [f.id, f]));

  g.features.forEach((f, i) => {
    if (f.footprint.length < 3) return;
    if (f.kind === 'surface' || f.kind === 'path' || f.kind === 'water') {
      flats.push({ id: f.id, name: featureLabel(f), polygon: f.footprint, material: f.kind === 'water' ? 'water' : (f.material ?? (f.kind === 'path' ? 'path' : 'lawn')), layer: i });
      return;
    }
    if (f.kind === 'tree') {
      const type = treeType(f.treeType);
      const r = f.circle?.radiusMm ?? 1000;
      trees.push({
        id: f.id,
        name: type && featureLabel(f) === 'Tree' ? type.name : featureLabel(f),
        centre: f.circle?.centre ?? f.footprint[0]!,
        heightMm: f.heightMm && f.heightMm > 0 ? f.heightMm : 5000,
        spreadMm: r * 2,
        shape: type?.shape ?? 'round',
        bare: !!f.deciduous && !leafy,
        foliage: type?.foliage ?? '#5e8a4a',
        leaf: type?.leaf ?? 'broad',
      });
      return;
    }
    const kind = SOLID_KINDS[f.kind];
    if (!kind) return;
    const heightMm = solidHeight(f);
    const roof = roofOf(f, heightMm);
    solids.push({
      id: f.id,
      name: featureLabel(f),
      kind,
      polygon: f.footprint,
      ...(f.circle ? { circle: f.circle } : {}),
      heightMm,
      ...(f.edging ? { edging: f.edging } : {}),
      ...(roof ? { roof } : {}),
      ...(f.kind === 'hedge' && f.deciduous && !leafy ? { bare: true } : {}),
      ...(isCover(f) || microclimateAt(g, pivotOf(f)) ? { covered: true } : {}),
    });
  });

  // Plants, grouped by plant and how they look, so each group is one picture drawn many times.
  const groups = new Map<string, PlantGroup>();
  const names: Record<string, string> = {};
  let plantCount = 0;
  for (const pl of g.plantings) {
    const stage = input.stageOf ? input.stageOf(pl).stage : pl.removedOn ? 'cleared' : currentStage(pl);
    if (stage === 'cleared') continue;
    const base = plantOf(pl.plantId);
    const plant = sizedPlant(base, pl);
    const look = seasonal(stageLook(stage, base, pl), base, month);
    if (look.seeds) continue;
    const bed = byId.get(pl.featureId);
    const baseMm = soilHeight(bed);
    names[pl.id] = `${base.commonName}${bed ? ` in ${placeLabel(bed)}` : ''}: ${STAGE_LABEL[stage].toLowerCase()}`;
    const art = artFor(base);
    const spread = spreadOf(plant);
    const height = usualHeight(plant);
    const pts = plantPositions(pl, plant);
    if (art.form === 'tree') {
      // Fruit trees are trees in 3D: a trunk and a canopy, with blossom or fruit in season.
      for (const p of pts)
        trees.push({
          id: `${pl.id}:${p[0]}:${p[1]}`,
          name: names[pl.id]!,
          centre: p,
          heightMm: height * Math.max(0.3, look.grow),
          spreadMm: spread * Math.max(0.3, look.grow),
          shape: 'round',
          bare: !!look.bare || !!look.dormant,
          foliage: art.foliage,
          ...(look.flowers && art.flower ? { blossom: art.flower } : {}),
          ...(look.crop && art.crop ? { fruit: art.crop.colour } : {}),
          ...(look.ghost ? { ghost: true } : {}),
          plantingId: pl.id,
          leaf: leafOf(art),
        });
      continue;
    }
    const key = `${base.id}|${lookKey(look)}`;
    let grp = groups.get(key);
    if (!grp) {
      grp = { key, plantId: base.id, art, look, spreadMm: spreadOf(base), heightMm: usualHeight(base), spots: [] };
      groups.set(key, grp);
    }
    // A huge block is drawn with every few plants, so the picture stays quick.
    const room = MAX_PLANTS - plantCount;
    if (room <= 0) continue;
    const step = pts.length > room ? Math.ceil(pts.length / room) : 1;
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i]!;
      grp.spots.push({ x: p[0], y: p[1], baseMm, spreadMm: spread, heightMm: height, turn: turnAt(p), plantingId: pl.id });
      plantCount++;
    }
  }

  const all: Point[] = [...g.boundary, ...g.features.flatMap((f) => f.footprint)];
  const b = boundsOf(all);
  const ground: Point[] =
    g.boundary.length >= 3
      ? g.boundary
      : [
          [b.min[0] - 1000, b.min[1] - 1000],
          [b.max[0] + 1000, b.min[1] - 1000],
          [b.max[0] + 1000, b.max[1] + 1000],
          [b.min[0] - 1000, b.max[1] + 1000],
        ];
  return {
    bounds: g.boundary.length >= 3 ? b : boundsOf(ground),
    ground,
    flats,
    solids,
    trees,
    groups: [...groups.values()].filter((x) => x.spots.length),
    plantCount,
    names,
    sun: sunIn(g, date, input.minutes),
    month,
    lawn: LAWN_BY_MONTH[month - 1]!,
    frost: frostOn(g, date, input.minutes ?? 13 * 60),
    sketches: g.sketches ?? [],
  };
}

/** A plant's leaf as a tree's: round leaves (a fig's, a vine's) are drawn as broad ones. */
export const leafOf = (art: PlantArt): TreeLeaf => (art.leaf === 'round' ? 'broad' : art.leaf);

/**
 * Frost between the first autumn frost and the last spring frost, the same days the plan shows it: white until 9 am,
 * melting to a light rime by 1 pm, and that rime the rest of the day, as in shade.
 */
export function frostOn(g: Garden, date: string, minutes: number): number {
  const f = frostDatesUnder(g, null);
  if (!f) return 0;
  const md = date.slice(5);
  if (!(md >= f.firstFrost || md <= f.lastFrost)) return 0;
  return minutes <= 9 * 60 ? 1 : minutes >= 13 * 60 ? 0.35 : 1 - (0.65 * (minutes - 540)) / 240;
}


export { TRUNK_SHARE };
