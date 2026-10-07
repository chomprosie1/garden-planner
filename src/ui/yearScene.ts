// The plan on a day, for the renderer: each planting's stage then, shadows
// from that day's sun, the lawn in its season, frost, and beds standing empty.
// Used by the plan, the share picture and the timelapse.

import type { TimeScene } from '../canvas/render';
import { gapsOn, stageIn, type Gap, type Step } from '../lifecycle/projection';
import { frostDates } from '../lifecycle/shed';
import type { Garden, Plant, Planting, Point } from '../model/types';
import { fromUkClock, shadowOffset, sunAt } from '../sun/position';

/** The lawn through the year: greener in spring, paler in a dry late summer, dull in winter. */
const LAWN_BY_MONTH = [-0.3, -0.3, 0.3, 0.8, 0.9, 0.3, -0.3, -0.8, -0.4, 0, -0.2, -0.3];

/** Which way shadows fall on screen at 1 pm on a day, and how long: short at midsummer, long in winter. */
export function lightOn(g: Garden, date: string): Point | null {
  const off = shadowOffset(1000, sunAt(fromUkClock(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)), 13, 0), g.latitude, g.longitude), g.northRotationDeg);
  if (!off) return null;
  const len = Math.hypot(off[0], off[1]);
  // Scaled so a sun about 48° up casts the usual shadow, at most a little over twice that.
  const k = (1.14 * Math.min(2.2, Math.max(0.6, len / 900))) / len;
  return [off[0] * k, -off[1] * k];
}

/**
 * The 1st or 15th nearest a day. The light only changes twice a month, so scrubbing week by week mostly shows
 * the same picture and needn't redraw it.
 */
export function halfMonth(date: string): string {
  const day = Number(date.slice(8, 10));
  if (day <= 7) return `${date.slice(0, 8)}01`;
  if (day <= 22) return `${date.slice(0, 8)}15`;
  const [y, m] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Between the first autumn frost and the last spring frost. */
export function frostyOn(g: Garden, date: string): boolean {
  const { lastFrost, firstFrost } = frostDates(g);
  const md = date.slice(5);
  return md >= firstFrost || md <= lastFrost;
}

export interface YearScene {
  time: TimeScene;
  gaps: Gap[];
  stageAt: TimeScene['stageOf'];
  month: number;
}

export function yearScene(g: Garden, plantOf: (id: string) => Plant, timelines: Map<string, Step[]>, date: string, ideaOf: (id: string) => Plant | null): YearScene {
  const stageAt = (pl: Planting) => stageIn(timelines.get(pl.id) ?? [], date);
  const gaps = gapsOn(g, plantOf, timelines, date, ideaOf);
  const month = Number(date.slice(5, 7));
  return {
    time: { stageOf: stageAt, light: lightOn(g, halfMonth(date)), lawn: LAWN_BY_MONTH[month - 1]!, frost: frostyOn(g, date), gaps: new Set(gaps.map((x) => x.bed.id)) },
    gaps,
    stageAt,
    month,
  };
}
