// The starter plant library (data/plants/*.json) merged with plants you add.
// The JSON is loaded on demand so it doesn't slow the first page load.

import type { AppState, Light, Plant, PlantCategory } from '../model/types';
import type { Change } from '../model/store';
import { newUserPlantId } from '../model/ids';

let cache: Promise<Plant[]> | null = null;

/** Every library plant, loaded once. */
export function loadLibrary(): Promise<Plant[]> {
  if (!cache) {
    const files = import.meta.glob<Plant[]>('../../data/plants/*.json', { import: 'default' });
    cache = Promise.all(Object.values(files).map((load) => load())).then((lists) =>
      lists.flat().sort((a, b) => a.commonName.localeCompare(b.commonName)),
    );
  }
  return cache;
}

/** Library and your own plants together; your own come first when names tie. */
export function allPlants(library: Plant[], userPlants: Plant[]): Plant[] {
  return [...userPlants, ...library].sort((a, b) => a.commonName.localeCompare(b.commonName) || Number(b.userAdded) - Number(a.userAdded));
}

export interface PlantFilter {
  query: string;
  category: PlantCategory | 'all';
  light: Light | 'all';
  /** Only plants you can sow or plant out in this month (1 to 12). */
  sowMonth: number | null;
  checkedOnly: boolean;
}

export const emptyFilter: PlantFilter = { query: '', category: 'all', light: 'all', sowMonth: null, checkedOnly: false };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function canSowIn(p: Plant, month: number): boolean {
  return !!p.sowing?.some((s) => s.months.includes(month)) || !!p.plantOutMonths?.includes(month);
}

export function filterPlants(plants: Plant[], f: PlantFilter): Plant[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return plants.filter((p) => {
    if (f.category !== 'all' && p.category !== f.category) return false;
    // Weeds are only listed when you ask for them: by the Weeds filter, or by name.
    if (f.category === 'all' && p.category === 'weed' && words.length === 0) return false;
    if (f.light !== 'all' && p.conditions.light !== f.light) return false;
    if (f.sowMonth !== null && !canSowIn(p, f.sowMonth)) return false;
    if (f.checkedOnly && !p.verified && !p.userAdded) return false;
    if (words.length === 0) return true;
    const hay = fold(`${p.commonName} ${p.latinName ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Months where a run starts: [6,7,8] → [6]; [9,10,11,12,1,2,3] → [9]. */
export function runStarts(months: number[]): number[] {
  const set = new Set(months);
  if (set.size === 12) return [];
  return [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
}

/** [2,3,4,10,11] → "Feb–Apr, Oct–Nov"; [11,12,1,2] → "Nov–Feb". */
export function monthRanges(months: number[], long = false): string {
  const names = long ? MONTH_LONG : MONTH_SHORT;
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0) return '';
  if (set.size === 12) return 'All year';
  // Start a run at a month whose previous month isn't included, so runs can wrap past December.
  const runs: [number, number][] = [];
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1;
    if (!set.has(m) || set.has(prev)) continue;
    let end = m;
    while (set.has((end % 12) + 1) && (end % 12) + 1 !== m) end = (end % 12) + 1;
    runs.push([m, end]);
  }
  return runs
    .sort((a, b) => a[0] - b[0])
    .map(([a, b]) => (a === b ? names[a - 1] : `${names[a - 1]}–${names[b - 1]}`))
    .join(', ');
}

// ---------- Your own plants ----------

export function blankPlant(): Plant {
  return {
    id: newUserPlantId(),
    commonName: '',
    category: 'vegetable',
    conditions: { light: 'full-sun' },
    size: { spacingMm: 300 },
    verified: false,
    userAdded: true,
  };
}

/** A copy of a library plant you can change, e.g. your own variety. */
export function copyAsUserPlant(p: Plant, name?: string): Plant {
  const copy = structuredClone(p);
  return { ...copy, id: newUserPlantId(), commonName: name ?? `${p.commonName} (my variety)`, userAdded: true, verified: false };
}

export const saveUserPlant =
  (p: Plant): Change =>
  (s: AppState) => {
    const exists = s.userPlants.some((x) => x.id === p.id);
    return { ...s, userPlants: exists ? s.userPlants.map((x) => (x.id === p.id ? p : x)) : [...s.userPlants, p] };
  };

export const deleteUserPlant =
  (id: string): Change =>
  (s: AppState) => {
    const userPlants = s.userPlants.filter((x) => x.id !== id);
    return userPlants.length === s.userPlants.length ? s : { ...s, userPlants };
  };
