// Autosave to the browser: the open garden, under its own key (see gardens.ts).
// Storage can be unavailable (private windows, blocked site data), so every
// access is guarded and the app still works.

import type { Store } from '../model/store';
import { saveOpen } from './gardens';

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

let pending: (() => void) | null = null;
let stopped = false;

/** Saves the last change now, before switching gardens. */
export const flushSave = () => pending?.();

/** Stops saving, before everything is deleted, so nothing is written back as the page closes. */
export function stopSaving(): void {
  stopped = true;
  pending = null;
}

export function autosave(store: Store, delayMs = 400): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
    if (stopped) return;
    // Storage full or blocked: a download still works.
    saveStatus.set(saveOpen(store.get()) ? 'saved' : 'failed');
  };
  store.subscribe(() => {
    if (stopped) return;
    clearTimeout(timer);
    saveStatus.set('saving');
    timer = setTimeout(save, delayMs);
    pending = save;
  });
  // Don't lose the last edit if the tab closes inside the delay.
  addEventListener('pagehide', () => pending?.());
}
