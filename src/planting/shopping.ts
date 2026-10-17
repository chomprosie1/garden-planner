// The shopping list: seed, bulbs, sets, seed potatoes, plants, compost and feed
// for what's planned and on your Want to grow list, less the seed already in the
// tin, what's sown already, and the feeds on the shelf. Tick things off as you
// buy them; a tick lasts the season. Pure functions: garden and plants in, a
// list out.

import { feedById } from '../feeding/feeds';
import { shelfFor } from '../feeding/schedule';
import { traysOf } from '../lifecycle/shed';
import { currentStage } from '../lifecycle/stages';
import { placeLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive, plantCount } from './place';
import { isPot, potSize } from './pots';
import { firstBedCompost, needsFirstBed } from './firstBed';
import { packetsFor, seedState } from './seeds';
import { sowingNow, startsAs } from './windows';

export const SHOP_KINDS = ['seed', 'bulb', 'plant', 'compost', 'feed'] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

export const SHOP_LABEL: Record<ShopKind, string> = { seed: 'Seed', bulb: 'Bulbs, sets and seed potatoes', plant: 'Plants', compost: 'Compost', feed: 'Feed' };

export interface ShopItem {
  /** Stable, so a tick finds it again: "seed:carrot", "bulb:garlic", "compost:pots", "feed:tomato-feed". */
  key: string;
  kind: ShopKind;
  /** What to ask for: "Carrot seed", "Onion sets", "Garlic", "Seed potatoes", "Tulip bulbs", "Multi-purpose compost". */
  name: string;
  /** How much, in words: "for about 40 plants", "about 40 cloves (4 or 5 bulbs)", "about 45 litres". */
  amount?: string;
  /** Anything else worth knowing: what it's for, or that the seed you have is old. */
  note?: string;
  plantId?: string;
  /** Ticked as bought this season. */
  bought: boolean;
}

/**
 * When this season's shopping started: 1 August, when next year's planning begins, or the August before. A tick lasts
 * until the next one, so seed bought in March isn't still ticked for next year's list.
 */
export function seasonStart(today: string): string {
  const y = Number(today.slice(0, 4));
  return `${Number(today.slice(5, 7)) >= 8 ? y : y - 1}-08-01`;
}

const thisSeason = (date: string, today: string) => date <= today && date >= seasonStart(today);

/** The keys ticked as bought this season. */
export function boughtKeys(g: Garden, today: string): Set<string> {
  return new Set((g.bought ?? []).filter((b) => thisSeason(b.date, today)).map((b) => b.key));
}

/** Ticks an item as bought, or unticks it. Ticks from an earlier season are tidied away. */
export function toggleBought(g: Garden, key: string, today: string): Garden {
  const fresh = (g.bought ?? []).filter((b) => thisSeason(b.date, today));
  const ticked = fresh.some((b) => b.key === key);
  const bought = ticked ? fresh.filter((b) => b.key !== key) : [...fresh, { key, date: today }];
  if (bought.length) return { ...g, bought };
  const { bought: _gone, ...rest } = g;
  return rest;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The one feed a first garden buys for nearly everything. */
const GENERAL_FEED = 'blood-fish-bone';
/** Feeds no general one stands in for. */
const NEEDED_FEEDS = ['tomato-feed', 'ericaceous-feed'];
/** Bought by the bag, to dig in: compost, not feed. */
const BULKY_FEEDS = ['rotted-manure'];

/** "Onion sets, overwintering", "Broad bean seed, autumn-sown": the word after the plant, before its kind. */
const named = (plant: Plant, word: string) => plant.commonName.replace(/^([^,]+)/, `$1 ${word}`);
const listOf = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(names.length === 2 ? ' and ' : ', '));
/** Litres in words, rounded to a sensible amount: "about 45 litres". */
const litres = (l: number) => `about ${l < 10 ? Math.max(1, Math.round(l)) : Math.round(l / 5) * 5} litres`;

export interface ShopOptions {
  /** Feeds too. The app asks for them unless feeding is turned off in Settings. */
  feeding?: boolean;
}

/**
 * For a plain plant going in in late summer or autumn, the kind to ask for: spring onion sets planted in autumn bolt, and
 * broad beans for the winter need a hardy kind (RHS: 'Aquadulce Claudia' is a good one for autumn sowing).
 */
const AUTUMN_KIND: Record<string, string> = { onion: 'an overwintering kind', 'broad-bean': 'an autumn kind such as ‘Aquadulce Claudia’' };
const autumnKind = (plant: Plant, month: number) => (!plant.variety && month >= 8 && month <= 11 ? AUTUMN_KIND[plant.id] : undefined);

/** What to call it, and how much, for what goes in: "Onion sets, about 48", "Garlic, about 40 cloves (4 or 5 bulbs)". */
function bulbItem(plant: Plant, from: 'sets' | 'cloves' | 'tubers' | 'bulbs', n: number, month: number): { name: string; amount?: string } {
  const potato = plant.id === 'potato' || plant.varietyOf === 'potato';
  switch (from) {
    case 'sets': {
      const kind = autumnKind(plant, month);
      return { name: `${named(plant, 'sets')}${kind ? `, ${kind}` : ''}`, ...(n ? { amount: `about ${n}` } : {}) };
    }
    case 'cloves': {
      // A bulb of garlic splits into about ten cloves.
      const bulbs = Math.max(1, Math.round(n / 10));
      return { name: plant.commonName, ...(n ? { amount: `about ${plural(n, 'clove', 'cloves')} (${bulbs === 1 ? 'a bulb' : `${bulbs} bulbs`} or so)` } : {}) };
    }
    case 'tubers':
      return potato
        ? { name: `Seed potatoes${plant.variety ? `, ${plant.variety.toLowerCase()}` : ''}`, ...(n ? { amount: `about ${n}` } : {}) }
        : { name: named(plant, 'tubers'), ...(n ? { amount: `about ${n}` } : {}) };
    default:
      return { name: named(plant, 'bulbs'), ...(n ? { amount: plural(n, 'bulb', 'bulbs') } : {}) };
  }
}

/**
 * What to buy for what's planned (on the plan, not yet sown or planted) and on your Want to grow list:
 * - seed for what's grown from seed, unless the tin has enough of it that's still in date;
 * - bulbs, onion sets, garlic and seed potatoes for what's planted from them;
 * - plants for the rest: fruit, perennials;
 * - seed compost when there's sowing to do under cover, and compost to fill the pots and planters with nothing growing in them yet;
 * - feeds their feeding calls for that you can buy, unless the feed shelf has one that will do.
 * Something on the Want to grow list that's already growing, or sown in a tray this season, isn't wanted again.
 * Seed, then bulbs, plants, compost and feed, each A to Z.
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
  // Already in hand: growing or sown on the plan, or sown in a tray this season.
  const since = seasonStart(today);
  const inHand = new Set([...g.plantings.filter((pl) => isActive(pl) && currentStage(pl) !== 'planned').map((pl) => pl.plantId), ...traysOf(g).filter((t) => t.sownOn >= since).map((t) => t.plantId)]);
  const wanted = [...new Set(g.wishlist)].filter((id) => !planned.has(id) && !inHand.has(id) && plantOf(id).category !== 'weed');
  const plants = [...planned.keys(), ...wanted].map(plantOf);

  let sowUnderCover = false;
  for (const plant of plants) {
    const list = planned.get(plant.id) ?? [];
    const n = list.reduce((t, pl) => t + plantCount(pl, plant), 0);
    const forWhat = list.length ? `For ${listOf([...new Set(list.map((pl) => byId.get(pl.featureId)).filter((f) => !!f).map((f) => placeLabel(f!)))])}` : 'On your Want to grow list';
    // When it goes in: the soonest planned sowing, or now. That decides what goes in (onions: sets in autumn, seed in winter).
    const sowOn = list.map((pl) => pl.sowBy).filter((d): d is string => !!d && d > today).sort()[0] ?? today;
    const from = startsAs(plant, Number(sowOn.slice(5, 7)), list[0]);
    if (from === 'plants') {
      items.push({ key: `plant:${plant.id}`, kind: 'plant', name: plant.commonName, plantId: plant.id, ...(n ? { amount: plural(n, 'plant', 'plants') } : {}), note: forWhat });
      continue;
    }
    if (from !== 'seed') {
      items.push({ key: `bulb:${plant.id}`, kind: 'bulb', ...bulbItem(plant, from, n, Number(sowOn.slice(5, 7))), plantId: plant.id, note: forWhat });
      continue;
    }
    if (sowingNow(plant, Number(sowOn.slice(5, 7)), list[0])?.method !== 'direct') sowUnderCover = true;
    // Seed in date when it's sown, and enough of it: a packet with no count is taken to be enough.
    const good = packetsFor(g, plant, plantOf).filter((p) => seedState(p, sowOn) !== 'old');
    const have = good.some((p) => p.count === undefined) ? Infinity : good.reduce((t, p) => t + (p.count ?? 0), 0);
    if (good.length && have >= Math.max(1, n)) continue;
    const old = packetsFor(g, plant, plantOf).length > good.length && !good.length;
    const note = old ? `The packet in your tin is past its sow-by date by then: fresh seed comes up better. ${forWhat}` : good.length ? `Your tin has about ${plural(have, 'seed', 'seeds')}. ${forWhat}` : forWhat;
    const kind = autumnKind(plant, Number(sowOn.slice(5, 7)));
    items.push({ key: `seed:${plant.id}`, kind: 'seed', name: `${named(plant, 'seed')}${kind ? `, ${kind}` : ''}`, plantId: plant.id, ...(n ? { amount: `for about ${plural(n, 'plant', 'plants')}` } : {}), note });
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
    // A first garden (no feed shelf yet) gets one general feed and some compost, and only the specialist feeds a plant
    // can't do without: tomato feed for fruiting crops, and ericaceous feed for blueberries and the like.
    const first = !g.feedShelf;
    const asBought = (id: string): string => (!first || NEEDED_FEEDS.includes(id) ? id : BULKY_FEEDS.includes(id) ? 'compost' : GENERAL_FEED);
    const forFeed = new Map<string, string[]>();
    for (const plant of plants)
      for (const s of plant.feeding?.steps ?? []) {
        const feed = feedById(s.feed);
        // Ones you make yourself aren't bought; one on the shelf, or one that does the same job, is had.
        if (!feed || feed.homeMade || !feed.pack || shelfFor(g, feed.id)) continue;
        const id = asBought(feed.id);
        if (id !== 'compost' && id !== feed.id && shelfFor(g, id)) continue;
        const names = forFeed.get(id) ?? [];
        if (!names.includes(plant.commonName.toLowerCase())) forFeed.set(id, [...names, plant.commonName.toLowerCase()]);
      }
    for (const [id, names] of forFeed)
      items.push(
        id === 'compost'
          ? { key: 'compost:beds', kind: 'compost', name: 'Well-rotted manure or bagged compost', amount: 'a bag or two a bed', note: `To dig in or spread on top, for ${listOf(names)}` }
          : { key: `feed:${id}`, kind: 'feed', name: feedById(id)!.name, note: `For ${listOf(names)}` },
      );
  }

  // A garden that's all lawn: what the first bed takes, made without digging.
  if (needsFirstBed(g)) {
    const { litres, bags } = firstBedCompost();
    items.push({ key: 'compost:first-bed', kind: 'compost', name: 'Compost or well-rotted manure', amount: `${bags[0]} to ${bags[1]} bags of 40 litres (${litres[0]} to ${litres[1]} litres)`, note: 'For your first bed: 10 to 15 cm over cardboard on the grass' });
    items.push({ key: 'compost:first-bed-card', kind: 'compost', name: 'Plain brown cardboard', amount: 'enough to cover the bed twice over', note: 'Boxes are fine: no tape, staples or shiny print' });
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
    for (const i of list) lines.push(`- ${i.name}${i.amount ? `, ${i.amount}` : ''}`);
  }
  return lines.length > 1 ? lines.join('\n') : `${lines[0]}\n\nNothing to buy.`;
}
