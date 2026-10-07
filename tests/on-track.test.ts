// Release 8: running behind (plantings late to reach their next stage, and why
// that might be), and weeds (kept or removed, their jobs, and weeding).

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import vegetables from '../data/plants/vegetable.json';
import weeds from '../data/plants/weed.json';
import { jobsFor, toggleJob, weedJob } from '../src/calendar/jobs';
import { upcoming } from '../src/calendar/week';
import { filterPlants, emptyFilter } from '../src/library/library';
import { behindOf, behindText, causesFor, runningBehind, slackDays, snooze } from '../src/lifecycle/behind';
import { gapsOn, shortDate, timeline } from '../src/lifecycle/projection';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden, validatePlant } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { checkGarden } from '../src/planting/rules';
import { seasonStats } from '../src/share/wrapped';
import { sanitisePrefs } from '../src/theme/prefs';

const library = [...vegetables, ...flowers, ...weeds] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const TODAY = '2026-10-07';
const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Veg bed' };
const lawn = { ...makeFeature('surface', { area: rectPoints({ x: 0, y: 2000, w: 6000, h: 4000 }) }), material: 'lawn' as const };
const base = (): Garden => addFeature(addFeature(newAppState().garden, lawn), bed);
const plant = (id: string, extra: Partial<Planting> = {}, where = bed.id): Planting => ({ ...makePlanting(plantOf(id), where, 'single', [500, 500]), ...extra });
const valid = (g: Garden) => validateGarden(JSON.parse(JSON.stringify(g)));

describe('running behind', () => {
  it('a direct sowing not up weeks after it should be is running behind, with why it might be', () => {
    const carrots = plant('carrot', { sownOn: '2026-08-20', sowing: 'direct' });
    const g = addPlanting(base(), carrots);
    const [b] = runningBehind(g, plantOf, TODAY);
    expect(b?.plantingId).toBe(carrots.id);
    expect(b?.next).toBe('germinated');
    expect(b!.late).toBeGreaterThan(0);
    expect(b!.causes[0]).toMatch(/Cold soil/);
    expect(behindText(b!, shortDate)).toMatch(/^Expected to be up by \d+ \w{3}\.$/);
  });

  it('a sowing still within its time, or its slack, is not', () => {
    const fresh = plant('carrot', { sownOn: '2026-10-01', sowing: 'direct' });
    expect(behindOf(plantOf('carrot'), fresh, addPlanting(base(), fresh), TODAY)).toBeNull();
  });

  it('marking the next stage clears it', () => {
    const up = plant('carrot', { sownOn: '2026-08-20', sowing: 'direct', stage: 'germinated', stageDates: { germinated: '2026-09-05' } });
    const b = behindOf(plantOf('carrot'), up, addPlanting(base(), up), TODAY);
    expect(b?.next).not.toBe('germinated');
  });

  it('leaves out planned and cleared plantings, ones with no date, weeds, and the step to clearing', () => {
    const planned = plant('carrot');
    const cleared = plant('carrot', { sownOn: '2026-05-01', removedOn: '2026-09-01' });
    const undated = plant('lettuce', { stage: 'transplanted' });
    const weed = plant('dandelion', {}, lawn.id);
    const g = [planned, cleared, undated, weed].reduce(addPlanting, base());
    expect(runningBehind(g, plantOf, TODAY)).toEqual([]);
  });

  it('"Still waiting" quietens it for two weeks', () => {
    const carrots = plant('carrot', { sownOn: '2026-08-20', sowing: 'direct' });
    const g = snooze(addPlanting(base(), carrots), carrots.id, TODAY);
    expect(g.plantings[0]!.snoozeUntil).toBe('2026-10-21');
    expect(runningBehind(g, plantOf, TODAY)).toEqual([]);
    expect(runningBehind(g, plantOf, '2026-10-22')).toHaveLength(1);
    expect(valid(g)).toEqual([]);
  });

  it('allows a week for seedlings and longer for slower stages', () => {
    expect(slackDays('germinated', 14)).toBe(7);
    expect(slackDays('flowering', 20)).toBe(14);
    expect(slackDays('harvesting', 120)).toBe(30);
  });

  it('adds the plant’s own pests to the usual reasons', () => {
    const withPests = library.find((p) => p.pests?.length)!;
    const causes = causesFor(withPests, 'harvesting');
    expect(causes.some((c) => c.startsWith(withPests.pests![0]!.name))).toBe(true);
    expect(causesFor(plantOf('carrot'), 'planned')).toEqual([]);
  });
});

describe('weeds', () => {
  it('about twenty, valid, each saying how it spreads and how to be rid of it by hand', () => {
    expect(weeds.length).toBeGreaterThanOrEqual(20);
    for (const w of weeds as Plant[]) {
      expect(validatePlant(w), w.id).toEqual([]);
      expect(w.category).toBe('weed');
      expect(w.weed!.removal, w.id).not.toMatch(/weedkiller|herbicide|glyphosate|spray/i);
      expect(w.flowerMonths?.length, w.id).toBeGreaterThan(0);
    }
    expect(validatePlant({ ...(weeds[0] as Plant), weed: undefined })).not.toEqual([]);
  });

  it('are left out of plant lists unless asked for, by the filter or by name', () => {
    const all = filterPlants(library, emptyFilter).map((p) => p.id);
    expect(all).not.toContain('dandelion');
    expect(filterPlants(library, { ...emptyFilter, category: 'weed' }).length).toBe(weeds.length);
    expect(filterPlants(library, { ...emptyFilter, query: 'dandelion' }).map((p) => p.id)).toEqual(['dandelion']);
  });

  it('are marked as already growing, and aren’t checked for spacing or neighbours', () => {
    const d = makePlanting(plantOf('dandelion'), lawn.id, 'single', [1000, 3000]);
    expect(d.stage).toBe('transplanted');
    const crocus = makePlanting(plantOf('crocus'), lawn.id, 'single', [1020, 3000]);
    expect(checkGarden([d, crocus].reduce(addPlanting, base()), plantOf).filter((f) => f.plantingIds.includes(d.id))).toEqual([]);
  });

  it('one you want gone gets a job before it seeds; one with spreading roots, in spring and autumn; one you keep, none', () => {
    const dandelion = plantOf('dandelion'); // both, flowers March to June
    const d = makePlanting(dandelion, lawn.id, 'single', [1000, 3000]);
    expect(weedJob(dandelion, [d], 2)).toMatch(/^Get it out before it seeds\./);
    expect(weedJob(dandelion, [d], 9)).toMatch(/^Dig out the roots\./);
    expect(weedJob(dandelion, [d], 12)).toBeNull();
    expect(weedJob(plantOf('couch-grass'), [d], 7)).toBeNull();
    expect(weedJob(plantOf('couch-grass'), [d], 4)).toMatch(/roots/);
    const g = addPlanting(base(), d);
    expect(jobsFor(g, plantOf, 4, 2027).find((j) => j.kind === 'weed' && j.plantId === 'dandelion')?.where).toBe('in the lawn');
    const kept = addPlanting(base(), { ...d, keep: true });
    expect(jobsFor(kept, plantOf, 4, 2027).filter((j) => j.plantId === 'dandelion')).toEqual([]);
  });

  it('ticking the job clears the weed; unticking brings it back', () => {
    const d = makePlanting(plantOf('dandelion'), lawn.id, 'single', [1000, 3000]);
    const g = addPlanting(base(), d);
    const job = jobsFor(g, plantOf, 4, 2027).find((j) => j.plantId === 'dandelion')!;
    const pulled = toggleJob(g, job, '2027-04-10');
    expect(pulled.plantings[0]!.removedOn).toBe('2027-04-10');
    expect(toggleJob(pulled, job, '2027-04-11').plantings[0]!.removedOn).toBeUndefined();
  });

  it('don’t fill a bed, aren’t looked forward to, and aren’t counted as grown', () => {
    const inBed = makePlanting(plantOf('groundsel'), bed.id, 'single', [500, 500]);
    const lettuce = { ...makePlanting(plantOf('lettuce'), bed.id, 'single', [1500, 500]), sownOn: '2026-04-01', sowing: 'direct' as const, removedOn: '2026-07-01' };
    const g = [lettuce, inBed].reduce(addPlanting, base());
    const lines = new Map(g.plantings.map((p) => [p.id, timeline(plantOf(p.plantId), p, g, TODAY)]));
    expect(gapsOn(g, plantOf, lines, TODAY).map((x) => x.bed.id)).toEqual([bed.id]);
    expect(upcoming(g, plantOf, TODAY, TODAY, '2027-12-31').some((u) => u.plantId === 'groundsel')).toBe(false);
    const stats = seasonStats(g, 2026, () => true, (id) => plantOf(id).category === 'weed');
    expect(stats.crops).toEqual(['lettuce']);
  });
});

describe('weeding the beds', () => {
  const growing = (): Garden => addPlanting(base(), plant('lettuce', { sownOn: '2027-03-01', sowing: 'direct' }));

  it('one job a month from March to October for beds with something in, with a word for the month', () => {
    const may = jobsFor(growing(), plantOf, 5, 2027, { weeding: true }).filter((j) => j.key.startsWith('weed:beds:'));
    expect(may).toHaveLength(1);
    expect(may[0]!.plant).toBe('Weed the beds');
    expect(may[0]!.where).toBe('(Veg bed)');
    expect(may[0]!.detail).toBeTruthy();
    expect(jobsFor(growing(), plantOf, 12, 2027, { weeding: true }).some((j) => j.key.startsWith('weed:beds:'))).toBe(false);
    expect(jobsFor(base(), plantOf, 5, 2027, { weeding: true }).some((j) => j.key.startsWith('weed:beds:'))).toBe(false);
  });

  it('can be turned off, on by default', () => {
    expect(sanitisePrefs({}).weeding).toBe(true);
    expect(sanitisePrefs({ weeding: false }).weeding).toBe(false);
    expect(jobsFor(growing(), plantOf, 5, 2027, { weeding: false }).some((j) => j.key.startsWith('weed:beds:'))).toBe(false);
  });
});

describe('schema 13', () => {
  it('saves as 13 or later; older gardens load unchanged, and keep and snoozeUntil are checked', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(13);
    expect((migrateGarden({ ...newAppState().garden, schemaVersion: 12 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
    const d = makePlanting(plantOf('dandelion'), lawn.id, 'single', [1000, 3000]);
    expect(valid(addPlanting(base(), { ...d, keep: true, snoozeUntil: '2026-10-21' }))).toEqual([]);
    expect(valid(addPlanting(base(), { ...d, keep: 'yes' as never }))).not.toEqual([]);
    expect(valid(addPlanting(base(), { ...d, snoozeUntil: 'soon' }))).not.toEqual([]);
  });
});
