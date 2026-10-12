// Release 34: explain the gardening. Garden words in plain lines, found in the
// app's own text and not in everyday words; a how-to for every job; kits sized
// for a first garden; not-now notes; a booked bed says so; cardboard in a
// list; the help that was missing.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { JOB_KINDS, jobsFor, type Job } from '../src/calendar/jobs';
import { gardenWord, GLOSSARY, glossed } from '../src/content/glossary';
import { helpTopic } from '../src/content/help';
import { howTo } from '../src/content/howto';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newAppState, newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { addListBed, listKindOf } from '../src/model/listLayout';
import { makeSpace, spaceInfo } from '../src/model/spaces';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { bookedText, bookedUntil } from '../src/planting/booked';
import { applyKit, KITS, kitPlants, STARTER_BLOCK } from '../src/planting/kits';
import { isListed } from '../src/planting/listPlant';
import { addPlanting, makePlanting, plantCount, unknownPlant } from '../src/planting/place';
import { notNow, startsAs } from '../src/planting/windows';
import { search } from '../src/ui/search';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const known = (id: string) => byId.get(id) ?? null;

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 2400 }) }), name: 'Bed 1' };
const row = (id: string, y: number, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [100, y], [1100, y]), ...patch });
const gardenWith = (...plantings: Planting[]): Garden => plantings.reduce(addPlanting, addFeature(newGarden(), bed));

/** The words a first-time gardener didn't know, from the review of 11 Oct 2026. */
const JORDAN = [
  'hardening off', 'under cover', 'module tray', 'root trainer', 'propagator', 'pinch out', 'side-shoot', 'truss', 'cordon', 'plant out', 'onion sets', 'garlic cloves',
  'overwintering', 'mulch', 'well-rotted manure', 'green manure', 'leaf mould', 'lift', 'bare-root', 'fleece', 'cold frame', 'blanch', 'germinate', 'staking', 'crop family',
  'rotation', 'succession sowing', 'earthing up', 'pricking out', 'potting on', 'chit', 'thin out', 'bolting', 'blood, fish and bone', 'bonemeal', 'variety',
];

const wordsIn = (text: string) => glossed(text).filter((s) => s.word).map((s) => s.word!.id);

describe('garden words', () => {
  it('explains every word on the list, in two plain lines', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(36);
    expect(new Set(GLOSSARY.map((w) => w.id)).size).toBe(GLOSSARY.length);
    for (const phrase of JORDAN) expect(wordsIn(`Now ${phrase} them.`), phrase).toHaveLength(1);
    for (const w of GLOSSARY) expect(w.text.split(/(?<=\.) /).length, w.id).toBe(2);
    expect(gardenWord('variety')!.text).toMatch(/Aquadulce/);
  });

  it('finds every garden word the plant notes use', () => {
    // Each of the list's words that the plant data uses is picked out where it's used.
    const notes = library.flatMap((p) => [...(p.sowing ?? []).map((s) => s.notes ?? ''), p.cropping?.notes ?? '', ...(p.lookOutFor ?? []), p.wintering?.notes ?? '']).filter(Boolean);
    let found = 0;
    for (const phrase of ['pinch out', 'under cover', 'mulch', 'fleece', 'modules', 'seedbed', 'earth up', 'thin to', 'chitted']) {
      const used = notes.filter((n) => n.toLowerCase().includes(phrase));
      for (const n of used) expect(wordsIn(n).length, n).toBeGreaterThan(0);
      found += used.length;
    }
    expect(found).toBeGreaterThan(20);
  });

  it('leaves everyday words alone', () => {
    for (const text of ['Fruit sets only after a mild winter.', 'Strongly clove-scented.', 'Pick the leaves while young and tender.', 'Rotate the tray each day.', 'A pot on the patio.', 'Little and often: pull weeds before they flower.', 'A mistake to avoid.'])
      expect(wordsIn(text), text).toEqual([]);
  });

  it('picks a word out once, and the longer of two that overlap', () => {
    const parts = glossed('Plant onion sets, and mulch. Mulch again later.');
    expect(parts.filter((s) => s.word).map((s) => s.text)).toEqual(['onion sets', 'mulch']);
    expect(parts.map((s) => s.text).join('')).toBe('Plant onion sets, and mulch. Mulch again later.');
  });

  it('can be searched for, with the meaning in the result', () => {
    const ctx = { garden: newAppState().garden, plants: [], plantOf: unknownPlant, locked: false };
    const r = search('what is hardening off', ctx).find((x) => x.key === 'word-hardening-off');
    expect(r?.detail).toMatch(/outside/);
    expect(r?.command).toEqual({ kind: 'help', id: 'words' });
    expect(helpTopic('words')?.title).toBe('Garden words');
  });
});

describe('how to do each job', () => {
  const job = (kind: Job['kind'], plantId = '', verb?: string): Job => ({ key: `${kind}:${plantId}`, kind, plantId, plant: plantId, where: '', plantingIds: [], ...(verb ? { verb } : {}) });

  it('has what you need, three or four steps and a time for every kind of job', () => {
    for (const kind of JOB_KINDS) {
      const h = howTo(job(kind), 'seed');
      expect(h.need.length, kind).toBeGreaterThan(0);
      expect(h.steps.length, kind).toBeGreaterThanOrEqual(3);
      expect(h.steps.length, kind).toBeLessThanOrEqual(4);
      expect(h.time, kind).toMatch(/minute/);
    }
  });

  it('plants garlic, onion sets, seed potatoes and bulbs as what they are', () => {
    const sowOut = (id: string, month: number) => howTo(job('sow-direct', id, 'Plant'), startsAs(plantOf(id), month)).steps.join(' ');
    expect(sowOut('garlic', 10)).toMatch(/clove/i);
    expect(sowOut('onion-overwintering', 10)).toMatch(/set/i);
    expect(sowOut('potato', 4)).toMatch(/potato/i);
    expect(howTo(job('sow-direct', 'carrot'), startsAs(plantOf('carrot'), 4)).steps.join(' ')).toMatch(/drill/);
    expect(howTo(job('plant-out', 'tulip', 'Plant'), 'bulbs', true).need.join(' ')).toMatch(/bulbs/);
    expect(howTo(job('plant-out', 'lavender', 'Plant'), 'plants').steps.join(' ')).toMatch(/pot/);
    expect(howTo(job('plant-out', 'tomato'), 'seed').steps.join(' ')).toMatch(/slugs/);
    expect(howTo(job('sow-indoors', 'sweet-pea'), 'seed').need.join(' ')).toMatch(/compost/);
  });

  it('agrees with the month’s jobs for an autumn garden', () => {
    const g = gardenWith(row('garlic', 300), row('onion-overwintering', 700), row('broad-bean-autumn-sown', 1100));
    const jobs = jobsFor(g, plantOf, 10, 2026).filter((j) => j.kind === 'sow-direct');
    const steps = (id: string) => howTo(jobs.find((j) => j.plantId === id)!, startsAs(plantOf(id), 10)).steps.join(' ');
    expect(steps('garlic')).toMatch(/clove/i);
    expect(steps('onion-overwintering')).toMatch(/set/i);
    expect(steps('broad-bean-autumn-sown')).toMatch(/drill/);
  });
});

describe('not now, out of season', () => {
  it('says when a plant can start, when nothing can be done this month', () => {
    expect(notNow(plantOf('tomato'), 10)).toBe('Not now: sow under cover from February, then plant out from May.');
    expect(notNow(plantOf('carrot'), 10)).toBe('Not now: sow outside from March.');
    expect(notNow(plantOf('tulip'), 8)).toBe('Not now: plant from November.');
    expect(notNow(plantOf('lavender'), 10)).toBe('Not now: plant from April.');
  });

  it('says nothing when something can be done now', () => {
    expect(notNow(plantOf('garlic'), 10)).toBeNull();
    expect(notNow(plantOf('tomato'), 3)).toBeNull();
    expect(notNow(plantOf('tomato'), 5)).toBeNull();
    expect(notNow(plantOf('tulip'), 11)).toBeNull();
  });
});

describe('a booked bed', () => {
  const today = '2026-11-05';

  it('says when a bed is taken until next summer', () => {
    const g = gardenWith(...[150, 400, 650, 900, 1150, 1400, 1650, 1900, 2150].map((y) => row('garlic', y, { sownOn: '2026-10-20', sowing: 'direct', stage: 'sown' })));
    const b = bookedUntil(g, bed, plantOf, today);
    expect(b).not.toBeNull();
    expect(b!.until > '2027-05-01').toBe(true);
    expect(bookedText(b!, bed, plantOf)).toMatch(/^Bed 1 is taken until about (June|July|August) by garlic\./);
    // A kind's name reads as words in a sentence.
    const sown = { sownOn: '2026-10-20', sowing: 'direct' as const, stage: 'sown' as const };
    const mixed = gardenWith(...[150, 650, 1150, 1650, 2150].map((y) => row('garlic', y, sown)), ...[400, 900, 1400, 1900].map((y) => row('onion-overwintering', y, sown)));
    expect(bookedText(bookedUntil(mixed, bed, plantOf, today)!, bed, plantOf)).toMatch(/overwintering onion/);
  });

  it('says nothing for an empty bed, a bed with room, or one that’s soon cleared', () => {
    expect(bookedUntil(gardenWith(), bed, plantOf, today)).toBeNull();
    expect(bookedUntil(gardenWith(row('garlic', 300, { sownOn: '2026-10-20', sowing: 'direct', stage: 'sown' })), bed, plantOf, today)).toBeNull();
    const lettuce = gardenWith(...[300, 700, 1100, 1500, 1900].map((y) => row('lettuce', y, { sownOn: '2026-08-01', sowing: 'direct', stage: 'vegetative' })));
    expect(bookedUntil(lettuce, bed, plantOf, '2026-09-20')).toBeNull();
  });
});

describe('kits for a first garden', () => {
  const planted = (full: boolean) =>
    KITS.map((k) => {
      const [w, d] = spaceInfo(k.space).size;
      return { kit: k, g: applyKit(makeSpace(newGarden(), k.space, w, d), k, known, '2026-10-12', full) };
    });

  it('plants tens of bulbs, not hundreds, unless made bigger', () => {
    for (const { kit, g } of planted(false))
      for (const pl of g.plantings.filter((p) => p.layout === 'block')) expect(plantCount(pl, plantOf(pl.plantId)), kit.id).toBeLessThanOrEqual(STARTER_BLOCK);
    const crocus = (full: boolean) => planted(full).find((x) => x.kit.id === 'autumn-garden')!.g.plantings.filter((p) => p.plantId === 'crocus').reduce((n, p) => n + plantCount(p, plantOf('crocus')), 0);
    expect(crocus(false)).toBeLessThanOrEqual(STARTER_BLOCK);
    expect(crocus(true)).toBeGreaterThan(100);
  });

  it('keeps every kit’s promise: each plant it names goes in, small or big', () => {
    for (const full of [false, true])
      for (const { kit, g } of planted(full)) {
        const ids = new Set(g.plantings.map((p) => p.plantId));
        for (const id of kitPlants(kit)) expect(ids.has(id), `${kit.id} ${full ? 'bigger' : 'first'}: ${id}`).toBe(true);
        expect(validateGarden(JSON.parse(JSON.stringify(g))), kit.id).toEqual([]);
      }
  });

  it('puts a cluster of bulbs in a pot, not one', () => {
    const balcony = planted(false).find((x) => x.kit.id === 'autumn-balcony')!.g;
    const daffodils = balcony.plantings.filter((p) => p.plantId === 'daffodil').reduce((n, p) => n + plantCount(p, plantOf('daffodil')), 0);
    expect(daffodils).toBeGreaterThan(1);
  });
});

describe('cardboard in a list', () => {
  it('adds cardboard over weeds as something in the list, with its check to come', () => {
    const [g, id] = addListBed({ ...newGarden(), view: 'list' }, 'cardboard', 'New bed');
    const f = g.features.find((x) => x.id === id)!;
    expect(f.kind).toBe('surface');
    expect(f.material).toBe('cardboard');
    expect(listKindOf(f)).toBe('cardboard');
    expect(isListed(g)(f)).toBe(true);
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    // Once it's laid, the check comes about six months on.
    const laid = { ...g, features: g.features.map((x) => (x.id === id ? { ...x, laidOn: '2026-04-01' } : x)) };
    expect(jobsFor(laid, plantOf, 10, 2026).some((j) => j.plant === 'Cardboard')).toBe(true);
  });
});

describe('the help that was missing', () => {
  it('has this week’s jobs, recording a harvest, feeding, and cardboard in a list', () => {
    for (const id of ['this-week', 'harvest', 'feeding', 'cardboard-list']) expect(helpTopic(id), id).toBeTruthy();
  });
});
