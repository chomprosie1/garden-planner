import { describe, expect, it } from 'vitest';
import { SEASONS, seasonFor } from '../src/content/seasons';
import { resolveMode } from '../src/theme/apply';
import { LOOK_IDS, LOOKS, themeVars } from '../src/theme/looks';
import { createPrefsStore, defaultPrefs, sanitisePrefs } from '../src/theme/prefs';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('prefs', () => {
  it('defaults to Cottage, following the device for light or dark', () => {
    expect(defaultPrefs()).toMatchObject({ look: 'cottage', mode: 'auto', onboarded: false });
  });

  it('drops unknown or invalid values', () => {
    const p = sanitisePrefs({ look: 'neon', mode: 'dark', photoMonth: 13, textSize: 'large', focus: 'yes', extra: 1 });
    expect(p.look).toBe('cottage');
    expect(p.mode).toBe('dark');
    expect(p.photoMonth).toBe('auto');
    expect(p.textSize).toBe('large');
    expect(p.focus).toBeNull();
    expect(p).not.toHaveProperty('extra');
  });

  it('saves and reloads', () => {
    const storage = memoryStorage();
    createPrefsStore(storage).set({ look: 'heritage', photos: 'off' });
    expect(createPrefsStore(storage).get()).toMatchObject({ look: 'heritage', photos: 'off' });
  });

  it('survives unreadable storage', () => {
    const storage = memoryStorage();
    storage.setItem('garden-planner:prefs', '{not json');
    expect(createPrefsStore(storage).get().look).toBe('cottage');
  });

  it('resolves auto mode from the device', () => {
    expect(resolveMode(defaultPrefs(), true)).toBe('dark');
    expect(resolveMode(defaultPrefs(), false)).toBe('light');
    expect(resolveMode({ ...defaultPrefs(), mode: 'light' }, true)).toBe('light');
  });
});

describe('looks', () => {
  it('gives every look the same set of tokens in both modes', () => {
    const keys = Object.keys(themeVars(LOOKS.cottage, 'light')).sort();
    for (const id of LOOK_IDS)
      for (const mode of ['light', 'dark'] as const) expect(Object.keys(themeVars(LOOKS[id], mode)).sort()).toEqual(keys);
  });
});

describe('seasons', () => {
  it('covers all twelve months in order, with jobs', () => {
    expect(SEASONS.map((s) => s.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    SEASONS.forEach((s) => expect(s.jobs.length).toBeGreaterThanOrEqual(3));
    expect(seasonFor(13).name).toBe('January');
  });
});
