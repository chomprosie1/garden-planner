// Release 11b, your gardens: more than one garden kept in the browser, the one
// garden from before moved across, switching without mixing them up, starting
// again with what's ticked, and gardens hidden for 30 days to bring back.

import { describe, expect, it } from 'vitest';
import { newAppState, newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { KEEP_ALL, newGardenFrom, startAgainFrom, whatGoes } from '../src/model/fresh';
import type { AppState, Garden, Plant } from '../src/model/types';
import { toFile } from '../src/storage/file';
import {
  addGarden,
  appKeys,
  blobsInUse,
  daysLeft,
  gardenKey,
  hideGarden,
  listGardens,
  loadIndex,
  loadPlants,
  OLD_KEY,
  openGarden,
  openTraceKey,
  peekGarden,
  purgeHidden,
  renameGarden,
  saveOpen,
  startUp,
  traceKeyOf,
  wipeAll,
  type Kv,
} from '../src/storage/gardens';
import { unusedBlobs } from '../src/storage/photos';

/** localStorage, in memory. */
function memory(seed: Record<string, string> = {}): Kv & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
  } as Kv & { data: Map<string, string> };
}

const mine: Plant = {
  id: 'user-blue-potato',
  commonName: 'Blue potato',
  category: 'vegetable',
  conditions: { light: 'full-sun' },
  size: { spacingMm: 300 },
  verified: false,
  userAdded: true,
} as Plant;

function planted(name: string): Garden {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2000, h: 1000 }) }), name: 'Bed' };
  const g = addFeature({ ...newGarden(), name, latitude: 53.8, longitude: -1.55, placeName: 'Leeds', lastFrost: '04-20', firstFrost: '10-25', wishlist: ['tomato', 'basil'] }, bed);
  return {
    ...g,
    plantings: [{ id: 'p1', plantId: 'tomato', featureId: bed.id, x: 500, y: 500, picks: [{ date: '2026-08-01', grams: 300 }] }],
    notes: [
      { id: 'n1', date: '2026-07-01', text: 'First truss', photo: 'ph-a' },
      { id: 'n2', date: '2026-07-02', text: 'Watered' },
    ],
    jobsDone: [{ key: 'j1', date: '2026-07-01' }],
    trace: { x: 0, y: 0, widthMm: 10000, opacity: 0.5, calibrated: true },
  } as Garden;
}

const NOW = new Date('2026-10-08T09:00:00Z');

describe('the garden kept before there could be several', () => {
  it('moves across the first time: the garden, your own plants and its trace, and the old key goes', () => {
    const old: AppState = { garden: planted('Back garden'), userPlants: [mine] };
    const s = memory({ [OLD_KEY]: JSON.stringify(toFile(old)) });
    const idx = loadIndex(s, NOW)!;
    expect(idx.gardens).toHaveLength(1);
    const [e] = idx.gardens;
    expect(idx.open).toBe(e!.id);
    expect(e!.name).toBe('Back garden');
    expect(traceKeyOf(e!)).toBe('trace');
    expect(s.getItem(OLD_KEY)).toBeNull();
    expect(peekGarden(e!.id, s)!.plantings).toEqual(old.garden.plantings);
    expect(loadPlants(s).map((p) => p.id)).toEqual(['user-blue-potato']);
    // And the app opens it.
    expect(startUp(newGarden, s, NOW).garden.name).toBe('Back garden');
  });

  it('keeps an unreadable one aside rather than writing over it', () => {
    const s = memory({ [OLD_KEY]: '{ not json' });
    expect(loadIndex(s, NOW)).toBeNull();
    expect([...s.data.keys()].some((k) => k.startsWith(`${OLD_KEY}:unreadable:`))).toBe(true);
    const state = startUp(newGarden, s, NOW);
    expect(state.garden.name).toBe('My garden');
    expect(listGardens(s).gardens).toHaveLength(1);
  });

  it('starts a new garden when nothing is kept', () => {
    const s = memory();
    const state = startUp(newGarden, s, NOW);
    expect(state.garden.features).toEqual([]);
    expect(listGardens(s).gardens).toHaveLength(1);
    expect(listGardens(s).open).toBe(listGardens(s).gardens[0]!.id);
  });
});

describe('more than one garden', () => {
  const two = () => {
    const s = memory();
    startUp(() => planted('Back garden'), s, NOW);
    const first = listGardens(s).open!;
    const second = addGarden(planted('Allotment'), s, new Date('2026-10-08T10:00:00Z'))!;
    return { s, first, second };
  };

  it('saves only to the open garden, so switching never mixes them up', () => {
    const { s, first, second } = two();
    expect(listGardens(s).open).toBe(first);
    saveOpen({ garden: { ...planted('Back garden'), plantings: [] }, userPlants: [mine] }, s);
    expect(peekGarden(first, s)!.plantings).toEqual([]);
    expect(peekGarden(second, s)!.plantings).toHaveLength(1);
    // Open the other, change it, and the first is untouched.
    const opened = openGarden(second, s, NOW)!;
    expect(opened.garden.name).toBe('Allotment');
    saveOpen({ ...opened, garden: { ...opened.garden, name: 'The allotment', notes: [] } }, s);
    expect(peekGarden(second, s)!.name).toBe('The allotment');
    expect(listGardens(s).gardens.find((e) => e.id === second)!.name).toBe('The allotment');
    expect(peekGarden(first, s)!.name).toBe('Back garden');
    // Your own plants are shared.
    expect(openGarden(first, s, NOW)!.userPlants.map((p) => p.id)).toEqual(['user-blue-potato']);
  });

  it('lists the most recently opened first, and opens that one next time', () => {
    const { s, first, second } = two();
    openGarden(second, s, new Date('2026-10-09T09:00:00Z'));
    openGarden(first, s, new Date('2026-10-10T09:00:00Z'));
    expect(listGardens(s).gardens.map((e) => e.id)).toEqual([first, second]);
    expect(startUp(newGarden, s, NOW).garden.name).toBe('Back garden');
  });

  it('renames one that isn’t open, in its file and the list', () => {
    const { s, second } = two();
    renameGarden(second, '  Plot 14 ', s);
    expect(peekGarden(second, s)!.name).toBe('Plot 14');
    expect(listGardens(s).gardens.find((e) => e.id === second)!.name).toBe('Plot 14');
  });

  it('opens the next garden when the open one can’t be read, keeping it aside', () => {
    const { s, first, second } = two();
    s.setItem(gardenKey(first), '{ broken');
    expect(startUp(newGarden, s, NOW).garden.name).toBe('Allotment');
    expect(listGardens(s).open).toBe(second);
    expect([...s.data.keys()].some((k) => k.startsWith(`${gardenKey(first)}:unreadable:`))).toBe(true);
  });

  it('gives each garden its own trace photo', () => {
    const { s, second } = two();
    expect(openTraceKey(s)).toBe(`trace:${listGardens(s).open}`);
    openGarden(second, s, NOW);
    expect(openTraceKey(s)).toBe(`trace:${second}`);
  });
});

describe('cleared or deleted gardens, kept for 30 days', () => {
  it('hides a garden, brings it back intact, and deletes it for good after 30 days', () => {
    const s = memory();
    startUp(() => planted('Back garden'), s, NOW);
    const id = listGardens(s).open!;
    const before = peekGarden(id, s);
    hideGarden(id, s, NOW);
    expect(listGardens(s).gardens).toHaveLength(0);
    expect(listGardens(s).hidden.map((e) => e.id)).toEqual([id]);
    expect(daysLeft(listGardens(s).hidden[0]!, new Date('2026-10-18T09:00:00Z'))).toBe(20);
    // Brought back: the same garden, visible again.
    expect(openGarden(id, s, NOW)!.garden).toEqual(before);
    expect(listGardens(s).hidden).toHaveLength(0);
    // Hidden again; still there on day 29, gone on day 30.
    hideGarden(id, s, NOW);
    expect(purgeHidden(s, new Date('2026-11-06T09:00:00Z'))).toEqual([]);
    expect(purgeHidden(s, new Date('2026-11-07T09:00:00Z'))).toEqual([id]);
    expect(peekGarden(id, s)).toBeNull();
    expect(listGardens(s).hidden).toHaveLength(0);
  });

  it('a hidden garden isn’t what opens next time', () => {
    const s = memory();
    startUp(() => planted('Back garden'), s, NOW);
    const id = listGardens(s).open!;
    hideGarden(id, s, NOW);
    const state = startUp(newGarden, s, NOW);
    expect(state.garden.name).toBe('My garden');
    expect(listGardens(s).open).not.toBe(id);
  });
});

describe('photos and traces, tidied against every garden', () => {
  it('keeps what any garden uses, hidden ones too, and tidies the rest', () => {
    const s = memory();
    startUp(() => planted('Back garden'), s, NOW);
    const first = listGardens(s).open!;
    const second = addGarden({ ...planted('Allotment'), notes: [{ id: 'n9', date: '2026-07-01', text: '', photo: 'ph-b' }] }, s, NOW)!;
    hideGarden(second, s, NOW);
    const used = blobsInUse(s)!;
    expect([...used.photos].sort()).toEqual(['ph-a', 'ph-b']);
    expect([...used.traces].sort()).toEqual([`trace:${first}`, `trace:${second}`].sort());
    expect(unusedBlobs(['photo:ph-a', 'photo:ph-b', 'photo:ph-gone', `trace:${first}`, 'trace:g-gone', 'trace', 'other'], used)).toEqual(['photo:ph-gone', 'trace:g-gone', 'trace']);
  });

  it('tidies nothing when the gardens can’t be read', () => {
    expect(blobsInUse(memory())).toBeNull();
  });
});

describe('deleting everything', () => {
  it('removes every key this app keeps, and nothing else', () => {
    const s = memory({ 'garden-planner:prefs': '{}', 'garden-planner:weather': '{}', 'someone-else': 'x' });
    startUp(() => planted('Back garden'), s, NOW);
    addGarden(planted('Allotment'), s, NOW);
    expect(appKeys(s).length).toBeGreaterThan(3);
    wipeAll(s);
    expect([...s.data.keys()]).toEqual(['someone-else']);
  });
});

describe('a new garden, and starting again', () => {
  it('a new garden is empty, in the same place if you like', () => {
    const from = planted('Back garden');
    const near = newGardenFrom(from, ' Allotment ', true);
    expect(near.name).toBe('Allotment');
    expect([near.latitude, near.longitude, near.placeName, near.lastFrost, near.firstFrost]).toEqual([53.8, -1.55, 'Leeds', '04-20', '10-25']);
    expect(near.features).toEqual([]);
    expect(near.wishlist).toEqual([]);
    const far = newGardenFrom(from, '', false);
    expect(far.name).toBe('My garden');
    expect([far.latitude, far.longitude, far.placeName]).toEqual([52.5, -1.5, undefined]);
  });

  it('starting again keeps the name, and what’s ticked', () => {
    const old = planted('Back garden');
    const all = startAgainFrom(old, KEEP_ALL);
    expect(all.name).toBe('Back garden');
    expect(all.wishlist).toEqual(['tomato', 'basil']);
    expect(all.placeName).toBe('Leeds');
    expect([all.features, all.plantings, all.notes, all.jobsDone]).toEqual([[], [], [], []]);
    expect(all.trace).toBeUndefined();
    const none = startAgainFrom(old, { ownPlants: false, wishlist: false, place: false, look: false });
    expect(none.wishlist).toEqual([]);
    expect([none.latitude, none.placeName, none.lastFrost]).toEqual([52.5, undefined, undefined]);
    expect(none).toEqual({ ...newAppState().garden, name: 'Back garden' });
  });

  it('counts what goes', () => {
    expect(whatGoes(planted('Back garden'))).toEqual({ beds: 1, plantings: 1, notes: 2, photos: 1, picks: 1, jobs: 1 });
  });
});
