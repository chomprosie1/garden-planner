import { describe, expect, it } from 'vitest';
import vegetables from '../data/plants/vegetable.json';
import { newAppState } from '../src/model/defaults';
import { addFeature, deleteFeatures, duplicateFeature, makeFeature, moveFeature, rectPoints } from '../src/model/features';
import { addNote, deleteNote, makeNote, newestFirst } from '../src/model/notes';
import type { Garden, Plant, Planting, Point } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import {
  addPlanting,
  blockGrid,
  clearBed,
  containerAt,
  deletePlanting,
  makePlanting,
  movePlanting,
  plantCount,
  plantPositions,
  restorePlanting,
  rowCount,
  setRowCount,
  unknownPlant,
} from '../src/planting/place';
import { checkGarden, closest } from '../src/planting/rules';

const library = vegetables as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);

/** A 10 × 14 m garden with two beds: A is 3 m × 1.2 m at (1000, 1000), B sits 2 m to its right. */
function garden(): { g: Garden; a: string; b: string } {
  const bedA = { ...makeFeature('bed', { area: rectPoints({ x: 1000, y: 1000, w: 3000, h: 1200 }) }), name: 'Bed A' };
  const bedB = { ...makeFeature('bed', { area: rectPoints({ x: 6000, y: 1000, w: 2000, h: 1200 }) }), name: 'Bed B' };
  let g: Garden = { ...newAppState().garden, boundary: rectPoints({ x: 0, y: 0, w: 10000, h: 14000 }) };
  g = addFeature(addFeature(g, bedA), bedB);
  return { g, a: bedA.id, b: bedB.id };
}

const row = (id: string, bed: string, a: Point, b: Point) => makePlanting(plant(id), bed, 'row', a, b);
const one = (id: string, bed: string, p: Point) => makePlanting(plant(id), bed, 'single', p);
const check = (g: Garden) => checkGarden(g, plant);
const kinds = (g: Garden) => check(g).map((f) => f.kind).sort();

describe('placing plants', () => {
  it('works out a row from its spacing, with a plant at each end', () => {
    expect(rowCount([0, 0], [600, 0], 60)).toBe(11);
    expect(rowCount([0, 0], [590, 0], 60)).toBe(10);
    expect(rowCount([0, 0], [0, 0], 60)).toBe(1);
    const r = row('carrot', 'x', [0, 0], [600, 0]);
    expect(r.count).toBe(11);
    const pts = plantPositions(r, plant('carrot'));
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([600, 0]);
    expect(pts[1]).toEqual([60, 0]);
  });

  it('fills a block on a grid, half a spacing in from each edge', () => {
    // Lettuce at 250 mm in a 1000 × 500 block: 4 × 2 plants.
    expect(blockGrid([0, 0], [1000, 500], 250)).toEqual({ cols: 4, rows: 2 });
    const b = makePlanting(plant('lettuce'), 'x', 'block', [1000, 500], [0, 0]);
    expect(plantCount(b, plant('lettuce'))).toBe(8);
    const pts = plantPositions(b, plant('lettuce'));
    expect(pts[0]).toEqual([125, 125]);
    expect(pts[7]).toEqual([875, 375]);
  });

  it('a block too small for two plants still holds one', () => {
    const b = makePlanting(plant('courgette'), 'x', 'block', [0, 0], [400, 400]);
    expect(plantPositions(b, plant('courgette'))).toEqual([[200, 200]]);
  });

  it('finds the bed under a point, and nothing on the lawn', () => {
    const { g, a, b } = garden();
    expect(containerAt(g, [2000, 1500])?.id).toBe(a);
    expect(containerAt(g, [7000, 1500])?.id).toBe(b);
    expect(containerAt(g, [5000, 1500])).toBeNull();
  });

  it('moving a bed moves what is planted in it', () => {
    const { g: g0, a } = garden();
    const r = row('carrot', a, [1200, 1200], [3800, 1200]);
    const g = moveFeature(addPlanting(g0, r), a, 100, 200);
    const moved = g.plantings[0]!;
    expect([moved.x, moved.y]).toEqual([1300, 1400]);
    expect(moved.endPoint).toEqual([3900, 1400]);
  });

  it('moving a planting into another bed hands it to that bed', () => {
    const { g: g0, a, b } = garden();
    const p = one('courgette', a, [2000, 1500]);
    const g = movePlanting(addPlanting(g0, p), p.id, 5000, 0);
    expect(g.plantings[0]!.featureId).toBe(b);
  });

  it('deleting a bed takes its plantings and notes with it', () => {
    const { g: g0, a, b } = garden();
    const p = one('courgette', a, [2000, 1500]);
    const q = one('courgette', b, [7000, 1500]);
    let g = addPlanting(addPlanting(g0, p), q);
    g = addNote(g, makeNote('Netted', '2026-10-01', { featureId: a }));
    g = addNote(g, makeNote('First flower', '2026-10-02', { plantingId: p.id }));
    g = addNote(g, makeNote('Bed B note', '2026-10-02', { featureId: b }));
    g = deleteFeatures(g, [a]);
    expect(g.plantings.map((x) => x.id)).toEqual([q.id]);
    expect(g.notes.map((n) => n.text)).toEqual(['Bed B note']);
  });

  it('duplicating a bed copies what is growing, not what was harvested', () => {
    const { g: g0, a } = garden();
    const live = one('courgette', a, [2000, 1500]);
    const done = { ...one('lettuce', a, [3000, 1500]), removedOn: '2026-08-01' };
    const [g, copyId] = duplicateFeature(addPlanting(addPlanting(g0, live), done), a);
    const copied = g.plantings.filter((p) => p.featureId === copyId);
    expect(copied.map((p) => p.plantId)).toEqual(['courgette']);
    expect([copied[0]!.x, copied[0]!.y]).toEqual([2500, 1000]);
  });

  it('clearing a bed keeps its history; restoring puts a planting back', () => {
    const { g: g0, a, b } = garden();
    const p = one('courgette', a, [2000, 1500]);
    const q = one('courgette', b, [7000, 1500]);
    let g = clearBed(addPlanting(addPlanting(g0, p), q), a, '2026-10-06');
    expect(g.plantings.find((x) => x.id === p.id)?.removedOn).toBe('2026-10-06');
    expect(g.plantings.find((x) => x.id === q.id)?.removedOn).toBeUndefined();
    expect(clearBed(g, a, '2026-10-07')).toBe(g); // nothing left to clear
    g = restorePlanting(g, p.id);
    expect(g.plantings.find((x) => x.id === p.id)?.removedOn).toBeUndefined();
  });

  it('deleting a planting removes its notes too', () => {
    const { g: g0, a } = garden();
    const p = one('courgette', a, [2000, 1500]);
    let g = addNote(addPlanting(g0, p), makeNote('Slugs', '2026-10-01', { plantingId: p.id }));
    g = deletePlanting(g, p.id);
    expect(g.plantings).toEqual([]);
    expect(g.notes).toEqual([]);
  });

  it('saves and validates plantings and notes', () => {
    const { g: g0, a } = garden();
    let g = addPlanting(g0, row('carrot', a, [1200, 1200], [3800, 1200]));
    g = addNote(g, makeNote('Sown thinly', '2026-04-10', { featureId: a }));
    expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
    const bad = { ...g, plantings: [{ ...g.plantings[0]!, layout: 'spiral', count: 0 }] };
    expect(validateGarden(bad).length).toBe(2);
  });
});

describe('notes', () => {
  it('lists newest first, and the latest added first on the same day', () => {
    const n1 = makeNote('a', '2026-05-01');
    const n2 = makeNote('b', '2026-06-01');
    const n3 = makeNote('c', '2026-05-01');
    expect(newestFirst([n1, n2, n3]).map((n) => n.text)).toEqual(['b', 'c', 'a']);
  });

  it('ignores an empty note, and deletes by id', () => {
    const { g } = garden();
    expect(addNote(g, makeNote('   ', '2026-05-01'))).toBe(g);
    const n = makeNote('Mulched', '2026-05-01');
    expect(deleteNote(addNote(g, n), n.id).notes).toEqual([]);
  });
});

describe('spacing rules', () => {
  it('flags carrots sown too close in a row, with the numbers', () => {
    const { g: g0, a } = garden();
    const r = row('carrot', a, [1200, 1200], [1800, 1200]); // 11 carrots at 60 mm
    const g = setRowCount(addPlanting(g0, r), r.id, 21); // now 30 mm apart
    const f = check(g);
    expect(f.map((x) => x.kind)).toEqual(['row']);
    expect(f[0]!.message).toContain('30 mm apart');
    expect(f[0]!.message).toContain('60 mm');
  });

  it('a row at its own spacing is fine', () => {
    const { g: g0, a } = garden();
    expect(check(addPlanting(g0, row('carrot', a, [1200, 1200], [3800, 1200])))).toEqual([]);
  });

  it('uses row spacing between parallel rows, and is quiet at the right distance', () => {
    const { g: g0, a } = garden();
    // Carrot rows need 150 mm between them.
    const tooClose = addPlanting(addPlanting(g0, row('carrot', a, [1200, 1200], [3800, 1200])), row('carrot', a, [1200, 1300], [3800, 1300]));
    const f = check(tooClose);
    expect(f.map((x) => x.kind)).toEqual(['spacing']);
    expect(f[0]!.message).toBe('The row of carrot and the row of carrot are 100 mm apart; they need about 150 mm between rows.');
    const fine = addPlanting(addPlanting(g0, row('carrot', a, [1200, 1200], [3800, 1200])), row('carrot', a, [1200, 1350], [3800, 1350]));
    expect(check(fine)).toEqual([]);
  });

  it('uses plant spacing for rows end to end', () => {
    const { g: g0, a } = garden();
    // Two carrot rows in a line, 60 mm apart end to end: fine. 20 mm: too close.
    const ok = addPlanting(addPlanting(g0, row('carrot', a, [1200, 1500], [2400, 1500])), row('carrot', a, [2460, 1500], [3600, 1500]));
    expect(check(ok)).toEqual([]);
    const tight = addPlanting(addPlanting(g0, row('carrot', a, [1200, 1500], [2400, 1500])), row('carrot', a, [2420, 1500], [3600, 1500]));
    expect(kinds(tight)).toEqual(['spacing']);
  });

  it('allows a small squeeze without a warning', () => {
    const { g: g0, a } = garden();
    // Courgettes need 900 mm; 820 mm is within 10%.
    const g = addPlanting(addPlanting(g0, one('courgette', a, [1500, 1600])), one('courgette', a, [2320, 1600]));
    expect(check(g)).toEqual([]);
    const g2 = addPlanting(addPlanting(g0, one('courgette', a, [1500, 1600])), one('courgette', a, [2200, 1600]));
    expect(check(g2)[0]!.message).toBe('Courgette and courgette are 700 mm apart; they need about 900 mm.');
  });

  it('flags plantings that overlap', () => {
    const { g: g0, a } = garden();
    const block = makePlanting(plant('lettuce'), a, 'block', [1000, 1000], [2000, 2200]);
    const g = addPlanting(addPlanting(g0, block), row('radish', a, [1100, 1600], [3000, 1600]));
    const f = check(g).find((x) => x.kind === 'spacing');
    expect(f?.message).toBe('The block of lettuce and the row of radish overlap.');
  });

  it('measures gaps between shapes', () => {
    expect(closest({ kind: 'point', p: [0, 0] }, { kind: 'segment', a: [100, -50], b: [100, 50] }).d).toBe(100);
    expect(closest({ kind: 'rect', min: [0, 0], max: [100, 100] }, { kind: 'point', p: [50, 50] }).d).toBe(0);
    expect(closest({ kind: 'segment', a: [0, 0], b: [100, 100] }, { kind: 'segment', a: [0, 100], b: [100, 0] }).d).toBe(0);
    expect(closest({ kind: 'rect', min: [0, 0], max: [100, 100] }, { kind: 'rect', min: [130, 0], max: [200, 100] }).d).toBe(30);
  });
});

describe('bed rules', () => {
  it('flags plants outside their bed, but not ones on its edge', () => {
    const { g: g0, a } = garden();
    // Bed A runs x 1000–4000. A row from its left edge to 1 m past its right edge.
    const g = addPlanting(g0, row('lettuce', a, [1000, 1500], [5000, 1500]));
    const f = check(g);
    expect(f.map((x) => x.kind)).toEqual(['outside']);
    expect(f[0]!.message).toBe('4 of 17 lettuce plants are outside Bed A.');
    // Edge to edge is all inside.
    expect(check(addPlanting(g0, row('lettuce', a, [1000, 1500], [4000, 1500])))).toEqual([]);
  });

  it('flags a planting whose bed has gone', () => {
    const { g } = garden();
    const f = check(addPlanting(g, one('courgette', 'f-missing', [2000, 1500])));
    expect(f.map((x) => x.kind)).toEqual(['no-bed']);
  });

  it('ignores what has been harvested', () => {
    const { g: g0, a } = garden();
    const p: Planting = { ...one('courgette', a, [9000, 9000]), removedOn: '2026-09-01' };
    expect(check(addPlanting(g0, p))).toEqual([]);
  });
});

describe('neighbour rules', () => {
  it('flags onions next to peas in the same bed', () => {
    const { g: g0, a } = garden();
    const g = addPlanting(addPlanting(g0, row('onion', a, [1200, 1200], [3800, 1200])), row('pea', a, [1200, 1900], [3800, 1900]));
    const f = check(g);
    expect(f.map((x) => x.kind)).toEqual(['avoid']);
    expect(f[0]!.message).toBe("Onion and pea are in Bed A. They're usually kept apart.");
  });

  it('flags a clash across beds only within 1 m', () => {
    const { g: g0, a, b } = garden();
    // Tomato in A's right end, potato in B's left end: 2 m apart. Then a bed C 600 mm away.
    const far = addPlanting(addPlanting(g0, one('tomato', a, [3700, 1600])), one('potato', b, [6300, 1600]));
    expect(check(far)).toEqual([]);
    const bedC = { ...makeFeature('bed', { area: rectPoints({ x: 4300, y: 1000, w: 1200, h: 1200 }) }), name: 'Bed C' };
    const near = addPlanting(addPlanting(addFeature(g0, bedC), one('tomato', a, [3700, 1600])), one('potato', bedC.id, [4700, 1600]));
    const f = check(near);
    expect(f.map((x) => x.kind)).toEqual(['avoid']);
    expect(f[0]!.message).toBe("Potato and tomato are within 1 m of each other (Bed C and Bed A). They're usually kept apart.");
  });

  it('counts a clash once per pair of plants, however many rows', () => {
    const { g: g0, a } = garden();
    let g = g0;
    for (const y of [1150, 1450]) g = addPlanting(g, row('onion', a, [1200, y], [2400, y]));
    for (const y of [1150, 1800]) g = addPlanting(g, row('pea', a, [2800, y], [3800, y]));
    const avoid = check(g).filter((x) => x.kind === 'avoid');
    expect(avoid.length).toBe(1);
    expect(avoid[0]!.plantingIds.length).toBe(4);
  });

  it('notes good neighbours, after the warnings', () => {
    const { g: g0, a } = garden();
    const g = addPlanting(addPlanting(g0, row('carrot', a, [1200, 1200], [3800, 1200])), row('onion', a, [1200, 1500], [3800, 1500]));
    const f = check(g);
    expect(f.map((x) => [x.kind, x.level])).toEqual([['good', 'good']]);
    expect(f[0]!.message).toBe('Carrot and onion are good neighbours in Bed A.');
  });

  it('reads a clash listed by either plant', () => {
    // Tomato lists kale to avoid; kale lists tomato. Calabrese lists tomato, but tomato doesn't list calabrese.
    const { g: g0, a } = garden();
    const g = addPlanting(addPlanting(g0, one('calabrese', a, [1500, 1600])), one('tomato', a, [3500, 1600]));
    expect(kinds(g)).toEqual(['avoid']);
  });
});
