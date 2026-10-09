// Asking the browser to keep the garden: without it, a browser short of space,
// or Safari after weeks without a visit, can clear what a site has kept. Once
// there's something worth keeping, it's asked; if the browser says no, it's
// asked again a week later (Chrome grants it as a site gets used, or once it's
// installed).

/** What the browser said: it'll keep the garden, it might clear it, or it can't say. */
export type Kept = 'kept' | 'not-kept' | 'unknown';

/** Days to wait before asking again after a no. */
export const ASK_AGAIN_DAYS = 7;

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

/** Whether to ask now: something worth keeping, and never asked, or a no at least a week ago. A yes is never asked again. */
export function shouldAskToKeep(worthKeeping: boolean, kept: Kept | null, askedOn: string | null, today: string): boolean {
  if (!worthKeeping || kept === 'kept') return false;
  if (!askedOn || kept === null) return true;
  return dayNumber(today) - dayNumber(askedOn) >= ASK_AGAIN_DAYS;
}

/**
 * Firefox asks you out loud whether a site may keep its data. It isn't asked unprompted, at launch: Firefox users
 * rely on backups, as before.
 */
export const asksOutLoud = () => /firefox|fxios/i.test(navigator.userAgent);

/** Asks the browser to keep this site's storage. Quiet in Chrome, Edge and Safari. */
export async function askToKeep(): Promise<Kept> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return 'unknown';
    if (await storage.persisted()) return 'kept';
    return (await storage.persist()) ? 'kept' : 'not-kept';
  } catch {
    return 'unknown';
  }
}
