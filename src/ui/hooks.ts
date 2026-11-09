import { useEffect, useState } from 'preact/hooks';
import { asShown, VIEW_HASH, viewForHash, type Prefs, type PrefsStore, type View } from '../theme/prefs';

export function usePrefs(prefs: PrefsStore): Prefs {
  const [value, setValue] = useState(() => asShown(prefs.get()));
  useEffect(() => {
    setValue(asShown(prefs.get()));
    return prefs.subscribe((p) => setValue(asShown(p)));
  }, [prefs]);
  return value;
}

/** How much bigger than standard the words are, by the text size here (the app's, and any the browser's set). */
export const rootTextScale = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;

const PHONE = '(max-width: 700px)';

/** A finger, not a mouse: no double-click and no arrow keys. */
export const touchScreen = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Whether a media query matches, kept up to date as the screen turns or the window changes. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const change = () => setOn(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, [query]);
  return on;
}

export const useIsPhone = (): boolean => useMedia(PHONE);

/** The address after "#/", split at its slashes: "help/adding-plants" is the Help page at that topic. */
const hashParts = () => location.hash.replace(/^#\/?/, '').split('/');
const viewFromHash = (): View | null => viewForHash(hashParts()[0] ?? '');

/** "#/today" for Home. */
export const hashFor = (v: View) => `#/${VIEW_HASH[v]}`;

/** "#/help/adding-plants": the Help page open at a topic. */
export const hashForHelp = (topic?: string) => `#/${VIEW_HASH.help}${topic ? `/${topic}` : ''}`;

/** The help topic the address is open at, kept in step with the back button. */
export function useHelpTopic(): string | null {
  const read = () => (viewFromHash() === 'help' ? (hashParts()[1] ?? null) : null);
  const [topic, setTopic] = useState(read);
  useEffect(() => {
    const on = () => setTopic(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return topic;
}

/** The welcome is for a first visit: not yet welcomed, and nothing in the garden. A garden with things in it means the preferences were lost, not that this is new. */
export const needsWelcome = (onboarded: boolean, welcomeAgain: boolean, garden: { features: unknown[]; plantings: unknown[] }): boolean =>
  !onboarded && (welcomeAgain || (garden.features.length === 0 && garden.plantings.length === 0));

/** The plant check is for those with the plant editor on; for anyone else its address shows Plants. */
export const gateView = (v: View, plantEditor: boolean): View => (v === 'check' && !plantEditor ? 'plants' : v);

/** What an address shows: an empty one is Today, and one that names no screen is Today too, flagged as unknown. Case matters. */
export function viewForAddress(hash: string): { view: View; unknown: boolean } {
  const first = hash.replace(/^#\/?/, '').split('/')[0] ?? '';
  if (first === '') return { view: 'home', unknown: false };
  const v = viewForHash(first);
  return v ? { view: v, unknown: false } : { view: 'home', unknown: true };
}

export const NO_SUCH_PAGE = "There's no page at that address, so here's Today.";

/** The current screen, kept in the URL hash so reloads and the back button work. `onUnknown` hears of an address that shows nothing. */
export function useView(prefs: PrefsStore, onUnknown?: (message: string) => void): [View, (v: View, sub?: string) => void] {
  /** The screen an address shows, tidying the address bar when it isn't a true one. */
  const resolve = (): View | null => {
    const { view: v, unknown } = viewForAddress(location.hash);
    if (!unknown && location.hash.replace(/^#\/?/, '') === '') return null;
    const shown = unknown ? 'home' : gateView(v, prefs.get().plantEditor);
    if (unknown || shown !== v) history.replaceState(null, '', hashFor(shown));
    if (unknown) onUnknown?.(NO_SUCH_PAGE);
    return shown;
  };
  const [view, setView] = useState<View>(() => {
    const fromHash = resolve();
    if (fromHash) return fromHash;
    // Phones open on Home; desktops go back to where you were.
    return matchMedia(PHONE).matches ? 'home' : prefs.get().lastView;
  });
  useEffect(() => {
    const on = () => {
      const v = resolve();
      if (v) setView(v);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  /** Goes to a screen; `sub` is a part within it, such as a help topic ("#/help/adding-plants"). */
  const go = (v: View, sub?: string) => {
    const hash = `${hashFor(v)}${sub ? `/${sub}` : ''}`;
    if (location.hash !== hash) location.hash = hash.slice(1);
    setView(v);
    if (v !== 'settings' && v !== 'help') prefs.set({ lastView: v });
  };
  return [view, go];
}

/** The month shown: today's, unless a favourite month is pinned for photos. */
export function currentMonth(now = new Date()): number {
  return now.getMonth() + 1;
}
