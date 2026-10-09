// Appearance and navigation preferences. These belong to the device, not the
// garden: they live in browser storage and never go into the export.

import { LOOK_IDS, type LookId } from './looks';

export const VIEWS = ['home', 'plan', 'plants', 'month', 'notes', 'settings', 'check', 'shed', 'new', 'profile', 'help'] as const;
export type View = (typeof VIEWS)[number];

/** What each screen is called in the address bar: Today, Garden and Seedlings are the tabs' names. Old names still work. */
export const VIEW_HASH: Record<View, string> = {
  home: 'today',
  plan: 'garden',
  plants: 'plants',
  month: 'month',
  notes: 'journal',
  settings: 'settings',
  check: 'check',
  shed: 'seedlings',
  new: 'new',
  profile: 'your-garden',
  help: 'help',
};

/** The screen an address names, by its name now or its old one. */
export function viewForHash(name: string): View | null {
  const found = (Object.entries(VIEW_HASH) as [View, string][]).find(([, h]) => h === name);
  if (found) return found[0];
  return (VIEWS as readonly string[]).includes(name) ? (name as View) : null;
}

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
  /** Beds, paths and other layout can't be moved or reshaped by accident. Plants still can. */
  layoutLocked: boolean;
  /** When a backup file was last downloaded (ISO date). */
  lastBackup: string | null;
  /** You've confirmed the north arrow, even if it still points up. */
  northChecked: boolean;
  /** The getting-started list on Home has been put away. */
  setupHidden: boolean;
  /** Show the sketch layer on the plan. */
  sketches: boolean;
  /** Soft shadows on the plan, for depth. null = the look's default (off in Minimal). */
  depth: boolean | null;
  /** Fetch this year's weather and the forecast from Open-Meteo. Off until you turn it on: it sends the garden's rough location. */
  weather: boolean;
  /** The newest "What's new" entry you've seen, by id. null: never looked. */
  seenNews: string | null;
  /** Show the tools for checking the plant library against its sources. For whoever keeps the plant data. */
  plantEditor: boolean;
  /** The first-visit tips on the garden plan have been seen. */
  seenTips: boolean;
  /** "Stuck?" notes already offered, by id: shown once and never again. */
  stuckSeen: string[];
  /** Warn of frost while the app's closed, where the browser allows (it checks the forecast in the background). */
  reminders: boolean;
  /** Once a week, a reminder of the jobs for the week, where the browser allows. */
  weeklyNudge: boolean;
  /** On days the UV is high (April to September), a morning reminder of sun cream and a hat, where the browser allows. */
  uvReminders: boolean;
  /** The "Install the app" card on Today has been put away. */
  installHidden: boolean;
  /** The plan's tools: Simple (beds, pots, plants and trees, dropped and dragged) or Advanced (drawing, reshaping, sun and shade). */
  planMode: 'simple' | 'advanced';
  /** A monthly "Weed the beds" job, March to October. */
  weeding: boolean;
  /** Feed jobs for plants that want feeding, and what goes in before planting. */
  feeding: boolean;
}


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
    layoutLocked: false,
    lastBackup: null,
    northChecked: false,
    setupHidden: false,
    sketches: true,
    depth: null,
    weather: false,
    seenNews: null,
    plantEditor: false,
    seenTips: false,
    stuckSeen: [],
    reminders: false,
    weeklyNudge: false,
    uvReminders: false,
    installHidden: false,
    planMode: 'simple',
    weeding: true,
    feeding: true,
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
    layoutLocked: r.layoutLocked === true,
    lastBackup: typeof r.lastBackup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastBackup) ? r.lastBackup : null,
    northChecked: r.northChecked === true,
    setupHidden: r.setupHidden === true,
    sketches: r.sketches !== false,
    depth: typeof r.depth === 'boolean' ? r.depth : null,
    weather: r.weather === true,
    seenNews: typeof r.seenNews === 'string' ? r.seenNews : null,
    plantEditor: r.plantEditor === true,
    seenTips: r.seenTips === true,
    stuckSeen: Array.isArray(r.stuckSeen) ? r.stuckSeen.filter((x): x is string => typeof x === 'string') : [],
    reminders: r.reminders === true,
    weeklyNudge: r.weeklyNudge === true,
    uvReminders: r.uvReminders === true,
    installHidden: r.installHidden === true,
    planMode: oneOf(['simple', 'advanced'] as const, r.planMode, d.planMode),
    weeding: r.weeding !== false,
    feeding: r.feeding !== false,
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
