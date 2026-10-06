// Autosave to the browser. Storage can be unavailable (private windows,
// blocked site data), so every access is guarded and the app still works.

import type { AppState } from '../model/types';
import type { Store } from '../model/store';
import { parseFile, toFile } from './file';

const KEY = 'garden-planner:state';

export function loadSaved(): AppState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const result = parseFile(JSON.parse(raw));
    if (result.ok) return result.state;
  } catch {
    // fall through
  }
  // Keep unreadable data aside rather than overwrite it on the next save.
  try {
    localStorage.setItem(`${KEY}:unreadable:${Date.now()}`, raw);
  } catch {
    // nothing more we can do
  }
  return null;
}

export type SaveStatus = 'saved' | 'saving' | 'failed';

/** Whether the last change reached this browser's storage, so the app can say so. */
export const saveStatus = (() => {
  let status: SaveStatus = 'saved';
  const listeners = new Set<(s: SaveStatus) => void>();
  return {
    get: () => status,
    set(s: SaveStatus) {
      if (s === status) return;
      status = s;
      listeners.forEach((l) => l(s));
    },
    subscribe(l: (s: SaveStatus) => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
})();

export function autosave(store: Store, delayMs = 400): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    try {
      localStorage.setItem(KEY, JSON.stringify(toFile(store.get())));
      saveStatus.set('saved');
    } catch {
      // Storage full or blocked; export still works.
      saveStatus.set('failed');
    }
  };
  store.subscribe(() => {
    clearTimeout(timer);
    saveStatus.set('saving');
    timer = setTimeout(save, delayMs);
  });
  // Don't lose the last edit if the tab closes inside the delay.
  addEventListener('pagehide', () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      save();
    }
  });
}
