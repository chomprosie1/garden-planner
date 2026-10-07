// The saved-file format, used for both export/import and browser autosave.
// Import migrates old files and validates everything before it is used.

import { migrateGarden, migratePlant, SCHEMA_VERSION } from '../model/migrate';
import type { AppState, Garden, Plant } from '../model/types';
import { validateGarden, validatePlant } from '../model/validate';

export interface GardenFile {
  app: 'garden-planner';
  schemaVersion: number;
  exportedAt: string;
  garden: Garden;
  userPlants: Plant[];
  /** Photos on notes, by id, as data URLs: only in a backup made "with photos". */
  photos?: Record<string, string>;
}

export type ParseResult = { ok: true; state: AppState; photos?: Record<string, string> } | { ok: false; errors: string[] };

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
  return { ok: true, state: { garden: garden as Garden, userPlants: userPlants as Plant[] }, ...(photos && Object.keys(photos).length ? { photos } : {}) };
}

export function parseFileText(text: string): ParseResult {
  try {
    return parseFile(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
}

/** Starts a browser download of the garden as a JSON file, with its photos if they're given. */
export function downloadFile(state: AppState, photos?: Record<string, string>): void {
  const file: GardenFile = photos ? { ...toFile(state), photos } : toFile(state);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const slug = state.garden.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-${file.exportedAt.slice(0, 10)}${photos ? '-with-photos' : ''}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
