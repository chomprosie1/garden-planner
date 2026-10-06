import { useEffect, useMemo, useState } from 'preact/hooks';
import { applyChecks, checksStore, type Checks } from '../library/checks';
import { allPlants, loadLibrary } from '../library/library';
import type { Plant, SpacingStyle } from '../model/types';
import { asGrown, unknownPlant } from '../planting/place';

/** Plants you've checked on this device; re-renders when you check another. */
export function useChecks(): Checks {
  const [checks, setChecks] = useState(checksStore.get());
  useEffect(() => checksStore.subscribe(setChecks), []);
  return checks;
}

/**
 * The library (with your checks) and your own plants, with a lookup. `plants` is null until the library has loaded.
 * With a spacing style, plants come as the garden grows them (close or in rows); `library` is always as written.
 */
export function usePlants(userPlants: Plant[], style?: SpacingStyle): { plants: Plant[] | null; plantOf: (id: string) => Plant; library: Plant[] | null } {
  const [raw, setRaw] = useState<Plant[] | null>(null);
  const checks = useChecks();
  useEffect(() => {
    loadLibrary().then(setRaw, () => setRaw([]));
  }, []);
  const library = useMemo(() => (raw ? applyChecks(raw, checks) : null), [raw, checks]);
  const plants = useMemo(() => (library ? allPlants(library, userPlants).map((p) => (style ? asGrown(p, style) : p)) : null), [library, userPlants, style]);
  const plantOf = useMemo(() => {
    const byId = new Map((plants ?? []).map((p) => [p.id, p]));
    return (id: string) => byId.get(id) ?? (style ? asGrown(unknownPlant(id), style) : unknownPlant(id));
  }, [plants]);
  return { plants, plantOf, library };
}
