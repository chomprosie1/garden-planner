// The licence rule, enforced on every build: every photo must be public
// domain, CC0, CC BY or CC BY-SA, credited, and within its size budget.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LICENCES, licenceFamily, PHOTOS } from '../src/content/photos';

const DIR = join(__dirname, '..', 'public', 'seasons');
const BUDGET_KB = (w: number) => (w <= 640 ? 100 : w <= 1280 ? 200 : 350);

describe('seasonal photos', () => {
  it('has at most one photo per month', () => {
    const months = PHOTOS.map((p) => p.month);
    expect(new Set(months).size).toBe(months.length);
    months.forEach((m) => expect(m >= 1 && m <= 12).toBe(true));
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
