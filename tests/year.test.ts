// Stage 14: the garden through the year. Projected stages, and beds standing empty.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { afterRun, fillersFor, gapsOn, gapText, inGround, nextInMonths, pickedBy, stageIn, stageOn, timeline, type Step } from '../src/lifecycle/projection';
import { fileSafe, monthTitle } from '../src/share/poster';
import { frostyOn, lightOn } from '../src/ui/yearScene';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);
const maybe = (id: string) => byId.get(id) ?? null;
const TODAY = '2026-10-07';
const g: Garden = { ...newGarden(), latitude: 53.8 };
const planting = (id: string, extra: Partial<Planting> = {}): Planting => ({ ...makePlanting(plant(id), 'bed', 'single', [0, 0]), ...extra });
const on = (id: string, pl: Planting, date: string) => stageOn(plant(id), pl, g, date, TODAY);

describe('months', () => {
  it('finds the next day in a run of months', () => {
    expect(nextInMonths('2026-10-07', [10, 11])).toBe('2026-10-07');
    expect(nextInMonths('2026-10-07', [3, 4])).toBe('2027-03-01');
    expect(nextInMonths('2026-10-07', [])).toBeNull();
  });

  it('finds the end of a run, across the new year', () => {
    expect(afterRun('2026-07-10', [6, 7, 8])).toBe('2026-09-01');
    expect(afterRun('2026-11-10', [10, 11, 12, 1, 2])).toBe('2027-03-01');
  });
});

describe('stages through the year', () => {
  it('shows what you marked, up to today', () => {
    const pl = planting('tomato', { sownOn: '2026-03-10', sowing: 'indoors', stage: 'transplanted', stageDates: { transplanted: '2026-05-20' } });
    expect(on('tomato', pl, '2026-03-01')).toEqual({ stage: 'planned', guessed: false });
    expect(on('tomato', pl, '2026-04-01')).toEqual({ stage: 'sown', guessed: false });
    expect(on('tomato', pl, '2026-06-01')).toEqual({ stage: 'transplanted', guessed: false });
    expect(on('tomato', pl, TODAY)).toEqual({ stage: 'transplanted', guessed: false });
  });

  it('guesses after today, from the plant’s months, and clears an annual after its harvest', () => {
    const pl = planting('tomato', { sownOn: '2026-03-10', sowing: 'indoors', stage: 'transplanted', stageDates: { transplanted: '2026-05-20' } });
    // Overdue steps all land tomorrow: it's probably cropping now.
    expect(on('tomato', pl, '2026-10-08')).toEqual({ stage: 'harvesting', guessed: true });
    expect(on('tomato', pl, '2026-11-02')).toEqual({ stage: 'cleared', guessed: true });
  });

  it('follows a planned planting from its usual sowing time through the next year', () => {
    const pl = planting('tomato');
    const steps = timeline(plant('tomato'), pl, g, TODAY);
    expect(steps.map((s) => s.stage)).toEqual(['sown', 'germinated', 'hardening', 'transplanted', 'vegetative', 'flowering', 'harvesting', 'cleared']);
    expect(steps.every((s) => s.guessed && s.date! > TODAY)).toBe(true);
    expect(on('tomato', pl, '2027-01-15').stage).toBe('planned');
    // Tender: planted out after the last frost.
    expect(steps.find((s) => s.stage === 'transplanted')!.date! >= '2027-05-01').toBe(true);
    expect(on('tomato', pl, '2027-08-01')).toEqual({ stage: 'harvesting', guessed: true });
  });

  it('crops a quick leafy crop for a few weeks, not the whole season', () => {
    const steps = timeline(plant('lettuce'), planting('lettuce'), g, TODAY);
    const cut = steps.find((s) => s.stage === 'harvesting')!.date!;
    const cleared = steps.find((s) => s.stage === 'cleared')!.date!;
    expect(cleared > cut).toBe(true);
    expect(cleared <= '2027-07-31').toBe(true);
  });

  it('takes perennials round again instead of clearing them', () => {
    const steps = timeline(plant('strawberry'), planting('strawberry'), g, TODAY);
    expect(steps.some((s) => s.stage === 'cleared')).toBe(false);
    expect(steps.filter((s) => s.stage === 'harvesting').length).toBeGreaterThanOrEqual(2);
  });

  it('never guesses past a planting you’ve cleared', () => {
    const pl = planting('carrot', { sownOn: '2026-04-01', sowing: 'direct', removedOn: '2026-08-15' });
    expect(timeline(plant('carrot'), pl, g, TODAY).every((s) => !s.guessed)).toBe(true);
    expect(on('carrot', pl, '2026-06-01').stage).toBe('sown');
    expect(on('carrot', pl, '2026-09-01').stage).toBe('cleared');
  });

  it('keeps a stage marked without a date for as far back as we know', () => {
    const pl = planting('lettuce', { stage: 'vegetative' });
    expect(on('lettuce', pl, '2025-12-01')).toEqual({ stage: 'vegetative', guessed: false });
  });

  it('counts only what’s in the bed as in the ground', () => {
    const direct = planting('carrot', { sowing: 'direct' });
    const indoors = planting('tomato', { sowing: 'indoors' });
    expect(inGround('sown', plant('carrot'), direct)).toBe(true);
    expect(inGround('sown', plant('tomato'), indoors)).toBe(false);
    expect(inGround('hardening', plant('tomato'), indoors)).toBe(false);
    expect(inGround('transplanted', plant('tomato'), indoors)).toBe(true);
    expect(inGround('cleared', plant('tomato'), indoors)).toBe(false);
  });

  it('reads a timeline at any day', () => {
    const steps: Step[] = [
      { stage: 'sown', date: '2026-03-01', guessed: false },
      { stage: 'germinated', date: '2026-03-15', guessed: true },
    ];
    expect(stageIn(steps, '2026-02-01').stage).toBe('planned');
    expect(stageIn(steps, '2026-03-15')).toEqual({ stage: 'germinated', guessed: true });
  });
});

describe('beds standing empty', () => {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Salad bed' };
  const unused = makeFeature('bed', { area: rectPoints({ x: 3000, y: 0, w: 1200, h: 1200 }) });
  const lettuce: Planting = { ...makePlanting(plant('lettuce'), bed.id, 'single', [500, 500]), sownOn: '2026-08-20', sowing: 'direct' };
  const garden = addPlanting(addFeature(addFeature(g, bed), unused), lettuce);
  const lines = new Map(garden.plantings.map((p) => [p.id, timeline(plant(p.plantId), p, garden, TODAY)]));

  it('finds a bed that will stand empty, from when, with ideas for the month', () => {
    expect(gapsOn(garden, plant, lines, TODAY, maybe)).toEqual([]);
    const later = gapsOn(garden, plant, lines, '2027-02-10', maybe);
    expect(later.map((x) => x.bed.id)).toEqual([bed.id]);
    expect(later[0]!.emptyFrom! > TODAY).toBe(true);
    expect(later[0]!.ideas).toEqual(['garlic', 'broad-bean']);
    expect(gapText(later[0]!, plant, TODAY)).toMatch(/^Empty from \d+ \w{3}: sow garlic or broad bean\?$/);
  });

  it('leaves alone a bed that has never had anything', () => {
    expect(gapsOn(garden, plant, lines, '2027-02-10', maybe).some((x) => x.bed.id === unused.id)).toBe(false);
  });

  it('suggests quick crops that can go in that month', () => {
    expect(fillersFor(5, maybe)).toEqual(['lettuce', 'radish']);
    expect(fillersFor(1, maybe)).toEqual([]);
  });
});

describe('lenses through the year', () => {
  const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) });
  const pot = makeFeature('pot', { circle: { centre: [4000, 500], radiusMm: 250 } });
  const tomato: Planting = { ...makePlanting(plant('tomato'), bed.id, 'single', [500, 500]), sowing: 'indoors', sownOn: '2026-03-10', stage: 'harvesting', stageDates: { transplanted: '2026-05-20', harvesting: '2026-07-20' } };
  const lavender: Planting = { ...makePlanting(plant('lavender'), bed.id, 'single', [1500, 500]), stage: 'vegetative' };
  const basil: Planting = { ...makePlanting(plant('basil'), pot.id, 'single', [4000, 500]), stage: 'vegetative' };
  const planned: Planting = makePlanting(plant('lettuce'), bed.id, 'single', [2000, 500]);
  const garden = [tomato, lavender, basil, planned].reduce(addPlanting, addFeature(addFeature(g, bed), pot));
  const at = (pl: Planting) => ({ stage: pl.stage ?? ('planned' as const), guessed: false });

  it('picks out what’s ready, what’s in flower and what’s thirsty, from what’s in the ground', () => {
    expect([...pickedBy('harvest', garden, plant, at, '2026-08-10')]).toEqual([tomato.id]);
    expect(pickedBy('flower', garden, plant, at, '2026-07-10').has(lavender.id)).toBe(true);
    expect(pickedBy('flower', garden, plant, at, '2026-01-10').has(lavender.id)).toBe(false);
    // In summer: the pot first. In winter: nothing.
    expect(pickedBy('water', garden, plant, at, '2026-07-10').has(basil.id)).toBe(true);
    expect(pickedBy('water', garden, plant, at, '2026-12-10').size).toBe(0);
    // Planned plantings aren't in the ground.
    for (const lens of ['flower', 'harvest', 'water'] as const) expect(pickedBy(lens, garden, plant, at, '2026-07-10').has(planned.id)).toBe(false);
  });
});

describe('the plan on a day', () => {
  it('casts longer shadows in winter than at midsummer', () => {
    const summer = lightOn(g, '2026-06-21')!;
    const winter = lightOn(g, '2026-12-21')!;
    expect(Math.hypot(...winter)).toBeGreaterThan(Math.hypot(...summer) * 1.5);
    // The sun is in the south at 1 pm, so shadows fall up the plan (north is up): negative y on screen.
    expect(summer[1]).toBeLessThan(0);
  });

  it('is frosty between the first autumn frost and the last spring frost', () => {
    expect(frostyOn(g, '2027-01-15')).toBe(true);
    expect(frostyOn(g, '2026-07-15')).toBe(false);
  });

  it('names the picture after the garden and the month', () => {
    expect(monthTitle('2027-07-14')).toBe('July 2027');
    expect(fileSafe('My balcony, July 2027')).toBe('my-balcony-july-2027');
    expect(fileSafe('!!!')).toBe('garden');
  });
});
