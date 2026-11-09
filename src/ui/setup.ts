// The getting-started list on Home: what someone new needs to do, in order,
// worked out from the garden itself so it's never out of step.

import type { Garden } from '../model/types';
import { isContainer } from '../planting/place';
import type { Prefs } from '../theme/prefs';

export type StepId = 'boundary' | 'bed' | 'location' | 'north' | 'plants';

export interface Step {
  id: StepId;
  title: string;
  why: string;
  done: boolean;
}

/** Where a new garden starts until you set your own. */
export const isDefaultLocation = (g: Garden) => g.latitude === 52.5 && g.longitude === -1.5;

export function setupSteps(g: Garden, prefs: Pick<Prefs, 'northChecked'> & Partial<Pick<Prefs, 'usedSun'>>): Step[] {
  const steps: Step[] = [
    { id: 'boundary', title: 'Set up your space', why: 'A balcony, a patio, a garden or an allotment: the plan is drawn to scale.', done: g.boundary.length >= 3 || g.features.length > 0 },
    { id: 'bed', title: 'Add a bed or pot', why: 'Beds, pots and planters are where plants go. Drag one in from below the plan.', done: g.features.some(isContainer) },
    { id: 'location', title: 'Say where your garden is', why: 'A postcode or town is enough. It times the sun and shade, the frosts and the seasons.', done: !isDefaultLocation(g) },
    { id: 'north', title: 'Point the north arrow north', why: 'Shadows fall the wrong way if north is out. On a phone, the compass can work it out.', done: g.northRotationDeg !== 0 || prefs.northChecked },
    { id: 'plants', title: 'Put plants in a bed', why: 'Then you get spacing checks and a job list for each month.', done: g.plantings.length > 0 },
  ];
  // The north arrow only matters for the sun: it waits until you've looked at sun or shade (or already turned it).
  const shown = steps.filter((s) => s.id !== 'north' || s.done || prefs.usedSun === true);
  // Kept as a list: no plan to set up or turn north.
  if (g.view !== 'list') return shown;
  return shown.filter((s) => s.id !== 'boundary' && s.id !== 'north').map((s) => (s.id === 'bed' ? { ...s, why: 'Beds, pots and planters are where plants go. Add one on the Garden tab: a name is enough.' } : s.id === 'plants' ? { ...s, why: 'Then you get a job list for each month, and how full each bed is.' } : s));
}

/** Days since the last backup, or null if there's never been one. */
export function daysSinceBackup(lastBackup: string | null, now = new Date()): number | null {
  if (!lastBackup) return null;
  const [y, m, d] = lastBackup.split('-').map(Number);
  const then = new Date(y!, m! - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  // A copy dated after today (a wrong clock) can't be said to be recent: it counts as no date known.
  return days < 0 ? null : days;
}

/** Something worth keeping: a boundary, anything on the plan, or a note. */
export const worthKeeping = (g: Garden) => g.boundary.length >= 3 || g.features.length > 0 || g.plantings.length > 0 || g.notes.length > 0;

/** A backup reminder is due when there's something worth keeping and none in the last 30 days. */
export function backupDue(g: Garden, lastBackup: string | null, now = new Date()): boolean {
  if (!worthKeeping(g)) return false;
  const days = daysSinceBackup(lastBackup, now);
  return days === null || days >= 30;
}

/** After the first day Getting started showed, it leaves Today, and waits under the ··· until it's wanted. */
export const setupFolded = (setupFrom: string | null, today: string): boolean => !!setupFrom && today > setupFrom;

/** Steps of Getting started are still to do, and it hasn't been put away: the ··· offers it. */
export const setupLeft = (g: Garden, prefs: Pick<Prefs, 'northChecked' | 'setupHidden' | 'setupFrom'> & Partial<Pick<Prefs, 'usedSun'>>, today: string): boolean => !prefs.setupHidden && setupFolded(prefs.setupFrom, today) && setupSteps(g, prefs).some((s) => !s.done);

/** "today", "yesterday", "12 days ago". */
const daysAgo = (days: number) => (days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/** The one line on where the garden is and how safe it is: the same on Today and in Settings. */
export function safetyText(lastBackup: string | null, now = new Date()): string {
  const days = daysSinceBackup(lastBackup, now);
  if (days === null && lastBackup && /^\d{4}-\d{2}-\d{2}$/.test(lastBackup)) {
    const [y, m, d] = lastBackup.split('-').map(Number);
    const full = new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Saved only in this browser on this device. Last copy ${full}.`;
  }
  return `Saved only in this browser on this device. ${days === null ? 'No copy yet.' : `Last copy ${daysAgo(days)}.`}`;
}
