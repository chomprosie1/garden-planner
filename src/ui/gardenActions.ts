// What the garden switcher and "Start again" do: each saves the garden that's
// open first, then changes what's kept (src/storage/gardens.ts) and what's
// shown (the store). Opening another garden clears undo; a garden cleared or
// deleted can be brought back for 30 days instead.

import { KEEP_ALL, newGardenFrom, startAgainFrom, type Keep } from '../model/fresh';
import { newGarden } from '../model/defaults';
import type { Store } from '../model/store';
import { defaultPrefs, type PrefsStore } from '../theme/prefs';
import { addGarden, hideGarden, listGardens, openGarden, wipeAll } from '../storage/gardens';
import { deleteAllBlobs } from '../storage/idb';
import { flushSave, stopSaving } from '../storage/local';
import { disableReminders } from '../storage/reminders';

/** How many gardens are kept, counting ones still to bring back. */
export const gardenCount = () => {
  const l = listGardens();
  return l.gardens.length + l.hidden.length;
};

/** Opens another garden. False if it can't be read. */
export function switchGarden(store: Store, id: string): boolean {
  flushSave();
  const state = openGarden(id);
  if (!state) return false;
  store.replace(state);
  return true;
}

/** Sets up a new garden, in the same place as this one if you like, and runs the start for it. */
export function makeNewGarden(store: Store, prefsStore: PrefsStore, name: string, samePlace: boolean): void {
  flushSave();
  const garden = newGardenFrom(store.get().garden, name, samePlace);
  addGarden(garden, undefined, new Date(), true);
  store.replace({ garden, userPlants: store.get().userPlants });
  prefsStore.set({ onboarded: false });
}

/**
 * Starts this garden again: it's hidden for 30 days to bring back, and an empty one with the same name takes its place,
 * keeping what's ticked. Then the start runs again.
 */
export function startAgain(store: Store, prefsStore: PrefsStore, keep: Keep = KEEP_ALL): void {
  flushSave();
  const { open } = listGardens();
  const now = new Date();
  if (open) hideGarden(open, undefined, now);
  const garden = startAgainFrom(store.get().garden, keep);
  addGarden(garden, undefined, now, true);
  store.replace({ garden, userPlants: keep.ownPlants ? store.get().userPlants : [] });
  prefsStore.set({ onboarded: false, ...(keep.look ? {} : { look: defaultPrefs().look }) });
}

/**
 * Deletes a garden, hidden for 30 days to bring back. If it's the one open, the one opened most recently takes its
 * place; if it was the only one, a new garden is set up.
 */
export function deleteGardenFor30Days(store: Store, prefsStore: PrefsStore, id: string): void {
  flushSave();
  const { open, gardens } = listGardens();
  hideGarden(id);
  if (id !== open) return;
  const next = gardens.find((g) => g.id !== id);
  if (next && switchGarden(store, next.id)) return;
  const garden = newGarden();
  addGarden(garden, undefined, new Date(), true);
  store.replace({ garden, userPlants: store.get().userPlants });
  prefsStore.set({ onboarded: false });
}

/** Brings back a garden that was cleared or deleted, and opens it. */
export const bringBack = (store: Store, id: string) => switchGarden(store, id);

/** Deletes everything this app keeps in this browser, for every garden, and starts afresh. There's no way back. */
export async function deleteEverything(): Promise<void> {
  stopSaving();
  wipeAll();
  await deleteAllBlobs();
  await disableReminders().catch(() => undefined);
  if (typeof caches !== 'undefined') await caches.delete('garden-planner-state').catch(() => false);
  location.hash = '';
  location.reload();
}
