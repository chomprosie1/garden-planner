// Checks on what's planted where. Pure functions: a garden and its plants in,
// a list of findings out. Each finding says what's wrong in words, with the
// numbers behind it, so no warning is a mystery.

import { formatLength } from '../canvas/viewport';
import { distance, distanceToSegment, pointInPolygon } from '../geometry/polygon';
import { featureLabel } from '../model/features';
import type { Garden, Plant, Planting, Point } from '../model/types';
import { averageHours, type SunGrid } from '../sun/hours';
import { activePlantings, canHold, plantCount, plantingShape, plantPositions, rowSpacingOf, sizedPlant, type PlantingShape } from './place';

export type FindingKind = 'spacing' | 'row' | 'outside' | 'no-bed' | 'avoid' | 'good' | 'light';

export interface Finding {
  /** Stable for the same problem, so the list doesn't jump about. */
  id: string;
  kind: FindingKind;
  level: 'warn' | 'good';
  plantingIds: string[];
  featureIds: string[];
  message: string;
}

/** Plants this much closer than they need are only a small squeeze, not worth a warning. */
export const SLACK = 0.9;
/** Plants that dislike each other are flagged within this distance, or anywhere in the same bed. */
export const NEIGHBOUR_MM = 1000;

type PlantOf = (id: string) => Plant;

/** Checks everything. With a sun-hours grid (normally June's), light is checked too. */
export function checkGarden(g: Garden, plantOf: PlantOf, sun: SunGrid | null = null): Finding[] {
  // Weeds aren't checked for spacing, neighbours or light: they're not a planting choice.
  const active = activePlantings(g).filter((pl) => plantOf(pl.plantId).category !== 'weed');
  const findings = [...checkPlacement(g, active, plantOf), ...checkSpacing(active, plantOf), ...checkNeighbours(g, active, plantOf), ...checkLight(active, plantOf, sun)];
  return findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
}

// ---------- In a bed ----------

function checkPlacement(g: Garden, active: Planting[], plantOf: PlantOf): Finding[] {
  const out: Finding[] = [];
  for (const pl of active) {
    const plant = plantOf(pl.plantId);
    const bed = g.features.find((f) => f.id === pl.featureId);
    if (!bed) {
      out.push({ id: `no-bed:${pl.id}`, kind: 'no-bed', level: 'warn', plantingIds: [pl.id], featureIds: [], message: `${describe(pl, plant)} isn't in a bed any more. Move it into one or delete it.` });
      continue;
    }
    // A lawn since turned into a patio.
    if (!canHold(bed)) {
      out.push({ id: `no-bed:${pl.id}`, kind: 'no-bed', level: 'warn', plantingIds: [pl.id], featureIds: [bed.id], message: `${describe(pl, plant)} is on ${featureLabel(bed).toLowerCase()}, which plants can't grow in. Move it or delete it.` });
      continue;
    }
    const pts = plantPositions(pl, plant);
    const outside = pts.filter((p) => !insideBed(p, bed.footprint)).length;
    if (outside > 0) {
      const what = pts.length === 1 ? `${plant.commonName} is` : `${outside} of ${pts.length} ${plant.commonName.toLowerCase()} plants are`;
      out.push({ id: `outside:${pl.id}`, kind: 'outside', level: 'warn', plantingIds: [pl.id], featureIds: [bed.id], message: `${what} outside ${featureLabel(bed)}.` });
    }
    if (pl.layout === 'row' && pts.length > 1) {
      const gap = distance(pts[0]!, pts[1]!);
      const need = plant.size.spacingMm;
      if (gap < need * SLACK)
        out.push({
          id: `row:${pl.id}`,
          kind: 'row',
          level: 'warn',
          plantingIds: [pl.id],
          featureIds: [pl.featureId],
          message: `The ${plant.commonName.toLowerCase()} plants in this row are ${formatLength(Math.round(gap))} apart; they need about ${formatLength(need)}. Fewer plants, or a longer row, would fit.`,
        });
    }
  }
  return out;
}

/** Inside, or on the edge: a plant right at the edge of a bed is still in it. */
function insideBed(p: Point, poly: Point[]): boolean {
  if (pointInPolygon(p, poly)) return true;
  return poly.some((a, i) => distanceToSegment(p, a, poly[(i + 1) % poly.length]!).distance <= EDGE_MM);
}
const EDGE_MM = 10;

// ---------- Spacing between plantings ----------

function checkSpacing(active: Planting[], plantOf: PlantOf): Finding[] {
  const out: Finding[] = [];
  const shapes = active.map((pl) => plantingShape(pl, sizedPlant(plantOf(pl.plantId), pl)));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const pa = sizedPlant(plantOf(a.plantId), a);
      const pb = sizedPlant(plantOf(b.plantId), b);
      // Bulbs under a tree or shrub are the usual way to grow them, not a squeeze.
      if (underplanted(pa, pb) || underplanted(pb, pa)) continue;
      const near = closest(shapes[i]!, shapes[j]!);
      const names = `${describe(a, pa)} and ${describe(b, pb, true)}`;
      const base = { kind: 'spacing' as const, level: 'warn' as const, plantingIds: [a.id, b.id], featureIds: [...new Set([a.featureId, b.featureId])] };
      if (near.d === 0) {
        out.push({ ...base, id: `spacing:${a.id}:${b.id}`, message: `${names} overlap.` });
        continue;
      }
      const dir: Point = [near.pb[0] - near.pa[0], near.pb[1] - near.pa[1]];
      const across = (pl: Planting, s: PlantingShape) => pl.layout === 'row' && s.kind === 'segment' && !along(s, dir);
      const need = halfNeed(a, pa, shapes[i]!, dir) + halfNeed(b, pb, shapes[j]!, dir);
      if (near.d < need * SLACK) {
        const rows = across(a, shapes[i]!) || across(b, shapes[j]!) ? ' between rows' : '';
        out.push({ ...base, id: `spacing:${a.id}:${b.id}`, message: `${names} are ${formatLength(Math.round(near.d))} apart; they need about ${formatLength(Math.round(need))}${rows}.` });
      }
    }
  }
  return out;
}

const underplanted = (small: Plant, big: Plant) => small.art?.form === 'bulb' && (big.art?.form === 'tree' || big.art?.form === 'shrub' || big.category === 'tree' || big.category === 'shrub');

/** True when a direction runs mostly along a row rather than across it. */
function along(s: { a: Point; b: Point }, dir: Point): boolean {
  const len = distance(s.a, s.b) * Math.hypot(dir[0], dir[1]);
  if (len === 0) return false;
  const cos = Math.abs((s.b[0] - s.a[0]) * dir[0] + (s.b[1] - s.a[1]) * dir[1]) / len;
  return cos > 0.7;
}

/** The room a planting needs on its side of a gap: half its row spacing across a row, half its plant spacing otherwise. */
function halfNeed(pl: Planting, plant: Plant, s: PlantingShape, dir: Point): number {
  if (pl.layout === 'row' && s.kind === 'segment' && !along(s, dir)) return rowSpacingOf(plant) / 2;
  return plant.size.spacingMm / 2;
}

// ---------- Neighbours ----------

function checkNeighbours(g: Garden, active: Planting[], plantOf: PlantOf): Finding[] {
  const groups = new Map<string, Finding>();
  const shapes = new Map(active.map((pl) => [pl.id, plantingShape(pl, plantOf(pl.plantId))]));
  const bedName = (id: string) => {
    const f = g.features.find((x) => x.id === id);
    return f ? featureLabel(f) : 'a bed';
  };
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      let a = active[i]!;
      let b = active[j]!;
      if (a.plantId === b.plantId) continue;
      if (a.plantId > b.plantId) [a, b] = [b, a];
      const pa = plantOf(a.plantId);
      const pb = plantOf(b.plantId);
      const avoid = !!pa.companions?.avoid.includes(pb.id) || !!pb.companions?.avoid.includes(pa.id);
      const good = !avoid && (!!pa.companions?.good.includes(pb.id) || !!pb.companions?.good.includes(pa.id));
      if (!avoid && !good) continue;
      const sameBed = a.featureId === b.featureId;
      if (!sameBed && closest(shapes.get(a.id)!, shapes.get(b.id)!).d > NEIGHBOUR_MM) continue;
      const where = sameBed ? `bed:${a.featureId}` : `near:${[a.featureId, b.featureId].sort().join(':')}`;
      const key = `${avoid ? 'avoid' : 'good'}:${pa.id}:${pb.id}:${where}`;
      const existing = groups.get(key);
      if (existing) {
        for (const id of [a.id, b.id]) if (!existing.plantingIds.includes(id)) existing.plantingIds.push(id);
        continue;
      }
      const pair = `${pa.commonName} and ${lower(pb.commonName)}`;
      const place = sameBed ? `in ${bedName(a.featureId)}` : `within ${formatLength(NEIGHBOUR_MM)} of each other (${bedName(a.featureId)} and ${bedName(b.featureId)})`;
      groups.set(key, {
        id: key,
        kind: avoid ? 'avoid' : 'good',
        level: avoid ? 'warn' : 'good',
        plantingIds: [a.id, b.id],
        featureIds: [...new Set([a.featureId, b.featureId])],
        message: avoid ? `${pair} are ${place}. They're usually kept apart.` : `${pair} are good neighbours ${place}.`,
      });
    }
  }
  return [...groups.values()];
}

// ---------- Light ----------

/** Sun a plant wants: its own figure if it has one, otherwise full sun 6 h, part shade 3 h, shade none. */
export function sunNeeded(p: Plant): number {
  return p.conditions.minSunHours ?? (p.conditions.light === 'full-sun' ? 6 : p.conditions.light === 'part-shade' ? 3 : 0);
}

/** Plants in too little sun, or shade lovers in too much, measured from a day's sun-hours grid. */
export function checkLight(active: Planting[], plantOf: PlantOf, sun: SunGrid | null): Finding[] {
  if (!sun) return [];
  const out: Finding[] = [];
  const month = MONTHS[sun.month - 1];
  for (const pl of active) {
    const plant = plantOf(pl.plantId);
    const hours = averageHours(sun, plantPositions(pl, plant));
    if (hours === null) continue;
    const got = `${describe(pl, plant)} gets about ${formatHours(hours)} of direct sun a day in ${month}`;
    const need = sunNeeded(plant);
    const base = { id: `light:${pl.id}`, kind: 'light' as const, level: 'warn' as const, plantingIds: [pl.id], featureIds: [pl.featureId] };
    if (hours < need - LIGHT_SLACK_H) out.push({ ...base, message: `${got}; it wants ${formatHours(need)} or more.` });
    else if (plant.conditions.light === 'shade' && hours > 6) out.push({ ...base, message: `${got}; it prefers shade and may scorch.` });
  }
  return out;
}

/** A quarter of an hour short isn't worth a warning. */
export const LIGHT_SLACK_H = 0.25;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const formatHours = (h: number) => `${Math.round(h * 2) / 2} h`;

// ---------- Words ----------

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "The row of carrot", "the block of lettuce", or just the plant's name. */
function describe(pl: Planting, plant: Plant, mid = false): string {
  const name = lower(plant.commonName);
  const text = pl.layout === 'row' ? `the row of ${name}` : pl.layout === 'block' && plantCount(pl, plant) > 1 ? `the block of ${name}` : name;
  return mid ? text : capital(text);
}

// ---------- Distance between plantings ----------

interface Near {
  d: number;
  pa: Point;
  pb: Point;
}

type Seg = [Point, Point];

const edges = (s: PlantingShape): Seg[] => {
  if (s.kind === 'point') return [[s.p, s.p]];
  if (s.kind === 'segment') return [[s.a, s.b]];
  const [x0, y0] = s.min;
  const [x1, y1] = s.max;
  return [
    [[x0, y0], [x1, y0]],
    [[x1, y0], [x1, y1]],
    [[x1, y1], [x0, y1]],
    [[x0, y1], [x0, y0]],
  ];
};

const inRect = (p: Point, s: PlantingShape) => s.kind === 'rect' && p[0] >= s.min[0] && p[0] <= s.max[0] && p[1] >= s.min[1] && p[1] <= s.max[1];

function segmentsCross(a: Seg, b: Seg): boolean {
  const cross = (o: Point, p: Point, q: Point) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(b[0], b[1], a[0]);
  const d2 = cross(b[0], b[1], a[1]);
  const d3 = cross(a[0], a[1], b[0]);
  const d4 = cross(a[0], a[1], b[1]);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** The shortest gap between two plantings, and the two nearest points. 0 when they overlap. */
export function closest(A: PlantingShape, B: PlantingShape): Near {
  const ea = edges(A);
  const eb = edges(B);
  for (const [p] of eb) if (inRect(p, A)) return { d: 0, pa: p, pb: p };
  for (const [p] of ea) if (inRect(p, B)) return { d: 0, pa: p, pb: p };
  let best: Near = { d: Infinity, pa: [0, 0], pb: [0, 0] };
  for (const sa of ea) {
    for (const sb of eb) {
      if (segmentsCross(sa, sb)) return { d: 0, pa: sa[0], pb: sa[0] };
      for (const p of sa) {
        const r = distanceToSegment(p, sb[0], sb[1]);
        if (r.distance < best.d) best = { d: r.distance, pa: p, pb: r.point };
      }
      for (const p of sb) {
        const r = distanceToSegment(p, sa[0], sa[1]);
        if (r.distance < best.d) best = { d: r.distance, pa: r.point, pb: p };
      }
    }
  }
  return best;
}
