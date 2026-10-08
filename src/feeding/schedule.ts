// When each plant wants feeding, and what a season's feeding comes to: the
// months for each step, what's due this month (for the jobs), and the season's
// amounts and rough cost for what's on the plan, against what's on your feed
// shelf. Pure functions.

import { runEnds, runStarts } from '../library/library';
import { flowerMonthsOf, perennial } from '../lifecycle/stages';
import type { FeedStep, FeedTime, Garden, Plant } from '../model/types';
import { isActive, plantCount } from '../planting/place';
import { everyText, feedById, stepText, type Feed } from './feeds';

/** Feeding outdoors runs from April to September: after that, soft new growth only gets caught by the cold. */
const SEASON = [4, 5, 6, 7, 8, 9];

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Months from a to b, wrapping past December: 11 → 2 is [11, 12, 1, 2]. */
function span(a: number, b: number): number[] {
  const out = [a];
  for (let m = a; m !== b;) {
    m = (m % 12) + 1;
    out.push(m);
  }
  return out;
}

/** The first run end at or after this month, walking forward through the year. */
function nextEnd(from: number, ends: number[]): number | undefined {
  for (let i = 0; i < 12; i++) {
    const m = ((from - 1 + i) % 12) + 1;
    if (ends.includes(m)) return m;
  }
  return undefined;
}

/** Months it's in the ground and growing: all year for a perennial; otherwise from planting (or sowing outside) to the end of its crop or flowers. */
export function inGroundMonths(p: Plant): number[] {
  if (perennial(p)) return span(1, 12);
  const direct = (p.sowing ?? []).filter((s) => s.method === 'direct').flatMap((s) => s.months);
  const start = runStarts(p.plantOutMonths ?? [])[0] ?? runStarts(direct)[0] ?? runStarts((p.sowing ?? []).flatMap((s) => s.months))[0];
  if (start === undefined) return [];
  const ends = runEnds([...(p.cropping?.harvestMonths ?? []), ...(p.flowerMonths ?? [])]);
  const end = nextEnd(start, ends) ?? ((start + 4) % 12) + 1;
  // Fed from the month after it goes in.
  return span(start, end).slice(1);
}

/** Months from the first flowers to the end of the crop (or of the flowers), in the feeding season. */
export function floweringMonths(p: Plant): number[] {
  const set = new Set([...flowerMonthsOf(p), ...(p.cropping?.harvestMonths ?? [])]);
  return SEASON.filter((m) => set.has(m));
}

/** The months a step applies. Before planting has none of its own: it rides on the sowing and planting jobs. */
export function feedMonths(p: Plant, s: FeedStep): number[] {
  if (s.months) return s.months;
  switch (s.when) {
    case 'planting':
      return [];
    case 'spring':
      return [3, 4];
    case 'flowering':
      return floweringMonths(p);
    case 'growing': {
      const fed = p.feeding?.steps.some((x) => x.when === 'flowering') ? new Set(floweringMonths(p)) : new Set<number>();
      const ground = new Set(inGroundMonths(p));
      return SEASON.filter((m) => ground.has(m) && !fed.has(m));
    }
    case 'after': {
      const end = runEnds(p.cropping?.harvestMonths.length ? p.cropping.harvestMonths : (p.flowerMonths ?? []))[0];
      if (end === undefined) return [];
      const m = (end % 12) + 1;
      return m >= 3 && m <= 10 ? [m] : [];
    }
  }
}

/** Once a year (spring, afterwards) rather than every week or two through a stretch of months. */
export const isOnce = (when: FeedTime) => when === 'spring' || when === 'after';

/** The feeding due this month, by time: one job each. */
export function feedingDue(p: Plant, month: number): { when: FeedTime; steps: FeedStep[] }[] {
  const out: { when: FeedTime; steps: FeedStep[] }[] = [];
  for (const s of p.feeding?.steps ?? []) {
    if (s.when === 'planting' || !feedMonths(p, s).includes(month) || !feedById(s.feed)) continue;
    const group = out.find((o) => o.when === s.when);
    if (group) group.steps.push(s);
    else out.push({ when: s.when, steps: [s] });
  }
  return out;
}

/** A feed job's advice: "Every week: liquid tomato feed, as the bottle says. Weekly once fruit has set." */
export function feedDetail(steps: FeedStep[]): string {
  return steps.map((s) => (s.when === 'growing' || s.when === 'flowering' ? `${everyText(s.every)}: ${lowerFirst(stepText(s))}` : stepText(s))).join(' ');
}

/** What goes in before planting, for the sowing and planting-out jobs: "Before planting: well-rotted manure, a bucketful a square metre." */
export function plantingFeedText(p: Plant): string | undefined {
  const steps = (p.feeding?.steps ?? []).filter((s) => s.when === 'planting' && feedById(s.feed));
  if (!steps.length) return undefined;
  return `Before planting: ${steps.map((s) => lowerFirst(stepText(s))).join(' ')}`;
}

// ---------- The feed shelf ----------

/** Feeds that do much the same job, so one on the shelf stands in for another. */
const STANDS_IN: Record<string, string[]> = {
  'blood-fish-bone': ['balanced-granular', 'chicken-manure-pellets'],
  'balanced-granular': ['blood-fish-bone', 'chicken-manure-pellets'],
  'chicken-manure-pellets': ['blood-fish-bone', 'balanced-granular'],
  'tomato-feed': ['comfrey-tea'],
  'comfrey-tea': ['tomato-feed'],
  'nettle-tea': ['chicken-manure-pellets', 'liquid-seaweed'],
  'garden-compost': ['rotted-manure'],
  'rotted-manure': ['garden-compost'],
  'sulphate-of-potash': ['wood-ash'],
  'wood-ash': ['sulphate-of-potash'],
};

export const onShelf = (g: Garden, id: string) => !!g.feedShelf?.includes(id);

/** The feed on your shelf that will do for this one: itself, or one that does the same job. Null: nothing that will. */
export function shelfFor(g: Garden, id: string): string | null {
  if (onShelf(g, id)) return id;
  return (STANDS_IN[id] ?? []).find((x) => onShelf(g, x)) ?? null;
}

export function toggleShelf(g: Garden, id: string): Garden {
  const shelf = g.feedShelf ?? [];
  return { ...g, feedShelf: shelf.includes(id) ? shelf.filter((x) => x !== id) : [...shelf, id] };
}

// ---------- A season's feeding ----------

export interface FeedUse {
  feed: Feed;
  /** How much, in the feed's unit. */
  amount: number;
  /** What it costs at the pack price, for the amount used, in pounds. Home-made: 0. */
  low: number;
  high: number;
  /** The plants it's for, by id, most-planted first. */
  plantIds: string[];
  /** On your shelf, or something that stands in for it. */
  have: string | null;
}

export interface SeasonFeeding {
  uses: FeedUse[];
  /** The season's feed, at shop prices, for what's on the plan. */
  low: number;
  high: number;
}

/** How many times a step goes on in a season. */
export function timesInSeason(p: Plant, s: FeedStep): number {
  if (s.when === 'planting' || isOnce(s.when)) return 1;
  return Math.round((feedMonths(p, s).length * 30) / (s.every ?? 14));
}

/**
 * A season's feeding for what's on the plan: each feed, how much, and what it would cost at shop prices for the
 * amount used. Every planting counts as a square of its spacing for each plant. Weeds and plants with no feeding
 * notes are left out.
 */
export function seasonFeeding(g: Garden, plantOf: (id: string) => Plant): SeasonFeeding {
  const by = new Map<string, { amount: number; plants: Map<string, number> }>();
  for (const pl of g.plantings) {
    if (!isActive(pl)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed' || !plant.feeding) continue;
    const each = (plant.size.spacingMm / 1000) ** 2;
    const area = Math.max(0.05, plantCount(pl, plant) * each);
    for (const s of plant.feeding.steps) {
      const feed = feedById(s.feed);
      if (!feed) continue;
      const entry = by.get(feed.id) ?? { amount: 0, plants: new Map<string, number>() };
      entry.amount += area * feed.rate * timesInSeason(plant, s);
      entry.plants.set(plant.id, (entry.plants.get(plant.id) ?? 0) + area);
      by.set(feed.id, entry);
    }
  }
  const uses: FeedUse[] = [];
  for (const [id, e] of by) {
    const feed = feedById(id)!;
    if (e.amount <= 0) continue;
    const share = feed.homeMade || !feed.pack ? 0 : e.amount / feed.pack.amount;
    uses.push({
      feed,
      amount: e.amount,
      low: share * (feed.pack?.low ?? 0),
      high: share * (feed.pack?.high ?? 0),
      plantIds: [...e.plants].sort((a, b) => b[1] - a[1]).map(([pid]) => pid),
      have: shelfFor(g, id),
    });
  }
  uses.sort((a, b) => b.high - a.high || b.amount - a.amount || a.feed.name.localeCompare(b.feed.name));
  return { uses, low: uses.reduce((t, u) => t + u.low, 0), high: uses.reduce((t, u) => t + u.high, 0) };
}

/** "about £14–22", "under £1", or "nothing" when it's all home-made. */
export function costText(low: number, high: number): string {
  if (high <= 0) return 'nothing';
  if (high < 1) return 'under £1';
  const lo = Math.max(1, Math.floor(low));
  const hi = Math.max(lo, Math.ceil(high));
  return lo === hi ? `about £${lo}` : `about £${lo}–${hi}`;
}

/** Feeds the plan calls for that aren't on your shelf, with nothing there to stand in. */
export const toBuy = (s: SeasonFeeding) => s.uses.filter((u) => !u.have);
