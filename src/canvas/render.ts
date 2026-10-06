// Draws the plan. Everything is drawn from the garden model and the current
// look; nothing here changes state.

import { bounds, centroid, distance } from '../geometry/polygon';
import { featureLabel, isClosed, pointsOf, type Target } from '../model/features';
import type { Feature, Garden, Plant, Planting, Point } from '../model/types';
import { blockGrid, isActive, MAX_PLANTS, plantCount, plantingShape, plantPositions, rowCount, spreadOf, type Layout, type PlantingShape } from '../planting/place';
import type { Finding } from '../planting/rules';
import type { SunGrid } from '../sun/hours';
import type { Sun } from '../sun/position';
import type { Shade } from '../sun/shadow';
import { LOOKS, type LookId, type Mode, type PlanPalette } from '../theme/looks';
import type { SnapKind } from './snap';
import { formatLength, gridStep, scaleBarLength, toScreen, type Viewport } from './viewport';

export interface PlanStyle {
  look: LookId;
  mode: Mode;
  plan: PlanPalette;
  accent: string;
  accentText: string;
  fontPlan: string;
  fontBody: string;
  labels: (typeof LOOKS)[LookId]['plan']['labels'];
  pattern: (typeof LOOKS)[LookId]['plan']['pattern'];
  bedRadiusMm: number;
}

export function planStyle(look: LookId, mode: Mode): PlanStyle {
  const l = LOOKS[look];
  return {
    look,
    mode,
    plan: l[mode].plan,
    accent: l[mode].ui.accent,
    accentText: l[mode].ui.accentText,
    fontPlan: l.fonts.plan,
    fontBody: l.fonts.body,
    labels: l.plan.labels,
    pattern: l.plan.pattern,
    bedRadiusMm: l.plan.bedRadiusMm,
  };
}

export interface Draft {
  geometry: 'area' | 'line' | 'circle' | 'rect';
  points: Point[];
  cursor: Point | null;
  snap: SnapKind;
  widthMm?: number;
  /** What the person is typing, e.g. "3450". */
  typed?: string;
}

export interface Scene {
  garden: Garden;
  view: Viewport;
  width: number;
  height: number;
  style: PlanStyle;
  selected: Target | null;
  selectedVertex: number | null;
  hoverId: string | null;
  draft: Draft | null;
  trace: HTMLImageElement | null;
  /** Phones: a fixed crosshair at the centre marks where the next corner goes. */
  crosshair?: boolean;
  /** Looks up a plant by id; needed to draw plantings. */
  plantOf?: (id: string) => Plant;
  findings?: Finding[];
  /** The finding picked in the warnings list, drawn strongly. */
  focusFinding?: string | null;
  plantDraft?: PlantDraft | null;
  /** Shadows at the chosen moment. */
  shadows?: Shade[] | null;
  /** Sun-hours heat map. */
  sunGrid?: SunGrid | null;
  /** Where the sun is, marked on the compass. */
  sun?: Sun | null;
  /** A small picture of the plan: no grid, scale bar or compass. */
  minimal?: boolean;
}

/** A planting being placed: the plant, how it's laid out, and the points so far. */
export interface PlantDraft {
  plant: Plant;
  layout: Layout;
  points: Point[];
  cursor: Point | null;
  typed?: string;
}

/** Colours for crops, picked by plant so the same plant always looks the same. */
const CROPS: Record<Mode, string[]> = {
  light: ['#5f8f3e', '#2f7a64', '#b07a1f', '#a8473c', '#7a5aa6', '#3f7aa6', '#8a8f2a', '#b5576f'],
  dark: ['#9ccc6e', '#6fcfae', '#e8b75a', '#f08c7c', '#bfa2ee', '#86bdea', '#cfd36a', '#f29ab0'],
};
export const WARN_COLOUR: Record<Mode, string> = { light: '#9a3412', dark: '#ffa45c' };
const GOOD: Record<Mode, string> = { light: '#2f7d32', dark: '#7bd88f' };

export function cropColour(plantId: string, mode: Mode): string {
  let h = 0;
  for (const ch of plantId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const list = CROPS[mode];
  return list[h % list.length]!;
}

// ---------- Patterns, cached per look and mode ----------

type Patterns = { lawn: CanvasPattern | string; bed: CanvasPattern | string; tileMm: { lawn: number; bed: number } };
const patternCache = new Map<string, Patterns>();

function tile(size: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!);
  return c;
}

function patterns(ctx: CanvasRenderingContext2D, s: PlanStyle): Patterns {
  const key = `${s.look}-${s.mode}`;
  const hit = patternCache.get(key);
  if (hit) return hit;
  const p = s.plan;
  const T = 64;
  let lawn: CanvasPattern | string = p.lawn;
  let bed: CanvasPattern | string = p.bedFill;
  const tileMm = { lawn: 400, bed: 300 };
  if (s.pattern === 'stipple' || s.pattern === 'hatch') {
    lawn = ctx.createPattern(
      tile(T, (c) => {
        c.fillStyle = p.lawn;
        c.fillRect(0, 0, T, T);
        c.fillStyle = p.lawnAlt;
        for (const [x, y, r] of [[12, 16, 3], [44, 40, 3], [30, 6, 2], [54, 58, 2]] as const) {
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
        }
      }),
      'repeat',
    )!;
  }
  if (s.pattern === 'hatch') {
    bed = ctx.createPattern(
      tile(T, (c) => {
        c.fillStyle = p.bedFill;
        c.fillRect(0, 0, T, T);
        c.strokeStyle = p.bedStroke;
        c.globalAlpha = 0.45;
        c.lineWidth = 3;
        for (let i = -T; i < T * 2; i += 16) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i + T, T);
          c.stroke();
        }
      }),
      'repeat',
    )!;
  }
  if (s.pattern === 'stripes') {
    tileMm.lawn = 2000;
    lawn = ctx.createPattern(
      tile(T, (c) => {
        c.fillStyle = p.lawn;
        c.fillRect(0, 0, T / 2, T);
        c.fillStyle = p.lawnAlt;
        c.fillRect(T / 2, 0, T / 2, T);
      }),
      'repeat',
    )!;
  }
  const result = { lawn, bed, tileMm };
  patternCache.set(key, result);
  return result;
}

/** Ties a pattern to the garden, so it pans and zooms with the plan. */
function placePattern(fill: CanvasPattern | string, v: Viewport, tileMm: number): CanvasPattern | string {
  if (typeof fill === 'string') return fill;
  const k = (v.scale * tileMm) / 64;
  fill.setTransform(new DOMMatrix([k, 0, 0, k, v.ox, v.oy]));
  return fill;
}

// ---------- Paths ----------

function polyPath(ctx: CanvasRenderingContext2D, pts: Point[], closed = true, radiusPx = 0) {
  ctx.beginPath();
  if (pts.length === 0) return;
  if (!closed || radiusPx <= 0 || pts.length < 3) {
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
    if (closed) ctx.closePath();
    return;
  }
  // Rounded corners, never more than half the shorter neighbouring edge.
  const n = pts.length;
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.moveTo(...mid(pts[n - 1]!, pts[0]!));
  for (let i = 0; i < n; i++) {
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const prev = pts[(i - 1 + n) % n]!;
    const r = Math.min(radiusPx, distance(prev, cur) / 2, distance(cur, next) / 2);
    ctx.arcTo(cur[0], cur[1], ...mid(cur, next), r);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------- Main ----------

export function render(ctx: CanvasRenderingContext2D, s: Scene) {
  const { garden: g, view: v, style: st } = s;
  const P = st.plan;
  const pats = patterns(ctx, st);
  const scr = (p: Point) => toScreen(v, p);

  // Ground outside the garden, and the grid.
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, s.width, s.height);
  if (!s.minimal) drawGrid(ctx, s);

  // The garden itself.
  if (g.boundary.length >= 3) {
    polyPath(ctx, g.boundary.map(scr));
    ctx.fillStyle = placePattern(pats.lawn, v, pats.tileMm.lawn);
    ctx.fill();
  }

  if (s.trace && g.trace) {
    const t = g.trace;
    const h = (t.widthMm * s.trace.naturalHeight) / s.trace.naturalWidth;
    const [x, y] = scr([t.x, t.y + h]);
    ctx.globalAlpha = t.opacity;
    ctx.drawImage(s.trace, x, y, t.widthMm * v.scale, h * v.scale);
    ctx.globalAlpha = 1;
  }

  if (g.boundary.length >= 2) {
    polyPath(ctx, g.boundary.map(scr), g.boundary.length >= 3);
    ctx.strokeStyle = P.fence;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  for (const f of g.features) drawFeature(ctx, s, f, pats);
  const planted = s.plantOf ? g.plantings.filter(isActive) : [];
  for (const pl of planted) drawPlanting(ctx, s, pl, s.plantOf!(pl.plantId));
  if (s.sunGrid) drawHeatMap(ctx, s, s.sunGrid);
  if (s.shadows) drawShadows(ctx, s, s.shadows);
  if (planted.length) drawFindings(ctx, s);
  const bedsInUse = new Set(planted.map((p) => p.featureId));
  for (const f of g.features) drawLabel(ctx, s, f, bedsInUse.has(f.id));
  for (const pl of planted) drawPlantLabel(ctx, s, pl, s.plantOf!(pl.plantId));

  if (s.selected) drawSelection(ctx, s, s.selected);
  if (s.draft) drawDraft(ctx, s, s.draft);
  if (s.plantDraft) drawPlantDraft(ctx, s, s.plantDraft);
  if (s.crosshair) drawCrosshair(ctx, s);

  if (s.minimal) return;
  drawScaleBar(ctx, s);
  drawNorth(ctx, s);
}

function drawGrid(ctx: CanvasRenderingContext2D, s: Scene) {
  const { minor, major } = gridStep(s.view.scale);
  const v = s.view;
  const x0 = Math.floor(-v.ox / v.scale / minor) * minor;
  const x1 = (s.width - v.ox) / v.scale;
  const yTop = v.oy / v.scale;
  const yBottom = (v.oy - s.height) / v.scale;
  ctx.lineWidth = 1;
  for (const [step, alpha] of [[minor, 0.07], [major, 0.16]] as const) {
    ctx.strokeStyle = s.style.plan.bedStroke;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      const sx = Math.round(v.ox + x * v.scale) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, s.height);
    }
    for (let y = Math.floor(yBottom / step) * step; y <= yTop; y += step) {
      const sy = Math.round(v.oy - y * v.scale) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(s.width, sy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function featureColours(f: Feature, P: PlanPalette): { fill: string; stroke: string; dash?: number[] } {
  switch (f.kind) {
    case 'bed':
      return { fill: P.bedFill, stroke: P.bedStroke };
    case 'path':
      return { fill: P.path, stroke: P.bedStroke };
    case 'fence':
    case 'wall':
      return { fill: P.fence, stroke: P.fence };
    case 'hedge':
      return { fill: P.canopy, stroke: P.canopyStroke };
    case 'greenhouse':
      return { fill: P.glass, stroke: P.glassStroke };
    case 'water':
      return { fill: P.water, stroke: P.buildingStroke };
    case 'tree':
      return { fill: P.canopy, stroke: P.canopyStroke, dash: [6, 5] };
    case 'compost':
      return { fill: P.bedFill, stroke: P.buildingStroke };
    default:
      return { fill: P.building, stroke: P.buildingStroke };
  }
}

function drawFeature(ctx: CanvasRenderingContext2D, s: Scene, f: Feature, pats: Patterns) {
  const v = s.view;
  const c = featureColours(f, s.style.plan);
  const pts = f.footprint.map((p) => toScreen(v, p));
  const radius = f.kind === 'bed' ? s.style.bedRadiusMm * v.scale : 0;
  polyPath(ctx, pts, true, radius);
  ctx.fillStyle = f.kind === 'bed' ? placePattern(pats.bed, v, pats.tileMm.bed) : c.fill;
  ctx.fill();
  ctx.setLineDash(c.dash ?? []);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = s.hoverId === f.id ? 3 : f.kind === 'tree' ? 1.5 : 2;
  ctx.stroke();
  ctx.setLineDash([]);

  if (f.kind === 'greenhouse' && pts.length === 4) {
    // Glazing bars across the short side.
    ctx.strokeStyle = c.stroke;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [a, b, , d] = pts as [Point, Point, Point, Point];
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      ctx.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      ctx.lineTo(d[0] + (b[0] - a[0]) * t, d[1] + (b[1] - a[1]) * t);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (f.circle) {
    const [cx, cy] = toScreen(v, f.circle.centre);
    ctx.fillStyle = s.style.plan.bedStroke;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.5, 150 * v.scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

function labelPoint(f: Feature): Point {
  if (f.circle) return [f.circle.centre[0], f.circle.centre[1] - f.circle.radiusMm * 0.45];
  if (f.line) {
    const m = Math.floor((f.line.length - 1) / 2);
    const a = f.line[m]!;
    const b = f.line[m + 1] ?? a;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  return centroid(f.footprint);
}

function drawLabel(ctx: CanvasRenderingContext2D, s: Scene, f: Feature, planted = false) {
  const v = s.view;
  const st = s.style;
  if (f.kind === 'fence' || f.kind === 'wall') {
    if (!f.name) return; // fences and walls only carry a label when named
  }
  const text = st.labels === 'sign' || st.labels === 'caps' ? featureLabel(f).toUpperCase() : featureLabel(f);
  // A bed with plants in it has its name just above it, out of the plants' way.
  const b = planted ? bounds(f.footprint) : null;
  const at = b ? toScreen(v, [(b.minX + b.maxX) / 2, b.maxY]) : toScreen(v, labelPoint(f));
  const x = at[0];
  const y = at[1] - (b ? 14 : 0);
  const size = st.labels === 'hand' ? 17 : st.labels === 'caps' ? 11 : 13;
  const weight = st.labels === 'hand' || st.labels === 'sign' ? 700 : st.labels === 'pill' ? 700 : 500;
  const italic = st.labels === 'serif' ? 'italic ' : '';
  ctx.font = `${italic}${weight} ${size}px ${st.labels === 'pill' ? st.fontBody : st.fontPlan}`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = st.labels === 'sign' || st.labels === 'caps' ? '1px' : '0px';
  const w = ctx.measureText(text).width;
  // Skip labels that would swamp a feature drawn very small.
  const xs = f.footprint.map((p) => p[0]);
  const span = (Math.max(...xs) - Math.min(...xs)) * v.scale;
  if (span < Math.min(w * 0.6, 40)) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (st.labels === 'sign') {
    roundRect(ctx, x - w / 2 - 7, y - 11, w + 14, 22, 4);
    ctx.fillStyle = st.accent;
    ctx.fill();
    ctx.strokeStyle = st.accentText;
    ctx.lineWidth = 1;
    roundRect(ctx, x - w / 2 - 4.5, y - 8.5, w + 9, 17, 2.5);
    ctx.stroke();
    ctx.fillStyle = st.accentText;
  } else if (st.labels === 'pill') {
    roundRect(ctx, x - w / 2 - 9, y - 11, w + 18, 22, 11);
    ctx.fillStyle = st.plan.paper;
    ctx.fill();
    ctx.fillStyle = st.plan.label;
  } else {
    // A soft halo keeps text readable over any fill.
    ctx.lineWidth = 4;
    ctx.strokeStyle = st.plan.paper;
    ctx.globalAlpha = 0.85;
    ctx.strokeText(text, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = st.plan.label;
  }
  ctx.fillText(text, x, y + (st.labels === 'hand' ? 1 : 0.5));
}

function lengthTag(ctx: CanvasRenderingContext2D, s: Scene, a: Point, b: Point) {
  const v = s.view;
  const [ax, ay] = toScreen(v, a);
  const [bx, by] = toScreen(v, b);
  if (Math.hypot(bx - ax, by - ay) < 46) return;
  const text = formatLength(distance(a, b));
  ctx.font = `600 11px ${s.style.fontBody}`;
  const w = ctx.measureText(text).width + 10;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  roundRect(ctx, mx - w / 2, my - 9, w, 18, 9);
  ctx.fillStyle = s.style.plan.paper;
  ctx.fill();
  ctx.strokeStyle = s.style.plan.selection;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = s.style.plan.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, mx, my + 0.5);
}

function drawSelection(ctx: CanvasRenderingContext2D, s: Scene, t: Target) {
  const g = s.garden;
  const v = s.view;
  const sel = s.style.plan.selection;
  if (t.type === 'planting') {
    const pl = g.plantings.find((x) => x.id === t.id);
    if (!pl || !s.plantOf) return;
    const plant = s.plantOf(pl.plantId);
    shapePath(ctx, s, plantingShape(pl, plant), (spreadOf(plant) / 2) * v.scale + 5);
    ctx.strokeStyle = sel;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (pl.layout === 'row' && pl.endPoint) lengthTag(ctx, s, [pl.x, pl.y], pl.endPoint);
    for (const p of plantingHandles(pl)) handle(ctx, toScreen(v, p), sel, s.style.plan.paper, false);
    return;
  }
  const f = t.type === 'feature' ? g.features.find((x) => x.id === t.id) : undefined;
  if (t.type === 'feature' && !f) return;

  // Outline.
  const outline = t.type === 'boundary' ? g.boundary : f!.footprint;
  polyPath(ctx, outline.map((p) => toScreen(v, p)), t.type === 'feature' || g.boundary.length >= 3);
  ctx.strokeStyle = sel;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (f?.circle) {
    const c = f.circle;
    lengthTag(ctx, s, c.centre, [c.centre[0] + c.radiusMm, c.centre[1]]);
    handle(ctx, toScreen(v, [c.centre[0] + c.radiusMm, c.centre[1]]), sel, s.style.plan.paper, false);
    return;
  }

  const pts = pointsOf(g, t) ?? [];
  const closed = isClosed(g, t);
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) lengthTag(ctx, s, pts[i]!, pts[(i + 1) % pts.length]!);
  pts.forEach((p, i) => handle(ctx, toScreen(v, p), sel, s.style.plan.paper, i === s.selectedVertex));
}

function handle(ctx: CanvasRenderingContext2D, [x, y]: Point, colour: string, paper: string, active: boolean) {
  ctx.beginPath();
  ctx.rect(x - 5, y - 5, 10, 10);
  ctx.fillStyle = active ? colour : paper;
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawDraft(ctx: CanvasRenderingContext2D, s: Scene, d: Draft) {
  const v = s.view;
  const sel = s.style.plan.selection;
  const pts = d.cursor ? [...d.points, d.cursor] : d.points;
  ctx.strokeStyle = sel;
  ctx.fillStyle = sel;
  ctx.lineWidth = 2;

  if (d.geometry === 'rect' && d.points[0] && d.cursor) {
    const a = d.points[0];
    const b = d.cursor;
    const corners: Point[] = [a, [b[0], a[1]], b, [a[0], b[1]]];
    polyPath(ctx, corners.map((p) => toScreen(v, p)));
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    lengthTag(ctx, s, corners[0]!, corners[1]!);
    lengthTag(ctx, s, corners[1]!, corners[2]!);
  } else if (d.geometry === 'circle' && d.points[0] && d.cursor) {
    const c = toScreen(v, d.points[0]);
    const r = distance(d.points[0], d.cursor);
    ctx.beginPath();
    ctx.arc(c[0], c[1], r * v.scale, 0, Math.PI * 2);
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    lengthTag(ctx, s, d.points[0], d.cursor);
  } else if (pts.length > 0) {
    if (d.geometry === 'line' && d.widthMm && pts.length >= 2) {
      ctx.lineWidth = Math.max(2, d.widthMm * v.scale);
      ctx.globalAlpha = 0.25;
      ctx.lineJoin = 'miter';
      polyPath(ctx, pts.map((p) => toScreen(v, p)), false);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
    }
    polyPath(ctx, d.points.map((p) => toScreen(v, p)), false);
    ctx.stroke();
    if (d.cursor && d.points.length > 0) {
      ctx.setLineDash([6, 5]);
      polyPath(ctx, [d.points[d.points.length - 1]!, d.cursor].map((p) => toScreen(v, p)), false);
      ctx.stroke();
      ctx.setLineDash([]);
      lengthTag(ctx, s, d.points[d.points.length - 1]!, d.cursor);
    }
    for (let i = 0; i < d.points.length - 1; i++) lengthTag(ctx, s, d.points[i]!, d.points[i + 1]!);
    d.points.forEach((p, i) => {
      const [x, y] = toScreen(v, p);
      ctx.beginPath();
      ctx.arc(x, y, i === 0 && d.geometry === 'area' ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (d.cursor) {
    const [x, y] = toScreen(v, d.cursor);
    ctx.beginPath();
    ctx.arc(x, y, d.snap === 'vertex' ? 9 : 5, 0, Math.PI * 2);
    ctx.strokeStyle = sel;
    ctx.lineWidth = d.snap === 'vertex' ? 2.5 : 1.5;
    ctx.stroke();
    if (d.typed) {
      // The length being typed, waiting for Enter.
      const text = `${d.typed} ↵`;
      ctx.font = `700 13px ${s.style.fontBody}`;
      const w = ctx.measureText(text).width + 16;
      roundRect(ctx, x + 14, y - 34, w, 24, 6);
      ctx.fillStyle = sel;
      ctx.fill();
      ctx.fillStyle = s.style.plan.paper;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 22, y - 21.5);
    }
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, s: Scene) {
  const cx = Math.round(s.width / 2) + 0.5;
  const cy = Math.round(s.height / 2) + 0.5;
  const sel = s.style.plan.selection;
  // A pale halo under the lines keeps them visible over any fill.
  for (const [colour, width] of [[s.style.plan.paper, 5], [sel, 2]] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of [
      [cx - 22, cy, cx - 7, cy],
      [cx + 7, cy, cx + 22, cy],
      [cx, cy - 22, cx, cy - 7],
      [cx, cy + 7, cx, cy + 22],
    ] as const) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = sel;
  ctx.fill();
}

function drawScaleBar(ctx: CanvasRenderingContext2D, s: Scene) {
  const L = scaleBarLength(s.view.scale);
  const px = L * s.view.scale;
  const x = 16;
  const y = s.height - 22;
  const P = s.style.plan;
  ctx.fillStyle = P.paper;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, x - 8, y - 22, px + 16, 34, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.label;
  ctx.fillRect(x, y, px / 2, 5);
  ctx.strokeStyle = P.label;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, px - 1, 4);
  ctx.font = `600 11px ${s.style.fontBody}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('0', x, y - 5);
  ctx.textAlign = 'right';
  ctx.fillText(formatLength(L), x + px, y - 5);
}

export const NORTH_RADIUS = 20;
export const northCentre = (s: { width: number }): Point => [s.width - 36, 36];

function drawNorth(ctx: CanvasRenderingContext2D, s: Scene) {
  const [cx, cy] = northCentre(s);
  const P = s.style.plan;
  const a = (s.garden.northRotationDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, NORTH_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = P.paper;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = P.label;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(6, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fillStyle = P.selection;
  ctx.fill();
  ctx.font = `700 10px ${s.style.fontBody}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.label;
  ctx.fillText('N', 0, -NORTH_RADIUS - 8);
  ctx.restore();
  if (s.sun && s.sun.altitude > 0) {
    // The sun on the compass ring, in the direction it's shining from.
    const b = ((s.sun.azimuth + s.garden.northRotationDeg) * Math.PI) / 180;
    const x = cx + Math.sin(b) * NORTH_RADIUS;
    const y = cy - Math.cos(b) * NORTH_RADIUS;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = SUN_COLOUR;
    ctx.fill();
    ctx.strokeStyle = P.label;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ---------- Sun and shade ----------

const SUN_COLOUR = '#f2b632';
const SHADOW: Record<Mode, { colour: string; alpha: number }> = {
  light: { colour: '#1d2433', alpha: 0.34 },
  dark: { colour: '#000000', alpha: 0.62 },
};

/** Each shadow, but not over the thing casting it: a shed's roof isn't in its own shadow. */
function drawShadows(ctx: CanvasRenderingContext2D, s: Scene, shades: Shade[]) {
  const v = s.view;
  const { colour, alpha } = SHADOW[s.style.mode];
  for (const sh of shades) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s.width, s.height);
    sh.own.forEach((p, i) => {
      const [x, y] = toScreen(v, p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip('evenodd');
    // One path for all the pieces, so overlaps within one shadow aren't darker.
    ctx.beginPath();
    for (const poly of sh.polygons) {
      poly.forEach((p, i) => {
        const [x, y] = toScreen(v, p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.globalAlpha = alpha * sh.opacity;
    ctx.fillStyle = colour;
    ctx.fill('nonzero');
    ctx.restore();
  }
}

/** Colours for sun hours, dark (shade) to bright (sun). Hours past the last stop share its colour. */
export const HOURS_STOPS: [number, string][] = [
  [0, '#2d1b5a'],
  [3, '#3b5ba5'],
  [6, '#2fa38a'],
  [9, '#a6d05a'],
  [12, '#fde74c'],
];

export function hoursColour(h: number): [number, number, number] {
  const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  const stops = HOURS_STOPS;
  if (h <= stops[0]![0]) return hex(stops[0]![1]);
  for (let i = 1; i < stops.length; i++) {
    const [h1, c1] = stops[i]!;
    const [h0, c0] = stops[i - 1]!;
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0);
      const a = hex(c0);
      const b = hex(c1);
      return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * t)) as [number, number, number];
    }
  }
  return hex(stops[stops.length - 1]![1]);
}

const heatCache = new WeakMap<SunGrid, HTMLCanvasElement>();

/** The grid as a small image, one pixel per cell, smoothed as it's scaled up. */
function heatImage(grid: SunGrid): HTMLCanvasElement {
  const hit = heatCache.get(grid);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = grid.cols;
  c.height = grid.rows;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(grid.cols, grid.rows);
  for (let r = 0; r < grid.rows; r++) {
    for (let col = 0; col < grid.cols; col++) {
      const i = r * grid.cols + col;
      if (!grid.inside[i]) continue;
      const [R, G, B] = hoursColour(grid.hours[i]!);
      // Image rows run top down; grid rows run bottom up.
      const o = ((grid.rows - 1 - r) * grid.cols + col) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  heatCache.set(grid, c);
  return c;
}

function drawHeatMap(ctx: CanvasRenderingContext2D, s: Scene, grid: SunGrid) {
  const v = s.view;
  const [x, y] = toScreen(v, [grid.x0, grid.y0 + grid.rows * grid.step]);
  ctx.save();
  if (s.garden.boundary.length >= 3) {
    polyPath(ctx, s.garden.boundary.map((p) => toScreen(v, p)));
    ctx.clip();
  }
  ctx.globalAlpha = 0.72;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(heatImage(grid), x, y, grid.cols * grid.step * v.scale, grid.rows * grid.step * v.scale);
  ctx.globalAlpha = 1;
  // Lines where the light bands change, so they don't rely on colour alone: dashed at 3 h, solid at 6 h.
  for (const [threshold, dash] of [[3, [5, 4]], [6, []]] as const) {
    ctx.beginPath();
    for (const [a, b2] of contours(grid, threshold)) {
      const [ax, ay] = toScreen(v, a);
      const [bx, by] = toScreen(v, b2);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.setLineDash([...dash]);
    ctx.strokeStyle = s.style.plan.label;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------- Plantings ----------

/** The ends of a row or the corners of a block, which can be dragged. */
export function plantingHandles(pl: Planting): Point[] {
  if (pl.layout === 'single' || !pl.endPoint || !pl.layout) return [];
  return [[pl.x, pl.y], pl.endPoint];
}

/** A path around a planting's plants, padded by this many pixels. */
function shapePath(ctx: CanvasRenderingContext2D, s: Scene, shape: PlantingShape, padPx: number) {
  const v = s.view;
  ctx.beginPath();
  if (shape.kind === 'point') {
    const [x, y] = toScreen(v, shape.p);
    ctx.arc(x, y, padPx, 0, Math.PI * 2);
  } else if (shape.kind === 'segment') {
    const a = toScreen(v, shape.a);
    const b = toScreen(v, shape.b);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.arc(b[0], b[1], padPx, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.arc(a[0], a[1], padPx, ang + Math.PI / 2, ang + (Math.PI * 3) / 2);
    ctx.closePath();
  } else {
    const [x0, y0] = toScreen(v, [shape.min[0], shape.max[1]]);
    const [x1, y1] = toScreen(v, [shape.max[0], shape.min[1]]);
    ctx.roundRect(x0 - padPx, y0 - padPx, x1 - x0 + padPx * 2, y1 - y0 + padPx * 2, padPx);
  }
}

/** Draws plants as circles of their spread; when they're too small to see apart, as one band. */
function drawPlants(ctx: CanvasRenderingContext2D, s: Scene, pts: Point[], shape: PlantingShape, spreadMm: number, colour: string, alpha: number) {
  const v = s.view;
  const r = (spreadMm / 2) * v.scale;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  if (r < 2 && pts.length > 1) {
    ctx.globalAlpha = alpha * 0.8;
    shapePath(ctx, s, shape, Math.max(1.5, r));
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  for (const p of pts) {
    const [x, y] = toScreen(v, p);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = r > 6 ? 1.5 : 1;
  ctx.stroke();
  if (r > 7) {
    ctx.beginPath();
    for (const p of pts) {
      const [x, y] = toScreen(v, p);
      ctx.moveTo(x + 2, y);
      ctx.arc(x, y, 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanting(ctx: CanvasRenderingContext2D, s: Scene, pl: Planting, plant: Plant) {
  const pts = plantPositions(pl, plant);
  drawPlants(ctx, s, pts, plantingShape(pl, plant), spreadOf(plant), cropColour(plant.id, s.style.mode), s.hoverId === pl.id ? 1 : 0.9);
}

/** Outlines plantings with a problem; the one picked in the list is drawn strongly. */
function drawFindings(ctx: CanvasRenderingContext2D, s: Scene) {
  const g = s.garden;
  const mode = s.style.mode;
  const byId = new Map(g.plantings.map((p) => [p.id, p]));
  const outline = (id: string, colour: string, width: number, dash: number[]) => {
    const pl = byId.get(id);
    if (!pl || !isActive(pl)) return;
    const plant = s.plantOf!(pl.plantId);
    shapePath(ctx, s, plantingShape(pl, plant), (spreadOf(plant) / 2) * s.view.scale + 3 + width);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const warned = new Set((s.findings ?? []).filter((f) => f.level === 'warn').flatMap((f) => f.plantingIds));
  for (const id of warned) outline(id, WARN_COLOUR[mode], 1.5, [4, 3]);
  const focus = s.findings?.find((f) => f.id === s.focusFinding);
  if (focus) for (const id of focus.plantingIds) outline(id, focus.level === 'warn' ? WARN_COLOUR[mode] : GOOD[mode], 3.5, []);
}

/** The plant's name beside a planting, when there's room. */
function drawPlantLabel(ctx: CanvasRenderingContext2D, s: Scene, pl: Planting, plant: Plant) {
  const v = s.view;
  const shape = plantingShape(pl, plant);
  const n = plantCount(pl, plant);
  const text = n > 1 ? `${plant.commonName} ×${n}` : plant.commonName;
  ctx.font = `600 11px ${s.style.fontBody}`;
  const w = ctx.measureText(text).width;
  const r = (spreadOf(plant) / 2) * v.scale;
  let x: number;
  let y: number;
  if (shape.kind === 'point') {
    if (r * 2 < 26) return;
    [x, y] = toScreen(v, shape.p);
    y += r + 9;
  } else if (shape.kind === 'segment') {
    const a = toScreen(v, shape.a);
    const b = toScreen(v, shape.b);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) + r * 2 < w * 0.8) return;
    x = (a[0] + b[0]) / 2;
    y = (a[1] + b[1]) / 2 - Math.max(r, 3) - 8;
  } else {
    const a = toScreen(v, [shape.min[0], shape.max[1]]);
    const b = toScreen(v, [shape.max[0], shape.min[1]]);
    if (b[0] - a[0] + r * 2 < w * 0.8) return;
    x = (a[0] + b[0]) / 2;
    y = (a[1] + b[1]) / 2;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = s.style.plan.paper;
  ctx.globalAlpha = 0.9;
  ctx.strokeText(text, x, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.style.plan.label;
  ctx.fillText(text, x, y);
}

/** Where the plants will go while you place them, with how many fit. */
function drawPlantDraft(ctx: CanvasRenderingContext2D, s: Scene, d: PlantDraft) {
  const v = s.view;
  const sel = s.style.plan.selection;
  const start = d.points[0];
  const end = d.cursor;
  if (!end) return;
  const sp = d.plant.size.spacingMm;
  const pl: Planting =
    d.layout === 'single' || !start
      ? { id: 'draft', plantId: d.plant.id, featureId: '', x: end[0], y: end[1], layout: 'single' }
      : { id: 'draft', plantId: d.plant.id, featureId: '', x: start[0], y: start[1], layout: d.layout, endPoint: end };
  let n = 1;
  if (start && d.layout === 'row') n = rowCount(start, end, sp);
  if (start && d.layout === 'block') {
    const { cols, rows } = blockGrid(start, end, sp);
    n = cols * rows;
  }
  if (d.layout === 'block' && start) {
    const a = toScreen(v, start);
    const b = toScreen(v, end);
    ctx.beginPath();
    ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    ctx.strokeStyle = sel;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (n <= MAX_PLANTS) drawPlants(ctx, s, plantPositions(pl, d.plant), plantingShape(pl, d.plant), spreadOf(d.plant), cropColour(d.plant.id, s.style.mode), 0.6);
  if (d.layout === 'row' && start) lengthTag(ctx, s, start, end);
  // How many, beside the cursor.
  const [x, y] = toScreen(v, end);
  const text = d.typed ? `${d.typed} ↵` : n > MAX_PLANTS ? 'Too many plants' : `${n} × ${d.plant.commonName}`;
  ctx.font = `700 12px ${s.style.fontBody}`;
  const w = ctx.measureText(text).width + 16;
  roundRect(ctx, x + 14, y - 34, w, 22, 6);
  ctx.fillStyle = sel;
  ctx.fill();
  ctx.fillStyle = s.style.plan.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 22, y - 22.5);
}


/** Which edges of a square the contour crosses, for each pattern of corners above the threshold (bottom-left, bottom-right, top-right, top-left). */
const MARCH: [number, number][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[3, 2]], [[0, 2]], [[0, 1], [3, 2]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
];

/** Smooth contour lines at a number of hours, by marching squares over the cell centres. */
export function contours(grid: SunGrid, threshold: number): [Point, Point][] {
  const out: [Point, Point][] = [];
  const { cols, rows, step, x0, y0, hours, inside } = grid;
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const idx = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c];
      if (idx.some((i) => !inside[i])) continue;
      const val = idx.map((i) => hours[i]!);
      const kind = val.reduce((k, h, n) => k | ((h >= threshold ? 1 : 0) << n), 0);
      const segs = MARCH[kind]!;
      if (!segs.length) continue;
      const cx = x0 + (c + 0.5) * step;
      const cy = y0 + (r + 0.5) * step;
      const corner: Point[] = [[cx, cy], [cx + step, cy], [cx + step, cy + step], [cx, cy + step]];
      // Where on an edge the value crosses the threshold, by straight-line interpolation.
      const at = (edge: number): Point => {
        const [i, j] = [[0, 1], [1, 2], [3, 2], [0, 3]][edge]!;
        const t = (threshold - val[i!]!) / (val[j!]! - val[i!]! || 1);
        const a = corner[i!]!;
        const b = corner[j!]!;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      };
      for (const [e1, e2] of segs) out.push([at(e1), at(e2)]);
    }
  }
  return out;
}