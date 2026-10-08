// Release 13, from plot to plate: the kitchen data (every crop, every recipe),
// what's cropping this week, recipes chosen for it, and what the year's picks
// would have cost in the shops.

import { describe, expect, it } from 'vitest';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { KITCHEN } from '../src/kitchen/data';
import { croppingNow, harvestWorth, KEEPS, minutesText, poundsText, recipesFor, recipesWith } from '../src/kitchen/recipes';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Garden, Plant, Planting } from '../src/model/types';
import { unknownPlant } from '../src/planting/place';
import { seasonStats, wrappedCards } from '../src/share/wrapped';

const library = [...vegetables, ...herbs, ...fruit] as Plant[];
const plantOf = (id: string) => library.find((p) => p.id === id) ?? unknownPlant(id);
const crops = library.filter((p) => p.cropping?.harvestMonths.length);

describe('the kitchen data', () => {
  it('has every crop: how to store it, keep it and use it, and a sensible price', () => {
    expect(crops.length).toBeGreaterThan(130);
    for (const p of crops) {
      const k = KITCHEN.crops[p.id];
      expect(k, p.id).toBeTruthy();
      for (const line of [k!.store, k!.preserve, k!.use]) expect(line.length, p.id).toBeGreaterThan(8);
      expect(k!.kg, p.id).toBeGreaterThan(0.5);
      expect(k!.kg, p.id).toBeLessThan(50);
      expect(k!.keeps.length, p.id).toBeGreaterThan(0);
      for (const x of k!.keeps) expect(KEEPS, `${p.id}: ${x}`).toContain(x);
    }
    // And nothing that isn't a crop.
    for (const id of Object.keys(KITCHEN.crops)) expect(crops.some((p) => p.id === id), id).toBe(true);
  });

  it('has about a hundred short recipes, each using real crops, in season', () => {
    const r = KITCHEN.recipes;
    expect(r.length).toBeGreaterThanOrEqual(100);
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
    expect(new Set(r.map((x) => x.title)).size).toBe(r.length);
    for (const x of r) {
      expect(x.crops.length, x.id).toBeGreaterThan(0);
      for (const c of x.crops) expect(KITCHEN.crops[c], `${x.id}: ${c}`).toBeTruthy();
      expect(x.months.length, x.id).toBeGreaterThan(0);
      for (const m of x.months) expect(m >= 1 && m <= 12, x.id).toBe(true);
      expect(x.minutes, x.id).toBeGreaterThan(0);
      expect(x.serves, x.id).toBeGreaterThan(0);
      expect(x.ingredients.length, x.id).toBeGreaterThan(0);
      expect(x.method.length, x.id).toBeGreaterThan(0);
      expect(x.method.length, x.id).toBeLessThanOrEqual(5);
    }
    // Most crops have a recipe.
    const used = new Set(r.flatMap((x) => x.crops));
    expect(crops.filter((p) => used.has(p.id)).length).toBeGreaterThan(80);
  });

  it('is written in the app’s voice: no exclamation marks, no filler', () => {
    const text = [...Object.values(KITCHEN.crops).flatMap((k) => [k.store, k.preserve, k.use]), ...KITCHEN.recipes.flatMap((x) => [x.title, ...x.method, ...x.ingredients])];
    for (const t of text) {
      expect(t, t).not.toMatch(/\w!(\s|$)/);
      expect(t, t).not.toMatch(/\b(simply|easily|effortless|delve|elevate)\b/i);
    }
  });
});

/** A 6 × 4 m garden with one bed, and plantings in it. */
function garden(plantings: Partial<Planting>[]): Garden {
  const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 6000, h: 4000 }) });
  const g = addFeature(newGarden(), bed);
  return { ...g, plantings: plantings.map((p, i) => ({ id: `p${i}`, featureId: bed.id, x: 500 + i * 600, y: 500, plantId: 'tomato', ...p })) };
}

describe('what’s cropping this week', () => {
  it('finds crops ready to pick, and ones picked lately, but not flowers or what’s cleared', () => {
    const g = garden([
      { plantId: 'tomato', stage: 'transplanted', stageDates: { transplanted: '2026-05-20' } },
      { plantId: 'lettuce', removedOn: '2026-08-01', stage: 'harvesting' },
      { plantId: 'basil', picks: [{ date: '2026-08-10', grams: 30 }] },
      { plantId: 'sweet-pea', stage: 'flowering' },
    ]);
    const now = croppingNow(g, plantOf, KITCHEN, '2026-08-15');
    expect(now).toContain('tomato');
    expect(now).toContain('basil');
    expect(now).not.toContain('lettuce');
    expect(now).not.toContain('sweet-pea');
    // Each crop once.
    expect(new Set(now).size).toBe(now.length);
    // A pick more than ten days ago doesn't count on its own.
    expect(croppingNow(garden([{ plantId: 'basil', picks: [{ date: '2026-07-01', grams: 30 }], stage: 'germinated', stageDates: { germinated: '2026-08-14' } }]), plantOf, KITCHEN, '2026-08-15')).toEqual([]);
  });
});

describe('recipes for what’s cropping', () => {
  it('chooses a few that use it, spreading over the crops', () => {
    const r = recipesFor(['tomato', 'french-bean'], 8, KITCHEN.recipes);
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.crops.some((c) => c === 'tomato' || c === 'french-bean'))).toBe(true);
    expect(r.some((x) => x.crops.includes('french-bean'))).toBe(true);
    expect(r.some((x) => x.crops.includes('tomato'))).toBe(true);
    expect(recipesFor([], 8, KITCHEN.recipes)).toEqual([]);
    // The same answer every time.
    expect(recipesFor(['tomato', 'french-bean'], 8, KITCHEN.recipes).map((x) => x.id)).toEqual(r.map((x) => x.id));
  });

  it('puts what’s in season first', () => {
    const r = recipesFor(['rhubarb'], 3, KITCHEN.recipes);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.months).toContain(3);
    const w = recipesWith('apple', KITCHEN.recipes, 10);
    expect(w[0]!.months).toContain(10);
    expect(recipesWith('no-such-crop', KITCHEN.recipes)).toEqual([]);
  });
});

describe('what the harvest is worth', () => {
  it('adds up the year’s picks at shop prices, most first', () => {
    const g = garden([
      { plantId: 'tomato', picks: [{ date: '2026-08-01', grams: 1500 }, { date: '2026-08-20', grams: 500 }, { date: '2025-08-01', grams: 9000 }] },
      { plantId: 'basil', picks: [{ date: '2026-07-01', grams: 500 }] },
      { plantId: 'not-a-crop', picks: [{ date: '2026-07-01', grams: 500 }] },
    ]);
    const w = harvestWorth(g, KITCHEN, 2026);
    // 2 kg of tomatoes at £4, and 0.5 kg of basil at £28.
    expect(w.pounds).toBeCloseTo(2 * KITCHEN.crops.tomato!.kg + 0.5 * KITCHEN.crops.basil!.kg, 5);
    expect(w.crops.map((c) => c.plantId)).toEqual(['basil', 'tomato']);
    expect(harvestWorth(g, KITCHEN, 2024).pounds).toBe(0);
  });

  it('says it roughly', () => {
    expect(poundsText(0.4)).toBe('under £1');
    expect(poundsText(143.4)).toBe('about £143');
    expect(poundsText(1234)).toBe('about £1,234');
    expect(minutesText(20)).toBe('20 min');
    expect(minutesText(75)).toBe('1 hr 15 min');
    expect(minutesText(180)).toBe('3 hr');
  });

  it('is a card in the year, wrapped', () => {
    const g = garden([{ plantId: 'tomato', stage: 'harvesting', stageDates: { harvesting: '2026-08-01' }, picks: [{ date: '2026-08-01', grams: 2000 }] }]);
    const s = seasonStats(g, 2026);
    const name = (id: string) => plantOf(id).commonName;
    expect(wrappedCards(s, 'Test', name, 8.2).find((c) => c.eyebrow === 'Your garden grew')!.big).toBe('£8');
    expect(wrappedCards(s, 'Test', name).some((c) => c.eyebrow === 'Your garden grew')).toBe(false);
  });
});
