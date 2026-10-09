// Release 24, off to a good start: plants in a beginner's order, the easy list,
// kits for every season, and keeping the garden safe.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canSowIn, emptyFilter, filterPlants } from '../src/library/library';
import { beginnerOrder, EASY, isEasy, POPULAR } from '../src/library/order';
import { newGarden } from '../src/model/defaults';
import { makeSpace, spaceInfo, SPACES } from '../src/model/spaces';
import type { Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { applyKit, kitPlants, KITS, kitsFor } from '../src/planting/kits';
import { backupFile, parseFileText } from '../src/storage/file';
import { shouldAskToKeep } from '../src/storage/persist';
import { sanitisePrefs } from '../src/theme/prefs';

const DIR = join(__dirname, '../data/plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const ids = new Set(library.map((p) => p.id));

describe("plants in a beginner's order", () => {
  it('names only real plants, once each', () => {
    expect(POPULAR.filter((id) => !ids.has(id))).toEqual([]);
    expect(new Set(POPULAR).size).toBe(POPULAR.length);
  });

  it('puts the most-grown first, in order, then the rest A to Z', () => {
    const ordered = beginnerOrder(library.filter((p) => p.category !== 'weed'));
    expect(ordered.slice(0, 4).map((p) => p.id)).toEqual(['tomato', 'lettuce', 'strawberry', 'basil']);
    const rest = ordered.slice(POPULAR.length).map((p) => p.commonName);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(ordered.length).toBe(library.filter((p) => p.category !== 'weed').length);
  });

  it('leaves the list it was given alone', () => {
    const list = library.slice(0, 20);
    const before = list.map((p) => p.id);
    beginnerOrder(list);
    expect(list.map((p) => p.id)).toEqual(before);
  });
});

describe('easy to start', () => {
  it('names only real plants, each with an RHS source in its own words', () => {
    for (const [id, source] of Object.entries(EASY)) {
      expect(ids.has(id), id).toBe(true);
      expect(source, id).toMatch(/^RHS, "How to grow [^"]+": .*"[^"]+"/);
    }
  });

  it('counts a variety as easy when its plant is', () => {
    expect(isEasy({ id: 'tomato-gardeners-delight', varietyOf: 'tomato' })).toBe(true);
    expect(isEasy({ id: 'celeriac' })).toBe(false);
  });

  it('filters the plant list to the easy ones', () => {
    const easy = filterPlants(library, { ...emptyFilter, easyOnly: true });
    expect(easy.map((p) => p.id).sort()).toEqual(Object.keys(EASY).sort());
  });
});

describe('kits for every season', () => {
  const byId = new Map(library.map((p) => [p.id, p]));
  const plantOf = (id: string) => byId.get(id) ?? null;

  it('offers something to plant in October for every space, first', () => {
    for (const s of SPACES) {
      const first = kitsFor(s.id, 10, plantOf)[0]!;
      const ready = kitPlants(first).filter((id) => canSowIn(byId.get(id)!, 10) || canSowIn(byId.get(id)!, 11));
      expect(ready.length, `${s.id}: ${first.id}`).toBeGreaterThanOrEqual(Math.ceil(kitPlants(first).length / 2));
    }
  });

  it('puts the summer kits first in spring', () => {
    for (const s of SPACES) expect(kitsFor(s.id, 4, plantOf)[0]!.id.startsWith('autumn'), s.id).toBe(false);
  });

  it('keeps the plain order without a month', () => {
    expect(kitsFor('bed').map((k) => k.id)).toEqual(KITS.filter((k) => k.space === 'bed').map((k) => k.id));
  });

  it('plants each autumn kit inside its space, as a valid garden', () => {
    for (const kit of KITS.filter((k) => k.id.startsWith('autumn'))) {
      const g = applyKit(makeSpace(newGarden(), kit.space, ...spaceInfo(kit.space).size), kit, plantOf, '2026-10-09');
      expect(validateGarden(g), kit.id).toEqual([]);
      expect(g.plantings.length, kit.id).toBeGreaterThan(0);
    }
  });
});

describe('keeping the garden safe', () => {
  it('asks to keep the storage once there is something worth keeping', () => {
    expect(shouldAskToKeep(false, null, null, '2026-10-09')).toBe(false);
    expect(shouldAskToKeep(true, null, null, '2026-10-09')).toBe(true);
  });

  it('never asks again after a yes, and asks again a week after a no', () => {
    expect(shouldAskToKeep(true, 'kept', '2026-01-01', '2026-10-09')).toBe(false);
    expect(shouldAskToKeep(true, 'not-kept', '2026-10-05', '2026-10-09')).toBe(false);
    expect(shouldAskToKeep(true, 'not-kept', '2026-10-02', '2026-10-09')).toBe(true);
    expect(shouldAskToKeep(true, 'unknown', '2026-09-30', '2026-10-09')).toBe(true);
  });

  it('keeps what the browser said in the preferences, and drops anything else', () => {
    expect(sanitisePrefs({ storageKept: 'kept', storageAsked: '2026-10-09' })).toMatchObject({ storageKept: 'kept', storageAsked: '2026-10-09' });
    expect(sanitisePrefs({ storageKept: 'yes', storageAsked: 'Thursday' })).toMatchObject({ storageKept: null, storageAsked: null });
  });

  it('makes a backup file named after the garden and the day, that reads back', async () => {
    const g = { ...newGarden(), name: 'Back garden' };
    const file = backupFile({ garden: g, userPlants: [] });
    expect(file.name).toMatch(/^back-garden-\d{4}-\d{2}-\d{2}\.json$/);
    expect(file.type).toBe('application/json');
    const read = parseFileText(await file.text());
    expect(read.ok).toBe(true);
  });
});
