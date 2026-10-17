// Starter kits: a plan you can drop in, so a new garden isn't a blank page.
// Each kit goes with a space from "Where are you growing?" and says what to
// plant in each of its beds and pots, in order: rows across a bed, blocks side
// by side along a border, one plant to a pot (or a cluster of bulbs). Salads
// come in batches, sown a few weeks apart. Sized for a first garden: a block is
// tens of plants, not hundreds, unless you ask for it bigger. Pure functions:
// garden in, garden out.

import { toggleWishlist } from '../calendar/jobs';
import { canSowIn } from '../library/library';
import { nextInMonths } from '../lifecycle/projection';
import { sowingOf } from '../lifecycle/stages';
import { addDays } from '../model/dates';
import { addFeature, makeFeature, rectPoints } from '../model/features';
import type { Space } from '../model/spaces';
import { clearSpot } from '../model/stickers';
import type { Feature, Garden, Plant, Point } from '../model/types';
import { bounds } from '../geometry/polygon';
import { splitIntoBatches } from './batches';
import { addPlanting, isContainer, makePlanting, plantCount, type Layout } from './place';
import { bulbsInPot, isBulb, potCapacity } from './pots';
import type { Planting } from '../model/types';

export interface KitItem {
  plant: string;
  layout: Layout;
  /** Sown in this many batches, three weeks apart. */
  batches?: number;
}

/** What goes in one bed or pot: in strips across it (rows, the default), or side by side along it (blocks along a border). */
export interface KitBed {
  items: KitItem[];
  split?: 'strips' | 'side';
  /** For the garden's border: it goes there, or (with no border) its plants wait on Want to grow. */
  border?: true;
}

export interface Kit {
  id: string;
  space: Space;
  title: string;
  blurb: string;
  /** For each bed or pot the space makes, in order. Spare ones are left empty. */
  beds: KitBed[];
}

const row = (plant: string, batches?: number): KitItem => (batches ? { plant, layout: 'row', batches } : { plant, layout: 'row' });
const block = (plant: string): KitItem => ({ plant, layout: 'block' });
const one = (plant: string): KitItem => ({ plant, layout: 'single' });

export const KITS: Kit[] = [
  {
    id: 'salad-balcony',
    space: 'balcony',
    title: 'Salad and tomatoes',
    blurb: 'Lettuce in the trough, sown in three batches, a tomato and some basil in pots.',
    beds: [{ items: [row('lettuce', 3)] }, { items: [one('tomato')] }, { items: [one('basil')] }],
  },
  {
    id: 'herb-balcony',
    space: 'balcony',
    title: 'Kitchen herbs',
    blurb: 'Basil, parsley, chives and thyme in the trough; mint and rosemary in pots of their own.',
    beds: [{ items: [one('basil'), one('parsley'), one('chives'), one('thyme')], split: 'side' }, { items: [one('mint')] }, { items: [one('rosemary')] }],
  },
  {
    id: 'patio-crops',
    space: 'patio',
    title: 'Patio crops',
    blurb: 'Salads and beans in the raised bed, a tomato and strawberries in pots.',
    beds: [{ items: [row('lettuce', 3), row('radish', 3), block('french-bean')] }, { items: [one('tomato')] }, { items: [one('strawberry')] }],
  },
  {
    id: 'first-veg-bed',
    space: 'bed',
    title: 'First veg bed',
    blurb: 'Easy crops in rows: carrots, beetroot, spring onions, and lettuce and radishes sown little and often.',
    beds: [{ items: [row('carrot'), row('beetroot'), row('lettuce', 3), row('radish', 3), row('spring-onion')] }],
  },
  {
    id: 'salad-bed',
    space: 'bed',
    title: 'Salad bed',
    blurb: 'Lettuce, rocket, radishes and spring onions, sown in batches for a steady supply.',
    beds: [{ items: [row('lettuce', 3), row('rocket', 2), row('radish', 3), row('spring-onion')] }],
  },
  {
    id: 'veg-and-flowers',
    space: 'garden',
    title: 'Veg and flowers',
    blurb: 'Flowers for bees along the border, and two beds of easy vegetables.',
    beds: [
      { items: [block('lavender'), block('cosmos'), block('calendula'), block('cornflower')], split: 'side', border: true },
      { items: [row('carrot'), row('beetroot'), row('lettuce', 3), block('french-bean')] },
      { items: [block('potato'), one('courgette')], split: 'side' },
    ],
  },
  {
    id: 'pollinator-garden',
    space: 'garden',
    title: 'Pollinator garden',
    blurb: 'Flowers bees and butterflies love, from spring to autumn.',
    beds: [
      { items: [block('lavender'), block('echinacea'), block('cosmos'), block('cornflower'), block('nigella')], split: 'side', border: true },
      { items: [block('sunflower'), block('calendula')], split: 'side' },
      { items: [block('nasturtium'), block('verbena-bonariensis')], split: 'side' },
    ],
  },
  {
    id: 'allotment-starter',
    space: 'allotment',
    title: 'Allotment starter',
    blurb: 'A bed for each group of crops, so they can move round the plot each year.',
    beds: [
      { items: [block('potato')] },
      { items: [row('onion'), row('onion'), row('garlic')] },
      { items: [row('pea'), row('broad-bean')] },
      { items: [block('kale'), block('cabbage')], split: 'side' },
      { items: [one('courgette'), block('sweetcorn')], split: 'side' },
      { items: [row('carrot'), row('beetroot'), row('parsnip')] },
      { items: [row('lettuce', 3), row('radish', 3), row('spring-onion')] },
      { items: [block('strawberry')] },
    ],
  },
  // For autumn: what goes in from September to November, so a garden started then has something to do.
  {
    id: 'autumn-balcony',
    space: 'balcony',
    title: 'Bulbs and garlic',
    blurb: 'Crocuses and tulips in the trough for spring, daffodils in one pot and garlic in the other.',
    beds: [{ items: [block('crocus'), block('tulip')], split: 'side' }, { items: [block('daffodil')] }, { items: [block('garlic')] }],
  },
  {
    id: 'autumn-patio',
    space: 'patio',
    title: 'Autumn planting',
    blurb: 'Garlic, broad beans and onion sets in the raised bed, and tulips and daffodils in pots for spring.',
    beds: [{ items: [row('garlic'), row('broad-bean-autumn-sown'), row('onion-overwintering')] }, { items: [block('tulip')] }, { items: [block('daffodil')] }],
  },
  {
    id: 'autumn-bed',
    space: 'bed',
    title: 'Autumn bed',
    blurb: 'Garlic, broad beans and onion sets, planted this autumn for some of the first crops next year.',
    beds: [{ items: [row('garlic'), row('garlic'), row('broad-bean-autumn-sown'), row('broad-bean-autumn-sown'), row('onion-overwintering')] }],
  },
  {
    id: 'autumn-garden',
    space: 'garden',
    title: 'Bulbs and autumn veg',
    blurb: 'Spring bulbs along the border, garlic and onion sets in one bed, broad beans in the other.',
    beds: [
      { items: [block('crocus'), block('daffodil'), block('tulip'), block('ornamental-allium')], split: 'side', border: true },
      { items: [row('garlic'), row('garlic'), row('onion-overwintering'), row('onion-overwintering')] },
      { items: [row('broad-bean-autumn-sown'), row('broad-bean-autumn-sown')] },
    ],
  },
  {
    id: 'autumn-allotment',
    space: 'allotment',
    title: 'Autumn on the plot',
    blurb: 'Garlic and onion sets, autumn broad beans, and raspberry canes; the other beds wait for spring.',
    beds: [
      { items: [] },
      { items: [row('onion-overwintering'), row('onion-overwintering'), row('garlic'), row('garlic')] },
      { items: [row('broad-bean-autumn-sown'), row('broad-bean-autumn-sown')] },
      { items: [] },
      { items: [] },
      { items: [] },
      { items: [] },
      { items: [block('raspberry')] },
    ],
  },
];

/**
 * The kits for a space. Given the month and the plants, the kits with the most that can be sown or planted this month
 * or next come first, so a garden started in October is offered garlic before tomatoes.
 */
export function kitsFor(space: Space, month?: number, plantOf?: (id: string) => Plant | null): Kit[] {
  const kits = KITS.filter((k) => k.space === space);
  if (!month || !plantOf) return kits;
  const soon = (k: Kit) => {
    const ids = kitPlants(k);
    const ready = ids.filter((id) => {
      const p = plantOf(id);
      return !!p && (canSowIn(p, month) || canSowIn(p, (month % 12) + 1));
    });
    return ids.length ? ready.length / ids.length : 0;
  };
  return [...kits].sort((a, b) => soon(b) - soon(a));
}

/** Every plant a kit uses, once each. */
export const kitPlants = (kit: Kit): string[] => [...new Set(kit.beds.flatMap((b) => b.items.map((i) => i.plant)))];

type Box = { x0: number; y0: number; x1: number; y1: number };
const boxOf = (f: Feature): Box => {
  const xs = f.footprint.map((p) => p[0]);
  const ys = f.footprint.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/** Where each item goes in a bed: a row's ends, a block's corners, or a single plant's spot. */
function placeIn(f: Feature, bed: KitBed, plantOf: (id: string) => Plant): { item: KitItem; start: Point; end: Point }[] {
  if (f.circle) {
    const item = bed.items[0];
    if (!item) return [];
    // A pot of bulbs or garlic: a cluster in the square inside the pot. Anything else: one plant.
    if (item.layout === 'block') {
      const [cx, cy] = f.circle.centre;
      const h = (f.circle.radiusMm / Math.SQRT2) * 0.95;
      return [{ item, start: [Math.round(cx - h), Math.round(cy - h)], end: [Math.round(cx + h), Math.round(cy + h)] }];
    }
    return [{ item: { ...item, layout: 'single' }, start: f.circle.centre, end: f.circle.centre }];
  }
  const b = boxOf(f);
  const wide = b.x1 - b.x0 >= b.y1 - b.y0;
  const n = bed.items.length;
  const singlesOnly = bed.items.every((i) => i.layout === 'single');
  const side = bed.split === 'side' || singlesOnly;
  return bed.items.map((item, i) => {
    // The piece of the bed this item gets: a strip across it, or a stretch along it.
    const [t0, t1] = [i / n, (i + 1) / n];
    const along = (t: number) => (wide ? b.x0 + (b.x1 - b.x0) * t : b.y0 + (b.y1 - b.y0) * t);
    const across = (t: number) => (wide ? b.y0 + (b.y1 - b.y0) * t : b.x0 + (b.x1 - b.x0) * t);
    const [a0, a1, c0, c1] = side ? [along(t0), along(t1), across(0), across(1)] : [along(0), along(1), across(t0), across(t1)];
    const pt = (a: number, c: number): Point => (wide ? [Math.round(a), Math.round(c)] : [Math.round(c), Math.round(a)]);
    const s = plantOf(item.plant).size.spacingMm;
    // Half a spacing in from the edges, so plants sit inside the bed.
    const inset = Math.min(s / 2, (a1 - a0) / 2);
    const inC = Math.min(s / 2, (c1 - c0) / 2);
    const midC = (c0 + c1) / 2;
    if (item.layout === 'single') return { item, start: pt((a0 + a1) / 2, midC), end: pt((a0 + a1) / 2, midC) };
    if (item.layout === 'row') return { item, start: pt(a0 + inset, midC), end: pt(a1 - inset, midC) };
    return { item, start: pt(a0 + inC * 0.2, c0 + inC * 0.2), end: pt(a1 - inC * 0.2, c1 - inC * 0.2) };
  });
}

/** A block in a kit for a first garden: at most this many plants, in the middle of its patch. Tens of bulbs, not hundreds. */
export const STARTER_BLOCK = 24;

/** A block cut down to at most `most` plants, kept centred on where it was. */
function smallerBlock(pl: Planting, plant: Plant, most: number): Planting {
  if (!pl.endPoint || plantCount(pl, plant) <= most) return pl;
  const [cx, cy] = [(pl.x + pl.endPoint[0]) / 2, (pl.y + pl.endPoint[1]) / 2];
  let [hx, hy] = [Math.abs(pl.endPoint[0] - pl.x) / 2, Math.abs(pl.endPoint[1] - pl.y) / 2];
  let next = pl;
  for (let i = 0; i < 60 && plantCount(next, plant) > most; i++) {
    hx *= 0.95;
    hy *= 0.95;
    next = { ...pl, x: Math.round(cx - hx), y: Math.round(cy - hy), endPoint: [Math.round(cx + hx), Math.round(cy + hy)] };
  }
  return next;
}

/** Sizes to try for a bed a kit needs and the space hasn't got, mm, the usual first. */
const BED_SIZES: [number, number][] = [
  [2400, 1200],
  [1200, 2400],
  [1200, 1200],
  [1000, 600],
];

/**
 * A bed (or, on a balcony or patio, a pot) added for a kit that needs more than the space has: in the first clear spot
 * inside the garden, nearest its middle, at the biggest size that fits. Null when there's no room for even a small one.
 */
function addKitBed(g: Garden, pot: boolean): [Garden, Feature] | null {
  const b = bounds(g.boundary.length >= 3 ? g.boundary : g.features.flatMap((f) => f.footprint));
  const mid: Point = b ? [Math.round((b.minX + b.maxX) / 2), Math.round((b.minY + b.maxY) / 2)] : [0, 0];
  const make = (at: Point, w: number, h: number) =>
    pot ? makeFeature('pot', { circle: { centre: at, radiusMm: w / 2 } }) : { ...makeFeature('bed', { area: rectPoints({ x: Math.round(at[0] - w / 2), y: Math.round(at[1] - h / 2), w, h }) }), edging: 'timber' as const };
  for (const [w, h] of pot ? ([[400, 400], [300, 300]] as [number, number][]) : BED_SIZES) {
    const at = clearSpot(g, make(mid, w, h), mid, 100);
    if (at) {
      const f = make(at, w, h);
      return [addFeature(g, f), f];
    }
  }
  return null;
}

/**
 * Plants a kit in the garden's beds and pots, and puts its plants on your sowing list. A garden kit's flowers go in the
 * border, if there is one; each other kit bed takes the next bed or pot the space made, and where there aren't enough,
 * one is added inside the garden, so a kit's crops always have a bed. Salads in batches start at their next sowing
 * time from `today`. Plants missing from the library are left out. Sized for a first garden unless `full`: then
 * blocks fill their part of the bed ("Make it bigger").
 */
export function applyKit(g: Garden, kit: Kit, plantOf: (id: string) => Plant | null, today: string, full = false): Garden {
  const all = g.features.filter(isContainer);
  const border = all.find((f) => f.name === 'Border');
  const beds = all.filter((f) => f !== border);
  let next = g;
  for (const bed of kit.beds) {
    let f = bed.border ? border : beds.shift();
    if (!f && !bed.border && bed.items.length) {
      const pot = (kit.space === 'balcony' || kit.space === 'patio') && bed !== kit.beds[0];
      const added = addKitBed(next, pot);
      if (added) [next, f] = added;
    }
    if (f) next = plantKitBed(next, f, bed, plantOf, today, full);
  }
  for (const id of kitPlants(kit)) if (plantOf(id) && !next.wishlist.includes(id)) next = toggleWishlist(next, id);
  return next;
}

/** One kit bed's plants, set out in a bed or pot. Salads in batches start at their next sowing time from `today`. Not full: blocks are kept small. */
export function plantKitBed(g: Garden, f: Feature, bed: KitBed, plantOf: (id: string) => Plant | null, today: string, full = true): Garden {
  const known = (id: string) => plantOf(id)!;
  const usable = { ...bed, items: bed.items.filter((it) => plantOf(it.plant)) };
  let next = g;
  for (const { item, start, end } of placeIn(f, usable, known)) {
    const plant = known(item.plant);
    const made = makePlanting(plant, f.id, item.layout, start, item.layout === 'single' ? undefined : end);
    // Bulbs in a round pot: a potful, as close as bulbs go in a pot. Other blocks are kept small for a first garden.
    const potful = item.layout === 'block' && f.kind === 'pot' && isBulb(plant);
    const pl = potful ? { ...made, ...bulbsInPot(f, plant, full ? undefined : Math.min(STARTER_BLOCK, potCapacity(f, plant))) } : item.layout === 'block' && !full ? smallerBlock(made, plant, STARTER_BLOCK) : made;
    next = addPlanting(next, pl);
    if (item.batches && item.layout !== 'single') {
      const how = sowingOf(plant);
      const months = (plant.sowing ?? []).filter((x) => (how === 'direct' ? x.method === 'direct' : x.method !== 'direct')).flatMap((x) => x.months);
      const first = nextInMonths(addDays(today, 1), months.length ? months : (plant.sowing ?? []).flatMap((x) => x.months)) ?? today;
      next = splitIntoBatches(next, pl.id, plant, item.batches, 21, first);
    }
  }
  return next;
}
