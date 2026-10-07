// Stage 16: growing degree days from UK climate averages. The stations, the
// warmth day by day, how much a crop needs, and the year's projections.

import { describe, expect, it } from 'vitest';
import climate from '../data/climate/uk-stations.json';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { coverEffects, DEFAULT_CLIMATE } from '../src/climate/microclimate';
import {
  averagesAt,
  dailyTable,
  dayIndex,
  daysUntil,
  degreeDays,
  REFERENCE,
  seasonDays,
  STATIONS,
  sumOver,
  tempsOn,
  underCover,
  yearDegreeDays,
} from '../src/climate/warmth';
import { baseOf, growthText, middleOf, readyFrom, runsOf, seasonShift } from '../src/lifecycle/growth';
import { afterSeason, expectedText, nextInSeason, probableStage, timeline, type Step } from '../src/lifecycle/projection';
import { addDays, dayNumber, daysBetween, fromDayNumber, frostDates, frostDatesUnder } from '../src/lifecycle/shed';
import { perennial } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);
const TODAY = '2026-10-07';

const at = (latitude: number, longitude: number): Garden => ({ ...newGarden(), latitude, longitude });
const MIDDLE = at(...REFERENCE);
const LEEDS = at(53.8, -1.55);
const WISLEY = at(51.31, -0.475);
const ABERDEEN = at(57.2, -2.2);
const GREENHOUSE = DEFAULT_CLIMATE.greenhouse;
const COLD_FRAME = DEFAULT_CLIMATE['cold-frame'];

const planting = (id: string, extra: Partial<Planting> = {}): Planting => ({ ...makePlanting(plant(id), 'bed', 'single', [9000, 9000]), ...extra });
const days = (from: string, to: string | null) => (to ? daysBetween(from, to) : null);

/** A garden with a greenhouse, and a planting in it or out in the open. */
function garden(base: Garden, id: string, extra: Partial<Planting> = {}, under = false): { g: Garden; pl: Planting } {
  const gh: Feature = makeFeature('greenhouse', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1800 }) });
  const pl = { ...makePlanting(plant(id), under ? gh.id : 'bed', 'single', under ? [1000, 900] : [9000, 9000]), ...extra };
  return { g: addPlanting(addFeature(base, gh), pl), pl };
}
const stepOf = (steps: Step[], stage: Step['stage']) => steps.find((s) => s.stage === stage)?.date ?? null;

describe('UK climate averages', () => {
  it('has twelve months of day and night temperatures for each station, in the UK, unchecked until you verify them', () => {
    expect(climate.source).toMatch(/Met Office/);
    expect(climate.verified).toBe(false);
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(STATIONS.length);
    for (const s of STATIONS) {
      expect(s.tmax).toHaveLength(12);
      expect(s.tmin).toHaveLength(12);
      expect(s.lat).toBeGreaterThan(49.8);
      expect(s.lat).toBeLessThan(61);
      for (let m = 0; m < 12; m++) {
        expect(s.tmax[m]!).toBeGreaterThan(s.tmin[m]!);
        expect(s.tmax[m]!).toBeLessThan(26);
        expect(s.tmin[m]!).toBeGreaterThan(-3);
      }
      // Summer is warmer than winter everywhere.
      expect(s.tmax[6]!).toBeGreaterThan(s.tmax[0]! + 7);
    }
  });

  it('uses a station on its own when the garden is next to it, and blends the nearest three otherwise', () => {
    const wisley = STATIONS.find((s) => s.id === 'wisley')!;
    const here = averagesAt(wisley.lat, wisley.lon);
    expect(here.tmax).toEqual(wisley.tmax);
    expect(here.stations.map((s) => s.id)).toEqual(['wisley']);
    const between = averagesAt(...REFERENCE);
    expect(between.stations).toHaveLength(3);
    expect(between.stations[0]!.id).toBe('birmingham');
    const july = between.stations.map((s) => s.tmax[6]!);
    expect(between.tmax[6]!).toBeGreaterThanOrEqual(Math.min(...july));
    expect(between.tmax[6]!).toBeLessThanOrEqual(Math.max(...july));
  });

  it('says how far the nearest station is, so a garden far from them knows the figures are rough', () => {
    expect(averagesAt(53.8, -1.55).nearestKm).toBe(0);
    expect(averagesAt(48.85, 2.35).nearestKm).toBeGreaterThan(300);
  });

  it('draws each month’s average smoothly through the year, across the new year too', () => {
    const av = averagesAt(53.8, -1.55);
    expect(tempsOn(av, dayIndex('2027-07-16')).max).toBeCloseTo(av.tmax[6]!, 1);
    const dec31 = tempsOn(av, dayIndex('2027-12-31')).min;
    const jan1 = tempsOn(av, dayIndex('2027-01-01')).min;
    expect(Math.abs(dec31 - jan1)).toBeLessThan(0.2);
    // Between the middles of June and July.
    const jul1 = tempsOn(av, dayIndex('2027-07-01')).max;
    expect(jul1).toBeGreaterThan(av.tmax[5]!);
    expect(jul1).toBeLessThan(av.tmax[6]!);
  });

  it('adds days without Date objects, through leap years and centuries', () => {
    for (const iso of ['1970-01-01', '2000-02-29', '2027-12-31', '2028-02-28', '2100-03-01', '1899-12-31']) {
      expect(fromDayNumber(dayNumber(iso))).toBe(iso);
      expect(dayNumber(iso)).toBe(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
    }
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2027-01-10', -20)).toBe('2026-12-21');
    expect(daysBetween('2027-12-25', '2028-01-05')).toBe(11);
  });

  it('counts 29 February as the 28th', () => {
    expect(dayIndex('2028-02-29')).toBe(dayIndex('2028-02-28'));
    expect(dayIndex('2028-03-01')).toBe(dayIndex('2027-03-01'));
    expect(dayIndex('2027-12-31')).toBe(364);
  });
});

describe('degree days', () => {
  it('counts the warmth above the base, with cold nights at the base and hot days capped at 30 °C', () => {
    expect(degreeDays(20, 10, 5)).toBe(10);
    expect(degreeDays(20, 2, 5)).toBe(7.5); // the night counts as 5
    expect(degreeDays(4, 0, 5)).toBe(0);
    expect(degreeDays(36, 20, 10)).toBe(15); // (30 + 20) / 2 − 10
  });

  it('is warmer under glass: half the sunny-day gain by day, the night gain at night, and a heated greenhouse never below 7 °C', () => {
    expect(underCover({ max: 15, min: 5 }, GREENHOUSE)).toEqual({ max: 19, min: 7 });
    expect(underCover({ max: 15, min: 5 }, COLD_FRAME)).toEqual({ max: 17, min: 6 });
    expect(underCover({ max: 6, min: -2 }, { heated: true, dayGainC: 8, nightGainC: 2 }).min).toBe(7);
    expect(underCover({ max: 15, min: 5 }, null)).toEqual({ max: 15, min: 5 });
  });

  it('adds up over days, and finds when enough has built up, across the new year', () => {
    const t = dailyTable(averagesAt(53.8, -1.55), 5);
    const june = sumOver(t, '2027-06-01', 30);
    expect(daysUntil(t, '2027-06-01', june)).toBe(30);
    expect(daysUntil(t, '2027-06-01', 0)).toBe(0);
    expect(sumOver(t, '2027-12-20', 30)).toBeGreaterThan(0);
    // There's far less warmth in winter: the same amount takes much longer.
    expect(daysUntil(t, '2027-12-01', june)!).toBeGreaterThan(60);
  });

  it('is warmer in the south than the north, and warmer still under glass', () => {
    const south = yearDegreeDays(averagesAt(51.31, -0.475));
    const north = yearDegreeDays(averagesAt(57.2, -2.2));
    expect(south).toBeGreaterThan(north * 1.25);
    expect(yearDegreeDays(averagesAt(57.2, -2.2), 5, GREENHOUSE)).toBeGreaterThan(north + 500);
    expect(seasonDays(averagesAt(51.31, -0.475))).toBeGreaterThan(seasonDays(averagesAt(57.2, -2.2)));
  });
});

describe('how much warmth a crop needs', () => {
  it('splits months into runs, keeping a run across the new year whole', () => {
    expect(runsOf([3, 4, 5, 9, 10])).toEqual([
      [3, 4, 5],
      [9, 10],
    ]);
    expect(runsOf([11, 12, 1, 2])).toEqual([[11, 12, 1, 2]]);
    expect(runsOf([])).toEqual([]);
    expect(middleOf([3, 4, 5, 6, 7])).toBe('2027-05-16');
  });

  it('grows tender plants above 10 °C and the rest above 5 °C, unless the plant says otherwise', () => {
    expect(baseOf(plant('tomato'))).toBe(10);
    expect(baseOf(plant('carrot'))).toBe(5);
    expect(baseOf(plant('potato'))).toBe(7);
  });

  it('takes its usual days in the middle of England, sown at the usual time', () => {
    // Carrots: 70 to 100 days, sown outside March to July; the middle of that is mid-May.
    const r = readyFrom(plant('carrot'), planting('carrot', { sowing: 'direct' }), MIDDLE, '2027-05-16', null);
    expect(days('2027-05-16', r)).toBe(85);
  });

  it('is ready later in the north and sooner in the south, and soonest under glass', () => {
    const tomato = plant('tomato');
    const pl = planting('tomato', { sowing: 'indoors' });
    const ready = (g: Garden, cover: typeof GREENHOUSE | null = null) => days('2027-05-20', readyFrom(tomato, pl, g, '2027-05-20', cover))!;
    expect(ready(ABERDEEN)).toBeGreaterThan(ready(LEEDS) + 10);
    expect(ready(WISLEY)).toBeLessThan(ready(LEEDS));
    expect(ready(LEEDS, GREENHOUSE)).toBeLessThan(ready(LEEDS) - 7);
    expect(ready(LEEDS, COLD_FRAME)).toBeLessThan(ready(LEEDS));
    expect(ready(LEEDS, COLD_FRAME)).toBeGreaterThan(ready(LEEDS, GREENHOUSE));
  });

  it('takes longer from an early sowing in cold soil than from one in early summer', () => {
    const carrot = plant('carrot');
    const pl = planting('carrot', { sowing: 'direct' });
    const march = days('2027-03-15', readyFrom(carrot, pl, LEEDS, '2027-03-15', null))!;
    const june = days('2027-06-15', readyFrom(carrot, pl, LEEDS, '2027-06-15', null))!;
    expect(march).toBeGreaterThan(june + 10);
    // But never more than twice its usual days, or less than half.
    expect(march).toBeLessThanOrEqual(170);
    expect(june).toBeGreaterThanOrEqual(42);
  });

  it('gives seedlings raised indoors a head start on a sowing outside', () => {
    const lettuce = plant('lettuce');
    const planted = days('2027-05-01', readyFrom(lettuce, planting('lettuce', { sowing: 'indoors' }), MIDDLE, '2027-05-01', null))!;
    const sown = days('2027-05-01', readyFrom(lettuce, planting('lettuce', { sowing: 'direct' }), MIDDLE, '2027-05-01', null))!;
    expect(sown).toBeGreaterThan(planted + 14);
  });

  it('leaves an autumn sowing to its months: it grows on through the winter', () => {
    expect(readyFrom(plant('broad-bean'), planting('broad-bean', { sowing: 'direct' }), LEEDS, '2026-11-01', null)).toBeNull();
    expect(readyFrom(plant('broad-bean'), planting('broad-bean', { sowing: 'direct' }), LEEDS, '2027-03-01', null)).not.toBeNull();
  });

  it('has no days for plants without them', () => {
    expect(readyFrom(plant('strawberry'), planting('strawberry'), LEEDS, '2027-03-01', null)).toBeNull();
  });
});

describe('seasons, moved with the warmth', () => {
  it('come on later in the north and sooner under glass, but not in midwinter', () => {
    expect(seasonShift(MIDDLE, null, 6)).toBe(0);
    expect(seasonShift(ABERDEEN, null, 6)).toBeGreaterThan(14);
    expect(seasonShift(WISLEY, null, 6)).toBeLessThan(0);
    expect(seasonShift(LEEDS, GREENHOUSE, 6)).toBeLessThan(-21);
    expect(seasonShift(LEEDS, COLD_FRAME, 6)).toBeLessThan(-7);
    expect(seasonShift(LEEDS, COLD_FRAME, 6)).toBeGreaterThan(seasonShift(LEEDS, GREENHOUSE, 6));
    expect(seasonShift(ABERDEEN, null, 12)).toBe(0);
    expect(seasonShift(ABERDEEN, null, 1)).toBe(0);
    // Never more than six weeks either way.
    expect(Math.abs(seasonShift(at(60.14, -1.18), null, 7))).toBeLessThanOrEqual(42);
  });

  it('slides a month or two of flowers, and stretches a longer season at both ends', () => {
    // A May flowering three weeks late is still about a month long.
    expect(nextInSeason('2027-04-01', [5], 21)).toBe('2027-05-22');
    expect(afterSeason('2027-05-22', [5], 21)).toBe('2027-06-22');
    // Two weeks sooner in spring means two weeks later in autumn.
    expect(nextInSeason('2027-04-01', [7, 8, 9, 10], -14)).toBe('2027-06-17');
    expect(afterSeason('2027-07-01', [7, 8, 9, 10], -14)).toBe('2027-11-15');
  });

  it('keeps a crop ready before its months standing until the end of them, but not one marked long after', () => {
    expect(afterSeason('2027-09-10', [10, 11, 12, 1, 2], 0)).toBe('2028-03-01');
    expect(afterSeason('2027-12-10', [6, 7, 8], 0)).toBe('2027-12-11');
  });
});

describe('the year’s projections, by the warmth', () => {
  it('ripens tomatoes outside in summer and stops them at the first frost', () => {
    const { g, pl } = garden(LEEDS, 'tomato');
    const steps = timeline(plant('tomato'), pl, g, TODAY);
    const out = stepOf(steps, 'transplanted')!;
    const harvest = stepOf(steps, 'harvesting')!;
    expect(harvest > '2027-07-15' && harvest < '2027-08-31').toBe(true);
    expect(stepOf(steps, 'flowering')! > out).toBe(true);
    expect(stepOf(steps, 'flowering')! < harvest).toBe(true);
    expect(stepOf(steps, 'cleared')).toBe(`2027-${frostDates(g).firstFrost}`);
  });

  it('crops a greenhouse tomato sooner, and for longer', () => {
    const outside = garden(LEEDS, 'tomato');
    const inside = garden(LEEDS, 'tomato', {}, true);
    const a = timeline(plant('tomato'), inside.pl, inside.g, TODAY);
    const b = timeline(plant('tomato'), outside.pl, outside.g, TODAY);
    expect(stepOf(a, 'harvesting')! < stepOf(b, 'harvesting')!).toBe(true);
    expect(stepOf(a, 'cleared')).toBe(`2027-${frostDatesUnder(inside.g, GREENHOUSE)!.firstFrost}`);
    expect(stepOf(a, 'cleared')! > stepOf(b, 'cleared')!).toBe(true);
  });

  it('loses sweetcorn in Aberdeen to the first frost before it’s ripe', () => {
    const { g, pl } = garden(ABERDEEN, 'sweetcorn');
    const steps = timeline(plant('sweetcorn'), pl, g, TODAY);
    expect(steps.some((s) => s.stage === 'harvesting')).toBe(false);
    expect(stepOf(steps, 'cleared')).toBe(`2027-${frostDates(g).firstFrost}`);
  });

  it('still crops lettuce sown in late August before the season’s out', () => {
    const { g, pl } = garden(LEEDS, 'lettuce', { sowing: 'direct', sownOn: '2027-08-20' });
    const steps = timeline(plant('lettuce'), pl, g, '2027-08-21');
    const cut = stepOf(steps, 'harvesting')!;
    expect(cut > '2027-09-20' && cut <= '2027-10-18').toBe(true);
  });

  it('stands Brussels sprouts ready early until the end of their months', () => {
    const { g, pl } = garden(MIDDLE, 'brussels-sprout');
    const steps = timeline(plant('brussels-sprout'), pl, g, TODAY);
    expect(stepOf(steps, 'harvesting')! < '2027-11-01').toBe(true);
    expect(stepOf(steps, 'cleared')).toBe('2028-03-01');
  });

  it('brings strawberries on later in Aberdeen and sooner under glass, a season at a time', () => {
    const flowering = (base: Garden, under = false) => {
      const { g, pl } = garden(base, 'strawberry', {}, under);
      return stepOf(timeline(plant('strawberry'), pl, g, TODAY), 'flowering')!;
    };
    expect(flowering(LEEDS) < flowering(ABERDEEN)).toBe(true);
    expect(flowering(LEEDS, true) < flowering(LEEDS)).toBe(true);
    const { g, pl } = garden(ABERDEEN, 'strawberry');
    expect(timeline(plant('strawberry'), pl, g, TODAY).filter((s) => s.stage === 'flowering')).toHaveLength(2);
  });

  it('brings seeds up slower in cold soil than in warm', () => {
    const up = (sown: string) => {
      const { g, pl } = garden(LEEDS, 'carrot', { sowing: 'direct', sownOn: sown });
      return days(sown, stepOf(timeline(plant('carrot'), pl, g, sown), 'germinated'))!;
    };
    expect(up('2027-03-05')).toBeGreaterThan(up('2027-06-05'));
  });

  it('only guesses: every projected step is marked as a guess', () => {
    const { g, pl } = garden(LEEDS, 'courgette');
    expect(timeline(plant('courgette'), pl, g, TODAY).every((s) => s.guessed)).toBe(true);
  });
});

describe('what it’s probably at, and what’s next', () => {
  it('says a planted-out tomato is probably cropping once it’s had the warmth, but not before', () => {
    const { g, pl } = garden(LEEDS, 'tomato', { sowing: 'indoors', sownOn: '2027-03-01', stage: 'transplanted', stageDates: { transplanted: '2027-05-20' } });
    expect(probableStage(plant('tomato'), pl, g, '2027-06-01')).toBeNull();
    expect(probableStage(plant('tomato'), pl, g, '2027-07-12')).toBe('flowering');
    expect(probableStage(plant('tomato'), pl, g, '2027-08-20')).toBe('harvesting');
    expect(probableStage(plant('tomato'), { ...pl, stage: 'harvesting' }, g, '2027-08-20')).toBeNull();
  });

  it('makes no guess for seedlings still indoors, or a planting not sown yet', () => {
    const { g, pl } = garden(LEEDS, 'tomato', { sowing: 'indoors', sownOn: '2027-03-01', stage: 'germinated' });
    expect(probableStage(plant('tomato'), pl, g, '2027-08-20')).toBeNull();
    expect(probableStage(plant('tomato'), planting('tomato'), g, '2027-08-20')).toBeNull();
  });

  it('says when the next milestone is likely', () => {
    const { g, pl } = garden(LEEDS, 'carrot', { sowing: 'direct', sownOn: '2027-04-10' });
    const today = '2027-04-20';
    expect(expectedText(timeline(plant('carrot'), pl, g, today), plant('carrot'), today)).toMatch(/^Ready to harvest from about \d+ (Jun|Jul)$/);
    const cosmos = garden(LEEDS, 'cosmos', { sowing: 'indoors', sownOn: '2027-03-10', stage: 'transplanted', stageDates: { transplanted: '2027-05-20' } });
    expect(expectedText(timeline(plant('cosmos'), cosmos.pl, cosmos.g, '2027-05-25'), plant('cosmos'), '2027-05-25')).toMatch(/^In flower from about \d+ (Jun|Jul)$/);
    expect(expectedText([], plant('cosmos'), today)).toBeNull();
  });
});

describe('the plant data’s days', () => {
  it('are for annual crops and flowers, sown or planted in spring or summer', () => {
    const withDays = library.filter((p) => p.growth?.days);
    expect(withDays.length).toBeGreaterThanOrEqual(45);
    for (const p of withDays) {
      expect(perennial(p)).toBe(false);
      expect(p.growth!.from).toMatch(/^(sowing|planting)$/);
      expect(validatePlant(p)).toEqual([]);
    }
  });

  it('are checked: [fewest, most], what they count from, and a sensible base', () => {
    const ok = plant('carrot');
    expect(validatePlant({ ...ok, growth: { days: [90, 60] } })).not.toEqual([]);
    expect(validatePlant({ ...ok, growth: { days: [60, 90], from: 'harvest' } } as unknown as Plant)).not.toEqual([]);
    expect(validatePlant({ ...ok, growth: { baseC: 40 } })).not.toEqual([]);
    expect(validatePlant({ ...ok, growth: { days: [60, 90], extra: 1 } } as unknown as Plant)).not.toEqual([]);
    expect(validatePlant({ ...ok, growth: { days: [60, 90], from: 'sowing', baseC: 4 } })).toEqual([]);
  });

  it('are on the plant card', () => {
    expect(growthText(plant('tomato'))).toEqual({
      label: 'Time to crop',
      text: 'About 60 to 80 days from planting out to the first harvest: sooner in warm weather or under glass, and later in a cool spell or further north.',
    });
    expect(growthText(plant('cosmos'))?.label).toBe('Time to flower');
    expect(growthText(plant('carrot'))?.text).toMatch(/from sowing outside/);
    expect(growthText(plant('strawberry'))).toBeNull();
  });
});

describe('under cover, in a sentence', () => {
  it('says crops come on faster in the warmth', () => {
    expect(coverEffects(GREENHOUSE)).toMatch(/crops come on faster in the warmth/);
  });
});
