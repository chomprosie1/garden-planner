// Appearance and navigation preferences. These belong to the device, not the
// garden: they live in browser storage and never go into the export.

import { LOOK_IDS, type LookId } from './looks';

export const VIEWS = ['home', 'plan', 'plants', 'month', 'notes', 'settings', 'check'] as const;
export type View = (typeof VIEWS)[number];

export interface Prefs {
  look: LookId;
  mode: 'auto' | 'light' | 'dark';
  photos: 'full' | 'subtle' | 'off';
  photoMonth: 'auto' | number; // 1 to 12
  textSize: 'standard' | 'large';
  /** Photos hidden in Plan. null = the look's default. */
  focus: boolean | null;
  onboarded: boolean;
  lastView: View;
  /** Last month the app was opened in, for the "Welcome to …" note. */
  seenMonth: number | null;
  /** Which part of the plan you were last using. null = pick one for you. */
  planMode: PlanMode | null;
  /** When a backup file was last downloaded (ISO date). */
  lastBackup: string | null;
  /** You've confirmed the north arrow, even if it still points up. */
  northChecked: boolean;
  /** The getting-started list on Home has been put away. */
  setupHidden: boolean;
}

export const PLAN_MODES = ['layout', 'planting', 'sun'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

const KEY = 'garden-planner:prefs';

export function defaultPrefs(): Prefs {
  const saveData =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return {
    look: 'cottage',
    mode: 'auto',
    photos: saveData ? 'subtle' : 'full',
    photoMonth: 'auto',
    textSize: 'standard',
    focus: null,
    onboarded: false,
    lastView: 'plan',
    seenMonth: null,
    planMode: null,
    lastBackup: null,
    northChecked: false,
    setupHidden: false,
  };
}

/** Keeps known, valid fields from stored data and defaults the rest. */
export function sanitisePrefs(raw: unknown): Prefs {
  const d = defaultPrefs();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    look: oneOf(LOOK_IDS, r.look, d.look),
    mode: oneOf(['auto', 'light', 'dark'] as const, r.mode, d.mode),
    photos: oneOf(['full', 'subtle', 'off'] as const, r.photos, d.photos),
    photoMonth:
      typeof r.photoMonth === 'number' && Number.isInteger(r.photoMonth) && r.photoMonth >= 1 && r.photoMonth <= 12
        ? r.photoMonth
        : 'auto',
    textSize: oneOf(['standard', 'large'] as const, r.textSize, d.textSize),
    focus: typeof r.focus === 'boolean' ? r.focus : null,
    onboarded: r.onboarded === true,
    lastView: oneOf(VIEWS, r.lastView, d.lastView),
    seenMonth:
      typeof r.seenMonth === 'number' && Number.isInteger(r.seenMonth) && r.seenMonth >= 1 && r.seenMonth <= 12
        ? r.seenMonth
        : null,
    planMode: typeof r.planMode === 'string' && (PLAN_MODES as readonly string[]).includes(r.planMode) ? (r.planMode as PlanMode) : null,
    lastBackup: typeof r.lastBackup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastBackup) ? r.lastBackup : null,
    northChecked: r.northChecked === true,
    setupHidden: r.setupHidden === true,
  };
}

type Listener = (p: Prefs) => void;

export interface PrefsStore {
  get(): Prefs;
  set(patch: Partial<Prefs>): void;
  subscribe(l: Listener): () => void;
}

export function createPrefsStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): PrefsStore {
  let prefs = defaultPrefs();
  try {
    const raw = storage?.getItem(KEY);
    if (raw) prefs = sanitisePrefs(JSON.parse(raw));
  } catch {
    // unreadable: defaults
  }
  const listeners = new Set<Listener>();
  return {
    get: () => prefs,
    set(patch) {
      prefs = { ...prefs, ...patch };
      try {
        storage?.setItem(KEY, JSON.stringify(prefs));
      } catch {
        // storage blocked: preferences last for this visit only
      }
      listeners.forEach((l) => l(prefs));
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
