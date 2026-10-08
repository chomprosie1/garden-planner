// The feeds: about fifteen generic kinds, organic and mineral, by their plain
// names and never a brand. What each is for, how and when to use it, roughly
// what's in it, and roughly what it costs. Pure, and small enough to load with
// the jobs.

import data from '../../data/feeds.json';
import type { FeedNeed, FeedStep, FeedTime, Plant } from '../model/types';

export const FEED_KINDS = ['organic', 'mineral'] as const;
export const FEED_FORMS = ['granules', 'pellets', 'powder', 'liquid', 'bulky'] as const;
export const FEED_UNITS = ['g', 'ml', 'l'] as const;

export interface Feed {
  id: string;
  name: string;
  kind: (typeof FEED_KINDS)[number];
  form: (typeof FEED_FORMS)[number];
  /** Rough nitrogen, phosphorus and potassium, as percentages. */
  npk: [number, number, number];
  /** What it's for. */
  for: string;
  how: string;
  when: string;
  /** How much each time, in words: "a good handful a square metre". */
  dose: string;
  /** How much each time, for a square metre, in its unit: for working out a season's cost. */
  rate: number;
  unit: (typeof FEED_UNITS)[number];
  /** A usual pack and its rough price range in pounds, autumn 2026. Absent for feeds you make. */
  pack?: { amount: number; low: number; high: number };
  /** How to make it yourself, for nothing. A home-made feed costs nothing in a season's sums. */
  homeMade?: string;
  careful?: string;
}

export const FEEDS = data as Feed[];
const BY_ID = new Map(FEEDS.map((f) => [f.id, f]));

/** A feed by id, or undefined. */
export const feedById = (id: string): Feed | undefined => BY_ID.get(id);

/** When the prices were looked at. */
export const PRICES_WHEN = 'autumn 2026';

export const NEED_LABEL: Record<FeedNeed, string> = {
  hungry: 'A hungry plant',
  moderate: 'An average appetite',
  light: 'A light feeder',
};

export const NEED_TEXT: Record<FeedNeed, string> = {
  hungry: 'Rich soil, and a feed through the season.',
  moderate: 'Good soil, and a feed now and then.',
  light: 'Ordinary soil is plenty. Too much feed does more harm than good.',
};

export const TIME_LABEL: Record<FeedTime, string> = {
  planting: 'Before planting',
  spring: 'In spring',
  growing: 'While it grows',
  flowering: 'From the first flowers',
  after: 'Afterwards',
};

/** "Every week", "Every two weeks", "Once a month". */
export function everyText(days = 14): string {
  if (days <= 7) return 'Every week';
  if (days <= 10) return 'Every ten days';
  if (days <= 14) return 'Every two weeks';
  if (days <= 21) return 'Every three weeks';
  return 'Once a month';
}

/** "After it crops" for a crop, "After flowering" for the rest. */
export const afterText = (p: Plant) => (p.cropping?.harvestMonths.length ? 'After it crops' : 'After flowering');

/** The heading for a step on this plant: "Every week from the first flowers", "In spring". */
export function stepHeading(p: Plant, s: FeedStep): string {
  if (s.when === 'growing') return `${everyText(s.every)} while it grows`;
  if (s.when === 'flowering') return `${everyText(s.every)} from the first flowers`;
  if (s.when === 'after') return afterText(p);
  return TIME_LABEL[s.when];
}

/** What to do, in a line: "Liquid tomato feed, as the bottle says, in a can of water. Weekly once fruit has set." */
export function stepText(s: FeedStep): string {
  const f = feedById(s.feed);
  const what = f ? `${f.name}, ${f.dose}.` : '';
  return [what, s.note ?? ''].filter(Boolean).join(' ');
}

/** "NPK 5-5-5". */
export const npkText = (f: Feed) => `NPK ${f.npk.join('-')}`;

const AMOUNT_UNIT: Record<Feed['unit'], [string, number]> = { g: ['kg', 1000], ml: ['litre', 1000], l: ['litres', 1] };

/** "3 kg", "1 litre", "50 litres". */
export function amountText(f: Feed, amount: number): string {
  if (f.unit === 'g') return amount < 1000 ? `${Math.round(amount / 10) * 10} g` : `${round1(amount / 1000)} kg`;
  if (f.unit === 'ml') return amount < 1000 ? `${Math.round(amount / 10) * 10} ml` : `${round1(amount / 1000)} ${amount === 1000 ? 'litre' : 'litres'}`;
  const [unit, per] = AMOUNT_UNIT[f.unit];
  return `${Math.round(amount / per)} ${unit}`;
}

const round1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** "about £6–9 for 3 kg", or "free, home-made". */
export function priceText(f: Feed): string {
  if (f.homeMade && !f.pack) return 'free, home-made';
  const p = f.pack!;
  const bought = `about £${p.low}–${p.high} for ${amountText(f, p.amount)}`;
  return f.homeMade ? `free home-made, or ${bought}` : bought;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * A line on feeding for a stage, from the plant's own feeding: growing on, flowering, then after it crops (or, for a
 * crop fed through its harvest, keep feeding). Undefined when there's nothing to say.
 */
export function feedTip(p: Plant, stage: string): string | undefined {
  const steps = (when: FeedTime) => (p.feeding?.steps ?? []).filter((s) => s.when === when && feedById(s.feed));
  const line = (list: FeedStep[], lead: string) => (list.length ? `${lead}: ${list.map((s) => lowerFirst(stepText(s))).join(' ')}` : undefined);
  if (stage === 'vegetative') {
    const g = steps('growing');
    return g.length ? line(g, `Feeding, ${lowerFirst(stepHeading(p, g[0]!))}`) : undefined;
  }
  if (stage === 'flowering') {
    const f = steps('flowering');
    return f.length ? line(f, `Feeding, ${lowerFirst(stepHeading(p, f[0]!))}`) : undefined;
  }
  if (stage === 'harvesting') {
    const after = steps('after');
    if (after.length) return line(after, `Feeding, ${lowerFirst(afterText(p))}`);
    const f = steps('flowering');
    return f.length ? line(f, `Keep feeding, ${lowerFirst(everyText(f[0]!.every))}`) : undefined;
  }
  return undefined;
}
