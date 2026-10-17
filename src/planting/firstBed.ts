// A first bed for a garden that's all lawn: made without digging, as the RHS
// sets out for a no-dig bed on grass ("No-Dig Gardening", rhs.org.uk, checked
// 17 Oct 2026): a double layer of plain cardboard over the grass, the sheets
// overlapping, wetted, then 10 to 15 cm of compost or well-rotted organic
// matter, which can be planted into straight away if it's 10 cm or more. Pure.

import type { Garden } from '../model/types';
import { isActive, isContainer, isSoftGround } from './place';

/** The bed it suggests, mm: a raised bed's usual size, small enough to reach the middle from either side. */
export const FIRST_BED_MM: [number, number] = [2400, 1200];

/** Compost over the card, mm: the RHS's 10 to 15 cm. */
const DEPTH_MM: [number, number] = [100, 150];

/** A bag of compost, litres. */
const BAG_LITRES = 40;

/**
 * A garden with grass to make a bed in but nowhere to grow yet: a lawn or meadow, and no bed, pot, planter, greenhouse,
 * patch of soil or cardboard, and nothing planted. It's offered the first bed.
 */
export function needsFirstBed(g: Garden): boolean {
  const lawn = g.features.some((f) => isSoftGround(f) && (f.material ?? 'lawn') !== 'soil' && f.material !== 'cardboard' && (f.material ?? 'lawn') !== 'gravel' && f.material !== 'bark');
  const somewhere = g.features.some((f) => isContainer(f) || (f.kind === 'surface' && (f.material === 'soil' || f.material === 'cardboard')));
  return lawn && !somewhere && !g.plantings.some(isActive);
}

/** How much compost the first bed takes, in litres and 40-litre bags: about 290 to 430 litres, 8 to 11 bags. */
export function firstBedCompost(): { litres: [number, number]; bags: [number, number] } {
  const area = (FIRST_BED_MM[0] * FIRST_BED_MM[1]) / 1e6;
  const litres = DEPTH_MM.map((d) => Math.round((area * d) / 10) * 10) as [number, number];
  return { litres, bags: litres.map((l) => Math.ceil(l / BAG_LITRES)) as [number, number] };
}

/** How to make it, in a few sentences, for the job's How to. */
export function firstBedHowTo(): string {
  const { bags } = firstBedCompost();
  const [w, d] = FIRST_BED_MM.map((mm) => mm / 1000);
  return `No digging: mark out about ${w} × ${d} m somewhere sunny. Lay plain brown cardboard over the grass two layers thick, the sheets overlapping, with any tape and staples taken off, and wet it well. Cover it with 10 to 15 cm of compost or well-rotted manure, about ${bags[0]} to ${bags[1]} bags of ${BAG_LITRES} litres. You can plant into it straight away. Then add it as a bed, so its jobs come too.`;
}
