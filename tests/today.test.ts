// Release 33: Today, and where things live. The month's jobs split into Now
// and Later this month; the month's line fits the garden; place search keeps
// to the UK; Wrapped waits for a season's worth; trays say where they are;
// backups are asked about once; the Shed's new name; Extra large text.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import varieties from '../data/varieties.json';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { jobTiming } from '../src/calendar/week';
import { monthLine, SEASONS } from '../src/content/seasons';
import { placePhrase, placesOf, sowInTray, trayFrom } from '../src/lifecycle/shed';
import { withVarieties, type VarietyEntry } from '../src/library/library';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { addPick } from '../src/planting/harvest';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { seasonStats, seasonsWorth } from '../src/share/wrapped';
import { sanitisePrefs, VIEW_HASH, viewForHash } from '../src/theme/prefs';
import { setupShowing } from '../src/ui/setup';
import { parseGeocoding, placeUrl, searchPlaces } from '../src/weather/places';

const DIR = join(__dirname, '../data/plants');
const species = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Plant[]);
const library = withVarieties(species, varieties as VarietyEntry[]);
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);

const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 1200, h: 3000 }) }), name: 'Veg bed' };
const row = (id: string, patch: Partial<Planting> = {}): Planting => ({ ...makePlanting(plantOf(id), bed.id, 'row', [600, 300], [600, 2700]), ...patch });
const gardenWith = (...plantings: Planting[]): Garden => plantings.reduce(addPlanting, addFeature(newGarden(), bed));

describe('Today: now, and later this month', () => {
  const split = (g: Garden, today: string) => {
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const jobs = jobsFor(g, plantOf, m, y, { today });
    const timing = jobTiming(jobs, g, plantOf, today);
    return { jobs, timing, of: (plantId: string) => jobs.filter((j) => j.plantId === plantId).map((j) => timing.get(j.key)) };
  };

  it('puts a sowing whose window is open now under Now', () => {
    const { of } = split(gardenWith(row('broad-bean'), row('garlic')), '2026-10-03');
    expect(of('broad-bean')).toEqual(['now']);
    expect(of('garlic')).toEqual(['now']);
  });

  it('puts a batch due late in the month under Later, and one due this week under Now', () => {
    const later = split(gardenWith(row('broad-bean', { sowBy: '2026-10-25' })), '2026-10-03');
    expect(later.jobs.some((j) => j.plantId === 'broad-bean')).toBe(true);
    expect(later.of('broad-bean')).toEqual(['later']);
    const soon = split(gardenWith(row('broad-bean', { sowBy: '2026-10-07' })), '2026-10-03');
    expect(soon.of('broad-bean')).toEqual(['now']);
  });

  it('keeps a ticked job under Now, whenever it was due', () => {
    const g = gardenWith(row('broad-bean', { sowBy: '2026-10-25' }));
    const job = jobsFor(g, plantOf, 10, 2026, { today: '2026-10-03' }).find((j) => j.plantId === 'broad-bean')!;
    const ticked = toggleJob(g, job, '2026-10-03', plantOf);
    expect(jobTiming([job], ticked, plantOf, '2026-10-03').get(job.key)).toBe('now');
  });

  it('never puts a job that isn’t sowing or planting out under Later', () => {
    const g = gardenWith(row('carrot', { sownOn: '2026-06-01', sowing: 'direct', stage: 'vegetative' }), row('leek', { sownOn: '2026-04-01', stage: 'transplanted' }));
    const { jobs, timing } = split(g, '2026-10-03');
    for (const j of jobs.filter((x) => !['sow-indoors', 'sow-direct', 'plant-out'].includes(x.kind))) expect(timing.get(j.key), j.key).toBe('now');
  });

  it('gives every job a place in one list or the other', () => {
    const g = gardenWith(row('broad-bean'), row('garlic'), row('sweet-pea'), row('onion-overwintering'), row('tulip'));
    const { jobs, timing } = split(g, '2026-10-20');
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) expect(['now', 'later']).toContain(timing.get(j.key));
  });
});

describe('the month’s line fits the garden', () => {
  it('only talks about a plant to a garden growing it, or meaning to', () => {
    expect(monthLine(10, newGarden(), plantOf)).toBe(SEASONS[9]!.line);
    expect(monthLine(10, newGarden(), plantOf)).not.toMatch(/dahlia/i);
    expect(monthLine(10, gardenWith(row('garlic')), plantOf)).toMatch(/garlic/i);
    expect(monthLine(10, { ...newGarden(), wishlist: ['dahlia'] }, plantOf)).toMatch(/dahlia/i);
    // A cleared planting doesn't count.
    expect(monthLine(10, gardenWith(row('garlic', { removedOn: '2026-07-01' })), plantOf)).toBe(SEASONS[9]!.line);
  });

  it('counts a kind of a plant as the plant', () => {
    const kind = library.find((p) => p.varietyOf === 'garlic');
    expect(kind).toBeDefined();
    expect(monthLine(10, gardenWith(row(kind!.id)), plantOf)).toMatch(/garlic/i);
  });

  it('has a line for any garden that tells nobody to do something to a plant, and lines only about real plants', () => {
    for (const s of SEASONS) {
      expect(s.line, s.name).not.toMatch(/^(Lift|Plant|Sow|Prune|Pick|Net|Feed)\b/);
      expect(s.lines.length, s.name).toBeGreaterThan(0);
      for (const l of s.lines) expect(byId.has(l.about), `${s.name}: ${l.about}`).toBe(true);
    }
  });
});

describe('place search keeps to the UK', () => {
  it('finds the first half of a postcode from part of the second', () => {
    expect(placeUrl('LS6 3')).toEqual({ url: 'https://api.postcodes.io/outcodes/LS6', kind: 'outcode' });
    expect(placeUrl('ls6 3a')).toEqual({ url: 'https://api.postcodes.io/outcodes/LS6', kind: 'outcode' });
    expect(placeUrl('LS6 3AB').kind).toBe('postcode');
  });

  it('asks Open-Meteo for UK places only, and drops any others it sends', () => {
    expect(placeUrl('Leeds').url).toContain('countryCode=GB');
    const found = parseGeocoding({
      results: [
        { name: 'Leeds', latitude: 53.8, longitude: -1.55, admin1: 'England', country: 'United Kingdom', country_code: 'GB' },
        { name: 'Leeds', latitude: 33.55, longitude: -86.54, admin1: 'Alabama', country: 'United States', country_code: 'US' },
        { name: 'Douglas', latitude: 54.15, longitude: -4.48, country: 'Isle of Man', country_code: 'IM' },
      ],
    });
    expect(found.map((p) => p.name)).toEqual(['Leeds', 'Douglas']);
  });

  it('reads a first half typed without its space as part of a postcode when the longer one doesn’t exist', async () => {
    const asked: string[] = [];
    const get: typeof fetch = (url) => {
      asked.push(String(url));
      if (String(url).endsWith('/LS63')) return Promise.resolve(new Response('{"status":404}', { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify({ result: { outcode: 'LS6', latitude: 53.82, longitude: -1.57, admin_district: ['Leeds'], country: ['England'] } })));
    };
    expect((await searchPlaces('LS63', get)).map((p) => p.name)).toEqual(['LS6']);
    expect(asked).toEqual(['https://api.postcodes.io/outcodes/LS63', 'https://api.postcodes.io/outcodes/LS6']);
  });
});

describe('Wrapped waits for a season’s worth', () => {
  it('isn’t offered after the first pick of the year', () => {
    let g = gardenWith(row('radish', { sownOn: '2026-09-01' }), row('radish', { sownOn: '2026-09-01' }));
    g = addPick(g, g.plantings[0]!.id, '2026-10-01', { grams: 200 });
    expect(seasonsWorth(seasonStats(g, 2026))).toBe(false);
  });

  it('is, once three crops have been grown over three months', () => {
    let g = gardenWith(row('radish', { sownOn: '2026-04-01' }), row('carrot', { sownOn: '2026-05-01' }), row('lettuce', { sownOn: '2026-06-01' }));
    g = addPick(g, g.plantings[0]!.id, '2026-05-10', { grams: 200 });
    expect(seasonsWorth(seasonStats(g, 2026))).toBe(true);
  });
});

describe('trays say where they are', () => {
  it('names the place, with the right word before it', () => {
    expect(placePhrase({ kind: 'windowsill', name: 'Windowsill' })).toBe('on the windowsill');
    expect(placePhrase({ kind: 'cold-frame', name: 'Cold frame' })).toBe('in the cold frame');
    expect(placePhrase({ kind: 'propagator', name: 'Propagator' })).toBe('in the propagator');
    expect(placePhrase({ kind: 'shelves', name: 'Shed shelves' })).toBe('on the shed shelves');
    expect(placePhrase({ kind: 'windowsill', name: 'Kitchen windowsill' })).toBe('on the kitchen windowsill');
    expect(placePhrase({ kind: 'greenhouse-bench', name: 'My greenhouse' })).toBe('on my greenhouse');
    expect(placePhrase({ kind: 'windowsill', name: 'Windowsill' }, true)).toBe('from the windowsill');
  });

  it('says where a tray comes from when it’s planted out', () => {
    const [g, id] = sowInTray(newGarden(), plantOf('sweet-pea'), { date: '2026-10-03', placeId: undefined });
    const place = placesOf(g).find((p) => p.id === g.trays!.find((t) => t.id === id)!.placeId)!;
    expect(trayFrom(g, id!)).toBe(placePhrase(place, true));
    expect(trayFrom(g, 'gone')).toBe('from the shed');
  });
});

describe('where things live', () => {
  const prefs = { northChecked: false, lastBackup: null, setupHidden: false };
  const planted = gardenWith(row('garlic'));

  it('asks for a backup once: in Getting started while it’s showing, otherwise by itself', () => {
    expect(setupShowing(planted, prefs)).toBe(true);
    expect(setupShowing(planted, { ...prefs, setupHidden: true })).toBe(false);
    expect(setupShowing(planted, { ...prefs, lastBackup: '2026-10-01' })).toBe(false);
  });

  it('calls the Shed the Shed, and still opens it from an old Seedlings link', () => {
    expect(VIEW_HASH.shed).toBe('shed');
    expect(viewForHash('shed')).toBe('shed');
    expect(viewForHash('seedlings')).toBe('shed');
  });

  it('keeps Extra large text', () => {
    expect(sanitisePrefs({ textSize: 'xlarge' }).textSize).toBe('xlarge');
    expect(sanitisePrefs({ textSize: 'huge' }).textSize).toBe('standard');
  });
});
