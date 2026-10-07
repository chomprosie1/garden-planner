// UX release 4, delight: photos on notes, the harvest log, your season
// wrapped, what frost reminders watch, the weekly reminder, and picking
// from a harvest job.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor, logPick } from '../src/calendar/jobs';
import { mondayOf, weekNudges } from '../src/calendar/week';
import { frostWatchList } from '../src/lifecycle/frostWatch';
import { happenings, likelyNext, recordHappening } from '../src/lifecycle/happened';
import { makePlace, setTrayStage, sowInTray } from '../src/lifecycle/shed';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { addNote, makeNote, photosOf } from '../src/model/notes';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { splitIntoBatches } from '../src/planting/batches';
import { addPick, formatWeight, picksIn } from '../src/planting/harvest';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { seasonStats, seasonYear, wrappedCards } from '../src/share/wrapped';
import { parseFile, toFile } from '../src/storage/file';
import { snapshot } from '../src/storage/reminders';
import { sanitisePrefs } from '../src/theme/prefs';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);
const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
const base: Garden = addFeature({ ...newGarden(), name: 'Plot 7' }, bed);
const tomato: Planting = { ...makePlanting(plant('tomato'), bed.id, 'single', [500, 500]), sowing: 'indoors', sownOn: '2027-03-01', stage: 'harvesting', stageDates: { transplanted: '2027-05-20', harvesting: '2027-07-30' } };

describe('photos on notes', () => {
  it('keeps a note with only a photo, and lists a garden’s or a planting’s photos, newest first', () => {
    let g = addNote(base, makeNote('', '2027-06-01', {}, 'ph-aaaa1111'));
    g = addNote(g, makeNote('First truss', '2027-06-20', { plantingId: tomato.id }, 'ph-bbbb2222'));
    g = addNote(g, makeNote('', '2027-06-21'));
    expect(g.notes).toHaveLength(2);
    expect(photosOf(g).map((n) => n.photo)).toEqual(['ph-bbbb2222', 'ph-aaaa1111']);
    expect(photosOf(g, tomato.id).map((n) => n.photo)).toEqual(['ph-bbbb2222']);
    expect(validateGarden(g)).toEqual([]);
    expect(validateGarden({ ...g, notes: [{ ...g.notes[0]!, photo: '../../etc' }] })).toHaveLength(1);
  });

  it('carries photos in a backup made with them, and leaves out anything that isn’t a picture', () => {
    const g = addNote(base, makeNote('', '2027-06-01', {}, 'ph-aaaa1111'));
    const file = { ...toFile({ garden: g, userPlants: [] }), photos: { 'ph-aaaa1111': 'data:image/jpeg;base64,AAAA', 'bad id!': 'data:image/jpeg;base64,AAAA', 'ph-x': 'javascript:alert(1)' } };
    const r = parseFile(JSON.parse(JSON.stringify(file)));
    expect(r.ok && r.photos).toEqual({ 'ph-aaaa1111': 'data:image/jpeg;base64,AAAA' });
    const plain = parseFile(JSON.parse(JSON.stringify(toFile({ garden: g, userPlants: [] }))));
    expect(plain.ok && plain.photos).toBeUndefined();
  });
});

describe('the harvest log', () => {
  it('logs pickings by size or weight, and adds them up by crop for the year', () => {
    let g = addPlanting(base, tomato);
    g = addPick(g, tomato.id, '2027-07-30', { size: 'bowl' });
    g = addPick(g, tomato.id, '2027-08-10', { grams: 1250 });
    g = addPick(g, tomato.id, '2026-08-10', { size: 'basket' });
    g = addPick(g, tomato.id, '2027-08-11', {});
    const pl = g.plantings[0]!;
    expect(pl.picks).toEqual([
      { date: '2027-07-30', grams: 500, size: 'bowl' },
      { date: '2027-08-10', grams: 1250 },
      { date: '2026-08-10', grams: 2000, size: 'basket' },
    ]);
    expect(picksIn(g, 2027)).toEqual([{ plantId: 'tomato', grams: 1750, picks: 2, first: '2027-07-30', last: '2027-08-10' }]);
    expect(validateGarden(g)).toEqual([]);
    expect(validateGarden({ ...g, plantings: [{ ...pl, picks: [{ date: '2027-08-01', grams: -1 }] }] })).toHaveLength(1);
    expect(formatWeight(450)).toBe('450 g');
    expect(formatWeight(6240)).toBe('6.2 kg');
  });

  it('asks how much from “What’s happened?” once it’s cropping', () => {
    expect(happenings(plant('tomato'), tomato).map((h) => h.id)[0]).toBe('picked');
    expect(likelyNext(plant('tomato'), tomato)).toBe('picked');
    const g = recordHappening(addPlanting(base, tomato), tomato, plant('tomato'), 'picked', '2027-08-02', 'Sungold', { pick: { size: 'handful' }, photo: 'ph-cccc3333' });
    expect(g.plantings[0]!.picks).toEqual([{ date: '2027-08-02', grams: 150, size: 'handful' }]);
    expect(g.plantings[0]!.stage).toBe('harvesting');
    expect(g.notes).toEqual([expect.objectContaining({ text: 'Sungold', photo: 'ph-cccc3333', plantingId: tomato.id })]);
  });

  it('saves as schema 11 or later', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(11);
    expect((migrateGarden({ ...newGarden(), schemaVersion: 10 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('your season, wrapped', () => {
  const lettuce: Planting = { ...makePlanting(plant('lettuce'), bed.id, 'row', [200, 900], [2800, 900]), sowing: 'direct', sownOn: '2027-04-02', stage: 'harvesting', stageDates: { harvesting: '2027-06-01' } };
  let g = [tomato, lettuce].reduce(addPlanting, base);
  g = addPick(g, lettuce.id, '2027-06-01', { size: 'bowl' });
  g = addPick(g, tomato.id, '2027-07-30', { grams: 2400 });
  g = addNote(g, makeNote('Best tomato yet', '2027-08-15', { plantingId: tomato.id }, 'ph-dddd4444'));
  const known = (id: string) => byId.has(id);

  it('adds up the year: what was grown, the first pick, how much, the busiest month, photos and what to try next', () => {
    const s = seasonStats(g, 2027, known);
    expect(s.plantings).toBe(2);
    expect(s.crops.sort()).toEqual(['lettuce', 'tomato']);
    expect(s.firstPick).toEqual({ plantId: 'lettuce', date: '2027-06-01' });
    expect(s.grams).toBe(2900);
    expect(s.top[0]!.plantId).toBe('tomato');
    expect(s.photos.map((p) => p.photo)).toEqual(['ph-dddd4444']);
    expect(s.tryNext).toEqual(['courgette', 'sweet-pea']);
    expect(s.busiest?.count).toBeGreaterThan(0);
    expect(seasonStats(g, 2026).plantings).toBe(0);
  });

  it('makes a card for each thing worth saying, and none for an empty year', () => {
    const cards = wrappedCards(seasonStats(g, 2027, known), 'Plot 7', (id) => plant(id).commonName);
    expect(cards.map((c) => c.eyebrow)).toEqual(['2027 in Plot 7', 'First pick of the year', 'Picked this year', 'Busiest month', 'A moment from the year', 'Next year, try']);
    expect(cards[0]).toMatchObject({ big: '2', line: 'plantings, of 2 crops' });
    expect(cards[2]).toMatchObject({ big: '2.9 kg', line: 'Most of all: tomato, 2.4 kg' });
    expect(cards[4]).toMatchObject({ photo: 'ph-dddd4444', line: 'Best tomato yet' });
    expect(cards[5]).toMatchObject({ big: 'Courgette', line: 'and sweet pea' });
    expect(wrappedCards(seasonStats(base, 2027), 'Plot 7', String)).toEqual([]);
  });

  it('looks back on this year from September, and last year before then', () => {
    expect(seasonYear('2027-10-07')).toBe(2027);
    expect(seasonYear('2028-01-15')).toBe(2027);
    expect(seasonYear('2027-05-01')).toBe(2026);
  });
});

describe('frost reminders', () => {
  it('watch what a frost could hurt, with how much warmer it is at night where it is', () => {
    const greenhouse = makeFeature('greenhouse', { area: rectPoints({ x: 5000, y: 0, w: 2400, h: 1800 }) });
    const outside: Planting = { ...tomato, id: 'p-out', stage: 'vegetative' };
    const inside: Planting = { ...makePlanting(plant('courgette'), greenhouse.id, 'single', [6000, 900]), sowing: 'indoors', sownOn: '2027-04-01', stage: 'vegetative' };
    const kale: Planting = { ...makePlanting(plant('kale'), bed.id, 'single', [2000, 500]), stage: 'vegetative' };
    let g: Garden = { ...[outside, inside, kale].reduce(addPlanting, addFeature(base, greenhouse)), shedPlaces: [makePlace('cold-frame')] };
    let tray: string;
    [g, tray] = sowInTray(g, plant('basil'), { date: '2027-04-01', placeId: g.shedPlaces![0]!.id }) as [Garden, string];
    expect(frostWatchList(g, plant)).toEqual([
      { name: 'Tomato in Veg bed', nightGain: 0 },
      { name: 'Courgette in Greenhouse', nightGain: 2 },
      { name: 'Basil on the Cold frame', nightGain: 1 },
    ]);
    g = setTrayStage(g, tray, 'hardening', '2027-05-01');
    expect(frostWatchList(g, plant).at(-1)).toEqual({ name: 'Basil hardening off', nightGain: 0 });
  });

  it('are off until you turn them on, and so is the install card put away', () => {
    expect(sanitisePrefs({}).reminders).toBe(false);
    expect(sanitisePrefs({}).installHidden).toBe(false);
    expect(sanitisePrefs({ reminders: true, installHidden: true })).toMatchObject({ reminders: true, installHidden: true });
  });
});

describe('the weekly reminder', () => {
  const sowing = (): Garden => {
    const lettuce: Planting = { ...makePlanting(plant('lettuce'), bed.id, 'row', [200, 300], [2800, 300]), sowing: 'direct' };
    return splitIntoBatches({ ...addPlanting(base, lettuce), latitude: 53.8, longitude: -1.55 }, lettuce.id, plant('lettuce'), 3, 21, '2027-04-05');
  };

  it('starts each week on a Monday', () => {
    expect(mondayOf('2027-04-01')).toBe('2027-03-29');
    expect(mondayOf('2027-04-05')).toBe('2027-04-05');
    expect(mondayOf('2027-04-11')).toBe('2027-04-05');
  });

  it('works out the next few weeks’ jobs, for weeks with something to do', () => {
    expect(weekNudges(sowing(), plant, '2027-04-01')).toEqual([
      { week: '2027-04-05', title: '1 job this week', body: 'Sow outside: lettuce (batch 1 of 3) in Veg bed.' },
      { week: '2027-04-26', title: '1 job this week', body: 'Sow outside: lettuce (batch 2 of 3) in Veg bed.' },
    ]);
    expect(weekNudges(base, plant, '2027-04-01')).toEqual([]);
  });

  it('gives the service worker only what each reminder that’s on needs', () => {
    const items = [{ name: 'Tomato in Veg bed', nightGain: 0 }];
    const weeks = weekNudges(sowing(), plant, '2027-04-01');
    expect(snapshot(true, 53.81234, -1.55678, items, null)).toEqual({ on: true, lat: 53.81, lon: -1.56, items, weeks: [] });
    expect(snapshot(false, 53.8, -1.55, items, weeks)).toMatchObject({ on: false, items: [], weeks });
  });

  it('is off until you turn it on', () => {
    expect(sanitisePrefs({}).weeklyNudge).toBe(false);
    expect(sanitisePrefs({ weeklyNudge: true }).weeklyNudge).toBe(true);
  });
});

describe('picking from a harvest job', () => {
  it('logs how much on the job’s planting, and ticks the job once', () => {
    const g0 = addPlanting(base, tomato);
    const job = jobsFor(g0, plant, 8, 2027).find((j) => j.kind === 'harvest' && j.plantId === 'tomato')!;
    expect(job.plantingIds).toEqual([tomato.id]);
    let g = logPick(g0, job, '2027-08-03', 'bowl', plant);
    g = logPick(g, job, '2027-08-09', 'handful', plant);
    expect(g.jobsDone).toEqual([{ key: job.key, date: '2027-08-03' }]);
    expect(g.plantings[0]!.picks).toEqual([
      { date: '2027-08-03', grams: 500, size: 'bowl' },
      { date: '2027-08-09', grams: 150, size: 'handful' },
    ]);
    expect(logPick(g0, { ...job, kind: 'tidy' }, '2027-08-03', 'bowl', plant)).toBe(g0);
  });
});
