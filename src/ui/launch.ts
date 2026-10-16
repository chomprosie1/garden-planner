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

/**
 * Not on a normal day: the app opens on Today. The welcome is for the first launch in a new month (or ever), or when
 * there's something new in the app you haven't seen.
 */
export const welcomeDue = (welcomedOn: string | null, today: string, news = false): boolean => !welcomedOn || welcomedOn.slice(0, 7) !== today.slice(0, 7) || (news && welcomedOn !== today);
