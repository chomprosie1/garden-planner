// The last weather fetched, kept in this browser so the app has it at once and
// doesn't ask Open-Meteo more than every few hours. Like preferences, it
// belongs to the device and never goes into a backup.

import type { Weather } from '../weather/weather';

const KEY = 'garden-planner:weather';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

const safe = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isNums = (v: unknown): v is (number | null)[] => Array.isArray(v) && v.every((x) => x === null || (typeof x === 'number' && Number.isFinite(x)));

/** The kept weather, if it's there and readable. */
export function loadWeather(storage: Storage | null = safe()): Weather | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as Weather;
    const ok =
      typeof w.from === 'string' &&
      typeof w.today === 'string' &&
      typeof w.fetchedAt === 'string' &&
      typeof w.lat === 'number' &&
      typeof w.lon === 'number' &&
      isNums(w.tmax) &&
      isNums(w.tmin) &&
      isNums(w.rain) &&
      w.tmax.length === w.tmin.length &&
      w.tmax.length === w.rain.length;
    return ok ? w : null;
  } catch {
    return null;
  }
}

export function saveWeather(w: Weather, storage: Storage | null = safe()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(w));
  } catch {
    // storage full or blocked: it's fetched again next time
  }
}

/** Forgets the weather, when you turn it off. */
export function clearWeather(storage: Storage | null = safe()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // nothing kept anyway
  }
}
