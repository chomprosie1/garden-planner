import { loadLookFonts } from './fonts';
import { LOOKS, themeVars, type Mode } from './looks';
import type { Prefs, PrefsStore } from './prefs';

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

export function resolveMode(prefs: Prefs, systemDark: boolean): Mode {
  return prefs.mode === 'auto' ? (systemDark ? 'dark' : 'light') : prefs.mode;
}

/** Applies the look to <html>, and keeps it in step with prefs and the system setting. */
export function startTheme(prefs: PrefsStore): void {
  const apply = () => {
    const p = prefs.get();
    const look = LOOKS[p.look];
    const mode = resolveMode(p, darkQuery().matches);
    const root = document.documentElement;
    root.dataset.look = look.id;
    root.dataset.mode = mode;
    root.dataset.text = p.textSize;
    root.dataset.photos = p.photos;
    root.style.colorScheme = mode;
    for (const [k, v] of Object.entries(themeVars(look, mode))) root.style.setProperty(k, v);
    void loadLookFonts(look.id);
    // Remembered for the inline script in index.html, so the next load paints the right background at once.
    try {
      localStorage.setItem('garden-planner:paint', JSON.stringify({ bg: look[mode].ui.bg, mode }));
    } catch {
      // not essential
    }
  };
  apply();
  prefs.subscribe(apply);
  darkQuery().addEventListener('change', apply);
}
