// Your gardens, kept in this browser: an index (which gardens there are, which
// is open, when each was last opened, and any you've cleared or deleted,
// hidden for a while so they can be brought back), each garden under its own
// key, and your own plants once, for every garden. The first time, the single
// garden kept before there could be several is moved across.
// Storage can be unavailable (private windows, blocked site data), so every
// access is guarded and the app still works.

import { dayNumber } from '../model/dates';
import { KEEP_DAYS } from '../model/fresh';
import { newId, todayIso } from '../model/ids';
import { migratePlant } from '../model/migrate';
import type { AppState, Garden, Plant } from '../model/types';
import { validatePlant } from '../model/validate';
import { parseFile, toFile } from './file';

export type Kv = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const PREFIX = 'garden-planner:';
const INDEX = `${PREFIX}gardens`;
const PLANTS = `${PREFIX}user-plants`;
/** Where the one garden was kept before there could be several. */
export const OLD_KEY = `${PREFIX}state`;
export const gardenKey = (id: string) => `${PREFIX}garden:${id}`;

export interface GardenEntry {
  id: string;
  name: string;
  /** When it was last opened, ISO date and time. */
  openedAt: string;
  /** The day it was cleared or deleted: hidden, and gone for good after KEEP_DAYS. */
  hiddenOn?: string;
  /** Where its trace photo is kept (IndexedDB). Absent: "trace:" and its id. The garden moved across keeps the old "trace". */
  traceKey?: string;
}

export interface GardensIndex {
  open: string;
  gardens: GardenEntry[];
}

const safe = (): Kv | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const get = (s: Kv | null, key: string): string | null => {
  try {
    return s?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
/** False when it couldn't be kept (storage full or blocked). */
const put = (s: Kv | null, key: string, value: string): boolean => {
  try {
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
const drop = (s: Kv | null, key: string) => {
  try {
    s?.removeItem(key);
  } catch {
    // nothing kept anyway
  }
};

/** Keeps unreadable data aside rather than letting the next save write over it. */
const keepAside = (s: Kv | null, key: string, raw: string, now: Date) => put(s, `${key}:unreadable:${now.getTime()}`, raw);

const isEntry = (e: unknown): e is GardenEntry => {
  const x = e as GardenEntry;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.openedAt === 'string' && (x.hiddenOn === undefined || typeof x.hiddenOn === 'string') && (x.traceKey === undefined || typeof x.traceKey === 'string');
};

function readIndex(s: Kv | null): GardensIndex | null {
  const raw = get(s, INDEX);
  if (!raw) return null;
  try {
    const x = JSON.parse(raw) as GardensIndex;
    if (typeof x.open !== 'string' || !Array.isArray(x.gardens)) return null;
    return { open: x.open, gardens: x.gardens.filter(isEntry) };
  } catch {
    return null;
  }
}

const writeIndex = (s: Kv | null, idx: GardensIndex) => put(s, INDEX, JSON.stringify(idx));

/** Your own plants, shared by every garden. Ones that don't check out are left out. */
export function loadPlants(s: Kv | null = safe()): Plant[] {
  const raw = get(s, PLANTS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list.map(migratePlant).filter((p) => validatePlant(p).length === 0) as Plant[]) : [];
  } catch {
    return [];
  }
}

/** A kept garden, checked and brought up to date; null if it's missing or can't be read. */
export function peekGarden(id: string, s: Kv | null = safe()): Garden | null {
  const raw = get(s, gardenKey(id));
  if (!raw) return null;
  try {
    const r = parseFile(JSON.parse(raw));
    return r.ok ? r.state.garden : null;
  } catch {
    return null;
  }
}

const writeGarden = (s: Kv | null, id: string, g: Garden, now = new Date()) => put(s, gardenKey(id), JSON.stringify(toFile({ garden: g, userPlants: [] }, now)));

/**
 * The index, moving the single garden kept before across the first time: it becomes the first garden, with your own
 * plants kept for every garden, and the old key goes once the new ones are written. Null when there's nothing kept.
 */
export function loadIndex(s: Kv | null = safe(), now = new Date()): GardensIndex | null {
  const idx = readIndex(s);
  if (idx) return idx;
  const old = get(s, OLD_KEY);
  if (!old) return null;
  let r: ReturnType<typeof parseFile>;
  try {
    r = parseFile(JSON.parse(old));
  } catch {
    r = { ok: false, errors: [] };
  }
  if (!r.ok) {
    keepAside(s, OLD_KEY, old, now);
    drop(s, OLD_KEY);
    return null;
  }
  const id = newId('g');
  const moved: GardensIndex = { open: id, gardens: [{ id, name: r.state.garden.name, openedAt: now.toISOString(), traceKey: 'trace' }] };
  const ok = writeGarden(s, id, r.state.garden, now) && put(s, PLANTS, JSON.stringify(r.state.userPlants)) && writeIndex(s, moved);
  // Only once it's all safely written does the old copy go.
  if (ok) drop(s, OLD_KEY);
  return ok ? moved : null;
}

const visible = (idx: GardensIndex) => idx.gardens.filter((g) => !g.hiddenOn);

/** Your gardens to choose from, most recently opened first, and those cleared or deleted, still to bring back. */
export function listGardens(s: Kv | null = safe()): { gardens: GardenEntry[]; hidden: GardenEntry[]; open: string | null } {
  const idx = loadIndex(s);
  if (!idx) return { gardens: [], hidden: [], open: null };
  const byOpened = (a: GardenEntry, b: GardenEntry) => b.openedAt.localeCompare(a.openedAt);
  return { gardens: visible(idx).sort(byOpened), hidden: idx.gardens.filter((g) => g.hiddenOn).sort((a, b) => b.hiddenOn!.localeCompare(a.hiddenOn!)), open: idx.open };
}

/** The days left to bring back a hidden garden. */
export const daysLeft = (e: GardenEntry, now = new Date()) => (e.hiddenOn ? Math.max(0, KEEP_DAYS - (dayNumber(todayIso(now)) - dayNumber(e.hiddenOn))) : KEEP_DAYS);

/**
 * What to open when the app starts: the open garden, or the most recently opened one you can see. With nothing kept
 * (or nothing readable), a new garden, with your own plants. Gardens hidden for KEEP_DAYS go for good first.
 */
export function startUp(fresh: () => Garden, s: Kv | null = safe(), now = new Date()): AppState {
  purgeHidden(s, now);
  const idx = loadIndex(s, now);
  const userPlants = loadPlants(s);
  if (idx) {
    const order = [...visible(idx)].sort((a, b) => (a.id === idx.open ? -1 : b.id === idx.open ? 1 : b.openedAt.localeCompare(a.openedAt)));
    for (const e of order) {
      const g = peekGarden(e.id, s);
      if (g) {
        if (idx.open !== e.id) writeIndex(s, { ...idx, open: e.id });
        return { garden: g, userPlants };
      }
      const raw = get(s, gardenKey(e.id));
      if (raw) keepAside(s, gardenKey(e.id), raw, now);
    }
  }
  const garden = fresh();
  addGarden(garden, s, now, true);
  return { garden, userPlants };
}

/** Saves the open garden and your own plants. False when it couldn't be kept. */
export function saveOpen(state: AppState, s: Kv | null = safe(), now = new Date()): boolean {
  const idx = loadIndex(s, now);
  if (!idx) return addGarden(state.garden, s, now, true) !== null && put(s, PLANTS, JSON.stringify(state.userPlants));
  const ok = writeGarden(s, idx.open, state.garden, now) && put(s, PLANTS, JSON.stringify(state.userPlants));
  const e = idx.gardens.find((g) => g.id === idx.open);
  if (e && e.name !== state.garden.name) writeIndex(s, { ...idx, gardens: idx.gardens.map((g) => (g === e ? { ...g, name: state.garden.name } : g)) });
  return ok;
}

/** Keeps another garden, opening it if asked. Its id, or null if it couldn't be kept. */
export function addGarden(garden: Garden, s: Kv | null = safe(), now = new Date(), open = false): string | null {
  const id = newId('g');
  if (!writeGarden(s, id, garden, now)) return null;
  const idx = readIndex(s);
  const entry: GardenEntry = { id, name: garden.name, openedAt: now.toISOString() };
  writeIndex(s, { open: open || !idx ? id : idx.open, gardens: [...(idx?.gardens ?? []), entry] });
  return id;
}

/** Opens a garden: the state to show, with your own plants, or null if it can't be read. */
export function openGarden(id: string, s: Kv | null = safe(), now = new Date()): AppState | null {
  const idx = loadIndex(s, now);
  const g = peekGarden(id, s);
  if (!idx || !g) return null;
  writeIndex(s, { open: id, gardens: idx.gardens.map((e) => (e.id === id ? { ...e, openedAt: now.toISOString(), hiddenOn: undefined } : e)) });
  return { garden: g, userPlants: loadPlants(s) };
}

/** Renames a garden that isn't open (the open one is renamed through the store, and saved). */
export function renameGarden(id: string, name: string, s: Kv | null = safe()): void {
  const g = peekGarden(id, s);
  const idx = readIndex(s);
  if (!g || !idx || !name.trim()) return;
  writeGarden(s, id, { ...g, name: name.trim() });
  writeIndex(s, { ...idx, gardens: idx.gardens.map((e) => (e.id === id ? { ...e, name: name.trim() } : e)) });
}

/** Hides a garden for KEEP_DAYS, to bring back if you change your mind. */
export function hideGarden(id: string, s: Kv | null = safe(), now = new Date()): void {
  const idx = readIndex(s);
  if (idx) writeIndex(s, { ...idx, gardens: idx.gardens.map((e) => (e.id === id ? { ...e, hiddenOn: todayIso(now) } : e)) });
}

/** Deletes a garden for good. Its photos and trace go when the photos are next tidied. */
export function deleteGarden(id: string, s: Kv | null = safe()): void {
  const idx = readIndex(s);
  drop(s, gardenKey(id));
  if (idx) writeIndex(s, { ...idx, gardens: idx.gardens.filter((e) => e.id !== id) });
}

/** Deletes gardens hidden for KEEP_DAYS or more. Their ids. */
export function purgeHidden(s: Kv | null = safe(), now = new Date()): string[] {
  const idx = readIndex(s);
  if (!idx) return [];
  const gone = idx.gardens.filter((e) => e.hiddenOn && daysLeft(e, now) <= 0).map((e) => e.id);
  for (const id of gone) deleteGarden(id, s);
  return gone;
}

/** Where a garden's trace photo is kept. */
export const traceKeyOf = (e: Pick<GardenEntry, 'id' | 'traceKey'>) => e.traceKey ?? `trace:${e.id}`;

/** Where the open garden's trace photo is kept. */
export function openTraceKey(s: Kv | null = safe()): string {
  const idx = readIndex(s);
  const e = idx?.gardens.find((g) => g.id === idx.open);
  return e ? traceKeyOf(e) : 'trace';
}

/**
 * Everything kept in IndexedDB that some garden still uses: photos on notes, and trace photos. Hidden gardens count.
 * Null when the gardens can't be read, so nothing is tidied away by mistake.
 */
export function blobsInUse(s: Kv | null = safe()): { photos: Set<string>; traces: Set<string> } | null {
  const idx = readIndex(s);
  if (!idx) return null;
  const photos = new Set<string>();
  const traces = new Set<string>();
  for (const e of idx.gardens) {
    const g = peekGarden(e.id, s);
    if (!g) {
      // Unreadable, not gone: keep what might be its.
      traces.add(traceKeyOf(e));
      continue;
    }
    for (const n of g.notes) if (n.photo) photos.add(n.photo);
    if (g.trace) traces.add(traceKeyOf(e));
  }
  return { photos, traces };
}

/** Every key this app keeps in this browser: gardens, your plants, preferences, the weather and the rest. */
export function appKeys(s: Kv | null = safe()): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; s && i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
  } catch {
    // can't look: nothing to list
  }
  return keys;
}

/** Deletes everything this app keeps in local storage, for every garden. There's no way back. */
export function wipeAll(s: Kv | null = safe()): void {
  for (const k of appKeys(s)) drop(s, k);
}
