// The garden out of the app, for people to keep: every planting and its dates as
// a spreadsheet, and the year ahead for a printed page. Pure functions: garden in,
// text and tables out.

import { timeline, yearDate } from '../lifecycle/projection';
import { currentStage, stageLabel } from '../lifecycle/stages';
import { addDays } from '../model/dates';
import { featureLabel } from '../model/features';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive, plantCount } from '../planting/place';
import type { Weather } from '../weather/weather';

export const CSV_COLUMNS = ['Bed or pot', 'Plant', 'How many', 'Laid out as', 'Stage', 'To sow by', 'Sown or planted', 'Up', 'Hardening off', 'Planted out', 'Growing', 'Flowering', 'Harvesting', 'Cleared', 'Times picked', 'Notes'];

const LAYOUT: Record<string, string> = { single: 'One plant', row: 'A row', block: 'A block' };
const QUOTE = '\x22';

/**
 * One cell, quoted if it needs it. A cell a spreadsheet would run as a formula starts with an apostrophe, so a name
 * beginning with = or + stays words.
 */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[\x22,\r\n]/.test(safe) ? QUOTE + safe.split(QUOTE).join(QUOTE + QUOTE) + QUOTE : safe;
}

/** Every planting there's been, one row each, cleared ones included. With a mark at the start, so Excel reads the £ and accents right. */
export function plantingsCsv(g: Garden, plantOf: (id: string) => Plant): string {
  const bedOf = new Map(g.features.map((f) => [f.id, f]));
  const notesOf = (pl: Planting) => g.notes.filter((n) => n.plantingId === pl.id).map((n) => n.text).join(' / ');
  const rows = g.plantings.map((pl) => {
    const plant = plantOf(pl.plantId);
    const bed = bedOf.get(pl.featureId);
    const on = pl.stageDates ?? {};
    return [bed ? featureLabel(bed) : 'No bed', plant.commonName, plantCount(pl, plant), LAYOUT[pl.layout ?? 'single'] ?? '', stageLabel(plant, currentStage(pl), pl), pl.sowBy ?? '', pl.sownOn ?? '', on.germinated ?? '', on.hardening ?? '', on.transplanted ?? '', on.vegetative ?? '', on.flowering ?? '', on.harvesting ?? '', pl.removedOn ?? '', pl.picks?.length ?? 0, notesOf(pl)];
  });
  return `﻿${[CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export interface YearRow {
  id: string;
  plant: string;
  count: number;
  stage: string;
  /** What's happened and what's expected, in order: "Sown 3 Mar", "Harvesting about 2 Jul". */
  dates: string[];
  plantId: string;
  /** First and last dates of any stage, recorded or expected (ISO), or null if it has none. */
  span: { start: string; end: string } | null;
}

/** The year ahead by bed or pot, for printing: what's in each now, and when each thing happens. */
export function yearSheet(g: Garden, plantOf: (id: string) => Plant, today: string, weather: Weather | null = null): { id: string; bed: string; rows: YearRow[] }[] {
  const out: { id: string; bed: string; rows: YearRow[] }[] = [];
  for (const f of g.features) {
    const here = g.plantings.filter((pl) => pl.featureId === f.id && isActive(pl));
    if (!here.length) continue;
    const rows = here.map((pl) => {
      const plant = plantOf(pl.plantId);
      const all = timeline(plant, pl, g, today, weather).filter((s) => s.date && s.stage !== 'planned');
      const iso = all.map((s) => s.date!).sort();
      const span = iso.length ? { start: iso[0]!, end: iso[iso.length - 1]! } : null;
      const dates = all
        .filter((s) => s.date! <= addDays(today, 365))
        .map((s) => `${s.stage === 'cleared' ? 'Finished' : stageLabel(plant, s.stage, pl)} ${s.guessed ? 'about ' : ''}${yearDate(s.date!, today)}`);
      return { id: pl.id, plant: plant.commonName, count: plantCount(pl, plant), stage: stageLabel(plant, currentStage(pl), pl), dates, plantId: pl.plantId, span };
    });
    out.push({ id: f.id, bed: featureLabel(f), rows });
  }
  return out;
}

export interface CropLine {
  plantId: string;
  plant: string;
  /** The beds it's in, in the order first seen. */
  beds: string[];
  dates: string[];
}

/** One line per crop for the print-out: its beds listed once, rows that are over or more than a year off left out. */
export function cropLines(sheet: { bed: string; rows: YearRow[] }[], today: string): CropLine[] {
  const limit = addDays(today, 365);
  const out: (CropLine & { rows: YearRow[] })[] = [];
  for (const b of sheet) {
    for (const r of b.rows) {
      if (r.span && (r.span.end < today || r.span.start > limit)) continue;
      let line = out.find((l) => l.plantId === r.plantId);
      if (!line) out.push((line = { plantId: r.plantId, plant: r.plant, beds: [], dates: [], rows: [] }));
      if (!line.beds.includes(b.bed)) line.beds.push(b.bed);
      line.rows.push(r);
    }
  }
  return out.map(({ rows, ...l }) => {
    const same = rows.every((r) => r.dates.join('|') === rows[0]!.dates.join('|'));
    if (same) return { ...l, dates: rows[0]!.dates };
    const spans = rows.filter((r) => r.span && r.dates.length);
    if (!spans.length) return { ...l, dates: [] };
    const first = spans.reduce((a, r) => (r.span!.start < a.span!.start ? r : a));
    const last = spans.reduce((a, r) => (r.span!.end > a.span!.end ? r : a));
    const a = first.dates[0]!;
    const z = last.dates[last.dates.length - 1]!;
    return { ...l, dates: a === z ? [a] : [a, z] };
  });
}
