// Every look, light and dark, must keep text readable: WCAG AA, 4.5:1.

import { describe, expect, it } from 'vitest';
import { LOOK_IDS, LOOKS, type PlanPalette, type UiPalette } from '../src/theme/looks';
import { contrast } from './colour';

const UI_PAIRS: [keyof UiPalette, keyof UiPalette][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['link', 'bg'],
  ['link', 'surface'],
  ['accentText', 'accent'],
  ['selectedText', 'selectedBg'],
  ['chromeText', 'chrome'],
  ['chromeMuted', 'chrome'],
  ['warnText', 'warnBg'],
];

const PLAN_PAIRS: [keyof PlanPalette, keyof PlanPalette][] = [
  ['label', 'paper'],
  ['label', 'lawn'],
];

describe('contrast', () => {
  it('measures a known pair', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  for (const id of LOOK_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${id} ${mode}: text pairs meet 4.5:1`, () => {
        const { ui, plan } = LOOKS[id][mode];
        const failures = [
          ...UI_PAIRS.map(([fg, bg]) => [`${fg} on ${bg}`, contrast(ui[fg], ui[bg])] as const),
          ...PLAN_PAIRS.map(([fg, bg]) => [`plan ${fg} on ${bg}`, contrast(plan[fg], plan[bg])] as const),
        ]
          .filter(([, ratio]) => ratio < 4.5)
          .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}`);
        expect(failures).toEqual([]);
      });
    }
  }
});
