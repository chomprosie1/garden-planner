// Sketches: pen marks, highlighter, arrows and words drawn over the plan.
// They're for ideas, so they are never measured, checked or shaded. Every
// edit returns a new Garden, so each is one undo step.

import { distance, distanceToSegment } from '../geometry/polygon';
import { simplify } from '../geometry/simplify';
import { newId } from './ids';
import type { Garden, Point, Sketch, SketchColour, SketchKind } from './types';

/** How wide each kind of mark is on the ground, mm. Drawn at least a pixel or two wide whatever the zoom. */
export const SKETCH_WIDTH: Record<SketchKind, number> = { pen: 40, highlighter: 300, arrow: 50, text: 300 };

export const SKETCH_LABEL: Record<SketchKind, string> = { pen: 'Pen', highlighter: 'Highlighter', arrow: 'Arrow', text: 'Words' };
export const COLOUR_LABEL: Record<SketchColour, string> = { ink: 'Ink', red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

export const sketchesOf = (g: Garden): Sketch[] => g.sketches ?? [];

/**
 * A new sketch. A pen or highlighter stroke is thinned to the points that keep its shape (to within a few mm
 * at this zoom), so a long scribble stays small in the saved file.
 */
export function makeSketch(kind: SketchKind, colour: SketchColour, points: Point[], opts: { text?: string; toleranceMm?: number } = {}): Sketch {
  const rounded = points.map(([x, y]): Point => [Math.round(x), Math.round(y)]);
  const pts = kind === 'pen' || kind === 'highlighter' ? simplify(rounded, opts.toleranceMm ?? 10) : kind === 'arrow' ? [rounded[0]!, rounded[rounded.length - 1]!] : [rounded[0]!];
  const k: Sketch = { id: newId('k'), kind, colour, points: pts, widthMm: SKETCH_WIDTH[kind] };
  if (kind === 'text') k.text = (opts.text ?? '').trim();
  return k;
}

export function addSketch(g: Garden, k: Sketch): Garden {
  if (k.kind === 'text' && !k.text) return g;
  if (k.kind === 'arrow' && distance(k.points[0]!, k.points[1]!) < 1) return g;
  return { ...g, sketches: [...sketchesOf(g), k] };
}

export function deleteSketches(g: Garden, ids: string[]): Garden {
  const set = new Set(ids);
  const sketches = sketchesOf(g).filter((k) => !set.has(k.id));
  if (sketches.length === sketchesOf(g).length) return g;
  return { ...g, sketches };
}

export const clearSketches = (g: Garden): Garden => (sketchesOf(g).length ? { ...g, sketches: [] } : g);

/**
 * Sketches under a point, topmost first: within half a mark's width (plus a tolerance) of its line, or for words,
 * inside the box they roughly fill (textWidthMm wide, widthMm tall, from their start point).
 */
export function sketchesAt(g: Garden, p: Point, toleranceMm: number, textWidthMm: (k: Sketch) => number = (k) => (k.text?.length ?? 0) * k.widthMm * 0.55): Sketch[] {
  const hits: Sketch[] = [];
  const list = sketchesOf(g);
  for (let i = list.length - 1; i >= 0; i--) {
    const k = list[i]!;
    const reach = k.widthMm / 2 + toleranceMm;
    if (k.kind === 'text') {
      const [x, y] = k.points[0]!;
      const w = textWidthMm(k);
      if (p[0] >= x - toleranceMm && p[0] <= x + w + toleranceMm && Math.abs(p[1] - y) <= reach) hits.push(k);
      continue;
    }
    if (k.points.length === 1 ? distance(p, k.points[0]!) <= reach : k.points.some((q, j) => j > 0 && distanceToSegment(p, k.points[j - 1]!, q).distance <= reach)) hits.push(k);
  }
  return hits;
}
