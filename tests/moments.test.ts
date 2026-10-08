// Release 12: small seasonal moments on Today. The first frost of autumn, the
// first pick of the year, the last frost passing, and midsummer and midwinter;
// one at a time, and only while they're fresh.

import { describe, expect, it } from 'vitest';
import vegetables from '../data/plants/vegetable.json';
import { momentFor } from '../src/calendar/moments';
import { addDays } from '../src/model/dates';
import { newGarden } from '../src/model/defaults';
import type { Garden, Plant } from '../src/model/types';
import { unknownPlant } from '../src/planting/place';
import type { Weather } from '../src/weather/weather';

const lib = vegetables as Plant[];
const plantOf = (id: string) => lib.find((p) => p.id === id) ?? unknownPlant(id);

/** Weather from a day: each day's lowest, given; mild by day, dry. */
function weather(from: string, mins: number[], today: string): Weather {
  return { from, tmax: mins.map((m) => m + 8), tmin: mins, rain: mins.map(() => 0), today, fetchedAt: `${today}T06:00:00Z`, lat: 52.5, lon: -1.5 };
}

const picked = (dates: string[], plantId = 'tomato'): Garden => ({
  ...newGarden(),
  lastFrost: '04-20',
  plantings: [{ id: 'p1', plantId, featureId: 'f1', x: 0, y: 0, picks: dates.map((date) => ({ date, grams: 200 })) }],
});

describe('moments on Today', () => {
  it('nothing on an ordinary day', () => {
    expect(momentFor(newGarden(), plantOf, '2026-10-08')).toBeNull();
  });

  it('the first frost of autumn, when one is forecast and there’s been none since August', () => {
    const today = '2026-10-20';
    const from = '2026-08-01';
    // 1 August to 20 October is 80 days: today is day 80, and the weather runs a week past it.
    const mins = Array.from({ length: 87 }, () => 8);
    mins[82] = -1; // two days after today
    expect(addDays(from, 80)).toBe(today);
    const m = momentFor(newGarden(), plantOf, today, weather(from, mins, today))!;
    expect(m.kind).toBe('first-frost');
    expect(m.line).toMatch(/^Likely early on /);
    // A frost already this autumn: not the first.
    const earlier = [...mins];
    earlier[60] = 0;
    expect(momentFor(newGarden(), plantOf, today, weather(from, earlier, today))?.kind).not.toBe('first-frost');
    // In spring a frost isn't an autumn moment.
    expect(momentFor(newGarden(), plantOf, '2026-03-10', weather('2026-03-01', [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, -2, 5, 5, 5, 5], '2026-03-10'))?.kind).not.toBe('first-frost');
  });

  it('the first pick of the year, for a few days', () => {
    const m = momentFor(picked(['2026-07-20']), plantOf, '2026-07-21')!;
    expect(m.kind).toBe('first-pick');
    expect(m.title).toBe('The first tomato of the year');
    expect(m.plantId).toBe('tomato');
    expect(momentFor(picked(['2026-07-20']), plantOf, addDays('2026-07-20', 3))).toBeNull();
    // Not the first: there was one earlier this year.
    expect(momentFor(picked(['2026-07-01', '2026-07-20']), plantOf, '2026-07-21')).toBeNull();
    // Last year's picks don't count.
    expect(momentFor(picked(['2025-08-01', '2026-07-20']), plantOf, '2026-07-21')?.kind).toBe('first-pick');
  });

  it('the average last frost, just passed', () => {
    const g = { ...newGarden(), lastFrost: '04-20' };
    expect(momentFor(g, plantOf, '2026-04-20')).toBeNull();
    expect(momentFor(g, plantOf, '2026-04-21')?.kind).toBe('last-frost');
    expect(momentFor(g, plantOf, '2026-04-24')).toBeNull();
  });

  it('midsummer and midwinter, a day either side', () => {
    expect(momentFor(newGarden(), plantOf, '2026-06-21')?.kind).toBe('midsummer');
    expect(momentFor(newGarden(), plantOf, '2026-06-23')).toBeNull();
    expect(momentFor(newGarden(), plantOf, '2026-12-20')?.kind).toBe('midwinter');
  });

  it('one at a time: a first pick beats midsummer', () => {
    expect(momentFor(picked(['2026-06-20']), plantOf, '2026-06-21')?.kind).toBe('first-pick');
  });
});
