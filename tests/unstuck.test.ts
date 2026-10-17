// Release 40: unstuck. One unit per size; search that hears plurals and
// "what can I grow now"; a copied bed that leaves the original's name alone;
// and rows of one sowing shown as one in the Shed.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { formatAcross, formatSize } from '../src/canvas/viewport';
import { feedById, stepText } from '../src/feeding/feeds';
import { indoorGroups } from '../src/lifecycle/shed';
import { sowList } from '../src/lifecycle/sowList';
import { filterPlants, emptyFilter, plantMatches, singular, withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { featureLabel } from '../src/model/features';
import { addListBed, copyListBed, nextName } from '../src/model/listLayout';
import type { Plant, Planting } from '../src/model/types';
import { unknownPlant } from '../src/planting/place';
import { search, type SearchContext } from '../src/ui/search';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

describe('one unit per size', () => {
  it('says both sides in one unit, the longer first', () => {
    expect(formatSize(1200, 600)).toBe('1.2 × 0.6 m');
    expect(formatSize(1200, 2400)).toBe('2.4 × 1.2 m');
    expect(formatSize(2400, 1200)).toBe('2.4 × 1.2 m');
    expect(formatSize(600, 450)).toBe('60 × 45 cm');
    expect(formatAcross(350)).toBe('35 cm across');
    expect(formatAcross(1200)).toBe('1.2 m across');
  });
});

describe('search hears plurals and questions', () => {
  const ctx: SearchContext = { garden: newGarden(), plants: library, plantOf, locked: false };
  const first = (q: string) => search(q, ctx)[0];

  it('singularises a word', () => {
    expect(['tomatoes', 'strawberries', 'potatoes', 'beans', 'peas', 'asparagus', 'cress'].map(singular)).toEqual(['tomato', 'strawberry', 'potato', 'bean', 'pea', 'asparagus', 'cress']);
  });

  it('finds the plant from its plural, first', () => {
    for (const [q, id] of [
      ['tomatoes', 'tomato'],
      ['strawberries', 'strawberry'],
      ['potatoes', 'potato'],
    ] as const)
      expect(first(q)?.plantId, q).toBe(id);
  });

  it('puts the strawberry before the strawberry tree, but a pot before pot marjoram', () => {
    expect(first('strawberry')?.plantId).toBe('strawberry');
    expect(first('pot')?.command).toEqual({ kind: 'sticker', id: 'pot' });
    // A plural doesn't start another word: "bees" isn't beetroot.
    expect(first('bees')?.command).toEqual({ kind: 'lens', lens: 'flower' });
  });

  it('answers "what can I grow now"', () => {
    expect(first('what can I grow now')?.command).toEqual({ kind: 'sowNow' });
  });

  it('the same matching in the Shed’s Sow seeds', () => {
    const l = sowList(library, { month: 10, kind: 'all', query: 'broad beans', weeds: false, tin: new Set() });
    expect([...l.now, ...l.later, ...l.other].some((p) => p.id === 'broad-bean')).toBe(true);
  });

  it('the same matching in the Plants list', () => {
    expect(filterPlants(library, { ...emptyFilter, query: 'tomatoes' }).some((p) => p.id === 'tomato')).toBe(true);
    expect(plantMatches(plantOf('broad-bean'), ['beans'])).not.toBeNull();
    expect(plantMatches(plantOf('beetroot'), ['bees'])).toBeNull();
  });
});

describe('another bed like this', () => {
  it('takes the next free name, and leaves the one copied alone', () => {
    expect(nextName('Bed 2', new Set(['Bed 1', 'Bed 2']))).toBe('Bed 3');
    expect(nextName('Bed 2 (legumes)', new Set(['Bed 2 (legumes)']))).toBe('Bed 2 (legumes) 2');
    expect(nextName('Veg', new Set(['Veg', 'Veg 2']))).toBe('Veg 3');
    const [g, id] = addListBed({ ...newGarden(), view: 'list' }, 'bed', 'Bed 2 (legumes)');
    const [next] = copyListBed(g, id, featureLabel)!;
    expect(next.features.map(featureLabel)).toEqual(['Bed 2 (legumes)', 'Bed 2 (legumes) 2']);
  });
});

describe('rows of one sowing, as one', () => {
  it('groups the Shed’s plantings by plant, bed, day and stage', () => {
    const row = (id: string, featureId: string, sownOn: string): Planting => ({ id, plantId: 'broad-bean', featureId, x: 0, y: 0, sownOn, sowing: 'indoors' });
    const groups = indoorGroups([row('a', 'b2', '2026-10-16'), row('b', 'b2', '2026-10-16'), row('c', 'b2', '2026-10-01'), row('d', 'b3', '2026-10-16')]);
    expect(groups.map((g) => g.map((p) => p.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
});

describe('small fixes', () => {
  it('the onion’s feed note is a whole sentence', () => {
    const step = plantOf('onion').feeding!.steps.find((s) => s.when === 'planting')!;
    expect(feedById(step.feed)).toBeTruthy();
    expect(stepText(step)).toMatch(/Rake it in a week or two before planting\.$/);
  });
});
