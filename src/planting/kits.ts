// Starter kits: a plan you can drop in, so a new garden isn't a blank page.
// Each kit goes with a space from "Where are you growing?" and says what to
// plant in each of its beds and pots, in order: rows across a bed, blocks side
// by side along a border, one plant to a pot. Salads come in batches, sown a
// few weeks apart. Pure functions: garden in, garden out.

import { toggleWishlist } from '../calendar/jobs';
import { nextInMonths } from '../lifecycle/projection';
import { sowingOf } from '../lifecycle/stages';
import { addDays } from '../model/dates';
import type { Space } from '../model/spaces';
import type { Feature, Garden, Plant, Point } from '../model/types';
import { splitIntoBatches } from './batches';
import { addPlanting, isContainer, makePlanting, type Layout } from './place';

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
      { items: [block('lavender'), block('cosmos'), block('calendula'), block('cornflower')], split: 'side' },
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
      { items: [block('lavender'), block('echinacea'), block('cosmos'), block('cornflower'), block('nigella')], split: 'side' },
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
];

export const kitsFor = (space: Space): Kit[] => KITS.filter((k) => k.space === space);

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
    return item ? [{ item: { ...item, layout: 'single' }, start: f.circle.centre, end: f.circle.centre }] : [];
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

/**
 * Plants a kit in the garden's beds and pots, in the order they were made, and puts its plants on your sowing list.
 * Salads in batches start at their next sowing time from `today`. Plants missing from the library are left out.
 */
export function applyKit(g: Garden, kit: Kit, plantOf: (id: string) => Plant | null, today: string): Garden {
  const beds = g.features.filter(isContainer);
  const known = (id: string) => plantOf(id)!;
  let next = g;
  kit.beds.forEach((bed, i) => {
    const f = beds[i];
    if (!f) return;
    const usable = { ...bed, items: bed.items.filter((it) => plantOf(it.plant)) };
    for (const { item, start, end } of placeIn(f, usable, known)) {
      const plant = known(item.plant);
      const pl = makePlanting(plant, f.id, item.layout, start, item.layout === 'single' ? undefined : end);
      next = addPlanting(next, pl);
      if (item.batches && item.layout !== 'single') {
        const how = sowingOf(plant);
        const months = (plant.sowing ?? []).filter((x) => (how === 'direct' ? x.method === 'direct' : x.method !== 'direct')).flatMap((x) => x.months);
        const first = nextInMonths(addDays(today, 1), months.length ? months : (plant.sowing ?? []).flatMap((x) => x.months)) ?? today;
        next = splitIntoBatches(next, pl.id, plant, item.batches, 21, first);
      }
    }
  });
  for (const id of kitPlants(kit)) if (plantOf(id) && !next.wishlist.includes(id)) next = toggleWishlist(next, id);
  return next;
}
