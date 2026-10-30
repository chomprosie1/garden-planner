// Releases 57b to 57d: what the interim round of 30 Oct 2026 found. A crop you say is cropping isn't finished, plants go
// where you asked, and dates follow a short season.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobsFor } from '../src/calendar/jobs';
import { clearingDue, expectedText, isFinished, stageOn, timeline } from '../src/lifecycle/projection';
import { addDays } from '../src/lifecycle/shed';
import { inGroundStages } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting, Stage } from '../src/model/types';
import { addPlanting, inGroundChoice, makePlanting, unknownPlant } from '../src/planting/place';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const byId = new Map(species.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Bed C' };
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));
const added = (id: string, date: string, stage: Stage, reached?: string) => makePlanting(plantOf(id), bed.id, 'single', [600, 600], undefined, { date, stage, ...(reached ? { reached } : {}) });

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
            expect(clearingDue(timeline(plantOf(id), pl, gardenWith(pl), TODAY)), `${id} ${date} ${stage}`).toBe(false);
          }
  });

  it('a tender crop you say is cropping after the frost date isn’t finished by tomorrow', () => {
    const today = '2026-11-20';
    const pl = added('tomato', '2026-05-20', 'harvesting', today);
    const g = gardenWith(pl);
    expect(isFinished(plantOf('tomato'), pl, g, today)).toBe(false);
    expect(isFinished(plantOf('tomato'), pl, g, addDays(today, 7))).toBe(false);
    expect(isFinished(plantOf('tomato'), pl, g, addDays(today, 30))).toBe(true);
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
