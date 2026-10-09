// Plants in pots: how big a pot is, how big a pot a plant wants, whether a pot
// is too small or too crowded, where a second plant goes in a pot, potting on
// into something bigger, and trees from the Trees list put in a pot. Pure
// functions: garden in, answers or garden out.

import { bounds, pointInPolygon } from '../geometry/polygon';
import { featureLabel, makeFeature, pivotOf, rectInfo } from '../model/features';
import { addNote, makeNote } from '../model/notes';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { isActive, plantCount, plantPositions, spreadOf } from './place';

/** Pots, tubs, planters and window boxes: small containers whose size matters to what's in them. */
export const isPot = (f: Feature): boolean => f.kind === 'pot' || f.kind === 'planter';

export interface PotSize {
  /** Across, mm: a round pot's width, or a planter's narrower side. */
  across: number;
  /** For a planter, its longer side, mm; a round pot's is the same as across. */
  long: number;
  depth: number;
  /** About how much compost it holds. */
  litres: number;
  /** Room for plants, as square mm: a round pot's width squared, a planter's length times its width. */
  room: number;
}

const USUAL_DEPTH = 300;

/** How big a pot or planter is. Null for anything else. */
export function potSize(f: Feature): PotSize | null {
  if (!isPot(f)) return null;
  const depth = f.heightMm && f.heightMm > 0 ? f.heightMm : USUAL_DEPTH;
  if (f.circle) {
    const d = f.circle.radiusMm * 2;
    return { across: d, long: d, depth, litres: (Math.PI * f.circle.radiusMm ** 2 * depth) / 1e6, room: d * d };
  }
  const r = rectInfo(f.footprint);
  const b = bounds(f.footprint);
  const [w, h] = r ? [r.w, r.h] : b ? [b.maxX - b.minX, b.maxY - b.minY] : [0, 0];
  const [across, long] = [Math.min(w, h), Math.max(w, h)];
  return { across, long, depth, litres: (across * long * depth) / 1e6, room: across * long };
}

/**
 * About how wide a pot a plant wants, mm: a rule of thumb from its size and kind.
 * - Fruit trees and bushes, and trees: 45 cm. RHS: most fruit in containers wants a pot 45 to 50 cm across, and a tree
 *   a final container of about 45 cm.
 * - Big leafy crops such as tomatoes, peppers and chillies (spread of 40 cm or more): 30 cm. RHS: about 30 cm across.
 * - Salad leaves and small plants: 15 cm. RHS: salad leaves grow in containers at least 15 cm deep.
 * - Not checked against a source, a rule of thumb between those: sprawling crops such as courgettes and squash (spread
 *   of 80 cm or more) 45 cm; ornamental shrubs 45 cm, or 30 cm for a small one (spread up to 60 cm), such as lavender.
 */
export function potNeeds(p: Plant): number {
  const spread = spreadOf(p);
  const form = p.art?.form;
  if (p.category === 'tree' || form === 'tree' || (p.category === 'fruit' && (form === 'shrub' || form === 'climber'))) return 450;
  if (p.category === 'shrub' || form === 'shrub') return spread <= 600 ? 300 : 450;
  if (spread >= 800) return 450;
  if (spread >= 400) return 300;
  return 150;
}

/** "45 cm". */
export const cmText = (mm: number) => `${Math.round(mm / 10)} cm`;

/** "30 cm across" for a round pot, "80 cm long and 20 cm wide" for a planter or window box. */
export const sizeText = (s: PotSize) => (s.long > s.across + 20 ? `${cmText(s.long)} long and ${cmText(s.across)} wide` : `${cmText(s.across)} across`);

/** "about 15 litres". */
export const litresText = (l: number) => `about ${l < 10 ? Math.round(l * 2) / 2 : Math.round(l)} litres`;

export interface PotProblem {
  kind: 'small' | 'crowded';
  feature: Feature;
  plantings: Planting[];
  size: PotSize;
  /** For small: what the plant wants across. For crowded: what they want across together. */
  need: number;
  message: string;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listOf = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Pots too small for what's in them, and pots with more in them than they've room for. A plant wanting a pot wider
 * than this one is "small"; plants that fit one by one but not together are "crowded". Weeds don't count.
 */
export function potProblems(g: Garden, plantOf: (id: string) => Plant): PotProblem[] {
  const out: PotProblem[] = [];
  for (const f of g.features) {
    const size = potSize(f);
    if (!size || size.across <= 0) continue;
    const here = g.plantings.filter((pl) => pl.featureId === f.id && isActive(pl) && plantOf(pl.plantId).category !== 'weed');
    if (!here.length) continue;
    const label = featureLabel(f).toLowerCase();
    const where = f.kind === 'pot' ? `this ${label === 'pot' ? 'pot' : label}` : `the ${label}`;
    let tooSmall = false;
    for (const pl of here) {
      const plant = plantOf(pl.plantId);
      const need = potNeeds(plant);
      if (need <= size.across * 1.05) continue;
      tooSmall = true;
      out.push({
        kind: 'small',
        feature: f,
        plantings: [pl],
        size,
        need,
        message: `${plant.commonName} wants a pot about ${cmText(need)} across or more; ${where} is ${sizeText(size)} (${litresText(size.litres)}). In a small pot it stays small and dries out fast. Pot it on when you can.`,
      });
    }
    // Counted by plants, not plantings: a block of lettuce is several plants.
    const counts = here.map((pl) => plantCount(pl, plantOf(pl.plantId)));
    if (tooSmall || counts.reduce((a, b) => a + b, 0) < 2) continue;
    // A plant on its own wants a square of the pot it would want; plants in a row or block, a square of their spacing.
    // Together, more room than the pot has is crowded.
    const plants = here.map((pl) => plantOf(pl.plantId));
    const demand = plants.reduce((n, p, i) => n + (counts[i]! > 1 ? counts[i]! * p.size.spacingMm ** 2 : potNeeds(p) ** 2), 0);
    if (demand <= size.room * 1.1) continue;
    const names = [...new Set(plants.map((p) => lower(p.commonName)))];
    const together = Math.sqrt(demand);
    out.push({
      kind: 'crowded',
      feature: f,
      plantings: here,
      size,
      need: together,
      message: f.circle
        ? `Too crowded: the ${listOf(names)} want a pot about ${cmText(together)} across between them; ${where} is ${cmText(size.across)}. Pot one on, or move one out to a bed.`
        : `Too crowded: the ${listOf(names)} want more room than ${where} has. Move one to a pot of its own, or to a bed.`,
    });
  }
  return out;
}

/**
 * Where a plant dropped into a pot goes: where it was dropped if the pot is empty, otherwise the free spot in the pot
 * furthest from what's already in it, so a second plant goes beside the first, not on top of it.
 */
export function spotInPot(g: Garden, pot: Feature, at: Point, plantOf: (id: string) => Plant): Point {
  const taken = g.plantings.filter((pl) => pl.featureId === pot.id && isActive(pl)).flatMap((pl) => plantPositions(pl, plantOf(pl.plantId)));
  if (!taken.length) return at;
  const b = bounds(pot.footprint);
  if (!b) return at;
  const inset = (b.maxX - b.minX) * 0.12;
  let best: { p: Point; d: number } = { p: at, d: -1 };
  const n = 12;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const p: Point = [Math.round(b.minX + inset + ((b.maxX - b.minX - 2 * inset) * i) / n), Math.round(b.minY + inset + ((b.maxY - b.minY - 2 * inset) * j) / n)];
      if (!pointInPolygon(p, pot.footprint)) continue;
      const d = Math.min(...taken.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
      if (d > best.d + 1) best = { p, d };
    }
  return best.p;
}

// ---------- Potting on ----------

/** Where to pot on into: a bigger pot already on the plan, a new pot of a size beside the old one, or a bed. */
export type PotOnTo = { kind: 'pot'; featureId: string } | { kind: 'new'; acrossMm: number } | { kind: 'bed'; featureId: string };

export interface PotOnChoices {
  /** The size it wants, mm across, for a new pot. */
  suggested: number;
  /** Pots and planters on the plan bigger than this one and big enough for it, emptiest first. */
  pots: Feature[];
  /** Beds it could go out into. */
  beds: Feature[];
}

/** The ways to pot on a planting in a pot, or null if it isn't in one. */
export function potOnChoices(g: Garden, plantingId: string, plantOf: (id: string) => Plant): PotOnChoices | null {
  const pl = g.plantings.find((p) => p.id === plantingId);
  const from = pl && g.features.find((f) => f.id === pl.featureId);
  const now = from && potSize(from);
  if (!pl || !from || !now) return null;
  const need = potNeeds(plantOf(pl.plantId));
  // A size up: what it wants, or a good step bigger than now if it's already there.
  const suggested = Math.max(need, Math.ceil((now.across * 1.4) / 50) * 50);
  const used = (f: Feature) => g.plantings.filter((p) => p.featureId === f.id && isActive(p)).length;
  const pots = g.features
    .filter((f) => f.id !== from.id && isPot(f))
    .filter((f) => {
      const s = potSize(f)!;
      return s.across > now.across && s.across >= need * 0.95;
    })
    .sort((a, b) => used(a) - used(b) || potSize(a)!.across - potSize(b)!.across);
  const beds = g.features.filter((f) => f.kind === 'bed' || f.kind === 'greenhouse' || f.kind === 'cold-frame');
  return { suggested, pots, beds };
}

/**
 * Pots a planting on: moves it into a bigger pot (a new one is made beside the old, when asked), or out into a bed,
 * and notes it on the planting ("Potted on into a 45 cm pot"). One change, so one undo.
 */
export function potOn(g: Garden, plantingId: string, to: PotOnTo, plantOf: (id: string) => Plant, today: string): Garden {
  const pl = g.plantings.find((p) => p.id === plantingId);
  const from = pl && g.features.find((f) => f.id === pl.featureId);
  if (!pl || !from) return g;
  let next = g;
  let target: Feature | undefined;
  if (to.kind === 'new') {
    // Beside the old pot or planter, clear of its whole outline (a long window box too), at the size asked for.
    const c = pivotOf(from);
    const b = bounds(from.footprint);
    const r = Math.round(to.acrossMm / 2);
    const x = (b ? b.maxX : c[0] + 150) + r + 100;
    target = { ...makeFeature('pot', { circle: { centre: [Math.round(x), Math.round(c[1])], radiusMm: r } }), heightMm: Math.max(300, Math.round(r * 0.9)) };
    next = { ...next, features: [...next.features, target] };
  } else target = g.features.find((f) => f.id === to.featureId);
  if (!target || target.id === from.id) return g;
  const at = spotInPot(next, target, pivotOf(target), plantOf);
  const moved: Planting = { ...pl, featureId: target.id, x: at[0], y: at[1], layout: 'single' };
  delete moved.endPoint;
  delete moved.count;
  next = { ...next, plantings: next.plantings.map((p) => (p.id === pl.id ? moved : p)) };
  const size = potSize(target);
  const text = size ? `Potted on into a ${cmText(size.across)} ${target.kind === 'planter' ? 'planter' : 'pot'}.` : `Planted out from the pot into ${featureLabel(target)}.`;
  return addNote(next, makeNote(text, today, { plantingId: pl.id }));
}

// ---------- Trees in pots ----------

/**
 * The library plant for a tree from the Trees list, so it can go in a pot: the plant with the same id, or the same
 * name ("Olive", "Japanese maple"). Null when there isn't one.
 */
export function treeAsPlant(tree: { id: string; name: string }, plants: Plant[]): Plant | null {
  const name = tree.name.toLowerCase();
  return plants.find((p) => !p.varietyOf && p.id === tree.id) ?? plants.find((p) => !p.varietyOf && p.commonName.toLowerCase() === name) ?? null;
}
