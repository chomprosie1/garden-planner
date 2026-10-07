// UX release 3, daily use: this week on Today, Want to grow, and "What's
// happened?" for logging a planting's next step in one go.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { jobsFor } from '../src/calendar/jobs';
import { dayWords, upcoming, upcomingText, weekWindows } from '../src/calendar/week';
import { happenings, likelyNext, recordHappening } from '../src/lifecycle/happened';
import { currentStage } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import type { Garden, Plant, Planting } from '../src/model/types';
import { splitIntoBatches } from '../src/planting/batches';
import { addPlanting, makePlanting, unknownPlant } from '../src/planting/place';
import { sanitisePrefs } from '../src/theme/prefs';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);
const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) }), name: 'Veg bed' };
const base: Garden = addFeature({ ...newGarden(), latitude: 53.8, longitude: -1.55 }, bed);
const put = (g: Garden, pl: Planting) => addPlanting(g, pl);

describe('this week on Today', () => {
  it('says what each planting is likely to do this week and next, to do first', () => {
    const lettuce: Planting = { ...makePlanting(plant('lettuce'), bed.id, 'row', [200, 300], [2800, 300]), sowing: 'direct' };
    let g = put(base, lettuce);
    g = splitIntoBatches(g, lettuce.id, plant('lettuce'), 3, 21, '2027-04-05');
    const tomato: Planting = { ...makePlanting(plant('tomato'), bed.id, 'single', [500, 900]), sowing: 'indoors', sownOn: '2027-03-01', stage: 'transplanted', stageDates: { transplanted: '2027-05-20' } };
    g = put(g, tomato);
    const today = '2027-04-01';
    const w = weekWindows(today);
    const week = upcoming(g, plant, today, ...w.thisWeek);
    expect(week.map((u) => [u.plantId, u.stage, u.date, u.batch])).toEqual([['lettuce', 'sown', '2027-04-05', 'batch 1 of 3']]);
    expect(week[0]!.todo).toBe(true);
    expect(upcomingText(week[0]!, g, plant, today)).toBe('Lettuce (batch 1 of 3) in Veg bed: sow outside on Monday');
    // Ripe tomatoes, weeks later: something to look out for.
    const july = upcoming(g, plant, '2027-07-29', ...weekWindows('2027-07-29').thisWeek);
    expect(july.some((u) => u.plantId === 'tomato' && u.stage === 'harvesting' && !u.todo)).toBe(true);
  });

  it('puts rows of the same plant in a bed on one line', () => {
    const a: Planting = { ...makePlanting(plant('carrot'), bed.id, 'row', [200, 300], [2800, 300]), sowing: 'direct', sownOn: '2027-04-01' };
    const b: Planting = { ...makePlanting(plant('carrot'), bed.id, 'row', [200, 600], [2800, 600]), sowing: 'direct', sownOn: '2027-04-01' };
    const g = put(put(base, a), b);
    const list = upcoming(g, plant, '2027-04-02', '2027-04-01', '2027-06-30');
    const up = list.filter((u) => u.stage === 'germinated');
    expect(up).toHaveLength(1);
    expect(up[0]!.plantingIds.sort()).toEqual([a.id, b.id].sort());
  });

  it('says when in plain words', () => {
    expect(dayWords('2027-04-01', '2027-04-01')).toBe('today');
    expect(dayWords('2027-04-02', '2027-04-01')).toBe('tomorrow');
    expect(dayWords('2027-04-05', '2027-04-01')).toBe('on Monday');
    expect(dayWords('2027-04-12', '2027-04-01')).toBe('on 12 Apr');
  });
});

describe('Want to grow', () => {
  it('names the list the same way in the month’s jobs', () => {
    const g = { ...base, wishlist: ['tomato'] };
    expect(jobsFor(g, plant, 3, 2027).find((j) => j.plantId === 'tomato')!.where).toBe('on your Want to grow list');
  });
});

describe('“What’s happened?”', () => {
  const tomato = (extra: Partial<Planting> = {}): Planting => ({ ...makePlanting(plant('tomato'), bed.id, 'single', [500, 500]), ...extra });

  it('offers what could come next for the plant, and finishing or a failed sowing where they fit', () => {
    expect(happenings(plant('tomato'), tomato()).map((h) => h.label)).toEqual(['Sown']);
    expect(happenings(plant('lettuce'), { ...tomato(), plantId: 'lettuce' }).map((h) => h.id)).toEqual(['sown-indoors', 'sown-direct']);
    expect(happenings(plant('strawberry'), { ...tomato(), plantId: 'strawberry' }).map((h) => h.label)).toEqual(['Planted']);
    const sown = tomato({ sownOn: '2027-03-01', sowing: 'indoors' });
    expect(happenings(plant('tomato'), sown).map((h) => h.label)).toEqual(['It’s up', 'Hardening off', 'Planted out', 'Growing well', 'Flowering', 'First pick', 'Didn’t come up', 'Finished']);
    // Under glass there's no hardening off.
    expect(happenings(plant('tomato'), sown, true).map((h) => h.id)).not.toContain('hardening');
    expect(likelyNext(plant('tomato'), sown)).toBe('germinated');
    expect(happenings(plant('tomato'), tomato({ removedOn: '2027-10-01' }))).toEqual([]);
  });

  it('records the step and a note as one change, on the day you say', () => {
    const pl = tomato({ sownOn: '2027-03-01', sowing: 'indoors', stage: 'transplanted', stageDates: { transplanted: '2027-05-20' } });
    const g = recordHappening(put(base, pl), pl, plant('tomato'), 'flowering', '2027-06-30', ' First truss open ');
    const after = g.plantings.find((p) => p.id === pl.id)!;
    expect(after).toMatchObject({ stage: 'flowering', stageDates: { transplanted: '2027-05-20', flowering: '2027-06-30' } });
    expect(g.notes).toEqual([expect.objectContaining({ text: 'First truss open', date: '2027-06-30', plantingId: pl.id })]);
    // No note, no entry in the journal.
    expect(recordHappening(put(base, pl), pl, plant('tomato'), 'harvesting', '2027-07-30').notes).toEqual([]);
  });

  it('sows with the method you chose, finishes a planting, and handles a failed sowing', () => {
    const lettuce = { ...tomato(), plantId: 'lettuce' };
    const sown = recordHappening(put(base, lettuce), lettuce, plant('lettuce'), 'sown-direct', '2027-04-02').plantings[0]!;
    expect(sown).toMatchObject({ sownOn: '2027-04-02', sowing: 'direct' });
    const finished = recordHappening(put(base, sown), sown, plant('lettuce'), 'finished', '2027-06-20').plantings[0]!;
    expect(finished.removedOn).toBe('2027-06-20');
    const failed = recordHappening(put(base, sown), sown, plant('lettuce'), 'failed', '2027-04-30', 'Slugs');
    expect(currentStage(failed.plantings[0]!)).toBe('planned');
    expect(failed.notes.map((n) => n.text)).toEqual([expect.stringMatching(/sowing failed/), 'Slugs']);
  });
});

describe('first-visit tips', () => {
  it('are shown until you’ve seen them', () => {
    expect(sanitisePrefs({}).seenTips).toBe(false);
    expect(sanitisePrefs({ seenTips: true }).seenTips).toBe(true);
  });
});
