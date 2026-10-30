// The shopping list: seed, bulbs, sets, seed potatoes, plants, compost and feed
// for what's planned and on your Want to grow list, less the seed already in the
// tin, what's sown already, and the feeds on the shelf. Tick things off as you
// buy them; a tick lasts the season. Pure functions: garden and plants in, a
// list out.

import { amountText, feedById } from '../feeding/feeds';
import { feedAsBought, feedMonths, shelfFor } from '../feeding/schedule';
import { plantHere } from '../lifecycle/growth';
import { nextInMonths } from '../lifecycle/projection';
import { traysOf } from '../lifecycle/shed';
import { currentStage } from '../lifecycle/stages';
import { daysBetween } from '../model/dates';
import { placeLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive, plantCount, stillWanted } from './place';
import { bagsText, isPot, potSize, wetWeightText } from './pots';
import { firstBedCompost, makingBeds, needsFirstBed } from './firstBed';
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
  /** The first of the month to have it by (ISO), when it isn't wanted yet. Absent: buy it now. */
  buyBy?: string;
}

/** Wanted within this many days, it's on the list to buy now. */
export const BUY_NOW_DAYS = 42;
/** A feed that won't be used for longer than this isn't on the list yet. */
export const FEED_AHEAD_DAYS = 125;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The month before something's wanted, to have it by: wanted in March, "buy by February". Nothing if it's wanted soon. */
function buyByFor(use: string | null, today: string): string | undefined {
  if (!use || daysBetween(today, use) <= BUY_NOW_DAYS) return undefined;
  const [y, m] = [Number(use.slice(0, 4)), Number(use.slice(5, 7))];
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
}

/** The list in the order to shop from it: what's wanted now, then by when, and what's bought last. Each is by kind, then A to Z. */
export function shopGroups(items: ShopItem[]): { label: string; list: ShopItem[] }[] {
  const toBuy = items.filter((i) => !i.bought);
  const later = [...new Set(toBuy.map((i) => i.buyBy).filter((d): d is string => !!d))].sort();
  return [
    { label: 'Buy now', list: toBuy.filter((i) => !i.buyBy) },
    ...later.map((d) => ({ label: `Buy by ${MONTHS[Number(d.slice(5, 7)) - 1]}`, list: toBuy.filter((i) => i.buyBy === d) })),
    { label: 'Bought', list: items.filter((i) => i.bought) },
  ].filter((g) => g.list.length);
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
  const wanted = stillWanted(g, plantOf).filter((id) => !inHand.has(id) && plantOf(id).category !== 'weed');
  const plants = [...planned.keys(), ...wanted].map(plantOf);

  let sowUnderCover = false;
  /** Plants going in soon. */
  const soon = new Set<string>();
  for (const plant of plants) {
    const list = planned.get(plant.id) ?? [];
    const n = list.reduce((t, pl) => t + plantCount(pl, plant), 0);
    const forWhat = list.length ? `For ${listOf([...new Set(list.map((pl) => byId.get(pl.featureId)).filter((f) => !!f).map((f) => placeLabel(f!)))])}` : 'On your Want to grow list';
    // When it goes in: the soonest planned sowing, or now. That decides what goes in (onions: sets in autumn, seed in winter).
    const sowOn = list.map((pl) => pl.sowBy).filter((d): d is string => !!d && d > today).sort()[0] ?? today;
    const from = startsAs(plant, Number(sowOn.slice(5, 7)), list[0]);
    // When it's wanted: a date you've set, or its next time to go in.
    const here = plantHere(plant, g);
    const use = sowOn > today ? sowOn : nextInMonths(today, [...(here.sowing ?? []).flatMap((s) => s.months), ...(here.plantOutMonths ?? [])]);
    const by = buyByFor(use, today);
    const when = by ? { buyBy: by } : {};
    if (!by) soon.add(plant.id);
    // With nothing on the plan to count: what a square metre takes, to go by.
    const perMetre = `about ${Math.max(1, Math.round(1e6 / plant.size.spacingMm ** 2))} a square metre`;
    if (from === 'plants') {
      items.push({ key: `plant:${plant.id}`, kind: 'plant', name: plant.commonName, plantId: plant.id, amount: n ? plural(n, 'plant', 'plants') : perMetre, note: forWhat, ...when });
      continue;
    }
    if (from !== 'seed') {
      const item = bulbItem(plant, from, n, Number(sowOn.slice(5, 7)));
      items.push({ key: `bulb:${plant.id}`, kind: 'bulb', ...item, amount: item.amount ?? perMetre, plantId: plant.id, note: forWhat, ...when });
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
    items.push({ key: `seed:${plant.id}`, kind: 'seed', name: `${named(plant, 'seed')}${kind ? `, ${kind}` : ''}`, plantId: plant.id, amount: n ? `for about ${plural(n, 'plant', 'plants')}` : 'a packet', note, ...when });
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
  const toFill = (l: number, names: string[]) => ({ amount: `${litres(l)} (${bagsText(l)})`, note: `To fill ${listOf(names)}: ${wetWeightText(l)}` });
  if (fill.ordinary.l > 0) items.push({ key: 'compost:pots', kind: 'compost', name: 'Multi-purpose compost', ...toFill(fill.ordinary.l, fill.ordinary.names) });
  if (fill.ericaceous.l > 0) items.push({ key: 'compost:ericaceous', kind: 'compost', name: 'Ericaceous compost', ...toFill(fill.ericaceous.l, fill.ericaceous.names) });

  if (opts.feeding) {
    const forFeed = new Map<string, string[]>();
    const firstUse = new Map<string, string>();
    for (const plant of plants)
      for (const s of plant.feeding?.steps ?? []) {
        const feed = feedById(s.feed);
        // Ones you make yourself aren't bought; one on the shelf, or one that does the same job, is had.
        if (!feed || feed.homeMade || !feed.pack || shelfFor(g, feed.id)) continue;
        const id = feedAsBought(g, feed.id);
        if (id !== 'compost' && id !== feed.id && shelfFor(g, id)) continue;
        // Only what's wanted in the next few months: no tomato feed for daffodils in October.
        const use = s.when === 'planting' ? (soon.has(plant.id) ? today : null) : nextInMonths(today, feedMonths(plant, s));
        if (!use || daysBetween(today, use) > FEED_AHEAD_DAYS) continue;
        const names = forFeed.get(id) ?? [];
        if (!names.includes(plant.commonName.toLowerCase())) forFeed.set(id, [...names, plant.commonName.toLowerCase()]);
        if (!firstUse.has(id) || use < firstUse.get(id)!) firstUse.set(id, use);
      }
    for (const [id, names] of forFeed) {
      const by = buyByFor(firstUse.get(id) ?? null, today);
      const feed = feedById(id);
      items.push(
        id === 'compost'
          ? { key: 'compost:beds', kind: 'compost', name: 'Well-rotted manure or bagged compost', amount: 'a bag or two a bed', note: `To dig in or spread on top, for ${listOf(names)}`, ...(by ? { buyBy: by } : {}) }
          : { key: `feed:${id}`, kind: 'feed', name: feed!.name, ...(feed!.pack ? { amount: `a pack of ${amountText(feed!, feed!.pack.amount)}` } : {}), note: `For ${listOf(names)}`, ...(by ? { buyBy: by } : {}) },
      );
    }
  }

  // A garden that's all lawn: what the first bed takes, made without digging.
  if (needsFirstBed(g)) {
    const { litres, bags } = firstBedCompost();
    items.push({ key: 'compost:first-bed', kind: 'compost', name: 'Compost or well-rotted manure', amount: `${bags[0]} to ${bags[1]} bags of 40 litres (${litres[0]} to ${litres[1]} litres)`, note: 'For your first bed: 10 to 15 cm over cardboard on the grass' });
    items.push({ key: 'compost:first-bed-card', kind: 'compost', name: 'Plain brown cardboard', amount: 'enough to cover the bed twice over', note: 'Boxes are fine: no tape, staples or shiny print' });
  }

  // Beds still to make: the same, for all of them.
  const making = makingBeds(g);
  if (making) {
    items.push({ key: 'compost:to-make', kind: 'compost', name: 'Compost or well-rotted manure', amount: `${making.bags[0]} to ${making.bags[1]} bags of 40 litres (${making.litres[0]} to ${making.litres[1]} litres)`, note: 'For the beds you’re making: 10 to 15 cm over cardboard on the grass' });
    items.push({ key: 'compost:to-make-card', kind: 'compost', name: 'Plain brown cardboard', amount: `about ${plural(making.boxes, 'big box', 'big boxes')}, opened out`, note: 'Two layers under each bed: no tape, staples or shiny print' });
  }

  const order = (k: ShopKind) => SHOP_KINDS.indexOf(k);
  return items.map((i) => ({ ...i, bought: bought.has(i.key) })).sort((a, b) => order(a.kind) - order(b.kind) || a.name.localeCompare(b.name));
}

/** The list as plain text to share or paste: what's still to buy, under each heading. */
export function shoppingText(items: ShopItem[], gardenName: string): string {
  const lines = [`Shopping list for ${gardenName}`];
  for (const { label, list } of shopGroups(items)) {
    if (label === 'Bought') continue;
    lines.push('', label);
    for (const i of list) lines.push(`- ${i.name}${i.amount ? `, ${i.amount}` : ''}`);
  }
  return lines.length > 1 ? lines.join('\n') : `${lines[0]}\n\nNothing to buy.`;
}
