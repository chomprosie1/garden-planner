// A first bed for a garden that's all lawn: made without digging, as the RHS
// sets out for a no-dig bed on grass ("No-Dig Gardening", rhs.org.uk, checked
// 17 Oct 2026): a double layer of plain cardboard over the grass, the sheets
// overlapping, wetted, then 10 to 15 cm of compost or well-rotted organic
// matter, which can be planted into straight away if it's 10 cm or more. Pure.

import { bounds, polygonArea } from '../geometry/polygon';
import type { Feature, Garden } from '../model/types';
import { isActive, isContainer, isSoftGround } from './place';

/** The bed it suggests, mm: a raised bed's usual size, small enough to reach the middle from either side. */
export const FIRST_BED_MM: [number, number] = [2400, 1200];

/** Compost over the card, mm: the RHS's 10 to 15 cm. */
const DEPTH_MM: [number, number] = [100, 150];

/** A bag of compost, litres. */
const BAG_LITRES = 40;

/**
 * A garden with grass to make a bed in but nowhere to grow yet: a lawn or meadow, or a boundary with nothing laid over it
 * ("Just the space" draws no lawn, and it's grass until you say), and no bed, pot, planter, greenhouse, patch of soil or
 * cardboard, and nothing planted. It's offered the first bed.
 */
export function needsFirstBed(g: Garden): boolean {
  const lawn = g.features.some((f) => isSoftGround(f) && (f.material ?? 'lawn') !== 'soil' && f.material !== 'cardboard' && (f.material ?? 'lawn') !== 'gravel' && f.material !== 'bark');
  const somewhere = g.features.some((f) => isContainer(f) || (f.kind === 'surface' && (f.material === 'soil' || f.material === 'cardboard')));
  // Mostly paved, it's a yard, not a garden that's grass until you say.
  const paved = g.features.filter((f) => f.kind === 'surface' && (f.material === 'paving' || f.material === 'decking' || f.material === 'gravel')).reduce((t, f) => t + polygonArea(f.footprint), 0);
  const open = g.boundary.length >= 3 && paved < polygonArea(g.boundary) / 2;
  return (lawn || open) && !somewhere && !g.plantings.some(isActive);
}

/** How much compost a bed takes, in litres and 40-litre bags: for the first bed, about 290 to 430 litres, 8 to 11 bags. */
export function firstBedCompost(area = (FIRST_BED_MM[0] * FIRST_BED_MM[1]) / 1e6): { litres: [number, number]; bags: [number, number] } {
  const litres = DEPTH_MM.map((d) => Math.round((area * d) / 10) * 10) as [number, number];
  return { litres, bags: litres.map((l) => Math.ceil(l / BAG_LITRES)) as [number, number] };
}

/** How to make it, in a few sentences, for the job's How to. */
export function firstBedHowTo(): string {
  return `${bedHowTo(FIRST_BED_MM[0], FIRST_BED_MM[1])} Then add it as a bed, so its jobs come too.`;
}

/** How to make a bed this big, without digging. */
export function bedHowTo(wMm: number, dMm: number): string {
  const { bags } = firstBedCompost((wMm * dMm) / 1e6);
  return `No digging: mark out about ${wMm / 1000} × ${dMm / 1000} m somewhere sunny. Lay plain brown cardboard over the grass two layers thick, the sheets overlapping, with any tape and staples taken off, and wet it well. Cover it with 10 to 15 cm of compost or well-rotted manure, about ${bags[0]} to ${bags[1]} bags of ${BAG_LITRES} litres. You can plant into it straight away.`;
}

/** Where a job to make a bed starts its key. */
export const MAKE_BED = 'check:make-bed:';

/** A job to make a bed, the first or one of a kit's: nothing in a garden can happen before it. */
export const makesABed = (job: { key: string }): boolean => job.key.startsWith(MAKE_BED) || job.key.startsWith('check:first-bed:');

/** Beds on the plan that aren't there yet. */
export const bedsToMake = (g: Garden): Feature[] => g.features.filter((f) => f.toMake);

/**
 * A new garden's beds, marked as still to make: the ones with something planned in them, or all of them if nothing is
 * yet. A big plot's empty beds can wait, and its border is ground that's already there.
 */
export function markBedsToMake(g: Garden): Garden {
  const beds = g.features.filter((f) => f.kind === 'bed' && f.name !== 'Border');
  const used = beds.filter((f) => g.plantings.some((p) => isActive(p) && p.featureId === f.id));
  const marked = new Set((used.length ? used : beds).map((f) => f.id));
  return { ...g, features: g.features.map((f) => (marked.has(f.id) ? { ...f, toMake: true } : f)) };
}

/** What beds still to make take: their area, m², their compost, and about how many big boxes make two layers of card. */
export function makingBeds(g: Garden): { area: number; bags: [number, number]; litres: [number, number]; boxes: number } | null {
  const beds = bedsToMake(g);
  if (!beds.length) return null;
  const area = beds.reduce((t, f) => t + polygonArea(f.footprint) / 1e6, 0);
  return { area, ...firstBedCompost(area), boxes: Math.ceil(area * 2) };
}

/** A bed's size for its How to, mm. */
export function bedSize(f: Feature): [number, number] {
  const b = bounds(f.footprint)!;
  return [Math.round(b.maxX - b.minX), Math.round(b.maxY - b.minY)];
}
