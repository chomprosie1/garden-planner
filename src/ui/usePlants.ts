import { useEffect, useMemo, useState } from 'preact/hooks';
import { applyChecks, checksStore, type Checks } from '../library/checks';
import { allPlants, loadLibrary } from '../library/library';
import type { Plant } from '../model/types';
import { unknownPlant } from '../planting/place';

/** Plants you've checked on this device; re-renders when you check another. */
export function useChecks(): Checks {
  const [checks, setChecks] = useState(checksStore.get());
  useEffect(() => checksStore.subscribe(setChecks), []);
  return checks;
}

/** The library (with your checks) and your own plants, with a lookup. `plants` is null until the library has loaded. */
export function usePlants(userPlants: Plant[]): { plants: Plant[] | null; plantOf: (id: string) => Plant; library: Plant[] | null } {
  const [raw, setRaw] = useState<Plant[] | null>(null);
  const checks = useChecks();
  useEffect(() => {
    loadLibrary().then(setRaw, () => setRaw([]));
  }, []);
  const library = useMemo(() => (raw ? applyChecks(raw, checks) : null), [raw, checks]);
  const plants = useMemo(() => (library ? allPlants(library, userPlants) : null), [library, userPlants]);
  const plantOf = useMemo(() => {
    const byId = new Map((plants ?? []).map((p) => [p.id, p]));
    return (id: string) => byId.get(id) ?? unknownPlant(id);
  }, [plants]);
  return { plants, plantOf, library };
}
