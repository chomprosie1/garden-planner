// Releases 57b to 57d: what the interim round of 30 Oct 2026 found. A crop you say is cropping isn't finished, plants go
// where you asked, and dates follow a short season.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { sensibleSize } from '../src/canvas/snap';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { clearingDue, expectedText, isFinished, stageOn, timeline } from '../src/lifecycle/projection';
import { plantHere } from '../src/lifecycle/growth';
import { addDays, daysBetween, frostEstimate, nextFor, oddFrosts, short } from '../src/lifecycle/shed';
import { inGroundStages, perennial, sowingOf } from '../src/lifecycle/stages';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, rectPoints } from '../src/model/features';
import { addListBed, NAME_LENGTH, namesFor } from '../src/model/listLayout';
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

  it('one more beside a numbered set is the next of them, not the bare name', () => {
    const g = ['Pot 1', 'Pot 2'].reduce((x, name) => addListBed(x, 'pot', name)[0], newGarden());
    expect(namesFor(g, 'Pot', 1, featureLabel)).toEqual(['Pot 3']);
    expect(namesFor(g, 'Pottery', 1, featureLabel)).toEqual(['Pottery']);
  });

  it('a number doesn’t take a name past the limit', () => {
    const long = 'x'.repeat(NAME_LENGTH);
    const names = namesFor(newGarden(), long, 12, featureLabel);
    expect(new Set(names).size).toBe(12);
    expect(Math.max(...names.map((n) => n.length))).toBeLessThanOrEqual(NAME_LENGTH);
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
    // A tower of something else is no place for a bay, however many pockets it has.
    const tower: Feature = { ...full, pockets: 8 };
    const berries = makePlanting(plantOf('strawberry'), tower.id, 'single', [900, 200]);
    const mixed = addPlanting(addPlanting(addFeature(addFeature(newGarden(), small), tower), bay), berries);
    expect(potOnChoices(mixed, bay.id, plantOf)!.pots).toEqual([]);
    // One more of the same, with pockets to spare, is; and a weed doesn't take up a pot.
    const pot: Feature = { ...small, name: 'Small pot' };
    const berry = makePlanting(plantOf('strawberry'), pot.id, 'single', [200, 200]);
    const same = addPlanting(addPlanting(addFeature(addFeature(newGarden(), pot), tower), berry), berries);
    expect(potOnChoices(same, berry.id, plantOf)!.pots.map((p) => p.name)).toEqual(['Apple pot']);
    const weed = makePlanting(plantOf('hairy-bittercress'), free.id, 'single', [1600, 200]);
    const weedy = addPlanting(addPlanting(addFeature(addFeature(newGarden(), small), free), bay), weed);
    expect(potOnChoices(weedy, bay.id, plantOf)!.pots.map((p) => p.name)).toEqual(['Spare pot']);
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

describe('dates for a short season', () => {
  // Callum's garden near Aviemore, 250 m up in a frost hollow, with his own frost dates.
  const callum = (patch: Partial<Garden> = {}): Garden => ({ ...gardenWith(), latitude: 57.19, longitude: -3.83, heightM: 250, frostHollow: true, lastFrost: '06-05', firstFrost: '09-05', ...patch });
  const TODAY = '2026-10-30';
  const steps = (id: string, pl: Planting, g: Garden, today = TODAY) => timeline(plantOf(id), pl, addPlanting(g, pl), today);
  const when = (s: ReturnType<typeof steps>, stage: string) => s.find((x) => x.stage === stage && x.date)?.date ?? '';
  const planned = (id: string) => makePlanting(plantOf(id), bed.id, 'row', [300, 300], [2700, 300]);

  it('potatoes are lifted by the first frost, not after it', () => {
    expect(when(steps('potato-second-early', planned('potato-second-early'), callum()), 'harvesting') <= '2027-09-05').toBe(true);
    expect(when(steps('potato-maincrop', planned('potato-maincrop'), callum()), 'harvesting') <= '2027-09-05').toBe(true);
  });

  it('leeks go out in their months, moved with the season, and are ready in autumn, not January', () => {
    const out = when(steps('leek', { ...planned('leek'), sownOn: '2027-04-05', sowing: 'indoors' }, callum(), '2027-04-06'), 'transplanted');
    expect(out >= '2027-06-15').toBe(true);
    expect(out <= '2027-07-10').toBe(true);
    const grown: Planting = { ...planned('leek'), sownOn: '2026-04-05', sowing: 'indoors', stage: 'vegetative', stageDates: { transplanted: '2026-06-26' } };
    const ready = when(steps('leek', grown, callum()), 'harvesting');
    expect(ready >= '2026-10-01').toBe(true);
    expect(ready <= '2026-11-20').toBe(true);
  });

  it('a late leek agrees with its own months (Margaret)', () => {
    const late: Planting = { ...planned('leek-late'), sownOn: '2026-03-01', sowing: 'indoors', stage: 'vegetative', stageDates: { transplanted: '2026-06-15' } };
    const g = gardenWith();
    expect(when(steps('leek-late', late, g), 'harvesting') >= '2026-12-01').toBe(true);
  });

  it('a summer cabbage isn’t ready weeks after planting, though its months run on over winter', () => {
    const cabbage = (out: string, g: Garden, today = '2027-04-01') => {
      const pl: Planting = { ...planned('cabbage'), sownOn: '2027-03-01', sowing: 'indoors', stage: 'vegetative', stageDates: { transplanted: out } };
      return when(steps('cabbage', pl, g, today), 'harvesting');
    };
    for (const out of ['2027-05-15', '2027-07-01']) {
      expect(cabbage(out, gardenWith(), addDays(out, 1)) >= addDays(out, 70)).toBe(true);
      expect(cabbage(out, callum(), addDays(out, 1)) >= addDays(out, 70)).toBe(true);
    }
  });

  it('crops gone in during the last of their winter months wait for the next ones', () => {
    for (const id of ['parsnip', 'chicory-witloof']) {
      const first = when(steps(id, planned(id), gardenWith(), '2027-01-10'), 'sown');
      expect(when(steps(id, planned(id), gardenWith(), '2027-01-10'), 'harvesting') >= addDays(first, 90), id).toBe(true);
      const pl: Planting = { ...planned(id), sownOn: '2027-03-15', sowing: 'direct', stage: 'sown' };
      expect(when(steps(id, pl, gardenWith(), '2027-03-16'), 'harvesting') >= '2027-06-15', id).toBe(true);
    }
    expect(when(steps('parsnip', { ...planned('parsnip'), sownOn: '2027-03-15', sowing: 'direct', stage: 'sown' }, gardenWith(), '2027-03-16'), 'harvesting') >= '2027-10-01').toBe(true);
  });

  it('hardy seedlings wait for their months once, not twice', () => {
    // Brussels sprouts, May and June as listed: a little after 1 May plus Callum's season, not a month on from that.
    const pl: Planting = { ...planned('brussels-sprout'), sownOn: '2027-04-05', sowing: 'indoors', stage: 'sown' };
    const out = when(steps('brussels-sprout', pl, callum(), '2027-04-06'), 'transplanted');
    expect(out >= '2027-05-25').toBe(true);
    expect(out <= '2027-06-15').toBe(true);
  });

  it('a tray and its timeline give the same day to harden off', () => {
    for (const g of [gardenWith(), callum()])
      for (const id of ['leek', 'kale', 'lettuce', 'cabbage', 'sweet-pea']) {
        const pl: Planting = { ...planned(id), sownOn: '2027-03-01', sowing: 'indoors', stage: 'sown' };
        const s = steps(id, pl, g, '2027-03-02');
        const up = when(s, 'germinated');
        const said = nextFor(plantOf(id), g, 'germinated', '2027-03-01', { germinated: up }, up).text;
        expect(said, id).toContain(`hardening off from ${short(when(s, 'hardening'))}`);
      }
  });

  it('a tender sowing stays in its sowing months', () => {
    for (const id of ['chilli', 'aubergine', 'petunia', 'lobelia']) {
      for (const g of [gardenWith(), callum(), { ...gardenWith(), latitude: 57.1, longitude: -2.1 }]) {
        const here = plantHere(plantOf(id), addPlanting(g, planned(id)));
        const sown = when(steps(id, planned(id), g, '2026-12-01'), 'sown');
        expect(here.sowing!.flatMap((s) => s.months), `${id} ${sown}`).toContain(Number(sown.slice(5, 7)));
      }
    }
  });

  it('a potato going in just before the frost still gets time to grow', () => {
    const late = (date: string, firstFrost: string) => {
      const pl: Planting = { ...planned('potato-second-early'), stage: 'vegetative', stageDates: { transplanted: date } };
      return when(steps('potato-second-early', pl, callum({ firstFrost }), addDays(date, 1)), 'harvesting');
    };
    // Three weeks in the ground by the frost isn't a crop: the frost doesn't pull its date back to then.
    expect(late('2027-08-10', '09-01') >= '2027-09-15').toBe(true);
    // In good time, the frost is still the last day.
    expect(late('2027-05-22', '09-05') <= '2027-09-05').toBe(true);
  });

  it('every annual, in four gardens: sown in its months, not cropping too soon, and a tray agrees', () => {
    const gardens = [gardenWith(), callum(), { ...gardenWith(), latitude: 57.1, longitude: -2.1 }, { ...gardenWith(), latitude: 50.2, longitude: -5.1 }];
    const wrong: string[] = [];
    for (const g0 of gardens)
      for (const p of byId.values()) {
        if (perennial(p) || !p.sowing?.length) continue;
        const pl = makePlanting(p, bed.id, 'single', [600, 600]);
        const g = addPlanting(g0, pl);
        const s = timeline(p, pl, g, '2026-12-01');
        const how = sowingOf(p, pl);
        const sown = when(s, 'sown');
        const start = how === 'direct' ? sown : when(s, 'transplanted');
        const crop = when(s, 'harvesting');
        const least = p.growth?.days?.[0];
        if (start && crop && least && daysBetween(start, crop) < least * 0.6) wrong.push(`${p.id}: in ${start}, cropping ${crop}`);
        const months = (plantHere(p, g).sowing ?? []).filter((x) => (how === 'direct') === (x.method === 'direct')).flatMap((x) => x.months);
        if (sown && months.length && !months.includes(Number(sown.slice(5, 7)))) wrong.push(`${p.id}: sown ${sown}, months ${months.join()}`);
        const up = when(s, 'germinated');
        const harden = when(s, 'hardening');
        if (up && harden) {
          const said = nextFor(p, g, 'germinated', sown, { germinated: up }, up).text;
          if (said.includes('hardening off from') && !said.includes(`from ${short(harden)}`)) wrong.push(`${p.id}: tray “${said}”, timeline ${harden}`);
        }
      }
    expect(wrong).toEqual([]);
  });

  it('kale stays ready through the winter', () => {
    const kale: Planting = { ...planned('kale'), sownOn: '2026-05-10', sowing: 'indoors', stage: 'vegetative', stageDates: { transplanted: '2026-06-25' } };
    expect(when(steps('kale', kale, callum()), 'cleared') > '2027-01-31').toBe(true);
  });

  it('a tomato isn’t sown months before it can go out', () => {
    const sown = when(steps('tomato', planned('tomato'), callum(), '2026-12-01'), 'sown');
    expect(sown >= '2027-04-01').toBe(true);
    expect(sown <= '2027-05-01').toBe(true);
    // For the polytunnel: late March, as he does (a 6 × 18 ft greenhouse, unheated).
    const tunnel: Feature = { ...makeFeature('greenhouse', { area: rectPoints({ x: 4000, y: 0, w: 5490, h: 1830 }) }), name: 'Polytunnel' };
    const inside = makePlanting(plantOf('tomato'), tunnel.id, 'row', [4300, 300], [9000, 300]);
    const tunnelSown = when(steps('tomato', inside, addFeature(callum(), tunnel), '2026-12-01'), 'sown');
    expect(tunnelSown >= '2027-03-20').toBe(true);
    expect(tunnelSown <= '2027-04-05').toBe(true);
    // In the south, the usual window stands: late March for outside.
    const south = when(steps('tomato', planned('tomato'), gardenWith(), '2026-12-01'), 'sown');
    expect(south >= '2027-03-01').toBe(true);
    expect(south <= '2027-04-01').toBe(true);
  });

  it('own frost dates move broad beans and potatoes, as they did', () => {
    expect(when(steps('broad-bean', planned('broad-bean'), callum()), 'sown') >= '2027-04-01').toBe(true);
    expect(when(steps('potato-second-early', planned('potato-second-early'), callum()), 'sown').slice(0, 7)).toBe('2027-05');
  });

  it('the card’s month agrees with the timeline in a late garden', () => {
    const g = callum({ lastFrost: '06-21', firstFrost: '09-09' });
    const here = plantHere(plantOf('potato-second-early'), addPlanting(g, planned('potato-second-early')));
    const first = when(steps('potato-second-early', planned('potato-second-early'), g), 'sown');
    expect(here.sowing![0]!.months).toContain(Number(first.slice(5, 7)));
  });

  it('height moves a last frost less than a first, from the station records', () => {
    const at = (s: { latitude: number; longitude: number; heightM?: number; frostHollow?: boolean }) => frostEstimate(s);
    const braemar = at({ latitude: 57.006, longitude: -3.396, heightM: 327 });
    expect(braemar.lastFrost >= '05-25').toBe(true);
    expect(braemar.lastFrost <= '06-12').toBe(true);
    expect(braemar.firstFrost >= '09-05').toBe(true);
    expect(braemar.firstFrost <= '09-20').toBe(true);
    const aviemore = at({ latitude: 57.19, longitude: -3.83, heightM: 250, frostHollow: true });
    expect(aviemore.lastFrost <= '06-14').toBe(true);
    expect(aviemore.firstFrost <= '09-12').toBe(true);
  });

  it('blackcurrants flower in spring, not June', () => {
    const pl = added('blackcurrant', '2023-11-01', 'vegetative');
    const dates = timeline(plantOf('blackcurrant'), pl, gardenWith(pl), '2027-02-01').filter((s) => s.stage === 'flowering');
    expect(Number(dates[0]!.date!.slice(5, 7))).toBeLessThanOrEqual(5);
    expect(plantOf('blackcurrant').flowerMonths).toEqual([4, 5]);
  });

  it('frost dates that can’t be right are noticed', () => {
    expect(oddFrosts('12-28', '01-29')).toBe(true);
    expect(oddFrosts('06-05', '05-01')).toBe(true);
    expect(oddFrosts('09-01', '10-01')).toBe(true);
    expect(oddFrosts('05-03', '10-28')).toBe(false);
    expect(oddFrosts('06-21', '09-09')).toBe(false);
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
