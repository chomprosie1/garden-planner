// Release 54: a balcony's answers, watering each pot, one line about a pot with
// what would suit it, sizes in litres, a tower's pockets, and advice in pot terms.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobsFor } from '../src/calendar/jobs';
import { potLasts, potWaterJobs, POT_JOBS, waterJob } from '../src/calendar/watering';
import { howTo } from '../src/content/howto';
import { potFeedDetail } from '../src/feeding/schedule';
import { pickedBy } from '../src/lifecycle/projection';
import { newGarden } from '../src/model/defaults';
import { addDays } from '../src/model/dates';
import { makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { balconyLight, isCovered, lightHere, plantsFor, setBalcony, suitsPot } from '../src/planting/balcony';
import { applyKit, KITS, kitsFor } from '../src/planting/kits';
import { makePlanting } from '../src/planting/place';
import { bagsText, litresTyped, plantRoom, potOfLitres, potSize, wetWeightText } from '../src/planting/pots';
import { checkGarden } from '../src/planting/rules';
import { shoppingList } from '../src/planting/shopping';
import { makeWeather, roundPlace, type Weather } from '../src/weather/weather';

const DIR = join(__dirname, '..', 'data', 'plants');
const plants: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(plants.map((p) => [p.id, p]));
const plantOf = (id: string): Plant => byId.get(id)!;

const pot = (x: number, cm: number, extra: Partial<Feature> = {}): Feature => ({ ...makeFeature('pot', { circle: { centre: [x, 500], radiusMm: cm * 5 } }), ...extra });
const trough = (extra: Partial<Feature> = {}): Feature => ({ ...makeFeature('planter', { area: rectPoints({ x: 0, y: 2000, w: 600, h: 200 }) }), heightMm: 200, name: 'Herb trough', ...extra });
const growing = (id: string, f: Feature, at: [number, number] = [f.footprint[0]![0], f.footprint[0]![1]]): Planting => ({ ...makePlanting(plantOf(id), f.id, 'single', at), stage: 'transplanted', stageDates: { transplanted: '2027-04-01' } });
const garden = (features: Feature[], plantings: Planting[], extra: Partial<Garden> = {}): Garden => ({ ...newGarden(), features, plantings, view: 'list', ...extra });

function steady(from: string, days: number, max: number, today: string, rain = 0, wind = 10): Weather {
  const replies = [new Map(Array.from({ length: days }, (_, i) => [addDays(from, i), { max, min: max - 8, rain, wind }]))];
  return makeWeather(replies, today, `${today}T09:00:00.000Z`, roundPlace(52.5), roundPlace(-1.5))!;
}

describe('a balcony', () => {
  it('saves and loads, and an older garden moves up unchanged', () => {
    const f = pot(0, 30, { covered: true, pockets: 8 });
    const g = garden([f], [], { balcony: { facing: 'north-east', sun: 'half', roof: true, windy: true } });
    expect(validateGarden(g)).toEqual([]);
    expect(validateGarden({ ...g, balcony: { facing: 'up' } }).length).toBeGreaterThan(0);
    const old = { ...newGarden(), schemaVersion: 25 };
    expect(migrateGarden(old)).toEqual({ ...old, schemaVersion: SCHEMA_VERSION });
  });

  it('takes its light from the sun you say, or the way it faces', () => {
    expect(balconyLight({ sun: 'most', facing: 'north' })).toBe('full-sun');
    expect(balconyLight({ facing: 'north-east' })).toBe('part-shade');
    expect(balconyLight({ facing: 'north' })).toBe('shade');
    expect(balconyLight({ roof: true })).toBeNull();
  });

  it('sets each pot’s light, leaves one you set yourself, and points the plan the way it faces', () => {
    const [a, b] = [pot(0, 30), pot(1000, 30, { light: 'full-sun' })];
    const g = setBalcony(garden([a, b], []), { sun: 'half', facing: 'east' });
    expect(g.features.find((f) => f.id === a.id)!.light).toBe('part-shade');
    expect(g.features.find((f) => f.id === b.id)!.light).toBe('full-sun');
    expect(g.northRotationDeg).toBe(270);
    // Changing your mind moves the pots that followed it.
    const next = setBalcony(g, { sun: 'little' });
    expect(next.features.find((f) => f.id === a.id)!.light).toBe('shade');
    expect(next.features.find((f) => f.id === b.id)!.light).toBe('full-sun');
  });

  it('leaves north alone unless the facing changes, and if you’ve set it yourself', () => {
    const g = setBalcony(garden([pot(0, 30)], []), { facing: 'east' });
    expect(g.northRotationDeg).toBe(270);
    const own = { ...g, northRotationDeg: 10 };
    expect(setBalcony(own, { facing: 'east', windy: true }).northRotationDeg).toBe(10);
    expect(setBalcony(own, { facing: 'west' }).northRotationDeg).toBe(10);
    expect(setBalcony(g, { facing: 'west' }).northRotationDeg).toBe(90);
  });

  it('offers a fully shady balcony a kit that suits it, with no warnings, and none that don’t', () => {
    const kits = kitsFor('balcony', 10, (id) => byId.get(id) ?? null, 'shade');
    expect(kits.map((k) => k.id)).toEqual(['deep-shade-balcony']);
    const made = setBalcony(applyKit(garden([trough(), pot(1000, 30), pot(2000, 30)], []), kits[0]!, (id) => byId.get(id) ?? null, '2026-10-30'), { sun: 'little' });
    expect(checkGarden(made, plantOf).filter((f) => f.level === 'warn')).toEqual([]);
    expect(kitsFor('balcony', 10, (id) => byId.get(id) ?? null, 'full-sun').map((k) => k.id)).not.toContain('deep-shade-balcony');
    expect(kitsFor('balcony', 10, (id) => byId.get(id) ?? null).map((k) => k.id)).not.toContain('deep-shade-balcony');
  });

  it('keeps nothing when nothing is said', () => {
    expect(setBalcony(garden([], []), {}).balcony).toBeUndefined();
  });

  it('covers its pots unless you say one isn’t', () => {
    const [a, b] = [pot(0, 30), pot(1000, 30, { covered: false })];
    const g = garden([a, b], [], { balcony: { roof: true } });
    expect(isCovered(g, a)).toBe(true);
    expect(isCovered(g, b)).toBe(false);
    expect(isCovered(garden([a], []), a)).toBe(false);
  });

  it('offers a shady balcony only kits that suit it, and none of them warns', () => {
    const kits = kitsFor('balcony', 10, (id) => byId.get(id) ?? null, 'part-shade');
    expect(kits.map((k) => k.id)).toContain('shady-balcony');
    expect(kits.map((k) => k.id)).not.toContain('salad-balcony');
    const kit = KITS.find((k) => k.id === 'shady-balcony')!;
    const made = setBalcony(applyKit(garden([trough(), pot(1000, 30), pot(2000, 30)], []), kit, (id) => byId.get(id) ?? null, '2026-10-30'), { sun: 'half' });
    expect(checkGarden(made, plantOf).filter((f) => f.level === 'warn')).toEqual([]);
  });
});

describe('watering each pot', () => {
  const today = '2027-07-10';
  const setup = (extra: Partial<Garden> = {}) => {
    const [small, big] = [pot(0, 20, { name: 'Chilli pot' }), pot(1000, 50, { name: 'Tub' })];
    return { small, big, g: garden([small, big], [growing('chilli', small), growing('tomato', big)], { latitude: 52.5, longitude: -1.5, ...extra }) };
  };

  it('dries small pots faster, and sun and wind bring it forward', () => {
    expect(potLasts(5, 20)).toBeLessThan(potLasts(80, 20));
    expect(potLasts(30, 15, { windy: true })).toBeLessThan(potLasts(30, 15));
    expect(potLasts(30, 15, { sunny: true })).toBeLessThanOrEqual(potLasts(30, 15));
    expect(potLasts(30, 30)).toBe(1);
  });

  it('says nothing of a pot rain reaches without the weather, but looks after a covered one', () => {
    expect(potWaterJobs(setup().g, plantOf, null, today)).toEqual([]);
    const jobs = potWaterJobs(setup({ balcony: { roof: true } }).g, plantOf, null, today);
    expect(jobs.map((j) => j.title)).toEqual(['Chilli pot', 'Tub']);
    expect(jobs[0]!.detail).toMatch(/Rain doesn’t reach it/);
    expect(jobs[0]!.detail).toMatch(/smallest dries fastest/);
  });

  it('counts rain for an open pot and not for a covered one', () => {
    const w = steady('2027-06-20', 21, 22, today, 8);
    expect(potWaterJobs(setup().g, plantOf, w, today)).toEqual([]);
    expect(potWaterJobs(setup({ balcony: { roof: true } }).g, plantOf, w, today).length).toBe(2);
  });

  it('starts the clock again on a tick, and a tick stands for the day', () => {
    const { g, small } = setup({ balcony: { roof: true } });
    const key = `water:${small.id}:${today}`;
    const ticked = { ...g, jobsDone: [{ key, date: today }] };
    // Today's own tick keeps the job showing, ticked.
    expect(potWaterJobs(ticked, plantOf, null, today).some((j) => j.key === key)).toBe(true);
    // The day after, a small pot in July has gone a day and isn't due: it lasts longer than that without the weather's heat.
    const later = potWaterJobs(ticked, plantOf, null, addDays(today, 1));
    const lasts = potLasts(potSize(small)!.litres, 21);
    expect(later.some((j) => j.key.startsWith(`water:${small.id}:`))).toBe(lasts <= 1);
  });

  it('brings a windy day forward', () => {
    const { g, big } = setup();
    // Rained 2 days ago: a big tub at 19 °C lasts 2 days, and a windy spell 1.
    const rained = (wind: number) => {
      const w = steady('2027-06-20', 21, 19, today, 0, wind);
      const i = 18;
      return { ...w, rain: w.rain.map((r, j) => (j === i ? 10 : r)) };
    };
    const has = (wind: number) => potWaterJobs({ ...g, features: [big], plantings: g.plantings.filter((p) => p.featureId === big.id) }, plantOf, rained(wind), addDays(today, -1)).length > 0;
    expect(has(10)).toBe(false);
    expect(has(40)).toBe(true);
  });

  it('makes one job of a lot of pots', () => {
    const pots = Array.from({ length: POT_JOBS + 1 }, (_, i) => pot(i * 1000, 30, { name: `Pot ${i + 1}` }));
    const g = garden(pots, pots.map((f) => growing('parsley', f)), { balcony: { roof: true } });
    const jobs = potWaterJobs(g, plantOf, null, today);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.key).toMatch(/^water:pots:.*:2027-07-10$/);
    // The one tick does for them all: in January, these pots go days between waterings.
    const january = '2027-01-10';
    const [key] = potWaterJobs(g, plantOf, null, january).map((j) => j.key);
    expect(potWaterJobs({ ...g, jobsDone: [{ key: key!, date: january }] }, plantOf, null, addDays(january, 1))).toEqual([]);
  });

  it('counts a tick on one job for many only for the pots in it', () => {
    const pots = Array.from({ length: POT_JOBS + 2 }, (_, i) => pot(i * 1000, 30, { name: `Pot ${i + 1}` }));
    const g = garden(pots, pots.map((f) => growing('parsley', f)), { balcony: { roof: true } });
    const january = '2027-01-10';
    // The last pot wasn't in the job that was ticked.
    const key = `water:pots:${pots.slice(0, -1).map((f) => f.id).join(',')}:${january}`;
    const next = potWaterJobs({ ...g, jobsDone: [{ key, date: january }] }, plantOf, null, addDays(january, 1));
    expect(next.map((j) => j.title)).toEqual([`Pot ${POT_JOBS + 2}`]);
  });

  it('keeps the smallest pot first among the day’s jobs', () => {
    const [big, small] = [pot(0, 60, { name: 'Apple tub' }), pot(1000, 20, { name: 'Zinnia pot' })];
    const g = garden([big, small], [growing('tomato', big), growing('chilli', small)], { balcony: { roof: true } });
    const jobs = jobsFor(g, plantOf, 7, 2027, { today }).filter((j) => j.kind === 'water');
    expect(jobs[0]!.plant).toBe('Zinnia pot');
    expect(jobs[0]!.detail).toMatch(/smallest dries fastest/);
  });

  it('shows on Today’s jobs, in a list too, and new plantings keep their own job', () => {
    const jobs = jobsFor(setup({ balcony: { roof: true } }).g, plantOf, 7, 2027, { today });
    expect(jobs.filter((j) => j.kind === 'water').map((j) => j.plant)).toEqual(['Chilli pot', 'Tub']);
    expect(waterJob(setup().g, plantOf, steady('2027-06-20', 21, 22, today), today)).toBeNull();
  });

  it('counts a covered pot as thirsty on the plan after rain', () => {
    const { g } = setup({ balcony: { roof: true } });
    const wet = steady('2027-06-20', 21, 22, today, 10);
    const at = () => ({ stage: 'transplanted' as const, guessed: false }) as never;
    expect(pickedBy('water', g, plantOf, at, today, wet).size).toBe(2);
    expect(pickedBy('water', { ...g, balcony: {} }, plantOf, at, today, wet).size).toBe(0);
  });
});

describe('warnings that become answers', () => {
  it('makes one line of everything wrong in a pot', () => {
    const t = trough({ light: 'part-shade' });
    const g = garden([t], [growing('basil', t, [100, 2100]), growing('thyme', t, [300, 2100]), growing('rosemary', t, [500, 2100])]);
    const warn = checkGarden(g, plantOf).filter((f) => f.level === 'warn' && f.featureIds.includes(t.id));
    expect(warn).toHaveLength(1);
    expect(warn[0]!.message).toMatch(/^Herb trough: .*basil wants full sun/);
    expect(warn[0]!.plantingIds).toHaveLength(3);
  });

  it('keeps what you’ve said is fine out of the line, and a new problem still shows', () => {
    const t = trough({ light: 'part-shade' });
    const g = garden([t], [growing('basil', t, [100, 2100]), growing('thyme', t, [300, 2100]), growing('rosemary', t, [500, 2100])]);
    const [line] = checkGarden(g, plantOf).filter((f) => f.level === 'warn' && f.parts);
    expect(line!.parts!.length).toBeGreaterThan(1);
    // Saying the line's fine says each of its parts is.
    expect(checkGarden(g, plantOf, null, line!.parts!).filter((f) => f.level === 'warn')).toEqual([]);
    const some = line!.parts!.slice(1);
    const left = checkGarden(g, plantOf, null, some).filter((f) => f.level === 'warn');
    expect(left).toHaveLength(1);
    expect(left[0]!.parts).toBeUndefined();
  });

  it('leaves one problem in full', () => {
    const t = trough({ light: 'part-shade' });
    const warn = checkGarden(garden([t], [growing('basil', t, [100, 2100])]), plantOf).filter((f) => f.level === 'warn');
    expect(warn).toHaveLength(1);
    expect(warn[0]!.message).toMatch(/which you said is in part shade; it wants full sun/);
  });

  it('counts a balcony’s light though the pot has none of its own', () => {
    const p = pot(0, 30);
    const g = garden([p], [growing('basil', p)], { balcony: { sun: 'little' } });
    expect(lightHere(g, p)).toBe('shade');
    expect(checkGarden(g, plantOf).some((f) => f.kind === 'light')).toBe(true);
  });

  it('never offers wisteria for a 60 cm trough', () => {
    const t = trough({ light: 'part-shade' });
    const g = garden([t], []);
    for (const id of ['wisteria', 'camellia', 'lilac', 'forsythia']) if (byId.has(id)) expect(suitsPot(plantOf(id), g, t)).toBe(false);
    expect(suitsPot(plantOf('parsley'), g, t)).toBe(true);
    expect(suitsPot(plantOf('basil'), g, t)).toBe(false);
  });

  it('suggests three that suit it, leaving out what’s there', () => {
    const t = trough({ light: 'part-shade' });
    const g = garden([t], [growing('parsley', t, [100, 2100])]);
    const ideas = plantsFor(plants, g, t, 10);
    expect(ideas).toHaveLength(3);
    expect(ideas.map((p) => p.id)).not.toContain('parsley');
    expect(ideas.every((p) => suitsPot(p, g, t))).toBe(true);
  });
});

describe('sizes, and advice in pot terms', () => {
  it('reads litres, and makes a pot that holds them', () => {
    expect(litresTyped('20 l')).toBe(20);
    expect(litresTyped('20 Litres')).toBe(20);
    expect(litresTyped('20')).toBeNull();
    expect(litresTyped('2.5 m')).toBeNull();
    const { across, depth } = potOfLitres(20);
    const size = potSize(pot(0, across / 10, { heightMm: depth }))!;
    expect(size.litres).toBeGreaterThan(19);
    expect(size.litres).toBeLessThan(21);
  });

  it('lets a strawberry tower hold its eight plants', () => {
    const tower = pot(0, 35, { pockets: 8, heightMm: 400 });
    const area = Math.PI * 175 ** 2;
    const one = plantRoom(growing('strawberry', tower), plantOf('strawberry'), tower);
    expect(one * 8).toBeLessThanOrEqual(area * 1.02);
    const eight = Array.from({ length: 8 }, () => growing('strawberry', tower));
    expect(checkGarden(garden([tower], eight), plantOf).filter((f) => f.level === 'warn')).toEqual([]);
  });

  it('says bags and wet weight for compost', () => {
    expect(bagsText(150)).toBe('4 bags of 40 litres');
    expect(bagsText(10)).toBe('1 bag of 40 litres');
    expect(wetWeightText(150)).toBe('about 150 kg once it’s wet');
    const p = pot(0, 40);
    const planned = { ...makePlanting(plantOf('tomato'), p.id, 'single', [0, 0]) };
    const item = shoppingList(garden([p], [planned]), plantOf, '2027-03-01').find((i) => i.key === 'compost:pots')!;
    expect(item.amount).toMatch(/^about \d+ litres \(\d+ bags? of 40 litres\)$/);
    expect(item.note).toMatch(/kg once it’s wet/);
  });

  it('shops for pots as their jobs feed them', () => {
    const p = pot(0, 40);
    const planned = makePlanting(plantOf('strawberry'), p.id, 'single', [0, 0]);
    const list = shoppingList(garden([p], [planned], { balcony: {} }), plantOf, '2027-03-20', { feeding: true });
    expect(list.map((i) => i.key)).toContain('feed:pot-liquid');
    expect(list.some((i) => i.key === 'compost:beds' || i.key === 'feed:blood-fish-bone')).toBe(false);
  });

  it('feeds a pot with a liquid feed, not by the square metre', () => {
    const steps = plantOf('strawberry').feeding?.steps ?? [];
    expect(steps.length).toBeGreaterThan(0);
    expect(potFeedDetail(steps, garden([], []))).not.toMatch(/square metre/);
  });

  it('brings a chilli in a pot indoors, and leaves one in a bed as it was', () => {
    const [p, bed] = [pot(0, 30), { ...makeFeature('bed', { area: rectPoints({ x: 2000, y: 0, w: 1000, h: 1000 }) }) }];
    const g = garden([p, bed], [growing('chilli', p), growing('chilli', bed, [2500, 500])], { firstFrost: '11-01' });
    const jobs = jobsFor(g, plantOf, 10, 2027, {}).filter((j) => j.kind === 'protect');
    const inPot = jobs.find((j) => j.featureId === p.id)!;
    expect(inPot.verb).toBe('Bring indoors');
    expect(inPot.detail).toMatch(/windowsill/);
    expect(inPot.detail).not.toMatch(/^Bring pots/);
    expect(howTo(inPot, 'seed').steps.join(' ')).not.toMatch(/fleece/i);
    expect(jobs.find((j) => j.featureId === bed.id)!.verb).toBeUndefined();
  });
});
