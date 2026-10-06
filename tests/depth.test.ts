// Depth and texture (Stage 11): bed edging, the soft shadows setting, and
// that drawing the ground and drawing what's live stay separate.

import { describe, expect, it } from 'vitest';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints, updateFeature } from '../src/model/features';
import { validateGarden } from '../src/model/validate';
import { sanitisePrefs } from '../src/theme/prefs';
import { parseFileText, toFile } from '../src/storage/file';

const square = rectPoints({ x: 0, y: 0, w: 2000, h: 1200 });

describe('bed edging', () => {
  it('new beds start with timber sides; other things have none', () => {
    expect(makeFeature('bed', { area: square }).edging).toBe('timber');
    expect(makeFeature('building', { area: square }).edging).toBeUndefined();
    expect(makeFeature('surface', { area: square }).edging).toBeUndefined();
  });

  it('can be changed or taken off, and saves with the garden', () => {
    const bed = makeFeature('bed', { area: square });
    let g = addFeature(newAppState().garden, bed);
    g = updateFeature(g, bed.id, { edging: 'brick' });
    expect(g.features[0]!.edging).toBe('brick');
    const back = parseFileText(JSON.stringify(toFile({ garden: g, userPlants: [] })));
    expect(back.ok && back.state.garden.features[0]!.edging).toBe('brick');
    g = updateFeature(g, bed.id, { edging: undefined });
    expect(JSON.parse(JSON.stringify(g)).features[0].edging).toBeUndefined();
  });

  it('only timber, brick or stone', () => {
    const bed = { ...makeFeature('bed', { area: square }), edging: 'wicker' as never };
    expect(validateGarden({ ...newAppState().garden, features: [bed] }).length).toBe(1);
  });
});

describe('soft shadows setting', () => {
  it('follows the look unless chosen, and keeps a choice', () => {
    expect(sanitisePrefs({}).depth).toBeNull();
    expect(sanitisePrefs({ depth: false }).depth).toBe(false);
    expect(sanitisePrefs({ depth: true }).depth).toBe(true);
    expect(sanitisePrefs({ depth: 'yes' }).depth).toBeNull();
  });
});
