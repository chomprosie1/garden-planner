// Reminders while the app is closed: the app keeps a note of where the garden
// is, what's tender and outside, and the jobs for the next few weeks, for the
// service worker (public/sw.js) to check now and then: frost against the
// forecast, and once a week, what there is to do. Only on browsers that allow
// it (Chrome and Edge on Android, for an installed app); elsewhere Today shows
// both when you open the app.

import type { WeekNudge } from '../calendar/week';
import type { Watched } from '../lifecycle/frostWatch';

const STATE = 'garden-planner-state';
const SNAPSHOT = 'reminder.json';
const TAG = 'frost-check';
/** How often to look: twice a day at most. */
const EVERY = 12 * 60 * 60 * 1000;

export type ReminderStatus = 'background' | 'open-only' | 'blocked' | 'unsupported';

type PeriodicSync = { register(tag: string, o: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> };
const periodic = (r: ServiceWorkerRegistration): PeriodicSync | undefined => (r as ServiceWorkerRegistration & { periodicSync?: PeriodicSync }).periodicSync;

/** Starts the service worker, for working offline and for reminders. In the built app only. */
export function startServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    // The first time, the app loaded before the service worker could keep a copy: hand it what's loaded so far
    // (scripts, styles, fonts, the plant lists), so it opens offline from then on.
    void navigator.serviceWorker.ready.then((reg) => {
      const files = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ keep: [location.href.split('#')[0], ...files] });
    });
  });
}

export interface Snapshot {
  /** Frost warnings are on. */
  on: boolean;
  /** Rounded to about a kilometre: all the forecast needs. */
  lat: number;
  lon: number;
  /** What a frost could hurt. */
  items: Watched[];
  /** The weekly jobs reminder, if it's on: one for each of the next few weeks. */
  weeks: WeekNudge[];
}

/** What the service worker is given: only what each reminder that's on needs. */
export const snapshot = (frost: boolean, lat: number, lon: number, items: Watched[], weeks: WeekNudge[] | null): Snapshot => ({
  on: frost,
  lat: Math.round(lat * 100) / 100,
  lon: Math.round(lon * 100) / 100,
  items: frost ? items : [],
  weeks: weeks ?? [],
});

/** Keeps the note the service worker checks. */
export async function saveSnapshot(s: Snapshot): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(STATE);
  await cache.put(SNAPSHOT, new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json' } }));
}

/** Asks to show notifications, and to check now and then in the background where that's possible. */
export async function enableReminders(): Promise<ReminderStatus> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'blocked';
  const reg = await navigator.serviceWorker.ready;
  const sync = periodic(reg);
  if (!sync) return 'open-only';
  try {
    const state = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (state.state !== 'granted') return 'open-only';
    await sync.register(TAG, { minInterval: EVERY });
    return 'background';
  } catch {
    return 'open-only';
  }
}

/** Stops checking in the background. */
export async function disableReminders(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  await (reg && periodic(reg)?.unregister(TAG).catch(() => undefined));
}
