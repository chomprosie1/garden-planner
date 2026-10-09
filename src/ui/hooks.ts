import { useEffect, useState } from 'preact/hooks';
import { VIEW_HASH, viewForHash, type Prefs, type PrefsStore, type View } from '../theme/prefs';

export function usePrefs(prefs: PrefsStore): Prefs {
  const [value, setValue] = useState(prefs.get());
  useEffect(() => {
    setValue(prefs.get());
    return prefs.subscribe(setValue);
  }, [prefs]);
  return value;
}

const PHONE = '(max-width: 700px)';

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

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

/** The current screen, kept in the URL hash so reloads and the back button work. */
export function useView(prefs: PrefsStore): [View, (v: View, sub?: string) => void] {
  const [view, setView] = useState<View>(() => {
    const fromHash = viewFromHash();
    if (fromHash) return fromHash;
    // Phones open on Home; desktops go back to where you were.
    return matchMedia(PHONE).matches ? 'home' : prefs.get().lastView;
  });
  useEffect(() => {
    const on = () => {
      const v = viewFromHash();
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
