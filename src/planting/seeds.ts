// The seed tin: packets of seed you have, how many are left, and whether they're
// still good to sow. Pure functions: garden in, garden or answers out.

import { newId } from '../model/ids';
import type { Garden, Plant, SeedPacket } from '../model/types';

export const seedsOf = (g: Garden): SeedPacket[] => g.seeds ?? [];

/** A new packet, with an id and today's date. */
export function makePacket(plantId: string, today: string, extra: Partial<Omit<SeedPacket, 'id' | 'plantId' | 'addedOn'>> = {}): SeedPacket {
  return { id: newId('seed'), plantId, addedOn: today, ...extra };
}

export const addPacket = (g: Garden, p: SeedPacket): Garden => ({ ...g, seeds: [...seedsOf(g), p] });

export function updatePacket(g: Garden, id: string, patch: Partial<Omit<SeedPacket, 'id'>>): Garden {
  return { ...g, seeds: seedsOf(g).map((p) => (p.id === id ? dropEmpty({ ...p, ...patch }) : p)) };
}

export const removePacket = (g: Garden, id: string): Garden => ({ ...g, seeds: seedsOf(g).filter((p) => p.id !== id) });

/** Optional fields set to undefined or '' are left off, so they don't save as empty. */
function dropEmpty(p: SeedPacket): SeedPacket {
  const out = { ...p } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out as unknown as SeedPacket;
}

/**
 * The packets for a plant: of the plant itself, of its parent if it's a variety, or of any of its varieties. A packet
 * of cherry tomatoes is seed for tomatoes, and the other way round. Ones with no seeds left are left out.
 */
export function packetsFor(g: Garden, plant: Plant, plantOf: (id: string) => Plant): SeedPacket[] {
  const family = (id: string) => {
    const p = plantOf(id);
    return p.varietyOf ?? p.id;
  };
  const mine = plant.varietyOf ?? plant.id;
  return seedsOf(g).filter((k) => k.count !== 0 && (k.plantId === plant.id || family(k.plantId) === mine));
}

export type SeedState = 'good' | 'soon' | 'old';

/** Still good, to sow within the next three months, or past its sow-by date (likely to come up poorly). */
export function seedState(p: SeedPacket, today: string): SeedState {
  if (!p.sowBy) return 'good';
  const now = today.slice(0, 7);
  if (p.sowBy < now) return 'old';
  const [y, m] = now.split('-').map(Number) as [number, number];
  const soon = `${m + 3 > 12 ? y + 1 : y}-${String(((m + 2) % 12) + 1).padStart(2, '0')}`;
  return p.sowBy <= soon ? 'soon' : 'good';
}

/** Takes seeds out of a packet after sowing; a packet with no count stays as it is. */
export function useSeeds(g: Garden, id: string, n: number): Garden {
  return { ...g, seeds: seedsOf(g).map((p) => (p.id === id && p.count !== undefined ? { ...p, count: Math.max(0, p.count - n) } : p)) };
}

/** What a plant's seed costs you: the cheapest packet in the tin with a price, in pounds. Null when there's none. */
export function seedPrice(g: Garden, plant: Plant, plantOf: (id: string) => Plant): number | null {
  const prices = packetsFor(g, plant, plantOf).flatMap((p) => (p.price !== undefined ? [p.price] : []));
  return prices.length ? Math.min(...prices) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "about 20 seeds, sow by Dec 2027, £2.50": what's known about a packet, or '' if nothing is. */
export function packetDetail(p: SeedPacket): string {
  const bits = [
    p.count === undefined ? '' : p.count === 0 ? 'none left' : `about ${p.count} ${p.count === 1 ? 'seed' : 'seeds'}`,
    p.sowBy ? `sow by ${MONTHS[Number(p.sowBy.slice(5, 7)) - 1]} ${p.sowBy.slice(0, 4)}` : '',
    p.price !== undefined ? `£${p.price.toFixed(2)}` : '',
  ];
  return bits.filter(Boolean).join(', ');
}

/** "Sungold, about 20 seeds, sow by Dec 2027". */
export function packetText(p: SeedPacket, plant: Plant): string {
  const detail = packetDetail({ ...p, price: undefined });
  return `${p.name || plant.commonName}${detail ? `, ${detail}` : ''}`;
}
