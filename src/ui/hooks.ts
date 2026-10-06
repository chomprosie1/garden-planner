import { useEffect, useState } from 'preact/hooks';
import { VIEWS, type Prefs, type PrefsStore, type View } from '../theme/prefs';

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

const viewFromHash = (): View | null => {
  const v = location.hash.replace(/^#\/?/, '');
  return (VIEWS as readonly string[]).includes(v) ? (v as View) : null;
};

/** The current screen, kept in the URL hash so reloads and the back button work. */
export function useView(prefs: PrefsStore): [View, (v: View) => void] {
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
  const go = (v: View) => {
    if (location.hash !== `#/${v}`) location.hash = `/${v}`;
    setView(v);
    if (v !== 'settings') prefs.set({ lastView: v });
  };
  return [view, go];
}

/** The month shown: today's, unless a favourite month is pinned for photos. */
export function currentMonth(now = new Date()): number {
  return now.getMonth() + 1;
}
