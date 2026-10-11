// The shopping list: seed, plants, compost and feed for what's planned and on
// your Want to grow list, less the seed already in the tin and the feeds on the
// shelf. Tick things off as you buy them; a tick lasts a season. Pure
// functions: garden and plants in, a list out.

import { feedById } from '../feeding/feeds';
import { shelfFor } from '../feeding/schedule';
import { currentStage, sowingOf } from '../lifecycle/stages';
import { daysBetween } from '../model/dates';
import { placeLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive, plantCount } from './place';
import { isPot, potSize } from './pots';
import { packetsFor, seedState } from './seeds';

export const SHOP_KINDS = ['seed', 'plant', 'compost', 'feed'] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

export const SHOP_LABEL: Record<ShopKind, string> = { seed: 'Seed', plant: 'Plants', compost: 'Compost', feed: 'Feed' };

export interface ShopItem {
  /** Stable, so a tick finds it again: "seed:carrot", "compost:pots", "feed:tomato-feed". */
  key: string;
  kind: ShopKind;
  /** "Carrot", "Multi-purpose compost". */
  name: string;
  /** How much, in words: "for about 40 plants", "about 45 litres". */
  amount?: string;
  /** Anything else worth knowing: what it's for, or that the seed you have is old. */
  note?: string;
  plantId?: string;
  /** Ticked as bought this season. */
  bought: boolean;
}

/** A tick counts for this long: a season's shopping. After that the same seed can be wanted again. */
export const BOUGHT_DAYS = 300;

/** The keys ticked as bought within the last season. */
export function boughtKeys(g: Garden, today: string): Set<string> {
  return new Set((g.bought ?? []).filter((b) => b.date <= today && daysBetween(b.date, today) < BOUGHT_DAYS).map((b) => b.key));
}

/** Ticks an item as bought, or unticks it. Ticks older than a season are tidied away. */
export function toggleBought(g: Garden, key: string, today: string): Garden {
  const fresh = (g.bought ?? []).filter((b) => b.date <= today && daysBetween(b.date, today) < BOUGHT_DAYS);
  const ticked = fresh.some((b) => b.key === key);
  const bought = ticked ? fresh.filter((b) => b.key !== key) : [...fresh, { key, date: today }];
  if (bought.length) return { ...g, bought };
  const { bought: _gone, ...rest } = g;
  return rest;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const listOf = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', '));
/** Litres in words, rounded to a sensible amount: "about 45 litres". */
const litres = (l: number) => `about ${l < 10 ? Math.max(1, Math.round(l)) : Math.round(l / 5) * 5} litres`;

export interface ShopOptions {
  /** Feeds too. The app asks for them unless feeding is turned off in Your garden. */
  feeding?: boolean;
}

/**
 * What to buy for what's planned (on the plan, not yet sown or planted) and on your Want to grow list:
 * - seed for what's grown from seed, unless the tin has a packet of it that's still in date;
 * - plants for what isn't: fruit, bulbs, sets;
 * - seed compost when there's sowing to do under cover, and compost to fill the pots and planters with nothing growing in them yet;
 * - feeds their feeding calls for that you can buy, unless the feed shelf has one that will do.
 * Seed, then plants, compost and feed, each A to Z.
 */
export function shoppingList(g: Garden, plantOf: (id: string) => Plant, today: string, opts: ShopOptions = {}): ShopItem[] {
  const bought = boughtKeys(g, today);
  const items: Omit<ShopItem, 'bought'>[] = [];
  const byId = new Map(g.features.map((f) => [f.id, f]));

  // What's planned on the plan, by plant.
  const planned = new Map<string, Planting[]>();
  for (const pl of g.plantings) {
    if (!isActive(pl) || currentStage(pl) !== 'planned') continue;
    if (plantOf(pl.plantId).category === 'weed') continue;
    planned.set(pl.plantId, [...(planned.get(pl.plantId) ?? []), pl]);
  }
  const wanted = [...new Set(g.wishlist)].filter((id) => !planned.has(id) && plantOf(id).category !== 'weed');
  const plants = [...planned.keys(), ...wanted].map(plantOf);

  let sowUnderCover = false;
  for (const plant of plants) {
    const list = planned.get(plant.id) ?? [];
    const n = list.reduce((t, pl) => t + plantCount(pl, plant), 0);
    const how = sowingOf(plant, list[0]);
    const forWhat = list.length ? `For ${listOf([...new Set(list.map((pl) => byId.get(pl.featureId)).filter((f) => !!f).map((f) => placeLabel(f!)))])}` : 'On your Want to grow list';
    if (how === 'none') {
      items.push({ key: `plant:${plant.id}`, kind: 'plant', name: plant.commonName, plantId: plant.id, ...(n ? { amount: plural(n, 'plant', 'plants') } : {}), note: forWhat });
      continue;
    }
    if (how === 'indoors') sowUnderCover = true;
    // Seed in date when it's sown: the soonest planned sowing, or now.
    const sowOn = list.map((pl) => pl.sowBy).filter((d): d is string => !!d && d > today).sort()[0] ?? today;
    const packets = packetsFor(g, plant, plantOf);
    if (packets.some((p) => seedState(p, sowOn) !== 'old')) continue;
    const note = packets.length ? `The packet in your tin is past its sow-by date by then: fresh seed comes up better. ${forWhat}` : forWhat;
    items.push({ key: `seed:${plant.id}`, kind: 'seed', name: plant.commonName, plantId: plant.id, ...(n ? { amount: `for about ${plural(n, 'plant', 'plants')}` } : {}), note });
  }

  if (sowUnderCover) items.push({ key: 'compost:seed', kind: 'compost', name: 'Seed compost', amount: 'a bag', note: 'For sowing in trays and modules: finer, and lower in feed, than multi-purpose' });

  // Pots and planters to fill: something planned in them, and nothing growing there yet.
  const fill = { ordinary: { l: 0, names: [] as string[] }, ericaceous: { l: 0, names: [] as string[] } };
  for (const f of g.features) {
    if (!isPot(f)) continue;
    const here = g.plantings.filter((pl) => isActive(pl) && pl.featureId === f.id);
    if (!here.some((pl) => currentStage(pl) === 'planned') || here.some((pl) => currentStage(pl) !== 'planned')) continue;
    const size = potSize(f);
    if (!size) continue;
    const which = f.soil === 'ericaceous' ? fill.ericaceous : fill.ordinary;
    which.l += size.litres;
    which.names.push(placeLabel(f));
  }
  if (fill.ordinary.l > 0) items.push({ key: 'compost:pots', kind: 'compost', name: 'Multi-purpose compost', amount: litres(fill.ordinary.l), note: `To fill ${listOf(fill.ordinary.names)}` });
  if (fill.ericaceous.l > 0) items.push({ key: 'compost:ericaceous', kind: 'compost', name: 'Ericaceous compost', amount: litres(fill.ericaceous.l), note: `To fill ${listOf(fill.ericaceous.names)}` });

  if (opts.feeding) {
    const forFeed = new Map<string, string[]>();
    for (const plant of plants)
      for (const s of plant.feeding?.steps ?? []) {
        const feed = feedById(s.feed);
        // Ones you make yourself aren't bought; one on the shelf, or one that does the same job, is had.
        if (!feed || feed.homeMade || !feed.pack || shelfFor(g, feed.id)) continue;
        const names = forFeed.get(feed.id) ?? [];
        if (!names.includes(plant.commonName.toLowerCase())) forFeed.set(feed.id, [...names, plant.commonName.toLowerCase()]);
      }
    for (const [id, names] of forFeed) items.push({ key: `feed:${id}`, kind: 'feed', name: feedById(id)!.name, note: `For ${listOf(names)}` });
  }

  const order = (k: ShopKind) => SHOP_KINDS.indexOf(k);
  return items.map((i) => ({ ...i, bought: bought.has(i.key) })).sort((a, b) => order(a.kind) - order(b.kind) || a.name.localeCompare(b.name));
}

/** The list as plain text to share or paste: what's still to buy, under each heading. */
export function shoppingText(items: ShopItem[], gardenName: string): string {
  const lines = [`Shopping list for ${gardenName}`];
  for (const kind of SHOP_KINDS) {
    const list = items.filter((i) => i.kind === kind && !i.bought);
    if (!list.length) continue;
    lines.push('', SHOP_LABEL[kind]);
    for (const i of list) lines.push(`- ${i.name}${kind === 'seed' ? ' seed' : ''}${i.amount ? `, ${i.amount}` : ''}`);
  }
  return lines.length > 1 ? lines.join('\n') : `${lines[0]}\n\nNothing to buy.`;
}
