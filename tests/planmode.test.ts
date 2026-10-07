// Release 7: Simple and Advanced on the plan. What each offers, what can be
// resized in Simple, and that nothing on the plan depends on the mode.

import { describe, expect, it } from 'vitest';
import { makeFeature, rectPoints, rotateFeature, setSmooth } from '../src/model/features';
import { newAppState } from '../src/model/defaults';
import { STICKERS } from '../src/model/stickers';
import { defaultPrefs, sanitisePrefs } from '../src/theme/prefs';
import { DRAWERS_IN, isAdvancedLens, isAdvancedTool, isLocked, LENSES_IN, pillHasExtras, resizableInSimple, showsSticker, SIMPLE_STICKERS } from '../src/ui/planMode';

describe('the setting', () => {
  it('starts on Simple, is remembered, and anything else falls back to Simple', () => {
    expect(defaultPrefs().planMode).toBe('simple');
    expect(sanitisePrefs({ planMode: 'advanced' }).planMode).toBe('advanced');
    expect(sanitisePrefs({ planMode: 'expert' }).planMode).toBe('simple');
    expect(sanitisePrefs({}).planMode).toBe('simple');
  });

  it('the padlock only counts in Advanced, so nothing is stuck in Simple with no way to unlock it', () => {
    expect(isLocked({ layoutLocked: true, planMode: 'advanced' })).toBe(true);
    expect(isLocked({ layoutLocked: true, planMode: 'simple' })).toBe(false);
    expect(isLocked({ layoutLocked: false, planMode: 'advanced' })).toBe(false);
  });
});

describe('what each offers', () => {
  it('Simple has four drawers, without Draw; Advanced has all five', () => {
    expect(DRAWERS_IN.simple).toEqual(['plants', 'beds', 'ground', 'build']);
    expect(DRAWERS_IN.advanced).toContain('draw');
  });

  it('Simple lists the usual things, every one real, with something in each drawer; Advanced lists everything', () => {
    const ids = new Set(STICKERS.map((s) => s.id));
    for (const id of SIMPLE_STICKERS) expect(ids.has(id), id).toBe(true);
    for (const group of ['beds', 'ground', 'build'] as const) expect(STICKERS.some((s) => s.group === group && showsSticker('simple', s.id)), group).toBe(true);
    expect(STICKERS.filter((s) => showsSticker('simple', s.id)).length).toBeLessThan(STICKERS.length);
    for (const s of STICKERS) expect(showsSticker('advanced', s.id)).toBe(true);
    // A raised bed, a pot and a lawn: enough to start in Simple.
    for (const id of ['raised-bed', 'pot', 'lawn']) expect(showsSticker('simple', id)).toBe(true);
  });

  it('sun and shade are Advanced; flowers, harvest and water are in both', () => {
    expect(LENSES_IN.simple).toEqual(['none', 'flower', 'harvest', 'water']);
    expect(isAdvancedLens('sun')).toBe(true);
    expect(isAdvancedLens('shade')).toBe(true);
    expect(isAdvancedLens('harvest')).toBe(false);
    for (const l of LENSES_IN.simple) expect(LENSES_IN.advanced).toContain(l);
  });

  it('only picking and planting are Simple tools; anything else asks for Advanced', () => {
    expect(isAdvancedTool('select')).toBe(false);
    expect(isAdvancedTool('plant')).toBe(false);
    for (const t of ['boundary', 'bed', 'path', 'sketch', 'trace', 'calibrate', 'tree']) expect(isAdvancedTool(t), t).toBe(true);
  });

  it('typed sizes, curved edges and edging on the action pill are Advanced', () => {
    expect(pillHasExtras('simple')).toBe(false);
    expect(pillHasExtras('advanced')).toBe(true);
  });
});

describe('resizing in Simple', () => {
  const rect = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) });

  it('a rectangle (at any angle) and anything round can be resized by its handles', () => {
    expect(resizableInSimple(rect)).toBe(true);
    const turned = rotateFeature({ ...newAppState().garden, features: [rect] }, rect.id, 30).features[0]!;
    expect(resizableInSimple(turned)).toBe(true);
    expect(resizableInSimple(makeFeature('pot', { circle: { centre: [0, 0], radiusMm: 150 } }))).toBe(true);
  });

  it('shapes drawn by corners, curves and lines are reshaped in Advanced', () => {
    expect(resizableInSimple(makeFeature('bed', { area: [[0, 0], [3000, 0], [3000, 1000], [1500, 2000], [0, 1000]] }))).toBe(false);
    const curved = setSmooth({ ...newAppState().garden, features: [rect] }, rect.id, true).features[0]!;
    expect(resizableInSimple(curved)).toBe(false);
    expect(resizableInSimple(makeFeature('path', { line: [[0, 0], [3000, 0]] }))).toBe(false);
  });
});
