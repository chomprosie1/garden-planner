// Opens "Your season, wrapped" from anywhere, once the plants have loaded.

import type { Garden, Plant } from '../model/types';
import { spacingStyle } from '../planting/place';
import { usePlants } from './usePlants';
import { WrappedDialog } from './Wrapped';

export function WrappedHost({ garden, userPlants, close }: { garden: Garden; userPlants: Plant[]; close: () => void }) {
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  if (!plants) return null;
  const ids = new Set(plants.map((p) => p.id));
  return <WrappedDialog garden={garden} plantOf={plantOf} known={(id) => ids.has(id)} close={close} />;
}
