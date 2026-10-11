// When the welcome screen shows. Pure, for tests.

import { viewForHash } from '../theme/prefs';

/**
 * A launch: the app opened at its start (no address, or Today by its name now or its old one, as the home-screen icon
 * opens it). A link or reminder to a particular screen ("#/garden", "#/today/reminder") goes straight there.
 */
export function welcomesAt(hash: string): boolean {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return parts.length === 0 || (parts.length === 1 && viewForHash(parts[0]!) === 'home');
}

/** At most once a day: the first launch of the day welcomes you, and the rest go straight in. */
export const welcomeDue = (welcomedOn: string | null, today: string): boolean => welcomedOn !== today;
