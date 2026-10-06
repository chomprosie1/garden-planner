// Plants you've checked against a trusted source, kept on this device. A
// checked library plant counts as verified everywhere in the app; the checks
// can later be folded back into data/plants/*.json for everyone.

import type { Plant } from '../model/types';

const KEY = 'garden-planner:checks';

/** Plant id → the date you checked it (ISO). */
export type Checks = Record<string, string>;

type Listener = (c: Checks) => void;

export interface ChecksStore {
  get(): Checks;
  check(id: string, date: string): void;
  uncheck(id: string): void;
  subscribe(l: Listener): () => void;
}

export function createChecksStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): ChecksStore {
  let checks: Checks = {};
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      for (const [id, date] of Object.entries(parsed)) if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) checks[id] = date;
  } catch {
    // unreadable: start again
  }
  const listeners = new Set<Listener>();
  const save = (next: Checks) => {
    checks = next;
    try {
      storage?.setItem(KEY, JSON.stringify(checks));
    } catch {
      // storage blocked: checks last for this visit only
    }
    listeners.forEach((l) => l(checks));
  };
  return {
    get: () => checks,
    check: (id, date) => save({ ...checks, [id]: date }),
    uncheck(id) {
      const { [id]: _gone, ...rest } = checks;
      save(rest);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/** Library plants with your checks applied. Your own plants are left as they are. */
export function applyChecks(plants: Plant[], checks: Checks): Plant[] {
  return plants.map((p) => (!p.userAdded && !p.verified && checks[p.id] ? { ...p, verified: true, lastChecked: checks[p.id] } : p));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The one store the app uses. */
export const checksStore = createChecksStore();
