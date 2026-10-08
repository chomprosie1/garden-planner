// Release 14, feeding: the feeds (generic, no brands, priced), every plant's
// feeding notes, the months each feed goes on, feed jobs, the feed shelf, and
// what a season's feeding costs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobsFor, toggleJob } from '../src/calendar/jobs';
import { feedById, FEEDS, feedTip, priceText } from '../src/feeding/feeds';
import { costText, feedingDue, feedMonths, inGroundMonths, seasonFeeding, shelfFor, toBuy, toggleShelf } from '../src/feeding/schedule';
import { causesFor } from '../src/lifecycle/behind';
import { stageTips } from '../src/lifecycle/stages';
import { newAppState } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import type { Garden, Plant, Planting } from '../src/model/types';
import { validateGarden, validatePlant } from '../src/model/validate';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';

const DIR = join(__dirname, '..', 'data', 'plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const P = (id: string) => byId.get(id)!;

function garden(): { g: Garden; bed: string } {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
  return { g: addFeature(newAppState().garden, bed), bed: bed.id };
}
const put = (g: Garden, bed: string, id: string, extra: Partial<Planting> = {}): Garden => addPlanting(g, { ...makePlanting(P(id), bed, 'single', [500, 500]), ...extra });
const feedJobs = (g: Garden, month: number) => jobsFor(g, plantOf, month, 2027, { feeding: true }).filter((j) => j.kind === 'feed');

describe('the feeds', () => {
  it('has about fifteen generic feeds, organic and mineral, with unique ids', () => {
    expect(FEEDS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(FEEDS.map((f) => f.id)).size).toBe(FEEDS.length);
    expect(FEEDS.some((f) => f.kind === 'organic')).toBe(true);
    expect(FEEDS.some((f) => f.kind === 'mineral')).toBe(true);
  });

  it('gives each a rough NPK, how and when, an amount, and a price or a way to make it', () => {
    for (const f of FEEDS) {
      expect(f.npk.length, f.id).toBe(3);
      for (const n of f.npk) expect(n >= 0 && n <= 60, f.id).toBe(true);
      for (const t of [f.for, f.how, f.when, f.dose]) expect(t.length, f.id).toBeGreaterThan(5);
      expect(f.rate, f.id).toBeGreaterThan(0);
      expect(f.pack || f.homeMade, f.id).toBeTruthy();
      if (f.pack) {
        expect(f.pack.low, f.id).toBeGreaterThan(0);
        expect(f.pack.high, f.id).toBeGreaterThanOrEqual(f.pack.low);
        expect(f.pack.high, f.id).toBeLessThan(40);
      }
    }
    expect(priceText(feedById('blood-fish-bone')!)).toBe('about £6–9 for 3 kg');
    expect(priceText(feedById('comfrey-tea')!)).toBe('free, home-made');
  });

  it('never names a brand', () => {
    const text = JSON.stringify(FEEDS);
    expect(text).not.toMatch(/[™®]|growmore|miracle|tomorite|phostrogen|osmocote|levington|westland|vitax|chempak|maxicrop|baby bio|doff|toprose|gro-sure|envii/i);
  });
});

describe('every plant’s feeding', () => {
  it('every plant but the weeds has feeding notes, with real feeds, in the voice', () => {
    for (const p of library) {
      if (p.category === 'weed') {
        expect(p.feeding, p.id).toBeUndefined();
        continue;
      }
      expect(p.feeding, p.id).toBeDefined();
      expect(validatePlant(p), p.id).toEqual([]);
      for (const s of p.feeding!.steps) expect(feedById(s.feed), `${p.id} → ${s.feed}`).toBeDefined();
      for (const t of [...p.feeding!.steps.map((s) => s.note ?? ''), ...(p.feeding!.avoid ?? [])]) expect(t, p.id).not.toMatch(/\w!(\s|$)/);
    }
  });

  it('knows the hungry crops, the light feeders and the usual things to avoid', () => {
    expect(P('tomato').feeding!.need).toBe('hungry');
    expect(P('courgette').feeding!.need).toBe('hungry');
    expect(P('carrot').feeding!.need).toBe('light');
    expect(P('carrot').feeding!.avoid!.join(' ')).toMatch(/fresh manure/i);
    expect(P('blueberry').feeding!.avoid!.join(' ')).toMatch(/lime/i);
    expect(P('rosemary').feeding!.steps).toEqual([]);
  });

  it('refuses feeding with an unknown time or a silly interval', () => {
    const tomato = P('tomato');
    expect(validatePlant({ ...tomato, feeding: { need: 'greedy', steps: [] } })).toHaveLength(1);
    expect(validatePlant({ ...tomato, feeding: { need: 'hungry', steps: [{ when: 'monday', feed: 'tomato-feed' }] } })).toHaveLength(1);
    expect(validatePlant({ ...tomato, feeding: { need: 'hungry', steps: [{ when: 'growing', feed: 'tomato-feed', every: 2 }] } })).toHaveLength(1);
  });
});

describe('when each feed goes on', () => {
  it('tomatoes: weekly from the first flowers to September, nothing in October', () => {
    const step = P('tomato').feeding!.steps.find((s) => s.when === 'flowering')!;
    expect(feedMonths(P('tomato'), step)).toEqual([6, 7, 8, 9]);
  });

  it('spring feeds in March, or April if missed; a step’s own months win', () => {
    const rasp = P('raspberry');
    expect(feedMonths(rasp, rasp.feeding!.steps[0]!)).toEqual([3, 4]);
    const garlic = P('garlic');
    expect(feedMonths(garlic, garlic.feeding!.steps.find((s) => s.when === 'spring')!)).toEqual([3]);
  });

  it('after cropping: the month after the harvest ends', () => {
    const s = P('strawberry');
    expect(feedMonths(s, s.feeding!.steps.find((x) => x.when === 'after')!)).toEqual([s.cropping!.harvestMonths.at(-1)! + 1]);
  });

  it('while it grows: from the month after planting out, in the growing season, until it crops', () => {
    expect(inGroundMonths(P('leek'))[0]).toBe(P('leek').plantOutMonths![0]! + 1);
    const leek = P('leek');
    const months = feedMonths(leek, leek.feeding!.steps.find((s) => s.when === 'growing')!);
    expect(months.length).toBeGreaterThan(0);
    expect(months.every((m) => m >= 4 && m <= 9)).toBe(true);
    // Nothing before planting goes on by the month: it rides on the planting jobs.
    expect(feedingDue(P('courgette'), 5).map((d) => d.when)).not.toContain('planting');
  });
});

describe('feed jobs', () => {
  it('tomatoes planted out: a weekly feed job in July, with what to use, only when asked for', () => {
    const { g: g0, bed } = garden();
    const g = put(g0, bed, 'tomato', { sownOn: '2027-03-10', stage: 'transplanted', stageDates: { transplanted: '2027-05-20' } });
    const [job] = feedJobs(g, 7);
    expect(job).toMatchObject({ kind: 'feed', plantId: 'tomato', feeds: ['tomato-feed'] });
    expect(job!.detail).toMatch(/^Every week: liquid tomato feed/);
    expect(job!.key).toBe(`feed:tomato:${bed}:flowering:2027-07`);
    expect(jobsFor(g, plantOf, 7, 2027).some((j) => j.kind === 'feed')).toBe(false);
    expect(feedJobs(g, 10)).toEqual([]);
  });

  it('nothing for a planned planting, or seedlings still indoors', () => {
    const { g: g0, bed } = garden();
    expect(feedJobs(put(g0, bed, 'tomato'), 7)).toEqual([]);
    expect(feedJobs(put(g0, bed, 'tomato', { sownOn: '2027-03-10', stage: 'germinated' }), 7)).toEqual([]);
  });

  it('a spring feed ticked in March isn’t asked for again in April; missed, it is', () => {
    const { g: g0, bed } = garden();
    let g = put(g0, bed, 'raspberry', { stage: 'vegetative', stageDates: { transplanted: '2025-11-01', vegetative: '2026-04-01' } });
    const march = feedJobs(g, 3);
    expect(march).toHaveLength(1);
    expect(march[0]!.detail).toMatch(/Blood, fish and bone.*Sulphate of potash.*Well-rotted manure/);
    expect(feedJobs(g, 4)).toHaveLength(1);
    g = toggleJob(g, march[0]!, '2027-03-14');
    expect(feedJobs(g, 4)).toEqual([]);
  });

  it('what goes in before planting rides on the planting-out job', () => {
    const { g: g0, bed } = garden();
    const g = put(g0, bed, 'courgette', { sownOn: '2027-04-20' });
    const out = jobsFor(g, plantOf, 6, 2027, { feeding: true }).find((j) => j.kind === 'plant-out')!;
    expect(out.detail).toMatch(/Before planting: well-rotted manure/);
    expect(jobsFor(g, plantOf, 6, 2027).find((j) => j.kind === 'plant-out')!.detail ?? '').not.toMatch(/manure/);
  });
});

describe('feeding in the advice', () => {
  it('the stage tips end with a line on feeding', () => {
    expect(stageTips(P('tomato'), 'flowering').at(-1)).toMatch(/^Feeding, every week from the first flowers: liquid tomato feed/);
    expect(stageTips(P('strawberry'), 'harvesting').at(-1)).toMatch(/^Feeding, after it crops/);
    expect(stageTips(P('carrot'), 'vegetative').join(' ')).not.toMatch(/Feeding/);
    expect(feedTip(P('rosemary'), 'vegetative')).toBeUndefined();
  });

  it('running behind: a hungry crop slow to grow is likely short of food; too much feed is a cause too', () => {
    expect(causesFor(P('leek'), 'vegetative')[0]).toMatch(/^Hungry: leek is a hungry crop/);
    expect(causesFor(P('carrot'), 'vegetative')[0]).not.toMatch(/Hungry/);
    expect(causesFor(P('tomato'), 'harvesting').join(' ')).toMatch(/Too much nitrogen feed/);
  });
});

describe('the feed shelf and a season’s feeding', () => {
  it('works out the season’s feed for what’s on the plan, with a rough cost', () => {
    const { g: g0, bed } = garden();
    let g = put(g0, bed, 'courgette');
    g = put(g, bed, 'tomato');
    g = put(g, bed, 'rosemary');
    const s = seasonFeeding(g, plantOf);
    const ids = s.uses.map((u) => u.feed.id).sort();
    expect(ids).toEqual(['garden-compost', 'rotted-manure', 'tomato-feed']);
    const tomatoFeed = s.uses.find((u) => u.feed.id === 'tomato-feed')!;
    expect(tomatoFeed.plantIds.sort()).toEqual(['courgette', 'tomato']);
    expect(tomatoFeed.amount).toBeGreaterThan(0);
    expect(s.high).toBeGreaterThan(s.low);
    expect(s.uses.find((u) => u.feed.id === 'garden-compost')!.high).toBe(0); // home-made
    expect(costText(s.low, s.high)).toMatch(/^about £\d+(–\d+)?$|^under £1$/);
  });

  it('leaves out weeds, cleared plantings and plants without notes', () => {
    const { g: g0, bed } = garden();
    let g = put(g0, bed, 'dandelion');
    g = put(g, bed, 'tomato', { removedOn: '2027-09-01' });
    expect(seasonFeeding(g, plantOf).uses).toEqual([]);
  });

  it('knows what’s on the shelf, what stands in for what, and what’s still to get', () => {
    const { g: g0, bed } = garden();
    let g = put(put(g0, bed, 'raspberry'), bed, 'tomato');
    expect(toBuy(seasonFeeding(g, plantOf)).map((u) => u.feed.id)).toContain('blood-fish-bone');
    g = toggleShelf(g, 'balanced-granular');
    expect(shelfFor(g, 'blood-fish-bone')).toBe('balanced-granular');
    expect(shelfFor(g, 'tomato-feed')).toBeNull();
    expect(toBuy(seasonFeeding(g, plantOf)).map((u) => u.feed.id)).not.toContain('blood-fish-bone');
    g = toggleShelf(g, 'balanced-granular');
    expect(g.feedShelf).toEqual([]);
  });

  it('cost text reads naturally', () => {
    expect(costText(0, 0)).toBe('nothing');
    expect(costText(0.2, 0.6)).toBe('under £1');
    expect(costText(12.4, 18.2)).toBe('about £12–19');
    expect(costText(3, 3)).toBe('about £3');
  });
});

describe('saving the shelf (schema 15)', () => {
  it('a v14 garden comes up to date, and a shelf saves and loads', () => {
    const old = { ...newAppState().garden, schemaVersion: 14 };
    const g = migrateGarden(old) as Garden;
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(15);
    expect(g.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateGarden({ ...g, feedShelf: ['tomato-feed', 'bonemeal'] })).toEqual([]);
    expect(validateGarden({ ...g, feedShelf: 'tomato-feed' })).toHaveLength(1);
    expect(validateGarden({ ...g, feedShelf: ['Tomato Feed!'] })).toHaveLength(1);
  });
});
