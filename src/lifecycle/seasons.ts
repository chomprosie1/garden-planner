// What a perennial looks like through the year: evergreens keep their leaves,
// deciduous shrubs, fruit and climbers stand bare from November to April (as
// trees do on the plan and in the sun views), and plants that die back go
// down to their crowns in winter. Bulbs show only from a couple of months
// before they flower until about six weeks after.

import type { Plant, WinterHabit } from '../model/types';
import { LEAF_MONTHS } from '../sun/shadow';
import { perennial } from './stages';

/** The lawn through the year, by month: greener in spring (above 0), paler in a dry late summer, dull in winter. */
export const LAWN_BY_MONTH = [-0.3, -0.3, 0.3, 0.8, 0.9, 0.3, -0.3, -0.8, -0.4, 0, -0.2, -0.3];

/** How a perennial spends the winter. null for annuals, weeds and anything cleared each year. */
export function winterHabit(p: Plant): WinterHabit | null {
  if (p.category === 'weed' || !perennial(p)) return null;
  if (p.lifePath?.winter) return p.lifePath.winter;
  const form = p.art?.form;
  if (p.category === 'fruit' || p.category === 'shrub' || p.category === 'tree' || form === 'shrub' || form === 'tree' || form === 'climber') return 'deciduous';
  return 'dies-back';
}

/** In full leaf, bare branches, down to its crown, or coming up (or dying back) small. */
export type SeasonState = 'full' | 'bare' | 'dormant' | 'small';

const after = (m: number, n: number) => ((m - 1 + n + 120) % 12) + 1;

/** The first and last month of a run of months that may go round the new year: [12, 1, 2] runs from 12 to 2. */
export function runOf(months: number[]): [number, number] | null {
  const set = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!set.length) return null;
  if (set.length === 12) return [1, 12];
  // The run starts just after the biggest gap round the year.
  let best = 0;
  let start = set[0]!;
  for (let i = 0; i < set.length; i++) {
    const a = set[i]!;
    const b = set[(i + 1) % set.length]!;
    const gap = (b - a + 12) % 12 || 12;
    if (gap > best) {
      best = gap;
      start = b;
    }
  }
  const end = set[(set.indexOf(start) - 1 + set.length) % set.length]!;
  return [start, end];
}

/** Whether a month falls in a run from `from` to `to`, going round the new year if need be. */
export const inRun = (m: number, from: number, to: number) => (from <= to ? m >= from && m <= to : m >= from || m <= to);

/** Months a bulb is in leaf: from two months before it flowers to the month after. Spring bulbs by default. */
export function bulbLeafMonths(p: Plant): [number, number] {
  const run = runOf(p.flowerMonths ?? []);
  return run ? [after(run[0], -2), after(run[1], 1)] : [2, 6];
}

/** How a plant looks in a month, by its winter habit. Annuals are always full. */
export function seasonState(p: Plant, month: number): SeasonState {
  const habit = winterHabit(p);
  if (habit === 'deciduous') return LEAF_MONTHS.includes(month) ? 'full' : 'bare';
  if (habit !== 'dies-back') return 'full';
  if (p.art?.form === 'bulb') {
    const [from, to] = bulbLeafMonths(p);
    return inRun(month, from, to) ? 'full' : 'dormant';
  }
  // Herbaceous plants: cut back in winter, coming up in March, dying back in November.
  if (month === 12 || month <= 2) return 'dormant';
  if (month === 3 || month === 11) return 'small';
  return 'full';
}
