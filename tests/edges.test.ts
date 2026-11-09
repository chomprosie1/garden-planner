import { describe, expect, it } from 'vitest';
import { newGarden } from '../src/model/defaults';
import { gateView, needsWelcome, viewForAddress } from '../src/ui/hooks';

describe('release 57h: small untruths', () => {
  it('shows the welcome only to an empty garden that has not been welcomed', () => {
    const empty = newGarden();
    const withBed = { ...newGarden(), features: [{ id: 'f1' }] as never };
    const withPlanting = { ...newGarden(), plantings: [{ id: 'p1' }] as never };
    expect(needsWelcome(false, false, empty)).toBe(true);
    expect(needsWelcome(false, false, withBed)).toBe(false);
    expect(needsWelcome(false, false, withPlanting)).toBe(false);
    expect(needsWelcome(false, true, withBed)).toBe(true);
    expect(needsWelcome(true, true, withBed)).toBe(false);
    expect(needsWelcome(true, false, empty)).toBe(false);
  });

  it('keeps the check page for those with the plant editor on, and sends others to Plants', () => {
    expect(gateView('check', false)).toBe('plants');
    expect(gateView('check', true)).toBe('check');
    expect(gateView('plants', false)).toBe('plants');
  });

  it('says whether an address is unknown, without throwing', () => {
    for (const h of ['#/nonsense', '#/SETTINGS', '#/%00', '#/%E0%A4%A']) {
      expect(viewForAddress(h)).toEqual({ view: 'home', unknown: true });
    }
    expect(viewForAddress('')).toEqual({ view: 'home', unknown: false });
    expect(viewForAddress('#/')).toEqual({ view: 'home', unknown: false });
    expect(viewForAddress('#/settings')).toEqual({ view: 'settings', unknown: false });
    expect(viewForAddress('#/month')).toEqual({ view: 'month', unknown: false });
    expect(viewForAddress('#/help/no-such-topic')).toEqual({ view: 'help', unknown: false });
  });
});
