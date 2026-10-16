// Release 27: next year drafted with crop rotation, the shopping list, watering
// in dry spells, the job fixes, and the save format (schema 19).

import { describe, expect, it } from 'vitest';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor } from '../src/calendar/jobs';
import { drySpell, thirsty, waterJob } from '../src/calendar/watering';
import { probableStage } from '../src/lifecycle/projection';
import { addDays } from '../src/model/dates';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { checkGarden } from '../src/planting/rules';
import { addPlanting, makePlanting, plantCount, plantPositions, unknownPlant } from '../src/planting/place';
import { applyDraft, draftNextYear, draftYear, follows, rotationGroup, seasonsApart, swapSources } from '../src/planting/rotation';
import { addPacket, makePacket } from '../src/planting/seeds';
import { boughtKeys, shoppingList, shoppingText, toggleBought } from '../src/planting/shopping';
import { makeWeather, roundPlace, type Weather } from '../src/weather/weather';

const library = [...vegetables, ...herbs, ...fruit] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bedAt = (x: number, name: string, w = 1200, h = 3000): Feature => ({ ...makeFeature('bed', { area: rectPoints({ x, y: 0, w, h }) }), name });
const potAt = (x: number, name: string, r = 200): Feature => ({ ...makeFeature('pot', { circle: { centre: [x, 5000], radiusMm: r } }), name });
/** A row up the middle of a bed 1.2 m wide at x. */
const rowIn = (bed: Feature, id: string, patch: Partial<Planting> = {}): Planting => {
  const [x0] = bed.footprint[0]!;
  return { ...makePlanting(plantOf(id), bed.id, 'row', [x0 + 600, 300], [x0 + 600, 2700]), ...patch };
};
const withAll = (g: Garden, features: Feature[], plantings: Planting[]) => plantings.reduce(addPlanting, features.reduce(addFeature, g));
/** Grown and cleared this year, so nothing about it is running behind. */
const grown = (sownOn: string): Partial<Planting> => ({ sownOn, removedOn: '2026-09-30' });

describe('crop rotation groups (RHS)', () => {
  it('puts each crop in its group, and leaves the rest to go anywhere', () => {
    const group = (id: string) => rotationGroup(plantOf(id));
    expect(['pea', 'broad-bean', 'runner-bean'].map(group)).toEqual(['legumes', 'legumes', 'legumes']);
    expect(['cabbage', 'swede', 'turnip', 'radish', 'kale'].map(group)).toEqual(Array(5).fill('brassicas'));
    expect(['potato', 'tomato'].map(group)).toEqual(['potatoes', 'potatoes']);
    expect(['onion', 'garlic', 'leek', 'shallot'].map(group)).toEqual(Array(4).fill('onions'));
    expect(['carrot', 'parsnip', 'beetroot', 'celeriac', 'parsley'].map(group)).toEqual(Array(5).fill('roots'));
    // Wherever convenient: peppers, squashes, salads, sweetcorn; and perennials stay put.
    expect(['chilli', 'sweet-pepper', 'courgette', 'lettuce', 'sweetcorn', 'asparagus', 'strawberry'].map(group)).toEqual(Array(7).fill(null));
  });

  it('goes legumes, brassicas, potatoes, onions and roots, then legumes again', () => {
    expect(follows('legumes', 'brassicas')).toBe(true);
    expect(follows('brassicas', 'potatoes')).toBe(true);
    expect(follows('potatoes', 'roots')).toBe(true);
    expect(follows('potatoes', 'onions')).toBe(true);
    expect(follows('roots', 'legumes')).toBe(true);
    expect(follows('legumes', 'potatoes')).toBe(false);
  });

  it('drafts next year from August, this year before then', () => {
    expect(draftYear('2026-10-11')).toBe(2027);
    expect(draftYear('2027-02-01')).toBe(2027);
    expect(draftYear('2026-07-31')).toBe(2026);
  });
});

describe('next year, drafted', () => {
  const today = '2026-10-11';
  const four = () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B'), bedAt(4000, 'C'), bedAt(6000, 'D')];
    const [a, b, c, d] = beds as [Feature, Feature, Feature, Feature];
    const pls = [rowIn(a, 'potato', grown('2026-04-01')), rowIn(b, 'pea', grown('2026-04-12')), rowIn(c, 'cabbage', grown('2026-04-20')), rowIn(d, 'carrot', grown('2026-05-02'))];
    return { g: withAll(newGarden(), beds, pls), beds, pls };
  };

  it('moves each bed’s crops on a step round four beds', () => {
    const { g, beds } = four();
    const draft = draftNextYear(g, plantOf, today);
    expect(draft.year).toBe(2027);
    const next = Object.fromEntries(draft.beds.map((b) => [b.bed.name, [b.was, b.next]]));
    expect(next).toEqual({ A: ['potatoes', 'roots'], B: ['legumes', 'brassicas'], C: ['brassicas', 'potatoes'], D: ['roots', 'legumes'] });
    const where = Object.fromEntries(draft.items.map((i) => [i.next.plantId, beds.find((f) => f.id === i.next.featureId)!.name]));
    expect(where).toEqual({ carrot: 'A', cabbage: 'B', potato: 'C', pea: 'D' });
    // Same arrangement in the new bed, and everything fits.
    const pea = draft.items.find((i) => i.next.plantId === 'pea')!;
    expect([pea.next.x, pea.next.y, pea.next.endPoint]).toEqual([6600, 300, [6600, 2700]]);
    expect(draft.items.every((i) => !i.leftOut)).toBe(true);
  });

  it('dates each one the same day next year, and plans it', () => {
    const { g } = four();
    const items = draftNextYear(g, plantOf, today).items;
    const pea = items.find((i) => i.next.plantId === 'pea')!.next;
    expect(pea.sowBy).toBe('2027-04-12');
    expect(pea.sownOn).toBeUndefined();
    expect(pea.stage).toBeUndefined();
    expect(pea.removedOn).toBeUndefined();
    expect(pea.id).not.toBe(items.find((i) => i.next.plantId === 'pea')!.was.id);
  });

  it('never gives a bed the same group back when it can be helped, and with one bed keeps it there', () => {
    const beds = [bedAt(0, 'Potato bed'), bedAt(2000, 'Pea bed'), bedAt(4000, 'Cabbage bed')];
    const [p, pe, c] = beds as [Feature, Feature, Feature];
    const g = withAll(newGarden(), beds, [rowIn(p, 'potato', grown('2026-04-01')), rowIn(pe, 'pea', grown('2026-04-01')), rowIn(c, 'cabbage', grown('2026-04-01'))]);
    const draft = draftNextYear(g, plantOf, today);
    for (const b of draft.beds) expect(b.next).not.toBe(b.was);
    expect(draft.beds.find((b) => b.bed.name === 'Pea bed')!.next).toBe('brassicas');
    expect(draft.beds.find((b) => b.bed.name === 'Cabbage bed')!.next).toBe('potatoes');

    const one = withAll(newGarden(), [p], [rowIn(p, 'potato', grown('2026-04-01'))]);
    const solo = draftNextYear(one, plantOf, today);
    expect(solo.beds.map((b) => [b.from, b.next])).toEqual([[p.id, 'potatoes']]);
  });

  it('keeps what did well, and leaves out what didn’t come up, but not what is standing', () => {
    const beds = [bedAt(0, 'A'), bedAt(2000, 'B')];
    const [a, b] = beds as [Feature, Feature];
    const pls = [
      rowIn(a, 'pea', { sownOn: '2026-04-12', stage: 'harvesting', stageDates: { germinated: '2026-04-25', harvesting: '2026-06-20' }, picks: [{ date: '2026-06-20', grams: 500 }] }),
      // Sown outside in August, never marked as up.
      rowIn(b, 'carrot', { sownOn: '2026-08-01' }),
      // Planted out in May, never marked as growing on: it grows on by itself, so it isn't behind.
      { ...makePlanting(plantOf('tomato'), b.id, 'single', [1000, 300]), x: 2300, sownOn: '2026-03-01', sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { germinated: '2026-03-10', hardening: '2026-05-01', transplanted: '2026-05-20' } },
    ];
    const draft = draftNextYear(withAll(newGarden(), beds, pls), plantOf, today);
    const by = (id: string) => draft.items.find((i) => i.next.plantId === id)!;
    expect(by('pea').didWell).toBe(true);
    expect(by('pea').leftOut).toBeUndefined();
    expect(by('carrot').leftOut).toBe('not-up');
    expect(by('tomato').leftOut).toBeUndefined();
  });

  it('shortens a row to fit its new bed, leaves out a block that won’t fit, and doesn’t move pots, perennials or last year’s crops', () => {
    const big = bedAt(0, 'Big', 1200, 3000);
    const small = bedAt(2000, 'Small', 1200, 800);
    const pot = potAt(5000, 'Pot');
    const pls = [
      rowIn(big, 'potato', grown('2026-04-01')),
      { ...makePlanting(plantOf('lettuce'), big.id, 'block', [100, 100], [1100, 2900]), ...grown('2026-04-01') },
      { ...makePlanting(plantOf('beetroot'), small.id, 'single', [2600, 400]), ...grown('2026-04-01') },
      { ...makePlanting(plantOf('rhubarb'), small.id, 'single', [2300, 400]), stage: 'transplanted' as const, stageDates: { transplanted: '2026-03-01' } },
      { ...makePlanting(plantOf('tomato'), pot.id, 'single', [5000, 5000]), ...grown('2026-03-01') },
      { ...makePlanting(plantOf('pea'), big.id, 'single', [600, 2000]), ...grown('2025-04-01') },
    ];
    const draft = draftNextYear(withAll(newGarden(), [big, small, pot], pls), plantOf, today);
    expect(draft.items.map((i) => i.next.plantId).sort()).toEqual(['beetroot', 'lettuce', 'potato']);
    expect(draft.items.find((i) => i.next.plantId === 'lettuce')!.leftOut).toBe('no-room');
    // The potatoes go into the small bed as a shorter row: fewer of them, every one inside.
    const potato = draft.items.find((i) => i.next.plantId === 'potato')!;
    expect(potato.leftOut).toBeUndefined();
    expect(plantCount(potato.next, plantOf('potato'))).toBeLessThan(plantCount(potato.was, plantOf('potato')));
    expect(plantPositions(potato.next, plantOf('potato')).every(([x, y]) => x >= 2000 && x <= 3200 && y >= 0 && y <= 800)).toBe(true);
    expect(draft.items.find((i) => i.next.plantId === 'beetroot')!.leftOut).toBeUndefined();
  });

  it('lets you choose another bed’s crops, swapping the two', () => {
    const { g, beds } = four();
    const [a, , , d] = beds as [Feature, Feature, Feature, Feature];
    const first = draftNextYear(g, plantOf, today);
    // A was to take D's carrots; take B's peas instead, and the bed that was to take the peas takes the carrots.
    const from = swapSources(first, a.id, beds[1]!.id);
    const again = draftNextYear(g, plantOf, today, null, from);
    const src = Object.fromEntries(again.beds.map((b) => [b.bed.name, b.from]));
    expect(src.A).toBe(beds[1]!.id);
    expect(src.D).toBe(d.id);
    expect(new Set(Object.values(src)).size).toBe(4);
  });

  it('goes on the plan as planned, with jobs next year and no clash with this year’s crops', () => {
    const bed = bedAt(0, 'Veg');
    const other = bedAt(2000, 'Other');
    // Still growing in October: leeks in one bed; peas, grown and cleared, in the other.
    const leeks = rowIn(bed, 'leek', { sownOn: '2026-04-01', sowing: 'indoors', stage: 'harvesting', stageDates: { transplanted: '2026-06-01', harvesting: '2026-10-01' } });
    const peas = rowIn(other, 'pea', grown('2026-04-01'));
    const g = withAll(newGarden(), [bed, other], [leeks, peas]);
    const draft = draftNextYear(g, plantOf, today);
    const used = applyDraft(g, draft.items.filter((i) => !i.leftOut).map((i) => i.next));
    expect(used.plantings).toHaveLength(4);
    // Peas follow onions: next year's go where the leeks are.
    const nextPeas = draft.items.find((i) => i.next.plantId === 'pea')!.next;
    expect(nextPeas.featureId).toBe(bed.id);
    // Sown next April, not now.
    expect(jobsFor(used, plantOf, 10, 2026).filter((j) => j.plantingIds.includes(nextPeas.id))).toEqual([]);
    expect(jobsFor(used, plantOf, 4, 2027).some((j) => j.kind === 'sow-direct' && j.plantId === 'pea' && j.plantingIds.includes(nextPeas.id))).toBe(true);
    // Next year's peas over this year's leeks: never in the bed together, so no warning.
    expect(seasonsApart(nextPeas, leeks, plantOf('pea'), plantOf('leek'))).toBe(true);
    expect(checkGarden(used, plantOf).filter((f) => f.kind === 'spacing' && f.plantingIds.includes(nextPeas.id))).toEqual([]);
    expect(validateGarden(JSON.parse(JSON.stringify(used)))).toEqual([]);
  });

  it('replaces the first use when the draft is used again', () => {
    const { g } = four();
    const once = applyDraft(g, draftNextYear(g, plantOf, today).items.map((i) => i.next));
    const again = draftNextYear(once, plantOf, today);
    expect([again.already, again.replaces]).toEqual([0, 4]);
    expect(again.items.every((i) => !i.leftOut)).toBe(true);
    expect(applyDraft(once, again.items.map((i) => i.next), again.year).plantings).toHaveLength(8);
  });

  it('takes a bed’s crops from one other bed only, even when told only part of it', () => {
    const { g, beds } = four();
    const first = draftNextYear(g, plantOf, today);
    // Tell C to take A's crops, and nothing else: the bed that was to take A's takes C's old source instead.
    const again = draftNextYear(g, plantOf, today, null, { [beds[2]!.id]: beds[0]!.id });
    expect(again.beds.find((b) => b.bed.id === beds[2]!.id)!.from).toBe(beds[0]!.id);
    expect(new Set(again.beds.map((b) => b.from)).size).toBe(4);
    expect(again.items).toHaveLength(first.items.length);
  });

  it('still checks next year’s plan against a crop that stands over winter into it', () => {
    const bed = bedAt(0, 'Veg');
    // Garlic planted this October stands until next summer: a row planned for next April is in the bed with it.
    const garlic = rowIn(bed, 'garlic', { sownOn: '2026-10-05', sowing: 'direct' });
    const peas = rowIn(bed, 'pea', { sowBy: '2027-04-12' });
    expect(seasonsApart(peas, garlic, plantOf('pea'), plantOf('garlic'))).toBe(false);
    // Cleared before then, or a summer crop: apart.
    expect(seasonsApart(peas, { ...garlic, removedOn: '2027-03-01' }, plantOf('pea'), plantOf('garlic'))).toBe(true);
    const beans = rowIn(bed, 'runner-bean', { sownOn: '2026-05-20', sowing: 'direct' });
    expect(seasonsApart(peas, beans, plantOf('pea'), plantOf('runner-bean'))).toBe(true);
  });

  it('plants something bought as a plant in its month next year', () => {
    const bed = bedAt(0, 'Veg');
    const g = withAll(newGarden(), [bed], [{ ...makePlanting(plantOf('elephant-garlic'), bed.id, 'single', [600, 600]), stage: 'transplanted', stageDates: { transplanted: '2025-10-05', harvesting: '2026-07-01' } }]);
    // Planted in October 2025 and picked in 2026: a 2026 crop, drafted for 2027 in August.
    const draft = draftNextYear(g, plantOf, '2026-08-15');
    const next = draft.items[0]!.next;
    expect(next.sowBy).toBe('2026-10-05');
    const used = applyDraft(g, [next]);
    expect(jobsFor(used, plantOf, 10, 2026).some((j) => j.kind === 'plant-out' && j.plantingIds.includes(next.id))).toBe(true);
    expect(jobsFor(used, plantOf, 9, 2026).some((j) => j.plantingIds.includes(next.id))).toBe(false);
  });
});

describe('the shopping list', () => {
  const today = '2027-01-10';
  const setup = () => {
    const bed = bedAt(0, 'Veg');
    const pot = potAt(5000, 'Patio pot', 200);
    const g = withAll(newGarden(), [bed, pot], [rowIn(bed, 'carrot'), { ...makePlanting(plantOf('elephant-garlic'), bed.id, 'single', [300, 300]) }, makePlanting(plantOf('lettuce'), pot.id, 'single', [5000, 5000])]);
    return { g: { ...g, wishlist: ['tomato'] }, bed, pot };
  };

  it('lists seed, plants and compost for what’s planned and wanted', () => {
    const { g } = setup();
    const list = shoppingList(g, plantOf, today);
    expect(list.map((i) => i.key)).toEqual(['seed:carrot', 'seed:lettuce', 'seed:tomato', 'plant:elephant-garlic', 'compost:pots', 'compost:seed']);
    expect(list.find((i) => i.key === 'seed:carrot')!.amount).toMatch(/^for about \d+ plants$/);
    expect(list.find((i) => i.key === 'seed:tomato')!.note).toBe('On your Want to grow list');
    expect(list.find((i) => i.key === 'plant:elephant-garlic')!.amount).toBe('1 plant');
    // A pot 40 cm across and 30 cm deep (the usual depth) holds about 38 litres.
    expect(list.find((i) => i.key === 'compost:pots')!.amount).toMatch(/^about \d+ litres$/);
  });

  it('leaves out seed in the tin, unless it’s past its sow-by date', () => {
    const { g } = setup();
    const tin = addPacket(g, makePacket('carrot', '2026-12-01', { sowBy: '2028-01' }));
    expect(shoppingList(tin, plantOf, today).some((i) => i.key === 'seed:carrot')).toBe(false);
    const old = addPacket(g, makePacket('carrot', '2024-12-01', { sowBy: '2025-01' }));
    expect(shoppingList(old, plantOf, today).find((i) => i.key === 'seed:carrot')!.note).toMatch(/past its sow-by date/);
    // In date now, but not by next year's planned sowing.
    const later = { ...g, plantings: g.plantings.map((p) => (p.plantId === 'carrot' ? { ...p, sowBy: '2027-04-01' } : p)) };
    const soon = addPacket(later, makePacket('carrot', '2026-12-01', { sowBy: '2027-02' }));
    expect(shoppingList(soon, plantOf, today).some((i) => i.key === 'seed:carrot')).toBe(true);
  });

  it('fills only pots with nothing growing yet, in ericaceous where that’s their soil', () => {
    const { g, pot } = setup();
    const eric = { ...g, features: g.features.map((f) => (f.id === pot.id ? { ...f, soil: 'ericaceous' as const } : f)) };
    expect(shoppingList(eric, plantOf, today).map((i) => i.key)).toContain('compost:ericaceous');
    const growing = addPlanting(g, { ...makePlanting(plantOf('chives'), pot.id, 'single', [5050, 5000]), stage: 'transplanted' });
    expect(shoppingList(growing, plantOf, today).some((i) => i.key.startsWith('compost:pots'))).toBe(false);
  });

  it('adds feeds you can buy, unless one on the shelf will do', () => {
    const { g } = setup();
    const keys = (x: Garden) => shoppingList(x, plantOf, today, { feeding: true }).filter((i) => i.kind === 'feed').map((i) => i.key);
    expect(keys(g)).toContain('feed:tomato-feed');
    // Garden compost is home-made, so it isn't bought.
    expect(keys(g)).not.toContain('feed:garden-compost');
    expect(keys({ ...g, feedShelf: ['comfrey-tea'] })).not.toContain('feed:tomato-feed');
    expect(shoppingList(g, plantOf, today).some((i) => i.kind === 'feed')).toBe(false);
  });

  it('ticks things off for a season, and shares what’s left as text', () => {
    const { g } = setup();
    const ticked = toggleBought(g, 'seed:carrot', today);
    expect(shoppingList(ticked, plantOf, today).find((i) => i.key === 'seed:carrot')!.bought).toBe(true);
    expect(toggleBought(ticked, 'seed:carrot', today).bought).toBeUndefined();
    // A season on, it's wanted again, and the old tick is tidied away with the next one.
    const later = '2027-08-01';
    expect(boughtKeys(ticked, later).has('seed:carrot')).toBe(false);
    expect(toggleBought(ticked, 'seed:lettuce', later).bought).toEqual([{ key: 'seed:lettuce', date: later }]);
    const text = shoppingText(shoppingList(ticked, plantOf, today), 'Home');
    expect(text).toMatch(/^Shopping list for Home\n\nSeed\n- Lettuce seed, for about 1 plant\n- Tomato seed\n\nPlants\n- Elephant garlic, 1 plant\n/);
    expect(text).not.toMatch(/Carrot/);
    expect(validateGarden(JSON.parse(JSON.stringify(ticked)))).toEqual([]);
  });
});

/** Weather with the same day every day, from a day, fetched on `today`. */
function steady(from: string, days: number, max: number, rain = 0, today = addDays(from, days - 3)): Weather {
  const replies = [new Map(Array.from({ length: days }, (_, i) => [addDays(from, i), { max, min: max - 8, rain }]))];
  return makeWeather(replies, today, `${today}T09:00:00.000Z`, roundPlace(52.5), roundPlace(-1.5))!;
}
/** The same, with one day changed. */
function withDay(w: Weather, iso: string, rain: number): Weather {
  const i = Math.round((Date.parse(iso) - Date.parse(w.from)) / 86_400_000);
  return { ...w, rain: w.rain.map((r, j) => (j === i ? rain : r)) };
}

describe('watering in a dry spell', () => {
  const today = '2027-06-20';
  const setup = () => {
    const bed = bedAt(0, 'Veg');
    const pot = potAt(5000, 'Patio pot');
    const house = { ...makeFeature('greenhouse', { area: rectPoints({ x: 8000, y: 0, w: 2000, h: 3000 }) }), name: 'Greenhouse' };
    const pls = [
      { ...makePlanting(plantOf('lettuce'), bed.id, 'single', [300, 300]), stage: 'transplanted' as const, stageDates: { transplanted: '2027-06-10' } },
      { ...makePlanting(plantOf('lettuce'), bed.id, 'single', [900, 300]), stage: 'transplanted' as const, stageDates: { transplanted: '2027-03-10' } },
      { ...makePlanting(plantOf('tomato'), pot.id, 'single', [5000, 5000]), stage: 'transplanted' as const, stageDates: { transplanted: '2027-05-25' } },
      { ...makePlanting(plantOf('tomato'), house.id, 'single', [9000, 1000]), stage: 'transplanted' as const, stageDates: { transplanted: '2027-06-10' } },
      makePlanting(plantOf('carrot'), bed.id, 'single', [300, 2000]),
    ];
    return { g: { ...withAll(newGarden(), [bed, pot, house], pls), latitude: 52.5, longitude: -1.5 }, pls };
  };

  it('finds a dry, warm spell, and none after rain or when it’s cool', () => {
    const w = steady('2027-06-10', 14, 22, 0, today);
    expect(drySpell(w, today)).toEqual({ days: 11, warmest: 22 });
    expect(drySpell(withDay(w, '2027-06-19', 6), today)).toBeNull();
    expect(drySpell(steady('2027-06-10', 14, 14, 0, today), today)).toBeNull();
    expect(drySpell(null, today)).toBeNull();
  });

  it('waters pots and new plantings outside, not old ones, ones under glass or ones not yet in', () => {
    const { g, pls } = setup();
    expect(thirsty(g, plantOf, today).map((p) => p.id)).toEqual([pls[0]!.id, pls[2]!.id]);
    const w = steady('2027-06-10', 14, 22, 0, today);
    const job = waterJob(g, plantOf, w, today)!;
    expect(job.key).toBe('water:2027-06-20');
    expect(job.title).toBe('Pots and new plantings');
    expect(job.where).toBe('(Veg and Patio pot)');
    expect(job.detail).toMatch(/No real rain for 11 days, and warm \(up to 22 °C\)/);
    // Rain forecast tomorrow: only the pots.
    const due = waterJob(g, plantOf, withDay(w, '2027-06-21', 8), today)!;
    expect([due.title, due.plantingIds]).toEqual(['Pots', [pls[2]!.id]]);
    expect(waterJob(g, plantOf, withDay(w, '2027-06-19', 12), today)).toBeNull();
  });

  it('is in this month’s jobs with the weather on, and not next month’s', () => {
    const { g } = setup();
    const w = steady('2027-06-10', 14, 22, 0, today);
    expect(jobsFor(g, plantOf, 6, 2027, { today, weather: w })[0]!.kind).toBe('water');
    expect(jobsFor(g, plantOf, 7, 2027, { today, weather: w }).some((j) => j.kind === 'water')).toBe(false);
    expect(jobsFor(g, plantOf, 6, 2027, { today }).some((j) => j.kind === 'water')).toBe(false);
  });
});

describe('the job fixes', () => {
  const bed = bedAt(0, 'Veg');

  it('gives no harvest job for a sowing outside that hasn’t come up', () => {
    const carrots = rowIn(bed, 'carrot', { sownOn: '2027-04-01', sowing: 'direct' });
    const g = withAll(newGarden(), [bed], [carrots]);
    const harvest = (x: Garden, today?: string) => jobsFor(x, plantOf, 7, 2027, today ? { today } : {}).some((j) => j.kind === 'harvest');
    expect(harvest(g, '2027-07-10')).toBe(false);
    // Up: picked as usual.
    const up = { ...g, plantings: [{ ...carrots, stage: 'germinated' as const, stageDates: { germinated: '2027-04-20' } }] };
    expect(harvest(up, '2027-07-10')).toBe(true);
    // Without today, by the months alone, as before.
    expect(harvest(g)).toBe(true);
  });

  it('asks about flowering by the warmth where the plant has days', () => {
    // Tomatoes planted out in mid-June in Aberdeen: the months say they flower in June, the warmth says later.
    const cold: Garden = { ...newGarden(), latitude: 57.15, longitude: -2.1 };
    const tom = { ...makePlanting(plantOf('tomato'), bed.id, 'single', [600, 600]), sownOn: '2027-04-01', sowing: 'indoors' as const, stage: 'transplanted' as const, stageDates: { transplanted: '2027-06-15' } };
    const g = withAll(cold, [bed], [tom]);
    expect(jobsFor(g, plantOf, 6, 2027).some((j) => j.kind === 'check')).toBe(true);
    expect(probableStage(plantOf('tomato'), tom, g, '2027-06-25', null, '2027-06-26')).toBeNull();
    expect(jobsFor(g, plantOf, 6, 2027, { today: '2027-06-25' }).some((j) => j.kind === 'check')).toBe(false);
    // In the south, planted out in April: in flower by the warmth by late June, so it's asked.
    const warm = withAll({ ...newGarden(), latitude: 50.8, longitude: -0.1 }, [bed], [{ ...tom, stageDates: { transplanted: '2027-04-20' } }]);
    expect(probableStage(plantOf('tomato'), warm.plantings[0]!, warm, '2027-06-28', null, '2027-06-29')).toBe('flowering');
    expect(jobsFor(warm, plantOf, 6, 2027, { today: '2027-06-28' }).some((j) => j.kind === 'check')).toBe(true);
  });
});

describe('save format 19', () => {
  it('checks the ticks, and brings schema 18 up to date', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(19);
    const g: Garden = { ...newGarden(), bought: [{ key: 'seed:carrot', date: '2027-01-10' }] };
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    expect(validateGarden({ ...g, bought: [{ key: 'seed:carrot' }] }).join(' ')).toMatch(/bought entries/);
    expect(validateGarden({ ...g, bought: 'carrot' }).join(' ')).toMatch(/bought entries/);
    const migrated = migrateGarden({ ...newGarden(), schemaVersion: 18 }) as Garden;
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateGarden(migrated)).toEqual([]);
  });
});
