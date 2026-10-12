// A bed that's booked: most of it taken by crops that won't be cleared for a
// while, such as garlic planted in October and lifted in July. Adding to it
// says so, rather than letting a spring crop be planned on top. Pure functions.

import { timeline } from '../lifecycle/projection';
import { perennial } from '../lifecycle/stages';
import { addDays } from '../model/dates';
import { placeLabel } from '../model/features';
import type { Feature, Garden, Plant } from '../model/types';
import type { Weather } from '../weather/weather';
import { howFull } from './listPlant';
import { isActive } from './place';

/** Taken for at least this long, days, before it's worth a word. */
const BOOKED_DAYS = 60;
/** Taken this much of the bed's room by what's staying: what the list calls about half full or more. */
const BOOKED_SHARE = 0.35;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Booked {
  /** When the last of it is likely cleared, ISO. */
  until: string;
  /** What's taking it, by plant id, the longest staying first. */
  plantIds: string[];
}

/**
 * Whether a bed is booked from today: what's in it, or planned for now, takes half its room or more and won't be cleared for
 * two months or more. Perennials don't count: a bed of them is full for good, which its fullness says already.
 */
export function bookedUntil(g: Garden, bed: Feature, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null): Booked | null {
  const soon = addDays(today, BOOKED_DAYS);
  const staying: { id: string; plantId: string; until: string }[] = [];
  for (const pl of g.plantings) {
    if (pl.featureId !== bed.id || !isActive(pl)) continue;
    const plant = plantOf(pl.plantId);
    if (plant.category === 'weed' || perennial(plant)) continue;
    // Planned for a later season: not in the way now.
    if (pl.sowBy && pl.sowBy > soon) continue;
    const cleared = timeline(plant, pl, g, today, weather).find((s) => s.stage === 'cleared' && s.date !== null)?.date;
    if (cleared && cleared > soon) staying.push({ id: pl.id, plantId: pl.plantId, until: cleared });
  }
  if (!staying.length) return null;
  const ids = new Set(staying.map((s) => s.id));
  const share = howFull({ ...g, plantings: g.plantings.filter((p) => ids.has(p.id)) }, bed, plantOf);
  if (share < BOOKED_SHARE) return null;
  staying.sort((a, b) => (a.until < b.until ? 1 : -1));
  return { until: staying[0]!.until, plantIds: [...new Set(staying.map((s) => s.plantId))] };
}

/** "Bed 1 is taken until about July by garlic and onion. Anything else may not have room until then." */
export function bookedText(b: Booked, bed: Feature, plantOf: (id: string) => Plant): string {
  // "Onion, overwintering" reads as "overwintering onion" in a sentence.
  const names = b.plantIds.map((id) => plantOf(id).commonName.toLowerCase().split(', ').reverse().join(' '));
  const list = names.length > 2 ? `${names.slice(0, 2).join(', ')} and more` : names.join(' and ');
  // Cleared on the 1st of a month is in the bed to the end of the one before.
  const last = addDays(b.until, -1);
  return `${placeLabel(bed)} is taken until about ${MONTHS[Number(last.slice(5, 7)) - 1]} by ${list}. Anything else may not have room until then.`;
}
