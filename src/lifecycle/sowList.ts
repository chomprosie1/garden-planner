// What to sow, for the Seedlings sowing list: what you have seed for, what to
// sow under cover now, what later, and everything else, narrowed by kind
// (vegetables, herbs and so on) and by name. Weeds only when asked for: a few
// people grow them on purpose, most don't. Pure.

import type { Plant } from '../model/types';

export const SOW_KINDS = [
  { id: 'all', label: 'All' },
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'herb', label: 'Herbs' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'flower', label: 'Flowers' },
  { id: 'shrub', label: 'Shrubs' },
  { id: 'tree', label: 'Trees' },
] as const;
export type SowKind = (typeof SOW_KINDS)[number]['id'];

export interface SowListOptions {
  month: number;
  kind: SowKind;
  /** Words in the name; empty for everything. */
  query: string;
  /** Show weeds too. Off unless asked. */
  weeds: boolean;
  /** Plant ids with seed in the tin. */
  tin: ReadonlySet<string>;
}

export interface SowList {
  tin: Plant[];
  /** Sown under cover this month. */
  now: Plant[];
  /** Sown under cover, but not this month. */
  later: Plant[];
  /** Sown outside or bought as plants: they can still start in the shed. */
  other: Plant[];
}

/** Started indoors, under glass or in a cold frame at some point in the year. */
export const sownUnderCover = (p: Plant) => !!p.sowing?.some((s) => s.method !== 'direct');

const sowNow = (p: Plant, month: number) => !!p.sowing?.some((s) => s.method !== 'direct' && s.months.includes(month));

/** Whether a plant is of a kind: trees include fruit trees, as on the plan's tree list. */
export function isKind(p: Plant, kind: SowKind): boolean {
  if (kind === 'all') return true;
  if (kind === 'tree') return p.category === 'tree' || p.art?.form === 'tree';
  if (kind === 'fruit') return p.category === 'fruit' && p.art?.form !== 'tree';
  return p.category === kind;
}

const byName = (a: Plant, b: Plant) => a.commonName.localeCompare(b.commonName);

/** The sowing list, in its groups. Varieties show when you search for them, or have seed of them. */
export function sowList(plants: Plant[], o: SowListOptions): SowList {
  const words = o.query.trim().toLowerCase();
  const shown = plants
    .filter((p) => o.weeds || p.category !== 'weed')
    .filter((p) => !p.varietyOf || words || o.tin.has(p.id))
    .filter((p) => isKind(p, o.kind))
    .filter((p) => !words || `${p.commonName} ${p.latinName ?? ''}`.toLowerCase().includes(words))
    .sort(byName);
  const tin = shown.filter((p) => o.tin.has(p.id));
  // Seed in the tin shows once, at the top, not again in its group.
  const rest = shown.filter((p) => !o.tin.has(p.id));
  const cover = rest.filter(sownUnderCover);
  return {
    tin,
    now: cover.filter((p) => sowNow(p, o.month)),
    later: cover.filter((p) => !sowNow(p, o.month)),
    other: rest.filter((p) => !sownUnderCover(p)),
  };
}
