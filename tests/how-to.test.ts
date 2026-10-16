// Release 43: how to, for this crop. Steps chosen by the actual sowing (big
// seeds one at a time, a cold frame with no heat) and by what's picked, with
// the spacing; garden words; the play-safe frost date for tender plants; and
// Margaret's corrections, each checked against the RHS.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobsFor, type Job } from '../src/calendar/jobs';
import { climateText, DEFAULT_CLIMATE } from '../src/climate/microclimate';
import { howTo } from '../src/content/howto';
import { generalJobs } from '../src/content/seasons';
import { gardenWord, GLOSSARY, glossed } from '../src/content/glossary';
import { frostDates, plantOutFrom, safeOut } from '../src/lifecycle/shed';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { shoppingList } from '../src/planting/shopping';
import { spacingText, startsAs } from '../src/planting/windows';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 3000 }) }), name: 'Veg bed' };
const row = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2700]), ...patch });
const gardenWith = (...pls: Planting[]): Garden => pls.reduce(addPlanting, addFeature(newGarden(), bed));
const job = (kind: Job['kind'], plantId: string, verb?: string): Job => ({ key: `${kind}:${plantId}`, kind, plantId, plant: plantId, where: '', plantingIds: [], ...(verb ? { verb } : {}) });
const how = (kind: Job['kind'], id: string, month: number, style: 'close' | 'rows' = 'rows') => howTo(job(kind, id), startsAs(plantOf(id), month), plantOf(id).art?.form === 'bulb', { plant: plantOf(id), month, style });
const text = (h: { need: string[]; steps: string[] }) => [...h.need, ...h.steps].join(' ');

describe('how to, for this crop', () => {
  it('sows big seeds one at a time, and small ones thinly', () => {
    expect(text(how('sow-direct', 'broad-bean-autumn-sown', 10))).toMatch(/one seed in each/i);
    expect(text(how('sow-direct', 'broad-bean-autumn-sown', 10))).not.toMatch(/thinly/);
    expect(text(how('sow-direct', 'carrot', 4))).toMatch(/thinly/);
  });

  it('a cold-frame sowing is cold: no heat, no propagator, and mice kept out', () => {
    const peas = text(how('sow-indoors', 'sweet-pea', 10));
    expect(peas).toMatch(/cold frame/);
    expect(peas).toMatch(/No heat/);
    expect(peas).toMatch(/mice/i);
    expect(peas).not.toMatch(/propagator|keep it warm/i);
    // Sown in February on a windowsill, it's the usual under-cover steps.
    expect(text(how('sow-indoors', 'sweet-pea', 2))).toMatch(/windowsill/);
  });

  it('harvests by what’s picked', () => {
    expect(text(how('harvest', 'parsnip', 11))).toMatch(/fork/);
    expect(text(how('harvest', 'parsnip', 11))).not.toMatch(/basket/i);
    expect(text(how('harvest', 'broad-bean', 6))).toMatch(/pods/);
    expect(text(how('harvest', 'cabbage', 8))).toMatch(/knife/);
    expect(text(how('harvest', 'rosemary', 6))).toMatch(/[Ss]nip/);
    expect(text(how('harvest', 'strawberry', 6))).toMatch(/fully coloured/);
  });

  it('gives the spacing for sowing and planting, as the garden grows it', () => {
    expect(how('sow-direct', 'broad-bean-autumn-sown', 10).spacing).toBe('20 cm apart, in rows 60 cm apart');
    expect(how('sow-direct', 'broad-bean-autumn-sown', 10, 'close').spacing).toBe('15 cm apart each way');
    expect(spacingText(plantOf('apple'), 'close')).toMatch(/apart$/);
    expect(how('harvest', 'parsnip', 11).spacing).toBeUndefined();
  });
});

describe('garden words', () => {
  it('has the new words, each in two sentences', () => {
    for (const id of ['seed-compost', 'multi-purpose', 'rose', 'dibber', 'hoe', 'hand-fork', 'free-draining', 'fertile', 'crowns', 'cloche', 'chicken-manure', 'ornamental-allium']) expect(gardenWord(id), id).toBeTruthy();
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(54);
  });

  it('finds a watering can’s rose, but not a rose bush', () => {
    expect(glossed('A watering can with a rose (the sprinkler head)').some((s) => s.word?.id === 'rose')).toBe(true);
    expect(glossed('Plant a climbing rose against the wall').some((s) => s.word?.id === 'rose')).toBe(false);
  });

  it('“tender” means runner and French beans, not broad beans', () => {
    expect(gardenWord('tender')!.text).toMatch(/runner and French beans/);
    expect(gardenWord('tender')!.text).toMatch(/broad beans are hardy/);
  });
});

describe('frost, and the warmth under glass', () => {
  it('tender plants go out on the play-safe date, two weeks after the 50:50 last frost', () => {
    const g = gardenWith();
    const last = `2027-${frostDates(g).lastFrost}`;
    expect(safeOut(g, 2027) > last).toBe(true);
    expect(plantOutFrom(plantOf('tomato'), g, last)).toBe(safeOut(g, 2027));
    // Hardy plants keep the 50:50 date: a week after hardening off starts.
    expect(plantOutFrom(plantOf('leek'), g, last) < safeOut(g, 2027)).toBe(true);
  });

  it('a tender plant-out job says when it’s safe', () => {
    const may = jobsFor(gardenWith(row('tomato', { sownOn: '2027-03-01', sowing: 'indoors' })), plantOf, 5, 2027).find((j) => j.kind === 'plant-out')!;
    expect(may.detail).toMatch(/^Tender: plant out from about \d+ May, when a frost is unlikely\./);
  });

  it('says a cold frame’s warmth as warmer than outside', () => {
    expect(climateText(DEFAULT_CLIMATE['cold-frame'])).toMatch(/^about \d+(\.\d)? °C warmer than outside by day, and \d+(\.\d)? °C at night$/);
  });
});

describe('Margaret’s corrections', () => {
  it('names the autumn kind on the shopping list', () => {
    const list = shoppingList(gardenWith(row('broad-bean'), row('onion')), plantOf, '2026-10-12');
    expect(list.find((i) => i.key === 'seed:broad-bean')!.name).toBe('Broad bean seed, an autumn kind such as ‘Aquadulce Claudia’');
    expect(list.find((i) => i.key === 'bulb:onion')!.name).toBe('Onion sets, an overwintering kind');
    // In spring, a plain onion set is just that.
    expect(shoppingList(gardenWith(row('onion', { sowBy: '2027-03-15' })), plantOf, '2027-03-01').find((i) => i.key === 'bulb:onion')!.name).toBe('Onion sets');
  });

  it('overwintering onions: sets 2 cm deep, and fed only in late winter on poor soil', () => {
    const o = plantOf('onion-overwintering');
    expect(o.sowing![0]!.depthMm).toBe(20);
    expect(o.sowing![0]!.notes).toMatch(/late summer/);
    const late = o.feeding!.steps.find((s) => s.when === 'spring')!;
    expect(late.months).toEqual([2, 3]);
  });

  it('autumn jobs for glass and fruit, for gardens that have them', () => {
    const g = addFeature(gardenWith(row('raspberry', { stage: 'vegetative' })), makeFeature('greenhouse', { area: rectPoints({ x: 3000, y: 0, w: 2400, h: 1800 }) }));
    const oct = generalJobs(10, g, plantOf).map((j) => j.text);
    expect(oct).toContain('Cut summer raspberry canes that have fruited down to the ground, and tie in the new ones');
    expect(oct).toContain('Clean the greenhouse glass and gutters, and put up bubble wrap for the winter');
    expect(oct).not.toContain('Keep the cold frame lid open by day, closing it only when a hard frost is due');
    expect(generalJobs(1, gardenWith(row('blackcurrant', { stage: 'vegetative' })), plantOf).map((j) => j.text)).toContain('Prune blackcurrants: cut out up to a third of the oldest stems at the base');
  });
});
