// Release 20: the welcome on launch. When it shows, how long it pauses, the
// version it shows, and the quotes: the rules a test can check. Whether a line
// sounds like a person wrote it is for a person to judge.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickQuote, QUOTES, quotesFor, seasonOfMonth, type QuoteSeason } from '../src/content/quotes';
import { APP_VERSION, versionText } from '../src/content/version';
import { pauseMs, SKIP_AFTER_MS, welcomesAt } from '../src/ui/launch';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

describe('the welcome on launch', () => {
  it('shows when the app opens at its start or at Today, not for a link or reminder to a screen', () => {
    for (const h of ['', '#', '#/', '#/today', '#/today/']) expect(welcomesAt(h), h).toBe(true);
    for (const h of ['#/garden', '#/seedlings', '#/today/reminder', '#/help/sowing', '#/settings']) expect(welcomesAt(h), h).toBe(false);
    // Today by its old name too.
    expect(welcomesAt('#/home')).toBe(true);
  });

  it('pauses between one and five seconds, and can be skipped after a second', () => {
    expect(pauseMs(0)).toBe(1000);
    expect(pauseMs(1)).toBe(5000);
    expect(pauseMs(-3)).toBe(1000);
    expect(pauseMs(9)).toBe(5000);
    for (let i = 0; i < 50; i++) {
      const ms = pauseMs();
      expect(ms).toBeGreaterThanOrEqual(1000);
      expect(ms).toBeLessThanOrEqual(5000);
    }
    expect(SKIP_AFTER_MS).toBe(1000);
  });

  it('shows the version from package.json, and the day it was built', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^0\.\d+\.\d+$/);
    expect(versionText('0.20.0', '2026-10-09')).toBe('Version 0.20.0 · 9 Oct 2026');
    expect(versionText('0.20.0', '')).toBe('Version 0.20.0');
  });
});

describe('quotes', () => {
  it('has a good handful for every season, and some for any time, with no repeats', () => {
    for (const s of ['winter', 'spring', 'summer', 'autumn', 'any'] as QuoteSeason[]) expect(QUOTES.filter((x) => x.season === s).length, s).toBeGreaterThanOrEqual(10);
    expect(new Set(QUOTES.map((x) => x.text.toLowerCase())).size).toBe(QUOTES.length);
  });

  it('keeps to the voice: short, a full stop at the end, no exclamations or questions, no dashes', () => {
    for (const { text } of QUOTES) {
      expect(text.length, text).toBeLessThanOrEqual(110);
      expect(text, text).toMatch(/^[A-Z].*\.$/);
      expect(text, text).not.toMatch(/[!?—–]| - /);
    }
  });

  it('avoids the words and shapes that sound machine-written', () => {
    const words = /\b(journey|magic(al)?|soul|nurture|embrace|tapestry|testament|delve|whisper(s)?|symphony|dream(s)?|promise(s)?|miracle(s)?|cherish|unlock|simply|truly)\b/i;
    // "It isn't X. It's Y." and "Not X, but Y": the shape of a slogan.
    const notButIs = /\b(isn[’']t|not)\b[^.]*\.\s*(it|that|they)[’']s\b|\bnot\b[^.]*,\s*but\b/i;
    for (const { text } of QUOTES) {
      expect(text, text).not.toMatch(words);
      expect(text, text).not.toMatch(notButIs);
    }
  });

  it('names no one: the only capitals after the first word are months and "I"', () => {
    for (const { text } of QUOTES) {
      const caps = text
        .split(/[\s,.]+/)
        .slice(1)
        .filter((w, i, all) => /^[A-Z]/.test(w) && !/[.]$/.test(all[i] ?? ''));
      for (const w of caps) {
        const sentenceStart = new RegExp(`\\.\\s+${w}\\b`).test(text);
        expect(sentenceStart || MONTHS.includes(w.replace(/[’'].*$/, '')) || w === 'I', `${w} in "${text}"`).toBe(true);
      }
    }
  });

  it('picks one for the season, never the one shown last time', () => {
    expect(seasonOfMonth(1)).toBe('winter');
    expect(seasonOfMonth(4)).toBe('spring');
    expect(seasonOfMonth(7)).toBe('summer');
    expect(seasonOfMonth(10)).toBe('autumn');
    expect(seasonOfMonth(12)).toBe('winter');
    for (let m = 1; m <= 12; m++) {
      const fits = new Set(quotesFor(m).map((x) => x.text));
      for (const r of [0, 0.3, 0.7, 0.999]) {
        const pick = pickQuote(m, null, r);
        expect(fits.has(pick.text)).toBe(true);
        expect(pickQuote(m, pick.text, r).text).not.toBe(pick.text);
      }
    }
  });
});
