// Release 44: less, but better. The welcome only for a new month or news;
// checks you've said are fine stay quiet; a first garden's shopping list has
// one general feed; plants still being checked are hidden unless asked for;
// and 3D opens on the beds, not the house.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { shoppingList } from '../src/planting/shopping';
import { sanitisePrefs } from '../src/theme/prefs';
import { buildScene } from '../src/three/scene';
import { stillToCheck } from '../src/ui/appContext';
import { welcomeDue } from '../src/ui/launch';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), name: 'Bed 1' };
const row = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2100]), ...patch });
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));

describe('no welcome on a normal day', () => {
  it('welcomes a new month, or news you haven’t seen, once that day', () => {
    expect(welcomeDue('2026-10-15', '2026-10-16')).toBe(false);
    expect(welcomeDue('2026-10-31', '2026-11-01')).toBe(true);
    expect(welcomeDue('2026-10-15', '2026-10-16', true)).toBe(true);
    expect(welcomeDue('2026-10-16', '2026-10-16', true)).toBe(false);
  });
});

describe('checks you’ve said are fine', () => {
  const findings = [
    { id: 'spacing:a', level: 'warn' },
    { id: 'sun:b', level: 'warn' },
    { id: 'good:c', level: 'good' },
  ];
  it('leaves out dismissed warnings, and nothing else', () => {
    expect(stillToCheck(findings, ['spacing:a']).map((f) => f.id)).toEqual(['sun:b', 'good:c']);
    expect(stillToCheck(findings).map((f) => f.id)).toEqual(['spacing:a', 'sun:b', 'good:c']);
  });

  it('keeps the dismissed checks, and the plants-still-being-checked switch, as preferences', () => {
    const p = sanitisePrefs({ dismissedChecks: ['spacing:a', 3, null], draftPlants: true });
    expect(p.dismissedChecks).toEqual(['spacing:a']);
    expect(p.draftPlants).toBe(true);
    expect(sanitisePrefs({}).draftPlants).toBe(false);
    expect(sanitisePrefs({}).dismissedChecks).toEqual([]);
  });
});

describe('a first garden’s shopping list', () => {
  const g = gardenWith(row('tomato'), row('leek'), row('blueberry'), row('kale'));
  const feeds = (garden: Garden) => shoppingList(garden, plantOf, '2027-02-01', { feeding: true }).filter((i) => i.kind === 'feed').map((i) => i.key);

  it('has one general feed, and only the specialist feeds a plant can’t do without', () => {
    const list = feeds(g);
    expect(list).toContain('feed:blood-fish-bone');
    expect(list).toContain('feed:tomato-feed');
    expect(list).toContain('feed:ericaceous-feed');
    for (const id of ['sulphate-of-potash', 'sulphate-of-ammonia', 'chicken-manure-pellets', 'liquid-seaweed', 'balanced-granular', 'bonemeal']) expect(list).not.toContain(`feed:${id}`);
  });

  it('a garden with a feed shelf gets each feed by name, as before', () => {
    const shelved = { ...g, feedShelf: ['blood-fish-bone'] };
    const list = feeds(shelved);
    expect(list.length).toBeGreaterThan(2);
  });
});

describe('3D opens on the beds', () => {
  it('aims at the beds and plants, not the whole garden with the house', () => {
    const house = makeFeature('building', { area: rectPoints({ x: 0, y: 6000, w: 8000, h: 3000 }) });
    const g = addFeature(gardenWith(row('carrot')), house);
    const s = buildScene({ garden: g, plantOf, date: '2027-07-01' });
    expect(s.focus).toBeDefined();
    expect(s.focus!.max[1]).toBeLessThanOrEqual(2400);
    expect(s.bounds.max[1]).toBeGreaterThan(s.focus!.max[1]);
  });
});
