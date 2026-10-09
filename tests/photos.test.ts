// The licence rule, enforced on every build: every photo must be public
// domain, CC0, CC BY or CC BY-SA, credited, and within its size budget.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LICENCES, licenceFamily, photoForMonth, PHOTOS, photosForMonth } from '../src/content/photos';

const DIR = join(__dirname, '..', 'public', 'seasons');
const BUDGET_KB = (w: number) => (w <= 640 ? 100 : w <= 1280 ? 200 : 350);

describe('seasonal photos', () => {
  // Was "at most one photo per month" until release 20, when you asked for more variety (9 Oct 2026).
  it('has at least four photos for every month, each used once', () => {
    for (let m = 1; m <= 12; m++) expect(photosForMonth(m).length, `month ${m}`).toBeGreaterThanOrEqual(4);
    expect(PHOTOS.every((p) => p.month >= 1 && p.month <= 12)).toBe(true);
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length);
    expect(new Set(PHOTOS.map((p) => p.sourceUrl)).size).toBe(PHOTOS.length);
  });

  it('shows a month’s photos in turn, one a day, the same all day', () => {
    const june = photosForMonth(6);
    const days = Array.from({ length: june.length }, (_, i) => photoForMonth(6, i + 1)!.id);
    expect(new Set(days).size).toBe(june.length);
    expect(photoForMonth(6, june.length + 1)!.id).toBe(days[0]);
    expect(photoForMonth(6, 3)).toBe(photoForMonth(6, 3));
  });

  for (const p of PHOTOS) {
    describe(p.id, () => {
      it('has an allowed licence', () => {
        expect(ALLOWED_LICENCES as readonly string[]).toContain(licenceFamily(p.licence));
      });

      it('is fully credited', () => {
        expect(p.author.trim()).not.toBe('');
        expect(p.title.trim()).not.toBe('');
        expect(p.alt.trim().length).toBeGreaterThan(10);
        expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(p.licenceUrl).toMatch(/^https?:\/\//);
        expect(p.changes.trim()).not.toBe('');
      });

      it('has every size, within budget', () => {
        for (const w of p.widths)
          for (const ext of ['avif', 'webp']) {
            const file = join(DIR, `${p.id}-${w}.${ext}`);
            expect(existsSync(file), file).toBe(true);
            expect(statSync(file).size / 1024, file).toBeLessThanOrEqual(BUDGET_KB(w));
          }
      });
    });
  }
});

describe('licenceFamily', () => {
  it('groups versions and spots disallowed licences', () => {
    expect(licenceFamily('CC BY-SA 2.0')).toBe('CC BY-SA');
    expect(licenceFamily('CC BY 4.0')).toBe('CC BY');
    expect(licenceFamily('Public domain')).toBe('Public domain');
    expect(licenceFamily('CC0')).toBe('CC0');
    expect(ALLOWED_LICENCES as readonly string[]).not.toContain(licenceFamily('CC BY-NC 2.0'));
    expect(ALLOWED_LICENCES as readonly string[]).not.toContain(licenceFamily('CC BY-ND 4.0'));
  });
});
