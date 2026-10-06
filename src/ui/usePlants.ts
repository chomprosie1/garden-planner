import { useEffect, useMemo, useState } from 'preact/hooks';
import { allPlants, loadLibrary } from '../library/library';
import type { Plant } from '../model/types';
import { unknownPlant } from '../planting/place';

/** The library and your own plants, with a lookup. `plants` is null until the library has loaded. */
export function usePlants(userPlants: Plant[]): { plants: Plant[] | null; plantOf: (id: string) => Plant } {
  const [library, setLibrary] = useState<Plant[] | null>(null);
  useEffect(() => {
    loadLibrary().then(setLibrary, () => setLibrary([]));
  }, []);
  const plants = useMemo(() => (library ? allPlants(library, userPlants) : null), [library, userPlants]);
  const plantOf = useMemo(() => {
    const byId = new Map((plants ?? []).map((p) => [p.id, p]));
    return (id: string) => byId.get(id) ?? unknownPlant(id);
  }, [plants]);
  return { plants, plantOf };
}
