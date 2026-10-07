// The Potting Shed: seeds sown in trays and pots, raised on shelves,
// windowsills, a propagator or a cold frame, until they're ready to plant
// out. A tray has no place on the plan; planting it out turns it into a
// planting in a bed, keeping its sowing date and stages.
//
// Pure functions: garden in, garden out, so each edit is one undo step.

import { frostShiftDays, microclimateOf, placeClimate, type Cover } from '../climate/microclimate';
import { featureLabel } from '../model/features';
import { newId } from '../model/ids';
import { addNote, makeNote } from '../model/notes';
import type { Climate, Container, Garden, Plant, Planting, ShedPlace, ShedPlaceKind, Tray, TrayStage } from '../model/types';
import { currentStage, setStage } from './stages';

// ---------- Dates ----------

const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => toIso(new Date(toDate(iso).getTime() + days * DAY));
export const daysBetween = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY);

/** "MM-DD" for a day of the year, in a year that isn't a leap year. */
const monthDay = (dayOfYear: number) => toIso(new Date(Date.UTC(2027, 0, Math.round(dayOfYear)))).slice(5);

/**
 * Average frost dates for a latitude in the UK and nearby: about 20 April on the south coast to the end of May in
 * the north of Scotland for the last spring frost, and early November to the start of October for the first autumn
 * frost. Rough averages: a frost pocket or a coastal garden can be weeks either side, so you can set your own.
 */
export function estimateFrost(latitude: number): { lastFrost: string; firstFrost: string } {
  const k = Math.max(-2, Math.min(10, latitude - 50));
  return { lastFrost: monthDay(110 + k * 5), firstFrost: monthDay(314 - k * 5) };
}

/** The garden's frost dates: your own, or estimated from its latitude. */
export function frostDates(g: Garden): { lastFrost: string; firstFrost: string; estimated: boolean } {
  const est = estimateFrost(g.latitude);
  return { lastFrost: g.lastFrost ?? est.lastFrost, firstFrost: g.firstFrost ?? est.firstFrost, estimated: !g.lastFrost && !g.firstFrost };
}

/**
 * Frost dates under a greenhouse or cold frame: the last spring frost comes sooner and the first autumn frost later, by
 * about a week for each degree warmer at night. Null under a heated greenhouse, which is kept frost-free.
 */
export function frostDatesUnder(g: Garden, c: Climate | null): { lastFrost: string; firstFrost: string } | null {
  const f = frostDates(g);
  if (!c) return f;
  if (c.heated) return null;
  const shift = frostShiftDays(c);
  const last = addDays(`2027-${f.lastFrost}`, -shift);
  const first = addDays(`2027-${f.firstFrost}`, shift);
  return { lastFrost: last < '2027-01-01' ? '01-01' : last.slice(5), firstFrost: first > '2027-12-31' ? '12-31' : first.slice(5) };
}

/** A "MM-DD" date in a year, as ISO. */
export const inYear = (md: string, year: number) => `${year}-${md}`;

// ---------- Places ----------

export const PLACE_LABEL: Record<ShedPlaceKind, string> = {
  shelves: 'Shelves',
  windowsill: 'Windowsill',
  propagator: 'Propagator',
  'greenhouse-bench': 'Greenhouse bench',
  'cold-frame': 'Cold frame',
};

/** A sensible size for each kind of place: shelves, and trays per shelf. */
export const PLACE_SIZE: Record<ShedPlaceKind, [number, number]> = {
  shelves: [3, 4],
  windowsill: [1, 4],
  propagator: [1, 3],
  'greenhouse-bench': [2, 5],
  'cold-frame': [1, 4],
};

export function makePlace(kind: ShedPlaceKind, name = PLACE_LABEL[kind]): ShedPlace {
  const [shelves, slots] = PLACE_SIZE[kind];
  return { id: newId('s'), kind, name, shelves, slots };
}

/** Where seeds go when you start: a windowsill, a propagator and some shelves. */
export const defaultPlaces = (): ShedPlace[] => [makePlace('windowsill'), makePlace('propagator'), makePlace('shelves', 'Shed shelves')];

export const placesOf = (g: Garden): ShedPlace[] => g.shedPlaces ?? [];
export const traysOf = (g: Garden): Tray[] => g.trays ?? [];

/** The garden with places to put trays, adding the usual ones if there are none yet. */
export const ensurePlaces = (g: Garden): Garden => (placesOf(g).length ? g : { ...g, shedPlaces: defaultPlaces() });

export function addPlace(g: Garden, place: ShedPlace): Garden {
  return { ...g, shedPlaces: [...placesOf(g), place] };
}

/** Changes a place's name, size, or the greenhouse or cold frame it's in. Trays that no longer fit move to the first free spaces. */
export function updatePlace(g: Garden, id: string, patch: Partial<Pick<ShedPlace, 'name' | 'shelves' | 'slots' | 'featureId'>>): Garden {
  const shedPlaces = placesOf(g).map((p) => (p.id === id ? { ...p, ...patch, shelves: Math.max(1, Math.min(8, patch.shelves ?? p.shelves)), slots: Math.max(1, Math.min(12, patch.slots ?? p.slots)) } : p));
  let next: Garden = { ...g, shedPlaces };
  const place = shedPlaces.find((p) => p.id === id);
  if (!place) return g;
  for (const t of traysOf(next).filter((t) => t.placeId === id && (t.shelf >= place.shelves || t.slot >= place.slots))) {
    const spot = freeSpot(next);
    if (spot) next = { ...next, trays: traysOf(next).map((x) => (x.id === t.id ? { ...x, ...spot } : x)) };
  }
  return next;
}

/** Removes an empty place. A place with trays on it stays. */
export function removePlace(g: Garden, id: string): Garden {
  if (traysOf(g).some((t) => t.placeId === id)) return g;
  return { ...g, shedPlaces: placesOf(g).filter((p) => p.id !== id) };
}

export type Spot = Pick<Tray, 'placeId' | 'shelf' | 'slot'>;

export const trayAt = (g: Garden, s: Spot): Tray | undefined => traysOf(g).find((t) => t.placeId === s.placeId && t.shelf === s.shelf && t.slot === s.slot);

/** The first free space, in a given place if it has room, otherwise anywhere. */
export function freeSpot(g: Garden, prefer?: string): Spot | null {
  const places = placesOf(g);
  const order = prefer ? [...places.filter((p) => p.id === prefer), ...places.filter((p) => p.id !== prefer)] : places;
  for (const p of order)
    for (let shelf = 0; shelf < p.shelves; shelf++)
      for (let slot = 0; slot < p.slots; slot++) if (!trayAt(g, { placeId: p.id, shelf, slot })) return { placeId: p.id, shelf, slot };
  return null;
}

// ---------- Trays ----------

export const CONTAINER_LABEL: Record<Container, string> = {
  'module-tray': 'Module tray',
  'seed-tray': 'Seed tray',
  'pot-9cm': '9 cm pots',
  'pot-1l': '1 litre pots',
  'root-trainer': 'Root trainers',
};

/** How many seedlings each container usually holds, to start with. */
export const CONTAINER_COUNT: Record<Container, number> = { 'module-tray': 24, 'seed-tray': 30, 'pot-9cm': 6, 'pot-1l': 4, 'root-trainer': 16 };

export const trayStage = (t: Tray): TrayStage => t.stage ?? 'sown';

export interface SowOptions {
  container?: Container;
  count?: number;
  placeId?: string;
  date: string;
}

/** Sows a tray of a plant, in the first free space (in the chosen place if it has room). Returns the garden and the tray's id. */
export function sowInTray(g: Garden, plant: Plant, o: SowOptions): [Garden, string | null] {
  const withPlaces = ensurePlaces(g);
  let spot = freeSpot(withPlaces, o.placeId);
  let next = withPlaces;
  if (!spot) {
    // Every space is full: put up another set of shelves.
    const extra = makePlace('shelves', `More shelves ${placesOf(next).length + 1}`);
    next = addPlace(next, extra);
    spot = { placeId: extra.id, shelf: 0, slot: 0 };
  }
  const container = o.container ?? (plant.size.spreadMm && plant.size.spreadMm >= 400 ? 'pot-9cm' : 'module-tray');
  const tray: Tray = { id: newId('t'), plantId: plant.id, container, count: Math.max(1, Math.round(o.count ?? CONTAINER_COUNT[container])), sownOn: o.date, ...spot };
  return [{ ...next, trays: [...traysOf(next), tray] }, tray.id];
}

export function updateTray(g: Garden, id: string, patch: Partial<Pick<Tray, 'container' | 'count' | 'sownOn'>>): Garden {
  if (!traysOf(g).some((t) => t.id === id)) return g;
  return { ...g, trays: traysOf(g).map((t) => (t.id === id ? { ...t, ...patch, ...(patch.count !== undefined ? { count: Math.max(1, Math.round(patch.count)) } : {}) } : t)) };
}

/** Moves a tray to a space. If another tray is there, they swap. */
export function moveTray(g: Garden, id: string, to: Spot): Garden {
  const tray = traysOf(g).find((t) => t.id === id);
  const place = placesOf(g).find((p) => p.id === to.placeId);
  if (!tray || !place || to.shelf < 0 || to.slot < 0 || to.shelf >= place.shelves || to.slot >= place.slots) return g;
  if (tray.placeId === to.placeId && tray.shelf === to.shelf && tray.slot === to.slot) return g;
  const other = trayAt(g, to);
  const from: Spot = { placeId: tray.placeId, shelf: tray.shelf, slot: tray.slot };
  return { ...g, trays: traysOf(g).map((t) => (t.id === id ? { ...t, ...to } : other && t.id === other.id ? { ...t, ...from } : t)) };
}

/** Moves a tray on (or back) to a stage. Going back drops the dates of the stages after it. */
export function setTrayStage(g: Garden, id: string, stage: TrayStage, date: string): Garden {
  return {
    ...g,
    trays: traysOf(g).map((t) => {
      if (t.id !== id) return t;
      const { stage: _s, stageDates: _d, ...rest } = t;
      if (stage === 'sown') return rest;
      const dates = { ...(stage === 'hardening' && t.stageDates?.germinated ? { germinated: t.stageDates.germinated } : {}), [stage]: t.stageDates?.[stage] ?? date };
      if (stage === 'hardening' && !dates.germinated) dates.germinated = date;
      return { ...rest, stage, stageDates: dates };
    }),
  };
}

export function removeTray(g: Garden, id: string): Garden {
  const trays = traysOf(g).filter((t) => t.id !== id);
  return trays.length === traysOf(g).length ? g : { ...g, trays };
}

/** A sowing that didn't come up: the tray goes, with a note in the journal. */
export function failTray(g: Garden, id: string, plantName: string, date: string): Garden {
  const t = traysOf(g).find((x) => x.id === id);
  if (!t) return g;
  return addNote(removeTray(g, id), makeNote(`${plantName}: a ${CONTAINER_LABEL[t.container].toLowerCase()} sown ${t.sownOn} didn't come to anything.`, date));
}

/**
 * Plants a tray out: the planting (placed by the Plant tool) carries the tray's sowing date and stages, and is
 * marked planted out today. The tray leaves the shed.
 */
export function plantOutTray(g: Garden, trayId: string, pl: Planting, date: string): Garden {
  const t = traysOf(g).find((x) => x.id === trayId);
  if (!t) return g;
  const planting: Planting = { ...pl, sownOn: t.sownOn, sowing: 'indoors', stage: 'transplanted', stageDates: { ...(t.stageDates ?? {}), transplanted: date } };
  return { ...removeTray(g, trayId), plantings: [...g.plantings, planting] };
}

// ---------- What's next ----------

/** Tender and half-hardy plants can't take a frost: they wait until after the last one to go out. */
export const isTender = (p: Plant) => /^\s*(tender|half-hardy)/i.test(p.conditions.hardiness ?? '');

export const germination = (p: Plant): [number, number] => p.germinationDays ?? [7, 21];

/** The day to start hardening off: two weeks before the last frost for tender plants, two weeks before planting-out time for the rest. */
export function hardenFrom(p: Plant, g: Garden, year: number): string {
  const { lastFrost } = frostDates(g);
  if (isTender(p) || !p.plantOutMonths?.length) return addDays(inYear(lastFrost, year), -14);
  const first = Math.min(...p.plantOutMonths.filter((m) => m >= 2 && m <= 9).concat(p.plantOutMonths));
  return addDays(`${year}-${String(first).padStart(2, '0')}-01`, -14);
}

/** The earliest day it can go out: after a week of hardening off, and for tender plants, after the last frost. */
export function plantOutFrom(p: Plant, g: Garden, hardenedFrom: string): string {
  const year = Number(hardenedFrom.slice(0, 4));
  const week = addDays(hardenedFrom, 7);
  if (!isTender(p)) return week;
  const frost = inYear(frostDates(g).lastFrost, year);
  return week > frost ? week : frost;
}

/**
 * Under cover there's no hardening off: seedlings go in once they've had about four weeks to grow on, and tender ones
 * not before the last frost under the glass. A heated greenhouse takes them whenever they're ready.
 */
export function plantInFrom(p: Plant, g: Garden, upOn: string, c: Climate): string {
  const ready = addDays(upOn, 28);
  const frost = frostDatesUnder(g, c);
  if (!frost || !isTender(p)) return ready;
  const last = inYear(frost.lastFrost, Number(ready.slice(0, 4)));
  return ready > last ? ready : last;
}

const monthStart = (m: number) => `2027-${String(m).padStart(2, '0')}-01`;

/**
 * The months a plant can go out, under cover: its usual months, starting sooner by the cover's head start. A month
 * counts once there's at least a week of it, so a greenhouse adds the month before and a cold frame's week doesn't.
 */
export function plantOutMonthsUnder(p: Plant, c: Climate | null): number[] {
  const months = p.plantOutMonths ?? [];
  if (!c || !months.length) return months;
  const shift = frostShiftDays(c);
  const set = new Set(months);
  for (const m of months) {
    if (set.size === 12 || months.includes(m === 1 ? 12 : m - 1)) continue; // not the start of a run
    // From the earliest day it can go in (plus the week that makes a month count) up to the run's first month.
    let k = Number(addDays(monthStart(m), 7 - shift).slice(5, 7));
    while (k !== m) {
      set.add(k);
      k = (k % 12) + 1;
    }
  }
  return [...set].sort((a, b) => a - b);
}

export interface Next {
  /** What to do or expect, in a sentence. */
  text: string;
  /** Ready to plant out now. */
  ready: boolean;
  /** Worth doing something about today. */
  due: boolean;
}

/** Where seedlings are, and where they're going: the climate of their place in the shed, and the cover they'll be planted under. */
export interface Under {
  place?: Climate | null;
  into?: Cover | null;
}

/** A cold frame's usual gain by day: unheated places this warm or cooler are where seedlings harden off. */
const COLD_FRAME_DAY = 4;

/** What's next for seedlings at a stage, sown on a date. Shared by trays and plantings still indoors. */
export function nextFor(p: Plant, g: Garden, stage: TrayStage, sownOn: string, stageDates: Partial<Record<'germinated' | 'hardening', string>>, today: string, under: Under = {}): Next {
  const [min, max] = germination(p);
  if (stage === 'sown') {
    const age = daysBetween(sownOn, today);
    if (age < min) return { text: `Seedlings due from ${short(addDays(sownOn, min))}. Keep the compost just moist.`, ready: false, due: false };
    if (age <= max) return { text: `Seedlings due any day now, up to ${short(addDays(sownOn, max))}.`, ready: false, due: true };
    return { text: `Not up after ${Math.round(age / 7)} weeks? If nothing shows soon, the sowing may have failed.`, ready: false, due: true };
  }
  const year = Number(today.slice(0, 4));
  const coldFrame = !!under.place && !under.place.heated && under.place.dayGainC <= COLD_FRAME_DAY;
  if (stage === 'germinated') {
    if (under.into) {
      // Going under glass: no hardening off, just time to grow on (and for tender plants, frost-free nights in there).
      const from = plantInFrom(p, g, stageDates.germinated ?? addDays(sownOn, min), under.into.climate);
      const where = featureLabel(under.into.feature);
      if (today >= from) return { text: `Ready to go into the ${where}. No need to harden off.`, ready: true, due: true };
      return { text: `Pot on when roots show at the bottom. It can go into the ${where} from ${short(from)}, with no hardening off.`, ready: false, due: false };
    }
    const from = hardenFrom(p, g, year);
    if (today >= from) return { text: coldFrame ? 'Time to start hardening off: open the cold frame by day and close it at night.' : 'Time to start hardening off: outside by day, in at night.', ready: false, due: true };
    return { text: `Pot on when roots show at the bottom. Start hardening off from ${short(from)}.${coldNights(p, g, under.place ?? null, today)}`, ready: false, due: false };
  }
  const hardened = stageDates.hardening ?? today;
  const outFrom = plantOutFrom(p, g, hardened);
  if (today >= outFrom) return { text: 'Ready for the garden.', ready: true, due: true };
  const how = coldFrame ? 'Hardening off in the cold frame: open it by day, close it at night.' : 'Hardening off.';
  return { text: `${how} Ready to plant out from ${short(outFrom)}${isTender(p) ? ', after the last frost' : ''}.`, ready: false, due: false };
}

/** For tender seedlings in an unheated greenhouse or cold frame before its last frost: bring them in on cold nights. */
function coldNights(p: Plant, g: Garden, c: Climate | null, today: string): string {
  if (!c || c.heated || !isTender(p)) return '';
  const last = inYear(frostDatesUnder(g, c)!.lastFrost, Number(today.slice(0, 4)));
  if (today >= last) return '';
  return ` It's only about +${c.nightGainC} °C warmer at night in here: bring them indoors on cold nights until about ${short(last)}.`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 May". */
export const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** What's next for a tray, in its place: a greenhouse bench or cold frame has its own climate. */
export function trayNext(t: Tray, p: Plant, g: Garden, today: string): Next {
  const place = placesOf(g).find((x) => x.id === t.placeId);
  return nextFor(p, g, trayStage(t), t.sownOn, t.stageDates ?? {}, today, { place: place ? placeClimate(g, place) : null });
}

/** Plantings on the plan that were sown indoors and haven't gone out yet: they're in the shed too. */
export function plantingsIndoors(g: Garden, plantOf: (id: string) => Plant): Planting[] {
  return g.plantings.filter((pl) => {
    if (pl.removedOn || !pl.sownOn) return false;
    const s = currentStage(pl);
    if (s !== 'sown' && s !== 'germinated' && s !== 'hardening') return false;
    const plant = plantOf(pl.plantId);
    const methods = (plant.sowing ?? []).map((x) => x.method);
    return pl.sowing === 'indoors' || (!pl.sowing && methods.length > 0 && methods[0] !== 'direct');
  });
}

/** What's next for a planting still indoors. One going into a greenhouse or cold frame skips hardening off. */
export const plantingNext = (pl: Planting, p: Plant, g: Garden, today: string): Next =>
  nextFor(
    p,
    g,
    currentStage(pl) as TrayStage,
    pl.sownOn!,
    { ...(pl.stageDates?.germinated ? { germinated: pl.stageDates.germinated } : {}), ...(pl.stageDates?.hardening ? { hardening: pl.stageDates.hardening } : {}) },
    today,
    { into: microclimateOf(g, pl) },
  );

/** Moves a planting that's still indoors on a stage (up, hardening off) or out into its bed. */
export const setIndoorStage = (g: Garden, id: string, stage: TrayStage | 'transplanted', date: string): Garden => setStage(g, [id], stage, date);

export interface ReadyItem {
  kind: 'tray' | 'planting';
  id: string;
  plantId: string;
  count: number;
}

/** Everything ready to plant out today, for the alert on Home. */
export function readyToPlantOut(g: Garden, plantOf: (id: string) => Plant, today: string): ReadyItem[] {
  const out: ReadyItem[] = [];
  for (const t of traysOf(g)) if (trayNext(t, plantOf(t.plantId), g, today).ready) out.push({ kind: 'tray', id: t.id, plantId: t.plantId, count: t.count });
  for (const pl of plantingsIndoors(g, plantOf)) if (plantingNext(pl, plantOf(pl.plantId), g, today).ready) out.push({ kind: 'planting', id: pl.id, plantId: pl.plantId, count: 0 });
  return out;
}
