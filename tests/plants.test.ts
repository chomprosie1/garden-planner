// The starter library is checked on every build: valid entries, unique ids,
// companions that point at real plants, and the provenance rules.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allPlants, copyAsUserPlant, deleteUserPlant, filterPlants, emptyFilter, monthRanges, saveUserPlant, blankPlant, canSowIn } from '../src/library/library';
import { newAppState } from '../src/model/defaults';
import type { Plant } from '../src/model/types';
import { validatePlant } from '../src/model/validate';

const DIR = join(__dirname, '..', 'data', 'plants');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const library: Plant[] = files.flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const ids = new Set(library.map((p) => p.id));

describe('starter library', () => {
  it('has the first batch of 30 vegetables', () => {
    expect(library.filter((p) => p.category === 'vegetable').length).toBeGreaterThanOrEqual(30);
  });

  it('has unique, slug-shaped ids that never look like your own plants', () => {
    expect(ids.size).toBe(library.length);
    for (const p of library) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.id.startsWith('user-')).toBe(false);
    }
  });

  for (const p of library) {
    describe(p.id, () => {
      it('is a valid plant', () => {
        expect(validatePlant(p)).toEqual([]);
      });
      it('says where its facts come from and is marked as library data', () => {
        expect(p.source?.trim()).toBeTruthy();
        expect(p.userAdded).toBe(false);
        if (p.verified) expect(p.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
      it('only names companions that are in the library, and never itself', () => {
        for (const c of [...(p.companions?.good ?? []), ...(p.companions?.avoid ?? [])]) {
          expect(ids.has(c), `${p.id} → ${c}`).toBe(true);
          expect(c).not.toBe(p.id);
        }
      });
      it('gives pest controls without naming chemical products', () => {
        for (const pest of p.pests ?? []) expect(pest.control).not.toMatch(/spray with [A-Z]|insecticide|fungicide|pesticide/i);
      });
      it('has spacing no wider than it is sensible for the spread', () => {
        expect(p.size.spacingMm).toBeGreaterThan(0);
        expect(p.size.spacingMm).toBeLessThanOrEqual(3000);
      });
    });
  }
});

describe('search and filters', () => {
  it('finds by common or Latin name, ignoring case', () => {
    expect(filterPlants(library, { ...emptyFilter, query: 'BEAN' }).map((p) => p.id).sort()).toEqual(['borlotti-bean', 'broad-bean', 'french-bean', 'green-manure', 'runner-bean', 'yardlong-bean']);
    expect(filterPlants(library, { ...emptyFilter, query: 'allium' }).length).toBeGreaterThanOrEqual(5);
  });

  it('filters by light and by what can be sown this month', () => {
    expect(filterPlants(library, { ...emptyFilter, light: 'part-shade' }).every((p) => p.conditions.light === 'part-shade')).toBe(true);
    const october = filterPlants(library, { ...emptyFilter, sowMonth: 10 }).map((p) => p.id);
    expect(october).toContain('garlic');
    expect(october).toContain('broad-bean');
    expect(october).not.toContain('tomato');
  });

  it('can hide unchecked library entries but always keeps your own plants', () => {
    const mine = { ...blankPlant(), commonName: 'Grandad’s bean' };
    const list = allPlants(library, [mine]);
    const checked = filterPlants(list, { ...emptyFilter, checkedOnly: true });
    expect(checked.map((p) => p.id)).toContain(mine.id);
    expect(checked.every((p) => p.verified || p.userAdded)).toBe(true);
  });

  it('knows sowing and planting-out months', () => {
    const tomato = library.find((p) => p.id === 'tomato')!;
    expect(canSowIn(tomato, 3)).toBe(true);
    expect(canSowIn(tomato, 5)).toBe(true); // planting out
    expect(canSowIn(tomato, 9)).toBe(false);
  });
});

describe('month ranges', () => {
  it('reads naturally', () => {
    expect(monthRanges([2, 3, 4, 10, 11])).toBe('Feb–Apr, Oct–Nov');
    expect(monthRanges([10, 11, 12, 1, 2, 3])).toBe('Oct–Mar');
    expect(monthRanges([6])).toBe('Jun');
    expect(monthRanges([1, 3])).toBe('Jan, Mar');
    expect(monthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('All year');
    expect(monthRanges([])).toBe('');
    expect(monthRanges([4, 5], true)).toBe('April–May');
  });
});

describe('your own plants', () => {
  it('copies a library plant as your own variety, and saves, edits and deletes it', () => {
    const potato = library.find((p) => p.id === 'potato')!;
    const mine = copyAsUserPlant(potato, "Pink Fir Apple");
    expect(mine.id).toMatch(/^user-/);
    expect(mine).toMatchObject({ userAdded: true, verified: false, commonName: 'Pink Fir Apple' });
    expect(validatePlant(mine)).toEqual([]);

    let s = saveUserPlant(mine)(newAppState());
    expect(s.userPlants).toHaveLength(1);
    s = saveUserPlant({ ...mine, size: { ...mine.size, spacingMm: 300 } })(s);
    expect(s.userPlants).toHaveLength(1);
    expect(s.userPlants[0]!.size.spacingMm).toBe(300);
    s = deleteUserPlant(mine.id)(s);
    expect(s.userPlants).toHaveLength(0);
  });
});
