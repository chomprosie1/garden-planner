// Release 31: one answer everywhere. A planting's next step agrees with the
// month's jobs; jobs due now say now, not tomorrow; garlic, sets, seed potatoes
// and bulbs are planted, and bought as what they are; something already in the
// ground has a date; sowing in a tray ticks its job.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobLabel, jobsFor, sownInTray, toggleWishlist } from '../src/calendar/jobs';
import { upcoming, upcomingVerb, weekWindows, whenWords } from '../src/calendar/week';
import { growthText } from '../src/lifecycle/growth';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, inGroundOptions, makePlanting, unknownPlant } from '../src/planting/place';
import { draftNextYear } from '../src/planting/rotation';
import { addPacket, makePacket } from '../src/planting/seeds';
import { seasonStart, shoppingList, toggleBought, boughtKeys } from '../src/planting/shopping';
import { nextStep, startsAs } from '../src/planting/windows';
import { sowInTray } from '../src/lifecycle/shed';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const TODAY = '2026-10-11';
const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 3000 }) }), name: 'Veg bed' };
const row = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2700]), ...patch });
const gardenWith = (...plantings: Planting[]): Garden => plantings.reduce(addPlanting, addFeature(newGarden(), bed));
const step = (id: string, month: number, patch: Partial<Planting> = {}) => nextStep(row(id, patch), plantOf(id), month);

describe('a planting’s next step agrees with the jobs', () => {
  it('says the window open now, or the next one, from every sowing the plant has', () => {
    // Broad beans: spring and autumn sowings. In October the autumn one is open.
    expect(step('broad-bean', 10)).toBe('Sow outside now, until Nov');
    expect(step('broad-bean', 1)).toBe('Next: sow outside Feb–Apr');
    expect(step('broad-bean', 6)).toBe('Next: sow outside Oct–Nov');
    // Garlic cloves and onion sets are planted, not sown.
    expect(step('garlic', 10)).toBe('Plant now, until Dec');
    expect(step('onion', 10)).toBe('Plant now, until Oct');
    expect(step('onion', 1)).toBe('Sow under cover now, until Feb');
    expect(step('sweet-pea', 10)).toBe('Sow under cover now, until Nov');
    // Bulbs are planted in their months.
    expect(step('tulip', 10)).toBe('Next: plant Nov–Dec');
    expect(step('daffodil', 9)).toBe('Plant now, until Oct');
  });

  it('goes by the month a planned batch is to be sown', () => {
    expect(step('broad-bean', 10, { sowBy: '2027-03-01' })).toBe('Next: sow outside Feb–Apr');
  });

  it('never says "Next" for a window that’s open while the month’s jobs ask for it', () => {
    const ids = ['broad-bean', 'garlic', 'onion', 'sweet-pea', 'daffodil', 'broad-bean-autumn-sown', 'onion-overwintering', 'pea-early'];
    const g = gardenWith(...ids.map((id) => row(id)));
    for (const job of jobsFor(g, plantOf, 10, 2026)) {
      if (!['sow-direct', 'sow-indoors', 'plant-out'].includes(job.kind)) continue;
      const pl = g.plantings.find((p) => job.plantingIds.includes(p.id))!;
      expect(nextStep(pl, plantOf(pl.plantId), 10), job.plantId).toMatch(/ now/);
    }
  });
});

describe('this week: now, not tomorrow', () => {
  const week = (g: Garden) => upcoming(g, plantOf, TODAY, ...weekWindows(TODAY).thisWeek);

  it('says now for a sowing whose window is open, and what goes in', () => {
    const list = week(gardenWith(row('broad-bean'), row('garlic')));
    const bean = list.find((u) => u.plantId === 'broad-bean')!;
    expect(bean.now).toBe(true);
    expect(whenWords(bean, TODAY)).toBe('now');
    expect(upcomingVerb(bean)).toBe('Sow outside');
    expect(upcomingVerb(list.find((u) => u.plantId === 'garlic')!)).toBe('Plant');
  });

  it('shows nothing after the sowing until it’s sown: no seedlings up for seed not yet in', () => {
    const list = week(gardenWith(row('broad-bean'), row('onion'), row('radish')));
    expect(list.filter((u) => u.stage === 'germinated')).toEqual([]);
  });

  it('says shoots, not seedlings, for sets and cloves once they’re in', () => {
    const g = gardenWith(row('garlic', { sownOn: '2026-10-01' }));
    const up = upcoming(g, plantOf, TODAY, '2026-10-01', '2027-03-01').find((u) => u.stage === 'germinated');
    expect(up && upcomingVerb(up)).toBe('Shoots up soon');
  });
});

describe('what goes in, and what to buy', () => {
  it('knows seed from sets, cloves, seed potatoes, bulbs and plants', () => {
    expect(startsAs(plantOf('carrot'), 4)).toBe('seed');
    expect(startsAs(plantOf('onion'), 10)).toBe('sets');
    expect(startsAs(plantOf('onion'), 1)).toBe('seed');
    expect(startsAs(plantOf('garlic'), 10)).toBe('cloves');
    expect(startsAs(plantOf('potato-first-early'), 3)).toBe('tubers');
    expect(startsAs(plantOf('tulip'), 11)).toBe('bulbs');
    expect(startsAs(plantOf('strawberry'), 4)).toBe('plants');
  });

  it('puts garlic, onion sets, seed potatoes and bulbs on the list as what they are', () => {
    const g = gardenWith(row('garlic'), row('onion'), row('potato', { sowBy: '2027-04-01' }), row('tulip'), row('carrot', { sowBy: '2027-04-01' }));
    const list = shoppingList(g, plantOf, TODAY);
    const item = (key: string) => list.find((i) => i.key === key)!;
    expect(item('bulb:garlic').name).toBe('Garlic');
    expect(item('bulb:garlic').amount).toMatch(/^about \d+ cloves \(\d+ bulbs or so\)$/);
    expect(item('bulb:onion').name).toBe('Onion sets');
    expect(item('bulb:potato').name).toBe('Seed potatoes');
    expect(item('bulb:tulip').name).toBe('Tulip bulbs');
    expect(item('bulb:tulip').amount).toMatch(/^\d+ bulbs$/);
    expect(item('seed:carrot').name).toBe('Carrot seed');
    expect(list.filter((i) => i.kind === 'seed').map((i) => i.plantId)).toEqual(['carrot']);
  });

  it('still wants seed when the packet in the tin is too short, and says what’s there', () => {
    const g = gardenWith(row('carrot', { sowBy: '2027-04-01' }));
    const short = addPacket(g, makePacket('carrot', TODAY, { count: 3 }));
    expect(shoppingList(short, plantOf, TODAY).find((i) => i.key === 'seed:carrot')!.note).toMatch(/^Your tin has about 3 seeds/);
    const plenty = addPacket(g, makePacket('carrot', TODAY, { count: 500 }));
    expect(shoppingList(plenty, plantOf, TODAY).some((i) => i.key === 'seed:carrot')).toBe(false);
  });

  it('leaves off what’s on the Want to grow list once it’s sown in a tray or growing', () => {
    const g = toggleWishlist(gardenWith(), 'sweet-pea');
    expect(shoppingList(g, plantOf, TODAY).some((i) => i.plantId === 'sweet-pea')).toBe(true);
    const [sown] = sowInTray(g, plantOf('sweet-pea'), { date: TODAY, count: 8 });
    expect(shoppingList(sown, plantOf, TODAY).some((i) => i.plantId === 'sweet-pea')).toBe(false);
  });

  it('keeps a tick until the next season starts on 1 August', () => {
    expect(seasonStart('2026-10-11')).toBe('2026-08-01');
    expect(seasonStart('2027-03-01')).toBe('2026-08-01');
    const g = toggleBought(gardenWith(), 'seed:carrot', '2027-03-01');
    expect(boughtKeys(g, '2027-07-31').has('seed:carrot')).toBe(true);
    expect(boughtKeys(g, '2027-08-01').has('seed:carrot')).toBe(false);
  });
});

describe('already in the ground, with a date', () => {
  it('offers this month, the eleven before, and over a year ago', () => {
    const options = inGroundOptions(TODAY);
    expect(options[0]).toEqual({ label: 'This month', date: TODAY });
    expect(options[1]).toEqual({ label: 'September', date: '2026-09-15' });
    expect(options[10]).toEqual({ label: 'December 2025', date: '2025-12-15' });
    expect(options[options.length - 1]!.label).toBe('Over a year ago');
    expect(options).toHaveLength(13);
  });

  it('records the day it went in, so next year’s draft sees it', () => {
    const pea = { ...makePlanting(plantOf('pea'), bed.id, 'row', [600, 300], [600, 2700], { date: '2026-05-15', stage: 'vegetative' }) };
    expect(pea.stage).toBe('vegetative');
    expect(pea.sownOn).toBe('2026-05-15');
    expect(pea.stageDates).toBeUndefined();
    const g = gardenWith(pea);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    expect(draftNextYear(g, plantOf, TODAY).items.map((i) => i.was.plantId)).toEqual(['pea']);
  });
});

describe('sowing in a tray ticks its job', () => {
  it('marks this month’s sowing job on the Want to grow list done, for the plant and its kind', () => {
    const g = toggleWishlist(gardenWith(), 'sweet-pea');
    const job = jobsFor(g, plantOf, 10, 2026).find((j) => j.plantId === 'sweet-pea')!;
    expect(jobLabel(job)).toBe('Sow under cover');
    const done = sownInTray(g, plantOf('sweet-pea'), TODAY);
    expect(done.jobsDone.map((j) => j.key)).toContain(job.key);
    expect(sownInTray(done, plantOf('sweet-pea'), TODAY)).toBe(done);
  });
});

describe('words', () => {
  it('says how autumn sowings grow, rather than spring days', () => {
    expect(growthText(plantOf('broad-bean-autumn-sown'))!.text).toMatch(/^Sown in autumn, it stands the winter/);
    expect(growthText(plantOf('broad-bean'))!.text).toMatch(/in spring to the first harvest.*An autumn sowing stands the winter/);
  });

  it('leaves no notes to the writer in what people read', () => {
    const text = readdirSync(DIR).map((f) => readFileSync(join(DIR, f), 'utf8')).join('');
    expect(text).not.toMatch(/\(check\)/);
  });

  it('puts the autumn kinds in the autumn kits', async () => {
    const { KITS, kitPlants } = await import('../src/planting/kits');
    const autumn = KITS.filter((k) => k.id.startsWith('autumn')).flatMap(kitPlants);
    expect(autumn).not.toContain('broad-bean');
    expect(autumn).toContain('broad-bean-autumn-sown');
  });
});
