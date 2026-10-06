import type { AppState, Garden } from './types';
import { SCHEMA_VERSION } from './migrate';

export function newGarden(): Garden {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: 'My garden',
    // Middle of England until you set your own location.
    latitude: 52.5,
    longitude: -1.5,
    northRotationDeg: 0,
    boundary: [],
    features: [],
    plantings: [],
    wishlist: [],
    jobsDone: [],
    notes: [],
  };
}

export function newAppState(): AppState {
  return { garden: newGarden(), userPlants: [] };
}
