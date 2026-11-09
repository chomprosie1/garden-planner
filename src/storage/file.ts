// The saved-file format, used for both export/import and browser autosave.
// Import migrates old files and validates everything before it is used.

import { migrateGarden, migratePlant, SCHEMA_VERSION } from '../model/migrate';
import type { AppState, Garden, Plant } from '../model/types';
import { gardenOutOfBounds, unusable, validateGarden, validatePlant } from '../model/validate';

export interface GardenFile {
  app: 'garden-planner';
  schemaVersion: number;
  exportedAt: string;
  garden: Garden;
  userPlants: Plant[];
  /** Photos on notes, by id, as data URLs: only in a backup made "with photos". */
  photos?: Record<string, string>;
}

export type ParseResult = { ok: true; state: AppState; photos?: Record<string, string>; /** The day the backup was made, if it says. */ madeOn?: string } | { ok: false; errors: string[] };

export function toFile(state: AppState, now = new Date()): GardenFile {
  return {
    app: 'garden-planner',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    garden: state.garden,
    userPlants: state.userPlants,
  };
}

/** Accepts a GardenFile, or a bare garden object from before the file format existed. */
export function parseFile(data: unknown): ParseResult {
  if (typeof data !== 'object' || data === null) return { ok: false, errors: ['This is not a garden file.'] };
  const raw = data as Record<string, unknown>;
  const wrapped = raw.app === 'garden-planner';
  if (!wrapped && !('boundary' in raw)) return { ok: false, errors: ['This is not a garden file.'] };

  let garden: unknown;
  let userPlants: unknown[];
  try {
    garden = migrateGarden(wrapped ? raw.garden : raw);
    userPlants = (wrapped && Array.isArray(raw.userPlants) ? raw.userPlants : []).map(migratePlant);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }

  const errors = [...validateGarden(garden), ...userPlants.flatMap(validatePlant)];
  if (errors.length > 0) return { ok: false, errors };
  // Photos come only as JPEG or PNG data, by the ids the notes use.
  const photos =
    wrapped && raw.photos && typeof raw.photos === 'object'
      ? (Object.fromEntries(
          Object.entries(raw.photos as Record<string, unknown>).filter(([id, v]) => /^[\w-]{1,40}$/.test(id) && typeof v === 'string' && /^data:image\/(jpeg|png);base64,/.test(v)),
        ) as Record<string, string>)
      : undefined;
  const madeOn = wrapped && typeof raw.exportedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.exportedAt) ? raw.exportedAt.slice(0, 10) : undefined;
  return { ok: true, state: { garden: garden as Garden, userPlants: userPlants as Plant[] }, ...(photos && Object.keys(photos).length ? { photos } : {}), ...(madeOn ? { madeOn } : {}) };
}

/** A file someone has chosen: everything parseFile checks, and that it holds nothing too big to draw. */
export function parseFileText(text: string): ParseResult {
  try {
    const result = parseFile(JSON.parse(text));
    if (!result.ok) return result;
    const errors = [...gardenOutOfBounds(result.state.garden), ...unusable(result.state)];
    return errors.length ? { ok: false, errors } : result;
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
}

/** The garden as a backup file, named after it and the day, with its photos if they're given. */
export function backupFile(state: AppState, photos?: Record<string, string>): File {
  const file: GardenFile = photos ? { ...toFile(state), photos } : toFile(state);
  const slug = state.garden.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden';
  return new File([JSON.stringify(file, null, 2)], `${slug}-${file.exportedAt.slice(0, 10)}${photos ? '-with-photos' : ''}.json`, { type: 'application/json' });
}

/** What a restore would refuse in a backup of this garden, built just as a backup is: empty if it would restore. */
export function backupProblems(state: AppState): string[] {
  const r = parseFileText(JSON.stringify(toFile(state), null, 2));
  return r.ok ? [] : r.errors;
}

/** Starts a browser download of the garden as a JSON file, with its photos if they're given. */
export function downloadFile(state: AppState, photos?: Record<string, string>): void {
  saveToDevice(backupFile(state, photos));
}

/** A spreadsheet of the garden's plantings, named as a backup is. */
export function csvFile(gardenName: string, csv: string, now = new Date()): File {
  const slug = gardenName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden';
  return new File([csv], `${slug}-plantings-${now.toISOString().slice(0, 10)}.csv`, { type: 'text/csv' });
}

/** Starts a browser download of a file. */
export function saveToDevice(file: File): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
