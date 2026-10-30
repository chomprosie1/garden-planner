// Releases 57b to 57d: what the interim round of 30 Oct 2026 found. A crop you say is cropping isn't finished, plants go
// where you asked, and dates follow a short season.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { sensibleSize } from '../src/canvas/snap';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { clearingDue, expectedText, isFinished, stageOn, timeline } from '../src/lifecycle/projection';
import { addDays } from '../src/lifecycle/shed';
import { inGroundStages } from '../src/lifecycle/stages';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, rectPoints } from '../src/model/features';
import { addListBed, namesFor } from '../src/model/listLayout';
import type { Feature, Garden, Plant, Planting, Stage } from '../src/model/types';
import { defaultFill } from '../src/planting/fill';
import { fullText, howFull, placeInList } from '../src/planting/listPlant';
import { addPlanting, countWord, inGroundChoice, makePlanting, plantCount, unknownPlant } from '../src/planting/place';
import { potOnChoices } from '../src/planting/pots';
import { addGarden, freeGardenName, type Kv } from '../src/storage/gardens';
import { asOneLine } from '../src/ui/oneLine';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const byId = new Map(withVarieties(species, varieties as VarietyEntry[]).map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Bed C' };
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));
const added = (id: string, date: string, stage: Stage, reached?: string) => makePlanting(plantOf(id), bed.id, 'single', [600, 600], undefined, { date, stage, ...(reached ? { reached } : {}) });

describe('plants go where you asked', () => {
  const raised: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Raised bed 1' };
  const row = (id: string, y: number, n: number): Planting => ({ ...makePlanting(plantOf(id), raised.id, 'row', [660, y], [1740, y]), count: n });
  const inRaised = (...pls: Planting[]) => pls.reduce(addPlanting, addFeature(newGarden(), raised));

  it('a row of spinach beside garlic and onions is a row’s worth, not 99 (Priya)', () => {
    // Spaced closely, as a new garden is.
    const close = (id: string): Plant => {
      const p = plantOf(id);
      return { ...p, size: { ...p.size, spacingMm: p.size.closeSpacingMm ?? p.size.spacingMm } };
    };
    const g = inRaised(row('garlic', 150, 10), row('garlic', 450, 10), row('onion-overwintering', 750, 12), row('onion-overwintering', 1050, 12));
    const { plantings } = placeInList(g, raised, close('spinach'), 'row', close);
    const total = plantings.reduce((t, pl) => t + plantCount(pl, close('spinach')), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(2400 / close('spinach').size.spacingMm);
  });

  it('adding a bed never renames the ones you have (Margaret)', () => {
    const g = [['Bed 1'], ['Bed 2']].reduce((x, [name]) => addListBed(x, 'bed', name!)[0], newGarden());
    expect(namesFor(g, 'Bed 1', 1, featureLabel)).toEqual(['Bed 3']);
    expect(namesFor(g, 'Herbs', 1, featureLabel)).toEqual(['Herbs']);
    expect(namesFor(g, 'Back door pot', 4, featureLabel)).toEqual(['Back door pot 1', 'Back door pot 2', 'Back door pot 3', 'Back door pot 4']);
    expect(namesFor(g, 'Bed 2', 2, featureLabel)).toEqual(['Bed 3', 'Bed 4']);
    const veg = addListBed(newGarden(), 'bed', 'Veg')[0];
    expect(namesFor(veg, 'Veg', 1, featureLabel)).toEqual(['Veg 2']);
  });

  it('a batch of names skips any that are taken', () => {
    const g = addListBed(newGarden(), 'pot', 'Back door pot 2')[0];
    expect(namesFor(g, 'Back door pot', 3, featureLabel)).toEqual(['Back door pot 1', 'Back door pot 3', 'Back door pot 4']);
  });

  it('one thyme, not a bedful: herbs that come back start on One (Ruth)', () => {
    for (const id of ['thyme', 'rosemary', 'chives', 'sage', 'oregano', 'mint']) expect(defaultFill(plantOf(id), bed), id).toBe('one');
    expect(defaultFill(plantOf('lettuce'), bed)).toBe('fill');
    expect(defaultFill(plantOf('carrot'), bed)).toBe('row');
    // A bulb that's filed under herbs still goes in by the handful.
    expect(defaultFill(plantOf('saffron'), bed)).not.toBe('one');
  });

  it('says over-full when it is, and full only of what fits (Priya)', () => {
    const pot: Feature = { ...makeFeature('pot', { circle: { centre: [200, 200], radiusMm: 175 } }), name: 'Bulb pot' };
    const g = addFeature(newGarden(), pot);
    const hyacinths = placeInList(g, pot, plantOf('grape-hyacinth'), 'fill', plantOf);
    const after = { ...g, plantings: hyacinths.plantings };
    const tulips = placeInList(after, pot, plantOf('tulip'), 24, plantOf);
    expect(tulips.full).toBe(true);
    expect(fullText(howFull({ ...after, plantings: [...after.plantings, ...tulips.plantings] }, pot, plantOf))).toBe('Over-full');
  });

  it('Pot on offers only empty pots (Priya)', () => {
    const small: Feature = { ...makeFeature('pot', { circle: { centre: [200, 200], radiusMm: 200 } }), name: 'Bay pot' };
    const full: Feature = { ...makeFeature('pot', { circle: { centre: [900, 200], radiusMm: 300 } }), name: 'Apple pot' };
    const free: Feature = { ...makeFeature('pot', { circle: { centre: [1600, 200], radiusMm: 300 } }), name: 'Spare pot' };
    const bay = makePlanting(plantOf('bay'), small.id, 'single', [200, 200]);
    const apple = makePlanting(plantOf('apple'), full.id, 'single', [900, 200]);
    const g = addFeature(addFeature(addFeature(newGarden(), small), full), free);
    const c = potOnChoices(addPlanting(addPlanting(g, bay), apple), bay.id, plantOf)!;
    expect(c.pots.map((p) => p.name)).toEqual(['Spare pot']);
    // A tower with pockets to spare is a place to go; one that's full isn't.
    const tower: Feature = { ...full, pockets: 8 };
    const towers = addPlanting(addPlanting(addFeature(addFeature(newGarden(), small), tower), bay), apple);
    expect(potOnChoices(towers, bay.id, plantOf)!.pots.map((p) => p.name)).toEqual(['Apple pot']);
    expect(potOnChoices(addPlanting(addFeature(addFeature(newGarden(), small), { ...full, pockets: 1 }), bay), bay.id, plantOf)!.pots).toHaveLength(1);
    expect(potOnChoices(addPlanting(addPlanting(addFeature(addFeature(newGarden(), small), { ...full, pockets: 1 }), bay), apple), bay.id, plantOf)!.pots).toEqual([]);
  });

  it('ticking a bed as made doesn’t add a job: no weeding a bed made today (Jordan)', () => {
    const made: Feature = { ...raised, toMake: true };
    const g = addPlanting(addFeature(newGarden(), made), row('garlic', 150, 10));
    const today = '2026-10-30';
    const list = (x: Garden) => jobsFor(x, plantOf, 10, 2026, { today, weeding: true });
    const before = list(g);
    const make = before.find((j) => j.key.startsWith('make-bed') || /Make/.test(j.verb ?? '') || j.plant === 'Raised bed 1')!;
    const after = list(toggleJob(g, make, today, plantOf));
    expect(after.length).toBe(before.length);
    expect(after.some((j) => j.kind === 'weed')).toBe(false);
    expect(list({ ...g, features: g.features.map((f) => ({ ...f, toMake: undefined })) }).some((j) => j.kind === 'weed')).toBe(true);
  });

  it('counts cloves and sets, not plants (Margaret)', () => {
    expect(countWord(plantOf('garlic'))).toBe('cloves');
    expect(countWord(plantOf('onion-overwintering'))).toBe('sets');
    expect(countWord(plantOf('tomato'))).toBe('plants');
    expect(countWord(plantOf('bay'))).toBe('plants');
  });

  it('a pot size too small to be one is asked about, not read as metres (Nadia)', () => {
    expect(sensibleSize('1.9', 'cm')).toBeNull();
    expect(sensibleSize('0.1', 'cm')).toBeNull();
    expect(sensibleSize('4', 'cm')).toBeNull();
    expect(sensibleSize('5', 'cm')).toBe(50);
    expect(sensibleSize('0.3 m', 'cm')).toBe(300);
    expect(sensibleSize('30', 'cm')).toBe(300);
    expect(sensibleSize('1.9', 'm')).toBe(1900);
  });

  it('a pasted name is one line, with spaces (Nadia)', () => {
    expect(asOneLine('Back\nbed')).toBe('Back bed');
    expect(asOneLine('  Back \r\n\r\n  bed  ')).toBe('Back bed');
    expect(asOneLine('Veg')).toBe('Veg');
  });

  it('a garden added beside one of the same name is told apart (Nadia)', () => {
    const m = new Map<string, string>();
    const s: Kv = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
    addGarden({ ...newGarden(), name: 'My garden' }, s, new Date(), true);
    expect(freeGardenName('My garden', s)).toBe('My garden 2');
    expect(freeGardenName('The allotment', s)).toBe('The allotment');
  });
});

describe('a crop you say is cropping isn’t finished (Margaret)', () => {
  const TODAY = '2026-10-30';

  // With no date for the stage, as a garden saved before this release has it, and with one, as it's saved now.
  for (const reached of [undefined, TODAY]) {
    const how = reached ? 'dated' : 'undated';

    it(`parsnips sown in April and being lifted, ${how}`, () => {
      const pl = added('parsnip', '2026-04-15', 'harvesting', reached);
      const g = gardenWith(pl);
      const steps = timeline(plantOf('parsnip'), pl, g, TODAY);
      expect(clearingDue(steps)).toBe(false);
      expect(steps.find((s) => s.stage === 'cleared')!.date! > '2027-02-01').toBe(true);
      const kinds = (month: number, year: number, today: string) => jobsFor(g, plantOf, month, year, { today }).filter((j) => j.plantId === 'parsnip').map((j) => j.kind);
      expect(kinds(10, 2026, TODAY)).not.toContain('tidy');
      expect(kinds(10, 2026, TODAY)).toContain('harvest');
    });

    it(`nothing on the card says it's over, ${how}`, () => {
      const pl = added('parsnip', '2026-04-15', 'harvesting', reached);
      expect(expectedText(timeline(plantOf('parsnip'), pl, gardenWith(pl), TODAY), plantOf('parsnip'), TODAY)).not.toMatch(/over/);
    });
  }

  it('no stage, for any kind of crop, is over the day you add it', () => {
    const crops: [string, string[]][] = [
      ['parsnip', ['2026-04-15', '2026-10-01', '2025-10-01']],
      ['leek', ['2026-06-01', '2026-10-01']],
      ['kale', ['2026-06-01']],
      ['carrot', ['2026-05-01']],
      ['lettuce', ['2026-09-01']],
      ['tomato', ['2026-05-20']],
      ['strawberry', ['2024-04-01', '2025-10-01']],
      ['apple', ['2022-02-01']],
      ['rosemary', ['2023-05-01']],
    ];
    for (const [id, dates] of crops)
      for (const date of dates)
        for (const stage of inGroundStages(plantOf(id)).filter((s) => s === 'flowering' || s === 'harvesting'))
          for (const reached of [undefined, TODAY]) {
            const pl = added(id, date, stage, reached);
            const g = gardenWith(pl);
            expect(clearingDue(timeline(plantOf(id), pl, g, TODAY)), `${id} ${date} ${stage}`).toBe(false);
            expect(isFinished(plantOf(id), pl, g, TODAY), `${id} ${date} ${stage}`).toBe(false);
          }
  });

  it('a tender crop you say is cropping after the frost date isn’t finished by tomorrow, flowering or harvesting', () => {
    const today = '2026-11-20';
    for (const [id, stage] of [['tomato', 'harvesting'], ['tomato', 'flowering'], ['courgette', 'flowering']] as const) {
      const pl = added(id, '2026-05-20', stage, today);
      const g = gardenWith(pl);
      expect(isFinished(plantOf(id), pl, g, today), `${id} ${stage}`).toBe(false);
      expect(isFinished(plantOf(id), pl, g, addDays(today, 7)), `${id} ${stage}`).toBe(false);
      expect(isFinished(plantOf(id), pl, g, addDays(today, 40)), `${id} ${stage}`).toBe(true);
    }
  });

  it('before the frost, a tender crop still ends at the frost, not after it', () => {
    const g = gardenWith();
    const frost = (d: string) => `2026-${d}`;
    for (const stage of ['harvesting', 'flowering'] as const) {
      const pl = added('tomato', '2026-05-20', stage, '2026-10-20');
      const end = timeline(plantOf('tomato'), pl, addPlanting(g, pl), '2026-10-20').find((s) => s.stage === 'cleared')!.date!;
      // Nothing's added for being marked close to it.
      expect(end <= frost('11-05'), stage).toBe(true);
    }
    const early = added('tomato', '2026-05-20', 'harvesting', '2026-10-20');
    const late = added('tomato', '2026-05-20', 'harvesting', '2026-09-01');
    const when = (pl: Planting, today: string) => timeline(plantOf('tomato'), pl, addPlanting(g, pl), today).find((s) => s.stage === 'cleared')!.date!;
    expect(when(early, '2026-10-20')).toBe(when(late, '2026-09-01'));
  });

  it('an old save at Harvesting with no date, in for over a year, does end', () => {
    const pl = added('parsnip', '2024-04-15', 'harvesting');
    expect(clearingDue(timeline(plantOf('parsnip'), pl, gardenWith(pl), TODAY))).toBe(true);
  });

  it('an undated perennial goes round the year, as it did', () => {
    const apple = { ...added('apple', '2022-02-01', 'flowering'), stageDates: { transplanted: '2022-02-01' } };
    const stage = (today: string) => stageOn(plantOf('apple'), apple, gardenWith(apple), today, today).stage;
    expect(stage('2027-01-15')).not.toBe('flowering');
    expect(stage('2026-10-20')).toBe('harvesting');
  });

  it('the choice keeps today’s date for what it’s doing now, and not for a stage it can’t reach', () => {
    expect(inGroundChoice(plantOf('parsnip'), '2026-04-15', TODAY, 'harvesting')).toEqual({ date: '2026-04-15', stage: 'harvesting', reached: TODAY });
    expect(inGroundChoice(plantOf('tomato'), '2026-05-20', TODAY, 'flowering').reached).toBe(TODAY);
    expect(inGroundChoice(plantOf('parsnip'), '2026-04-15', TODAY, 'vegetative').reached).toBeUndefined();
    expect(inGroundChoice(plantOf('parsnip'), TODAY, TODAY, 'sown').reached).toBe(TODAY);
    // Chosen for a flowering plant, then the plant's changed to one that doesn't flower.
    const swapped = makePlanting(plantOf('lettuce'), bed.id, 'single', [600, 600], undefined, inGroundChoice(plantOf('tomato'), '2026-04-15', TODAY, 'flowering'));
    expect(swapped.stage).toBe('vegetative');
    expect(swapped.stageDates?.vegetative).toBeUndefined();
  });

  it('marked as growing and left for years, an annual still ends', () => {
    const pl = added('parsnip', '2024-04-15', 'vegetative');
    expect(clearingDue(timeline(plantOf('parsnip'), pl, gardenWith(pl), TODAY))).toBe(true);
  });

  it('dated when it started cropping, it ends in its time, a year on', () => {
    const pl = added('parsnip', '2025-04-15', 'harvesting', '2025-10-30');
    expect(clearingDue(timeline(plantOf('parsnip'), pl, gardenWith(pl), TODAY))).toBe(true);
  });
});
