// When the welcome screen shows, and how long its pause lasts. Pure, for tests.

import { viewForHash } from '../theme/prefs';

/**
 * A launch: the app opened at its start (no address, or Today by its name now or its old one, as the home-screen icon
 * opens it). A link or reminder to a particular screen ("#/garden", "#/today/reminder") goes straight there.
 */
export function welcomesAt(hash: string): boolean {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return parts.length === 0 || (parts.length === 1 && viewForHash(parts[0]!) === 'home');
}

/** The pause while it loads: between 1 and 5 seconds, a different length each time. `random` is 0 to 1. */
export const pauseMs = (random = Math.random()): number => Math.round(1000 + Math.min(1, Math.max(0, random)) * 4000);

/** A tap skips the pause once it's been this long. */
export const SKIP_AFTER_MS = 1000;

/** The pause never waits longer than this for the plant library, whatever the connection. */
export const LONGEST_WAIT_MS = 8000;

/** The choices take taps only after this long, so a second tap to hurry the pause doesn't land on one by accident. */
export const CHOICES_SETTLE_MS = 400;
