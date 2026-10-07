// Stage 13c: "Where are you growing?" and search everything.

import { describe, expect, it } from 'vitest';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { bounds, pointInPolygon, polygonArea } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { addFeature, featureLabel, makeFeature, rectPoints } from '../src/model/features';
import { makeSpace, PLOTS, SPACES, type Space } from '../src/model/spaces';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { addPlanting, isContainer, makePlanting, unknownPlant } from '../src/planting/place';
import { queryWords, scoreOf, search, type Result } from '../src/ui/search';

const library = [...vegetables, ...herbs] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plantOf = (id: string) => byId.get(id) ?? unknownPlant(id);
const inside = (g: Garden) => g.features.every((f) => f.footprint.every((p) => pointInPolygon(p, g.boundary) || g.boundary.some((q) => q[0] === p[0] && q[1] === p[1]) || onEdge(p, g)));
/** On the boundary's edge, which counts as inside for a surface that covers it. */
const onEdge = ([x, y]: [number, number], g: Garden) => {
  const b = bounds(g.boundary)!;
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && (x === b.minX || x === b.maxX || y === b.minY || y === b.maxY);
};

describe('where are you growing', () => {
  it('lays out each space at its usual size, inside its boundary, ready for plants', () => {
    for (const s of SPACES) {
      const g = makeSpace(newGarden(), s.id, s.size[0], s.size[1]);
      expect(validateGarden(JSON.parse(JSON.stringify(g))), s.id).toEqual([]);
      expect(g.features.some(isContainer), s.id).toBe(true);
      if (s.id === 'bed') expect(g.boundary).toEqual([]);
      else {
        expect(Math.abs(polygonArea(g.boundary)), s.id).toBe(s.size[0] * s.size[1]);
        expect(inside(g), s.id).toBe(true);
      }
    }
  });

  it('uses the size you give, within sensible limits', () => {
    const g = makeSpace(newGarden(), 'balcony', 4200, 1100);
    expect(bounds(g.boundary)).toEqual({ minX: 0, minY: 0, maxX: 4200, maxY: 1100 });
    const tiny = makeSpace(newGarden(), 'patio', 10, 10);
    expect(bounds(tiny.boundary)).toEqual({ minX: 0, minY: 0, maxX: 1500, maxY: 1500 });
    const huge = makeSpace(newGarden(), 'garden', 500000, 20000);
    expect(bounds(huge.boundary)!.maxX).toBe(100000);
  });

  it('fits what it makes into small spaces', () => {
    for (const [space, w, d] of [['balcony', 1000, 600], ['patio', 1500, 1500], ['garden', 3000, 3000], ['allotment', 3000, 5000]] as [Space, number, number][]) {
      const g = makeSpace(newGarden(), space, w, d);
      expect(inside(g), space).toBe(true);
      expect(g.features.some(isContainer), space).toBe(true);
    }
  });

  it('gives an allotment beds across the plot, and a half plot half the area', () => {
    const full = makeSpace(newGarden(), 'allotment', ...PLOTS.full);
    const half = makeSpace(newGarden(), 'allotment', ...PLOTS.half);
    expect(Math.abs(polygonArea(full.boundary)) / 1e6).toBe(250);
    expect(Math.abs(polygonArea(half.boundary)) / 1e6).toBe(125);
    expect(full.features.filter((f) => f.kind === 'bed')).toHaveLength(8);
    expect(full.features.some((f) => f.kind === 'compost')).toBe(true);
  });

  it('names the garden after the space, unless you named it', () => {
    expect(makeSpace(newGarden(), 'balcony', 3000, 1500).name).toBe('My balcony');
    expect(makeSpace(newGarden(), 'allotment', ...PLOTS.half).name).toBe('My allotment');
    expect(makeSpace(newGarden(), 'garden', 10000, 14000).name).toBe('My garden');
    expect(makeSpace({ ...newGarden(), name: 'Rooftop' }, 'balcony', 3000, 1500).name).toBe('Rooftop');
  });

  it('keeps a boundary that’s already drawn', () => {
    const drawn = { ...newGarden(), boundary: rectPoints({ x: 0, y: 0, w: 6000, h: 6000 }) };
    expect(makeSpace(drawn, 'patio', 3000, 3000).boundary).toBe(drawn.boundary);
  });
});

describe('search everything', () => {
  const bed = { ...makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 2400, h: 1200 }) }), name: 'Veg bed' };
  const lawn = makeFeature('surface', { area: rectPoints({ x: 3000, y: 0, w: 4000, h: 3000 }) });
  let garden = addFeature(addFeature({ ...newGarden(), boundary: rectPoints({ x: 0, y: 0, w: 8000, h: 6000 }) }, bed), lawn);
  garden = addPlanting(garden, makePlanting(plantOf('tomato'), bed.id, 'single', [500, 500]));
  const ctx = { garden, plants: library, plantOf, locked: false };
  const first = (q: string) => search(q, ctx)[0];
  const labels = (rs: Result[]) => rs.map((r) => r.label);

  it('ignores little words and accents', () => {
    expect(queryWords('Go to the Shed')).toEqual(['go', 'shed']);
    expect(scoreOf(['cafe'], 'Café', '')).not.toBeNull();
    expect(scoreOf(['sun', 'moon'], 'Show sun hours', '')).toBeNull();
  });

  it('understands "add tomato", "go to the shed" and "show sun"', () => {
    expect(search('add tomato', ctx).filter((r) => r.group !== 'Plants')).toEqual([]);
    expect(first('add tomato')).toMatchObject({ group: 'Plants', label: 'Tomato', command: { kind: 'plant', id: 'tomato' } });
    expect(first('go to the shed')?.command).toEqual({ kind: 'go', view: 'shed' });
    expect(first('show sun')?.command).toEqual({ kind: 'lens', lens: 'sun' });
    expect(first('shade')?.command).toEqual({ kind: 'lens', lens: 'shade' });
    expect(first('share')?.command).toEqual({ kind: 'share' });
    expect(first('bees')?.command).toEqual({ kind: 'lens', lens: 'flower' });
    expect(first('watering')?.command).toEqual({ kind: 'lens', lens: 'water' });
  });

  it('sows a plant in the shed, or opens its card, with a word before it', () => {
    expect(first('sow basil')?.command).toEqual({ kind: 'sow', id: 'basil' });
    expect(first('about basil')?.command).toEqual({ kind: 'about', id: 'basil' });
  });

  it('finds things on the plan, by name, kind or what they’re made of', () => {
    const plan = (q: string) => search(q, ctx).filter((r) => r.group === 'On your plan');
    // The bed first, then what grows in it.
    expect(labels(plan('veg'))).toEqual(['Veg bed', 'Tomato']);
    expect(plan('lawn')[0]?.command).toEqual({ kind: 'show', target: { type: 'feature', id: lawn.id } });
    expect(plan('tomato')[0]).toMatchObject({ label: 'Tomato', detail: `In ${featureLabel(bed)}`, command: { kind: 'show', target: { type: 'planting' } } });
    expect(plan('boundary')[0]?.command).toEqual({ kind: 'show', target: { type: 'boundary' } });
  });

  it('adds stickers, and offers what fits the layout’s lock', () => {
    expect(first('add pot')?.command).toEqual({ kind: 'sticker', id: 'pot' });
    expect(first('raised bed')?.command).toEqual({ kind: 'sticker', id: 'raised-bed' });
    expect(labels(search('lock', ctx))).toContain('Lock the layout');
    expect(labels(search('lock', { ...ctx, locked: true }))).toContain('Unlock the layout');
  });

  it('suggests a few things before anything is typed, and offers setting up an empty plan', () => {
    const empty = search('', ctx);
    expect(empty.length).toBeGreaterThan(3);
    expect(empty.some((r) => r.command.kind === 'setup')).toBe(false);
    const fresh = search('', { ...ctx, garden: newGarden() });
    expect(fresh[0]?.command).toEqual({ kind: 'setup' });
    expect(search('allotment', { ...ctx, garden: newGarden() })[0]?.command).toEqual({ kind: 'setup' });
  });

  it('keeps each group short, and finds nothing for nonsense', () => {
    const rs = search('p', ctx);
    expect(rs.filter((r) => r.group === 'Plants').length).toBeLessThanOrEqual(8);
    expect(search('xyzzy', ctx)).toEqual([]);
  });
});
