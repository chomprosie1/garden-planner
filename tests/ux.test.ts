// The UX plan (docs/ux-plan.md), release by release.

import { describe, expect, it } from 'vitest';
import { newGarden } from '../src/model/defaults';
import { sanitisePrefs, VIEW_HASH, viewForHash, VIEWS } from '../src/theme/prefs';
import { placeText } from '../src/ui/GardenSettings';
import { reportUrl } from '../src/ui/PlantCard';
import { unknownPlant } from '../src/planting/place';

describe('release 1: finding your way', () => {
  it('names the tabs in the address bar, and old addresses still work', () => {
    expect(viewForHash('today')).toBe('home');
    expect(viewForHash('garden')).toBe('plan');
    expect(viewForHash('seedlings')).toBe('shed');
    expect(viewForHash('your-garden')).toBe('profile');
    // Links from before: #/home, #/plan, #/shed, #/notes.
    expect(viewForHash('home')).toBe('home');
    expect(viewForHash('plan')).toBe('plan');
    expect(viewForHash('shed')).toBe('shed');
    expect(viewForHash('notes')).toBe('notes');
    expect(viewForHash('nowhere')).toBeNull();
    // Every screen has its own address, and no two share one.
    expect(new Set(VIEWS.map((v) => VIEW_HASH[v])).size).toBe(VIEWS.length);
  });

  it('says where the garden is in words, not numbers', () => {
    expect(placeText(newGarden())).toMatch(/^Not set yet/);
    expect(placeText({ ...newGarden(), latitude: 53.8, longitude: -1.55 })).toBe('Near Leeds.');
    expect(placeText({ ...newGarden(), latitude: 55.85, longitude: -4.43 })).toBe('Near Paisley.');
    expect(placeText({ ...newGarden(), latitude: 48.85, longitude: 2.35 })).toBe('Set from your location.');
  });

  it('keeps the plant-checking tools for whoever keeps the plant data', () => {
    expect(sanitisePrefs({}).plantEditor).toBe(false);
    expect(sanitisePrefs({ plantEditor: true }).plantEditor).toBe(true);
    const url = reportUrl({ ...unknownPlant('carrot'), commonName: 'Carrot' });
    expect(url).toMatch(/^https:\/\/github\.com\/chomprosie1\/garden-planner\/issues\/new\?title=Plant%20notes%3A%20Carrot&body=/);
  });
});
