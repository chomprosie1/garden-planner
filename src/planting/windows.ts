// When something goes in, and what goes in: a plant's sowing and planting
// windows, the one open now or coming next, and the words for it ("Sow outside
// now, until Nov", "Next: plant Feb–Mar"). What you sow or plant: seed, onion
// sets, garlic cloves, seed potatoes, bulbs, or plants. Pure functions.

import { runsOf } from '../lifecycle/growth';
import { shortDate, type Step } from '../lifecycle/projection';
import { addDays, plantOutMonthsUnder } from '../lifecycle/shed';
import { monthRanges } from '../library/library';
import type { Climate, Plant, Planting, Sowing, SowingFrom } from '../model/types';
import { plantingStatus } from './place';

/** What goes in the ground (or the tray) to start it. */
export type StartsAs = 'seed' | SowingFrom | 'bulbs' | 'plants';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The sowings a planting can take: all of the plant's, or the ones that match how you said it's sown. */
function sowingsFor(plant: Plant, pl?: Planting): Sowing[] {
  const all = plant.sowing ?? [];
  if (!pl?.sowing) return all;
  const match = all.filter((s) => (pl.sowing === 'direct' ? s.method === 'direct' : s.method !== 'direct'));
  return match.length ? match : all;
}

/** A window: one run of months, and whether it's open in the month asked about. */
interface Window {
  sowing: Sowing | null;
  run: number[];
  open: boolean;
}

/** The run of months open in `month`, or else the next to open. Null when there are no months. */
function pick(options: { sowing: Sowing | null; months: number[] }[], month: number): Window | null {
  let best: (Window & { ahead: number }) | null = null;
  for (const o of options)
    for (const run of runsOf(o.months)) {
      const open = run.includes(month);
      const ahead = open ? 0 : (run[0]! - month + 12) % 12;
      if (!best || ahead < best.ahead) best = { sowing: o.sowing, run, open, ahead };
    }
  return best && { sowing: best.sowing, run: best.run, open: best.open };
}

/** The sowing open in `month`, or the next one: the one a job or a planting's next step is about. Null with none. */
export function sowingNow(plant: Plant, month: number, pl?: Planting): Sowing | null {
  return pick(sowingsFor(plant, pl).map((s) => ({ sowing: s, months: s.months })), month)?.sowing ?? null;
}

/**
 * What a plant starts as: the seed, sets, cloves or tubers of the sowing open in `month` (or the next one), bulbs for a
 * bulb that's never sown, or plants.
 */
export function startsAs(plant: Plant, month: number, pl?: Planting): StartsAs {
  const s = sowingNow(plant, month, pl);
  if (s) return s.from ?? 'seed';
  return plant.art?.form === 'bulb' ? 'bulbs' : 'plants';
}

/** Sown as seed: what's sown. Anything else (sets, cloves, tubers, bulbs, plants) is planted. */
export const isSown = (from: StartsAs) => from === 'seed';

/** "Sow outside", "Sow under cover", or "Plant" for sets, cloves and tubers. */
export function sowingVerb(s: Sowing): string {
  if (s.from) return 'Plant';
  return s.method === 'direct' ? 'Sow outside' : 'Sow under cover';
}

/** "now, until Nov" for a window that's open; "Feb–Apr" for one to come. */
const when = (w: Window) => (w.open ? (w.run.length === 12 ? 'now' : `now, until ${MONTHS[w.run[w.run.length - 1]! - 1]}`) : monthRanges(w.run));

/** "Sow outside now, until Nov" or "Next: sow outside Feb–Apr". */
const line = (verb: string, w: Window) => (w.open ? `${verb} ${when(w)}` : `Next: ${verb.charAt(0).toLowerCase()}${verb.slice(1)} ${when(w)}`);

/**
 * A planting's next step, from where it is in its life and the month: the sowing or planting window open now, or the
 * next to open, so it agrees with the month's jobs. A planned planting with a date to sow by goes by that month. Under
 * a greenhouse or cold frame, planting out starts sooner. Given its timeline, a sowing's planting out goes by the
 * timeline's day, so the two can't disagree. Null when there's nothing to say.
 */
export function nextStep(pl: Planting, plant: Plant, month: number, under: Climate | null = null, steps: Step[] = [], today?: string): string | null {
  const status = plantingStatus(pl);
  const harvest = plant.cropping?.harvestMonths.length ? `Harvest ${monthRanges(plant.cropping.harvestMonths)}` : null;
  const outMonths = plantOutMonthsUnder(plant, under);
  const at = pl.sowBy && status === 'planned' ? Number(pl.sowBy.slice(5, 7)) : month;
  // Chosen by the month it's meant for; open or not by this month.
  const now = (w: Window | null): Window | null => w && { ...w, open: w.run.includes(month) };
  const out = now(pick([{ sowing: null, months: outMonths }], at));
  if (status === 'planned') {
    const w = now(pick(sowingsFor(plant, pl).map((s) => ({ sowing: s, months: s.months })), at));
    if (w?.sowing) return line(sowingVerb(w.sowing), w);
    // Never sown: bulbs and plants are planted, in their planting-out months.
    return out ? line('Plant', out) : harvest;
  }
  if (status === 'sown') {
    const indoors = pl.sowing ? pl.sowing === 'indoors' : plant.sowing?.some((s) => s.method !== 'direct') && !plant.sowing?.some((s) => s.method === 'direct');
    const expected = today ? steps.find((s) => s.guessed && s.stage === 'transplanted' && s.date) : undefined;
    if (indoors && expected && today) return expected.date! <= addDays(today, 6) ? 'Plant out now' : `Next: plant out from about ${shortDate(expected.date!)}`;
    return (indoors && out && line('Plant out', out)) || harvest;
  }
  if (status === 'growing') return harvest;
  return null;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * For a plant page out of season: when it can start, if nothing can be sown or planted in `month`. "Not now: sow under
 * cover from February, then plant out from May." Null when something can be done now, or the plant gives no months.
 */
export function notNow(plant: Plant, month: number): string | null {
  if (plant.category === 'weed') return null;
  const sowings = plant.sowing ?? [];
  const out = plant.plantOutMonths ?? [];
  if (sowings.some((s) => s.months.includes(month)) || out.includes(month)) return null;
  const sow = pick(sowings.map((s) => ({ sowing: s, months: s.months })), month);
  // Plants out after the sowing it follows, or the next planting-out run if it's never sown.
  const outFrom = sow?.sowing && sow.sowing.method !== 'direct' && !sow.sowing.from ? pick([{ sowing: null, months: out }], sow.run[0]!) : null;
  const parts: string[] = [];
  if (sow?.sowing) parts.push(`${sowingVerb(sow.sowing).toLowerCase()} from ${MONTH_NAMES[sow.run[0]! - 1]}`);
  if (outFrom) parts.push(`plant out from ${MONTH_NAMES[outFrom.run[0]! - 1]}`);
  if (!parts.length && out.length) {
    const w = pick([{ sowing: null, months: out }], month)!;
    parts.push(`plant from ${MONTH_NAMES[w.run[0]! - 1]}`);
  }
  return parts.length ? `Not now: ${parts.join(', then ')}.` : null;
}

/** "seed", "onion sets", "garlic cloves", "seed potatoes", "bulbs", "plants": what to buy, in words. */
export function buyWord(from: StartsAs, plant: Plant): string {
  switch (from) {
    case 'sets':
      return 'sets';
    case 'cloves':
      return 'cloves';
    case 'tubers':
      return plant.id === 'potato' || plant.varietyOf === 'potato' ? 'seed potatoes' : 'tubers';
    case 'bulbs':
      return 'bulbs';
    case 'plants':
      return 'plants';
    default:
      return 'seed';
  }
}
