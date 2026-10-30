// Release 57: a backup and a spreadsheet that lose nothing, one line on where the
// garden is, and the year on paper.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newGarden } from '../src/model/defaults';
import { makeFeature, rectPoints } from '../src/model/features';
import { SCHEMA_VERSION } from '../src/model/migrate';
import type { Feature, Garden, Plant, Planting } from '../src/model/types';
import { addPlanting, makePlanting } from '../src/planting/place';
import { CSV_COLUMNS, csvCell, plantingsCsv, yearSheet } from '../src/share/export';
import { backupFile, csvFile, parseFileText, toFile } from '../src/storage/file';
import { safetyText } from '../src/ui/setup';

const DIR = join(__dirname, '..', 'data', 'plants');
const plants: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byId = new Map(plants.map((p) => [p.id, p]));
const plantOf = (id: string): Plant => byId.get(id)!;

/** A garden with something of everything: what a backup mustn't drop. */
function fullGarden(): Garden {
  const bed: Feature = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Veg, "the big one"', handTools: true, toMake: false, rotates: true };
  const pot: Feature = { ...makeFeature('pot', { circle: { centre: [5000, 500], radiusMm: 175 } }), name: '=Tower', pockets: 8, covered: true, light: 'part-shade', heightMm: 400 };
  const sown: Planting = { ...makePlanting(plantOf('carrot'), bed.id, 'row', [300, 300], [2000, 300]), sownOn: '2026-04-01', sowing: 'direct', stage: 'harvesting', stageDates: { germinated: '2026-04-15', vegetative: '2026-05-01', harvesting: '2026-07-20' }, picks: [{ date: '2026-07-20', grams: 300, size: 'bowl' }] };
  const cleared: Planting = { ...makePlanting(plantOf('lettuce'), bed.id, 'single', [300, 900]), sownOn: '2026-03-01', removedOn: '2026-06-01' };
  const planned: Planting = { ...makePlanting(plantOf('strawberry'), pot.id, 'single', [5000, 500]), sowBy: '2027-03-01' };
  const g = [sown, cleared, planned].reduce(addPlanting, { ...newGarden(), name: 'Everything', features: [bed, pot] });
  return {
    ...g,
    latitude: 53.8,
    longitude: -1.55,
    northRotationDeg: 30,
    heightM: 120,
    frostHollow: true,
    lastFrost: '05-01',
    firstFrost: '10-20',
    balcony: { facing: 'north-east', sun: 'half', roof: true, windy: true },
    wishlist: ['tomato'],
    feedShelf: ['tomato-feed'],
    jobsDone: [{ key: 'water:x:2026-10-01', date: '2026-10-01' }],
    notes: [{ id: 'n1', date: '2026-07-20', text: 'A first picking, "sweet" and early, £2 saved', plantingId: sown.id }],
  };
}

/** A small CSV reader, as a spreadsheet would read it. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let [row, cell, quoted]: [string[], string, boolean] = [[], '', false];
  const body = text.replace(/^﻿/, '');
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else if (c !== '\r') cell += c;
  }
  return rows;
}

describe('a backup loses nothing', () => {
  it('brings back the whole garden, exactly', async () => {
    const state = { garden: fullGarden(), userPlants: [] };
    const read = parseFileText(await backupFile(state).text());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.state).toEqual(state);
  });

  it('survives a second trip', async () => {
    const state = { garden: fullGarden(), userPlants: [] };
    const once = parseFileText(await backupFile(state).text());
    if (!once.ok) throw new Error('not read');
    const twice = parseFileText(await backupFile(once.state).text());
    if (!twice.ok) throw new Error('not read');
    expect(twice.state).toEqual(state);
  });

  it('says when it was made', () => {
    const file = toFile({ garden: fullGarden(), userPlants: [] }, new Date('2026-09-03T10:00:00Z'));
    const read = parseFileText(JSON.stringify(file));
    expect(read.ok && read.madeOn).toBe('2026-09-03');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('turns down a damaged file and leaves nothing half done', () => {
    const text = JSON.stringify(toFile({ garden: fullGarden(), userPlants: [] }));
    expect(parseFileText(text.slice(0, text.length / 2)).ok).toBe(false);
    expect(parseFileText('{"app":"garden-planner","garden":{}}').ok).toBe(false);
    expect(parseFileText('not json').ok).toBe(false);
  });
});

describe('a spreadsheet of plantings', () => {
  const g = fullGarden();
  const csv = plantingsCsv(g, plantOf);
  const rows = readCsv(csv);
  const at = (r: string[], col: string) => r[CSV_COLUMNS.indexOf(col)];

  it('has every planting, cleared ones too, with every date', () => {
    expect(rows[0]).toEqual(CSV_COLUMNS);
    expect(rows.slice(1)).toHaveLength(g.plantings.length);
    expect(rows.slice(1).every((r) => r.length === CSV_COLUMNS.length)).toBe(true);
    for (const [i, pl] of g.plantings.entries()) {
      const r = rows[i + 1]!;
      expect(at(r, 'Plant')).toBe(plantOf(pl.plantId).commonName);
      expect(at(r, 'Sown')).toBe(pl.sownOn ?? '');
      expect(at(r, 'Harvesting')).toBe(pl.stageDates?.harvesting ?? '');
      expect(at(r, 'Cleared')).toBe(pl.removedOn ?? '');
      expect(at(r, 'To sow by')).toBe(pl.sowBy ?? '');
    }
    expect(at(rows[1]!, 'Times picked')).toBe('1');
  });

  it('keeps commas and quotes in their cells, and notes with their planting', () => {
    expect(at(rows[1]!, 'Bed or pot')).toBe('Veg, "the big one"');
    expect(at(rows[1]!, 'Notes')).toBe('A first picking, "sweet" and early, £2 saved');
  });

  it('won’t let a name run as a formula', () => {
    expect(at(rows[3]!, 'Bed or pot')).toBe("'=Tower");
    for (const bad of ['=1+1', '+44', '-2', '@x']) expect(csvCell(bad).startsWith("'")).toBe(true);
    expect(csvCell('Carrot')).toBe('Carrot');
  });

  it('opens in Excel with its accents and pound signs right', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csvFile('My Garden!', csv, new Date('2026-10-30T09:00:00Z')).name).toBe('my-garden-plantings-2026-10-30.csv');
  });
});

describe('where the garden is', () => {
  const now = new Date(2026, 9, 30);

  it('says the same plain thing on Today and in Settings', () => {
    expect(safetyText(null, now)).toBe('Saved only in this browser on this device. No copy yet.');
    expect(safetyText('2026-10-30', now)).toMatch(/Last copy today/);
    expect(safetyText('2026-10-29', now)).toMatch(/Last copy yesterday/);
    expect(safetyText('2026-10-18', now)).toMatch(/Last copy 12 days ago/);
  });
});

describe('the year on paper', () => {
  it('lists what’s in each bed, not what’s cleared, with its dates', () => {
    const sheet = yearSheet(fullGarden(), plantOf, '2026-10-30');
    expect(sheet.map((b) => b.bed)).toEqual(['Veg, "the big one"', '=Tower']);
    const names = sheet.flatMap((b) => b.rows.map((r) => r.plant));
    expect(names).toContain('Carrot');
    expect(names).not.toContain('Lettuce');
    expect(sheet[0]!.rows[0]!.dates.join(' ')).toMatch(/Sown/);
  });

  it('prints nothing for an empty garden', () => {
    expect(yearSheet(newGarden(), plantOf, '2026-10-30')).toEqual([]);
  });
});
