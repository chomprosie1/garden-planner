// Release 41: plants already growing. An established apple or raspberry
// catches up with the calendar rather than replaying from the day it went in;
// "already in the ground" asks the stage; running behind is only for coming
// up, hardening off and planting out; autumn sowings flower in their season;
// the card's "Next" agrees with the timeline; and the care tips fit the plant.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { upcoming } from '../src/calendar/week';
import { behindOf, behindText, runningBehind } from '../src/lifecycle/behind';
import { expectedText, shortDate, stageOn, timeline } from '../src/lifecycle/projection';
import { addDays } from '../src/lifecycle/shed';
import { inGroundDefault, inGroundStages, settledIn, stageAction, stageLabel, stageTips } from '../src/lifecycle/stages';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant, type InGroundAt } from '../src/planting/place';
import { nextStep } from '../src/planting/windows';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const TODAY = '2026-10-12';
const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 3000 }) }), name: 'Fruit' };
const frame: Feature = { ...makeFeature('cold-frame', { area: rectPoints({ x: 4000, y: 0, w: 1200, h: 600 }) }), name: 'Cold frame' };
const garden = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(addFeature(newGarden(), bed), frame));
const inBed = (id: string, growing: InGroundAt | null, where: Feature = bed): Planting => makePlanting(plantOf(id), where.id, 'single', where === bed ? [1500, 1500] : [4600, 300], undefined, growing);
const overAYearAgo = '2025-10-01';

describe('an established fruit plant catches up, not replays', () => {
  // Saved before this release: planted out over a year ago, nothing marked since.
  const oldApple: Planting = { ...inBed('apple', null), stage: 'transplanted', stageDates: { transplanted: overAYearAgo } };

  it('isn’t coming into flower tomorrow, or running behind', () => {
    const g = garden(oldApple);
    const steps = timeline(plantOf('apple'), oldApple, g, TODAY);
    expect(steps.some((s) => s.due)).toBe(false);
    expect(expectedText(steps, plantOf('apple'), TODAY)).not.toMatch(/In flower from about 13 Oct/);
    // In October an apple is cropping; it flowers again next spring.
    expect(stageOn(plantOf('apple'), oldApple, g, TODAY, TODAY).stage).toBe('harvesting');
    const flowers = steps.find((s) => s.guessed && s.stage === 'flowering' && s.date! > TODAY)!;
    expect(Number(flowers.date!.slice(5, 7))).toBeGreaterThanOrEqual(4);
    expect(flowers.date! > '2027-03-01').toBe(true);
    expect(behindOf(plantOf('apple'), oldApple, g, TODAY)).toBeNull();
  });

  it('puts no flowering or picking in this week’s look-out list for raspberries and blackcurrants', () => {
    const rasp: Planting = { ...inBed('raspberry', null), stage: 'transplanted', stageDates: { transplanted: overAYearAgo } };
    const currant: Planting = { ...inBed('blackcurrant', null), stage: 'transplanted', stageDates: { transplanted: overAYearAgo } };
    const g = garden(rasp, currant);
    const soon = upcoming(g, plantOf, TODAY, addDays(TODAY, -1), addDays(TODAY, 13));
    expect(soon.filter((u) => u.stage === 'flowering' || u.stage === 'harvesting')).toEqual([]);
    expect(runningBehind(g, plantOf, TODAY)).toEqual([]);
  });

  it('added as growing over a year ago, it goes from the calendar', () => {
    const at = { date: overAYearAgo, stage: inGroundDefault(plantOf('apple'), overAYearAgo, TODAY) };
    expect(at.stage).toBe('vegetative');
    const apple = inBed('apple', at);
    expect(apple.stage).toBe('vegetative');
    expect(apple.stageDates).toEqual({ transplanted: overAYearAgo });
    const g = garden(apple);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    const next = timeline(plantOf('apple'), apple, g, TODAY).find((s) => s.guessed)!;
    expect(next.stage).toBe('flowering');
    expect(next.date! >= '2027-04-01').toBe(true);
    expect(behindOf(plantOf('apple'), apple, g, TODAY)).toBeNull();
  });
});

describe('already in the ground asks the stage', () => {
  it('offers the plant’s own stages, in its own words', () => {
    expect(inGroundStages(plantOf('parsnip'))).toEqual(['sown', 'germinated', 'vegetative', 'harvesting']);
    expect(inGroundStages(plantOf('apple'))).toEqual(['transplanted', 'vegetative', 'flowering', 'harvesting']);
    expect(stageLabel(plantOf('garlic'), 'sown')).toBe('Planted');
    expect(stageLabel(plantOf('apple'), 'transplanted')).toBe('Planted');
    expect(stageLabel(plantOf('tomato'), 'transplanted')).toBe('Planted out');
    expect(stageAction(plantOf('garlic'), 'sown')).toBe('Mark as planted');
    expect(stageAction(plantOf('parsnip'), 'harvesting')).toBe('Start lifting');
  });

  it('starts sowings this month as sown, plants as planted, and anything older as growing', () => {
    expect(inGroundDefault(plantOf('parsnip'), TODAY, TODAY)).toBe('sown');
    expect(inGroundDefault(plantOf('sweet-pea'), TODAY, TODAY)).toBe('sown');
    expect(inGroundDefault(plantOf('apple'), TODAY, TODAY)).toBe('transplanted');
    expect(inGroundDefault(plantOf('parsnip'), '2026-04-15', TODAY)).toBe('vegetative');
  });

  it('a parsnip sown in April is sown, growing and not behind; never planted out', () => {
    const parsnip = inBed('parsnip', { date: '2026-04-15', stage: 'vegetative' });
    expect(parsnip.sownOn).toBe('2026-04-15');
    expect(parsnip.stage).toBe('vegetative');
    expect(parsnip.stageDates).toBeUndefined();
    const g = garden(parsnip);
    expect(behindOf(plantOf('parsnip'), parsnip, g, TODAY)).toBeNull();
    expect(timeline(plantOf('parsnip'), parsnip, g, TODAY).some((s) => s.stage === 'transplanted')).toBe(false);
  });

  it('a stage reached this month keeps its date', () => {
    const leeks = inBed('leek', { date: TODAY, stage: 'vegetative', reached: TODAY });
    expect(leeks.stageDates).toEqual({ transplanted: TODAY, vegetative: TODAY });
  });
});

describe('running behind', () => {
  it('leeks in since June aren’t behind for growing on', () => {
    const leeks: Planting = { ...inBed('leek', null), stage: 'transplanted', stageDates: { transplanted: '2026-06-15' } };
    expect(behindOf(plantOf('leek'), leeks, garden(leeks), TODAY)).toBeNull();
  });

  it('says the year when it isn’t this one', () => {
    const b = { plantingId: 'p', plantId: 'carrot', featureId: bed.id, stage: 'sown' as const, next: 'germinated' as const, due: '2025-11-02', late: 300, causes: [] };
    expect(behindText(b, shortDate, TODAY)).toBe('Expected to be up by 2 Nov 2025.');
    expect(behindText({ ...b, due: '2026-10-02' }, shortDate, TODAY)).toBe('Expected to be up by 2 Oct.');
  });
});

describe('autumn sowings flower in their season', () => {
  it('sweet peas sown in October in the cold frame go in about April and flower from about June', () => {
    const peas = inBed('sweet-pea', { date: TODAY, stage: 'sown', reached: TODAY }, frame);
    expect(peas.sownOn).toBe(TODAY);
    const g = garden(peas);
    const steps = timeline(plantOf('sweet-pea'), peas, g, TODAY);
    const out = steps.find((s) => s.stage === 'transplanted')!;
    expect(out.date! >= '2027-03-01').toBe(true);
    const flowers = steps.find((s) => s.stage === 'flowering')!;
    expect(flowers.date! >= '2027-05-20').toBe(true);
    expect(flowers.date! < '2027-08-01').toBe(true);
    // The card's "Next" is the timeline's day, not a different answer.
    const next = nextStep(peas, plantOf('sweet-pea'), 10, null, steps, TODAY)!;
    expect(next).toBe(`Next: plant out from about ${shortDate(out.date!)}`);
  });
});

describe('care tips fit the plant', () => {
  it('fruit and roots get their own picking tip', () => {
    expect(stageTips(plantOf('apple'), 'harvesting', undefined, 9).join(' ')).not.toMatch(/little and often/);
    expect(stageTips(plantOf('apple'), 'harvesting', undefined, 9).join(' ')).toMatch(/lift and twist/);
    expect(stageTips(plantOf('raspberry'), 'harvesting', undefined, 7).join(' ')).not.toMatch(/little and often/);
    expect(stageTips(plantOf('parsnip'), 'harvesting', undefined, 11).join(' ')).toMatch(/fork/);
  });

  it('a fruit bush rests in winter', () => {
    expect(stageTips(plantOf('blackcurrant'), 'vegetative', undefined, 12).join(' ')).toMatch(/Resting/);
  });

  it('an established planting is past watering in', () => {
    const apple: Planting = { ...inBed('apple', null), stage: 'transplanted', stageDates: { transplanted: overAYearAgo } };
    expect(settledIn(apple, TODAY)).toBe(true);
    expect(settledIn({ ...apple, stageDates: { transplanted: '2026-10-01' } }, TODAY)).toBe(false);
  });
});
