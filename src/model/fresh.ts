// A new garden, or starting this one again: what carries over from the garden
// you're in, and what a fresh start takes away. Pure functions; the keeping of
// gardens is in src/storage/gardens.ts.

import { newGarden } from './defaults';
import type { Garden } from './types';

/** Where a garden is: its place and its frost dates. */
const placeOf = (g: Garden): Partial<Garden> => ({
  latitude: g.latitude,
  longitude: g.longitude,
  ...(g.placeName ? { placeName: g.placeName } : {}),
  ...(g.lastFrost ? { lastFrost: g.lastFrost } : {}),
  ...(g.firstFrost ? { firstFrost: g.firstFrost } : {}),
});

/** A new, empty garden, in the same place as this one if you like. */
export function newGardenFrom(from: Garden | null, name: string, samePlace: boolean): Garden {
  return { ...newGarden(), ...(from && samePlace ? placeOf(from) : {}), name: name.trim() || 'My garden' };
}

/** What starting again keeps. Your own plants and the look aren't part of the garden, so the caller keeps those. */
export interface Keep {
  ownPlants: boolean;
  wishlist: boolean;
  place: boolean;
  look: boolean;
}

export const KEEP_ALL: Keep = { ownPlants: true, wishlist: true, place: true, look: true };

/** The garden to start again with: empty, keeping its name, and its wish list and place if they're ticked. */
export function startAgainFrom(old: Garden, keep: Keep): Garden {
  return {
    ...newGarden(),
    name: old.name,
    ...(keep.place ? placeOf(old) : {}),
    ...(keep.wishlist ? { wishlist: [...old.wishlist] } : {}),
  };
}

/** What starting again (or deleting) takes away, counted, to say before it happens. */
export interface Goes {
  beds: number;
  plantings: number;
  notes: number;
  photos: number;
  picks: number;
  jobs: number;
}

export function whatGoes(g: Garden): Goes {
  return {
    beds: g.features.length,
    plantings: g.plantings.length,
    notes: g.notes.length,
    photos: g.notes.filter((n) => n.photo).length,
    picks: g.plantings.reduce((n, p) => n + (p.picks?.length ?? 0), 0),
    jobs: g.jobsDone.length,
  };
}

/** Days a garden you've cleared or deleted is kept, hidden, so it can be brought back. */
export const KEEP_DAYS = 30;
