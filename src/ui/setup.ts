// The getting-started list on Home: what someone new needs to do, in order,
// worked out from the garden itself so it's never out of step.

import type { Garden } from '../model/types';
import { isContainer } from '../planting/place';
import type { Prefs } from '../theme/prefs';

export type StepId = 'boundary' | 'bed' | 'location' | 'north' | 'plants' | 'backup';

export interface Step {
  id: StepId;
  title: string;
  why: string;
  done: boolean;
}

/** Where a new garden starts until you set your own. */
export const isDefaultLocation = (g: Garden) => g.latitude === 52.5 && g.longitude === -1.5;

export function setupSteps(g: Garden, prefs: Pick<Prefs, 'northChecked' | 'lastBackup'>): Step[] {
  return [
    { id: 'boundary', title: 'Set up your space', why: 'A balcony, a patio, a garden or an allotment: the plan is drawn to scale.', done: g.boundary.length >= 3 || g.features.length > 0 },
    { id: 'bed', title: 'Add a bed or pot', why: 'Beds, pots and planters are where plants go. Drag one in from below the plan.', done: g.features.some(isContainer) },
    { id: 'location', title: 'Say where your garden is', why: 'A postcode or town is enough. It times the sun and shade, the frosts and the seasons.', done: !isDefaultLocation(g) },
    { id: 'north', title: 'Point the north arrow north', why: 'Shadows fall the wrong way if north is out. On a phone, the compass can work it out.', done: g.northRotationDeg !== 0 || prefs.northChecked },
    { id: 'plants', title: 'Put plants in a bed', why: 'Then you get spacing checks and a job list for each month.', done: g.plantings.length > 0 },
    { id: 'backup', title: 'Download a backup', why: 'Your garden is kept only in this browser. A backup keeps it safe.', done: !!prefs.lastBackup },
  ];
}

/** Days since the last backup, or null if there's never been one. */
export function daysSinceBackup(lastBackup: string | null, now = new Date()): number | null {
  if (!lastBackup) return null;
  const [y, m, d] = lastBackup.split('-').map(Number);
  const then = new Date(y!, m! - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

/** Something worth keeping: a boundary, anything on the plan, or a note. */
export const worthKeeping = (g: Garden) => g.boundary.length >= 3 || g.features.length > 0 || g.plantings.length > 0 || g.notes.length > 0;

/** A backup reminder is due when there's something worth keeping and none in the last 30 days. */
export function backupDue(g: Garden, lastBackup: string | null, now = new Date()): boolean {
  if (!worthKeeping(g)) return false;
  const days = daysSinceBackup(lastBackup, now);
  return days === null || days >= 30;
}
