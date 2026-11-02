// Balconies and pots: what you've said about a balcony, the light and cover each
// pot gets from it, and what suits a pot. Pure functions: garden in, answers or
// garden out.
//
// Six hours of sun or more is full sun, as most sources have it (Chicago Botanic
// Garden, UC Master Gardeners). The bands below that vary from one source to the
// next, and the RHS's own wasn't found, so 3 to 5 hours as part shade, and light
// judged from the way a balcony faces, are rules of thumb.

import { beginnerOrder } from '../library/order';
import { canSowIn } from '../library/library';
import { isTender } from '../lifecycle/shed';
import { facingBearing } from '../lifecycle/shedSun';
import type { Balcony, BalconySun, Facing, Feature, Garden, Light, Plant } from '../model/types';
import { isActive } from './place';
import { isPot, potNeeds, potsOnly, potSize } from './pots';

const FROM_SUN: Record<BalconySun, Light> = { most: 'full-sun', half: 'part-shade', little: 'shade' };
const FROM_FACING: Record<Facing, Light> = {
  north: 'shade',
  'north-east': 'part-shade',
  east: 'part-shade',
  'south-east': 'full-sun',
  south: 'full-sun',
  'south-west': 'full-sun',
  west: 'part-shade',
  'north-west': 'part-shade',
};

export const LIGHT_WORDS: Record<Light, string> = { 'full-sun': 'full sun', 'part-shade': 'part shade', shade: 'shade' };
export const LIGHT_RANK: Record<Light, number> = { shade: 0, 'part-shade': 1, 'full-sun': 2 };

/** Just a balcony: nothing but pots, up where glass and fleece don't come into it. */
export const onBalcony = (g: Garden): boolean => !!g.balcony && potsOnly(g);

/** On a balcony there's nowhere to raise it first: what can be sown outside goes straight in its pot, and isn't planted out. */
export const sowsOnBalcony = (g: Garden, plant: Plant): boolean => onBalcony(g) && !isTender(plant) && !!plant.sowing?.some((s) => s.method === 'direct' && !s.from);
export const sowsInPot = (g: Garden, plant: Plant, f: Feature): boolean => isPot(f) && sowsOnBalcony(g, plant);

/** A text without the sentences that match. */
const without = (text: string, words: RegExp) => text.split(/(?<=[.!?])\s+/).filter((s) => !words.test(s)).join(' ');

/** Advice that takes a greenhouse or cold frame, without it for a balcony that hasn't one. */
export function withoutGlass(g: Garden, text: string): string {
  if (!onBalcony(g) || g.features.some((f) => f.kind === 'greenhouse' || f.kind === 'cold-frame')) return text;
  return without(text, /greenhouse|cold frame|polytunnel/i);
}

/** A sowing's advice, for sowing where it's to grow: nothing about raising it to move later. */
export const sownWhereItGrows = (text: string) => without(text, /modules|seedbed|root trainers|\bmove\b|transplant|plant(ing)? (them )?out/i);

/** What to do about a frost on a balcony, where fleece blows away: a plant's own advice without it, or this. */
export const frostCareOnBalcony = (notes = '') => without(notes, /fleece/i) || 'Move it to the most sheltered spot, against the wall, before the first frosts.';

/** Grown to eat. */
export const isFood = (p: Plant): boolean => !!p.cropping?.harvestMonths.length && ['vegetable', 'herb', 'fruit'].includes(p.category);

/** A balcony's light: from the sun you've said it gets, or the way it faces. Null if you've said neither. */
export function balconyLight(b: Balcony | undefined): Light | null {
  if (b?.sun) return FROM_SUN[b.sun];
  return b?.facing ? FROM_FACING[b.facing] : null;
}

/** The light a place gets: as you've said, or for a pot, the balcony's. */
export const lightHere = (g: Garden, f: Feature): Light | null => f.light ?? (isPot(f) ? balconyLight(g.balcony) : null);

/** Rain doesn't reach it: a pot you've said is under cover, or any pot under a balcony's roof, unless you've said otherwise. */
export const isCovered = (g: Garden, f: Feature): boolean => isPot(f) && (f.covered ?? !!g.balcony?.roof);

/**
 * The balcony as you've said it. Pots take its light, except ones you've set yourself to something else. A balcony
 * facing a way has the plan's top pointing that way, as its railing's drawn along the top: not if you've set north yourself.
 */
export function setBalcony(g: Garden, b: Balcony): Garden {
  const was = balconyLight(g.balcony);
  const northFor = (f: Facing | undefined) => (f ? (360 - facingBearing(f)) % 360 : 0);
  const turned = !!b.facing && b.facing !== g.balcony?.facing && g.northRotationDeg === northFor(g.balcony?.facing);
  const light = balconyLight(b);
  const { balcony: _old, ...rest } = g;
  const said = b.facing !== undefined || b.sun !== undefined || b.roof !== undefined || b.windy !== undefined;
  const features = g.features.map((f) => {
    if (!isPot(f) || (f.light && f.light !== was)) return f;
    if (light) return { ...f, light };
    const { light: _gone, ...plain } = f;
    return plain;
  });
  return { ...rest, ...(said ? { balcony: b } : {}), features, ...(turned ? { northRotationDeg: northFor(b.facing) } : {}) };
}

/** Whether a plant suits a pot: it fits the pot's width, isn't too tall for it, and likes the light it gets, where that's known. */
export function suitsPot(p: Plant, g: Garden, f: Feature): boolean {
  const size = potSize(f);
  if (!size) return true;
  if (potNeeds(p) > size.across * 1.05) return false;
  // Rule of thumb: a tall plant needs a pot wide enough to stay upright.
  if ((p.size.heightMm ?? 0) > 1500 && size.across < 400) return false;
  const light = lightHere(g, f);
  if (!light) return true;
  return LIGHT_RANK[light] >= LIGHT_RANK[p.conditions.light] && !(p.conditions.light === 'shade' && light === 'full-sun');
}

/** A few plants that would suit a pot, what can go in soonest first, leaving out what's in it already. */
export function plantsFor(plants: Plant[], g: Garden, f: Feature, month: number, n = 3): Plant[] {
  const here = new Set(g.plantings.filter((pl) => pl.featureId === f.id && isActive(pl)).map((pl) => pl.plantId));
  const suits = plants.filter((p) => p.category !== 'weed' && !p.varietyOf && !p.userAdded && !here.has(p.id) && suitsPot(p, g, f));
  // Food for food: someone growing basil wants something to eat, not a daffodil.
  const food = plants.some((p) => here.has(p.id) && isFood(p)) ? suits.filter(isFood) : [];
  const fit = food.length ? food : suits;
  const soon = (p: Plant) => (canSowIn(p, month) ? 0 : canSowIn(p, (month % 12) + 1) ? 1 : 2);
  const order = new Map(beginnerOrder(fit).map((p, i) => [p.id, i]));
  return [...fit].sort((a, b) => soon(a) - soon(b) || order.get(a.id)! - order.get(b.id)!).slice(0, n);
}
