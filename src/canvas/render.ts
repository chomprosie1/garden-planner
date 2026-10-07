// Draws the plan. Everything is drawn from the garden model and the current
// look; nothing here changes state.

import { bounds, centroid, distance } from '../geometry/polygon';
import { featureLabel, isClosed, pointsOf, type Target } from '../model/features';
import { artFor, drawPlant, hashString, OVERHANG, shadeHex, stageLook, type Look } from '../art/plants';
import { bucketFor, paintFor, plantSprite, VARIANTS } from '../art/sprites';
import type { Projected } from '../lifecycle/projection';
import { currentStage, type LifeStage } from '../lifecycle/stages';
import { SKETCH_WIDTH, sketchesOf } from '../model/sketches';
import type { Feature, Garden, Material, Plant, Planting, Point, Sketch, SketchColour, SketchKind } from '../model/types';
import { blockGrid, isActive, MAX_PLANTS, plantCount, plantingShape, plantPositions, rowCount, spreadOf, type Layout, type PlantingShape } from '../planting/place';
import type { Finding } from '../planting/rules';
import type { SunGrid } from '../sun/hours';
import type { Sun } from '../sun/position';
import { LEAF_MONTHS, type Shade } from '../sun/shadow';
import { LOOKS, type LookId, type Mode, type PlanPalette } from '../theme/looks';
import { drawEdgingTile, drawHedgeTile, drawMaterialTile, EDGING_TILE_MM, EDGING_WIDTH_MM, materialColour, MATERIAL_TILE_MM, mix, type Edging } from './materials';
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
  /** Show the sketch layer (pen marks, arrows, words). Shown unless false. */
  sketches?: boolean;
  /** A stroke being drawn by hand: a freehand shape, or a sketch. */
  stroke?: Stroke | null;
  /** Soft shadows under things with height, for depth. On unless false. */
  depth?: boolean;
  /** Something is being drawn, so shadows are fainter and lines easier to see. */
  drawing?: boolean;
  /** The month, 1 to 12, for trees in or out of leaf. Defaults to this month. */
  month?: number;
  /** Show the selected thing's rotate handle. */
  rotatable?: boolean;
  /** Leave out names and labels (small previews). */
  noLabels?: boolean;
  /** Alignment lines while moving something, garden mm. */
  guides?: Guide[];
  /** The plan on a day: plantings at their stage then, and that week's light, lawn and frost. */
  time?: TimeScene | null;
  /** A lens picking out some plantings; the rest of the plan is dimmed. */
  focus?: Focus | null;
}

export interface TimeScene {
  /** Each planting's stage on the day. Guessed stages get a dotted edge. */
  stageOf: (pl: Planting) => Projected;
  /** Which way, and how far, shadows fall on screen, per px of reach. null: the usual light from the top left. */
  light: Point | null;
  /** The lawn in its season: above 0 greener (spring), below 0 paler (a dry August). */
  lawn: number;
  /** Frost on the ground. */
  frost: boolean;
  /** Greenhouses and cold frames clear of the frost. */
  thawed?: Set<string>;
  /** Beds standing empty, which glow faintly. */
  gaps: Set<string>;
}

export type FocusKind = 'flower' | 'harvest' | 'water';
export interface Focus {
  kind: FocusKind;
  /** The plantings it picks out. */
  ids: Set<string>;
}

const stageFor = (s: Scene, pl: Planting): LifeStage => (s.time ? s.time.stageOf(pl).stage : currentStage(pl));
/** The usual light, from the top left: shadows fall down and to the right. */
const lightOf = (s: Scene): Point => s.time?.light ?? [0.7, 0.9];

/** A line showing two things lined up: vertical at x, or horizontal at y, between two points along it. */
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number };

/** Where the rotate handle sits for a selected outline: a little above its top, on screen. */
export function rotateHandleAt(s: { view: Viewport }, pts: Point[]): Point | null {
  const b = bounds(pts.map((q) => toScreen(s.view, q)));
  if (!b) return null;
  return [(b.minX + b.maxX) / 2, b.minY - 26];
}

/** A hand-drawn stroke in progress. */
export interface Stroke {
  points: Point[];
  /** A freehand area closes back to its start. */
  closed?: boolean;
  /** A freehand line feature's width, mm. */
  widthMm?: number;
  /** A sketch mark: its kind and colour. */
  sketch?: { kind: SketchKind; colour: SketchColour };
}

/** A planting being placed: the plant, how it's laid out, and the points so far. */
export interface PlantDraft {
  plant: Plant;
  layout: Layout;
  points: Point[];
  cursor: Point | null;
  typed?: string;
}

export const WARN_COLOUR: Record<Mode, string> = { light: '#9a3412', dark: '#ffa45c' };
const GOOD: Record<Mode, string> = { light: '#2f7d32', dark: '#7bd88f' };

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
  if (s.pattern !== 'hatch') {
    bed = materialFill(ctx, s, 'soil');
    tileMm.bed = MATERIAL_TILE_MM.soil;
  }
  const result = { lawn, bed, tileMm };
  patternCache.set(key, result);
  return result;
}

/** A bed's edging texture in this look. */
function edgingFill(ctx: CanvasRenderingContext2D, s: PlanStyle, e: Edging): CanvasPattern | string {
  const key = `edge-${s.look}-${s.mode}-${e}`;
  let fill = materialCache.get(key);
  if (!fill) {
    fill = ctx.createPattern(tile(64, (c) => drawEdgingTile(c, e, s.plan, s.mode)), 'repeat') ?? s.plan.bedStroke;
    materialCache.set(key, fill);
  }
  return fill;
}

/** A clipped hedge's leafy texture in this look. */
function hedgeFill(ctx: CanvasRenderingContext2D, s: PlanStyle): CanvasPattern | string {
  const key = `hedge-${s.look}-${s.mode}`;
  let fill = materialCache.get(key);
  if (!fill) {
    fill = ctx.createPattern(tile(64, (c) => drawHedgeTile(c, s.mode === 'dark' ? '#4f6e42' : '#5e8a4a', s.mode)), 'repeat') ?? s.plan.canopyStroke;
    materialCache.set(key, fill);
  }
  return fill;
}

const materialCache = new Map<string, CanvasPattern | string>();

/**
 * A material's texture in this look. Every look gets one, even the flat ones: in Minimal, a white lawn or
 * soil would otherwise vanish, and its faint marks read like the hatching on a technical drawing.
 */
function materialFill(ctx: CanvasRenderingContext2D, s: PlanStyle, m: Material): CanvasPattern | string {
  const key = `${s.look}-${s.mode}-${m}`;
  let fill = materialCache.get(key);
  if (!fill) {
    fill = ctx.createPattern(tile(64, (c) => drawMaterialTile(c, m, s.plan, s.mode)), 'repeat') ?? materialColour(m, s.plan, s.mode);
    materialCache.set(key, fill);
  }
  return fill;
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

/** The whole plan: what's on the ground, then what's being drawn or picked. */
export function render(ctx: CanvasRenderingContext2D, s: Scene) {
  renderStatic(ctx, s);
  renderLive(ctx, s);
}

/**
 * Everything that only changes when the garden, the look or the zoom does: ground, features, plants and labels.
 * The plan keeps this as an image with a margin round it, so panning just moves the image.
 */
export function renderStatic(ctx: CanvasRenderingContext2D, s: Scene) {
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
    if (s.time?.lawn) tintLawn(ctx, s, s.time.lawn);
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

  // Surfaces (lawns, gravel) lie under everything else; then soft shadows; then everything with height.
  for (const f of g.features) if (f.kind === 'surface') drawFeature(ctx, s, f, pats);
  const depth = s.depth !== false && !s.minimal && !s.shadows;
  if (depth) for (const f of g.features) drawFeatureShadow(ctx, s, f);
  for (const f of g.features) if (f.kind !== 'surface') drawFeature(ctx, s, f, pats);
  if (s.time?.frost) drawFrost(ctx, s);
  if (s.time?.gaps.size) for (const f of g.features) if (s.time.gaps.has(f.id)) drawGap(ctx, s, f);
  // On a day, plantings cleared since are back, and ones cleared by then are left out.
  const planted = s.plantOf ? (s.time ? g.plantings.filter((pl) => stageFor(s, pl) !== 'cleared') : g.plantings.filter(isActive)) : [];
  if (depth) for (const pl of planted) drawPlantingShadow(ctx, s, pl, s.plantOf!(pl.plantId));
  for (const pl of planted) drawPlanting(ctx, s, pl, s.plantOf!(pl.plantId));
  if (s.focus) drawFocus(ctx, s, s.focus, planted);
  if (s.sunGrid) drawHeatMap(ctx, s, s.sunGrid);
  if (s.shadows) drawShadows(ctx, s, s.shadows);
  if (planted.length) drawFindings(ctx, s);
  const bedsInUse = new Set(planted.map((p) => p.featureId));
  if (!s.noLabels) {
    for (const f of g.features) drawLabel(ctx, s, f, bedsInUse.has(f.id));
    for (const pl of planted) drawPlantLabel(ctx, s, pl, s.plantOf!(pl.plantId));
  }
  if (s.sketches !== false) for (const k of sketchesOf(g)) drawSketch(ctx, s, k);
}

/** What changes as you work: the selection, shapes and plants being drawn, the crosshair, scale bar and compass. */
export function renderLive(ctx: CanvasRenderingContext2D, s: Scene) {
  if (s.selected) drawSelection(ctx, s, s.selected);
  if (s.guides?.length) drawGuides(ctx, s, s.guides);
  if (s.stroke) drawStroke(ctx, s, s.stroke);
  if (s.draft) drawDraft(ctx, s, s.draft);
  if (s.plantDraft) drawPlantDraft(ctx, s, s.plantDraft);
  if (s.crosshair) drawCrosshair(ctx, s);

  if (s.minimal) return;
  drawScaleBar(ctx, s);
  drawNorth(ctx, s);
}

function drawGuides(ctx: CanvasRenderingContext2D, s: Scene, guides: Guide[]) {
  ctx.save();
  ctx.strokeStyle = s.style.accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  for (const g of guides) {
    const [a, b] = g.axis === 'x' ? [toScreen(s.view, [g.at, g.from]), toScreen(s.view, [g.at, g.to])] : [toScreen(s.view, [g.from, g.at]), toScreen(s.view, [g.to, g.at])];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Depth: soft shadows, lit from the top left ----------

/** How far a shadow falls, px, for something this tall: a little, and never more than half a metre. */
const shadowReach = (heightMm: number, scale: number) => Math.min(heightMm * 0.12, 500) * scale;
const shadowAlpha = (s: Scene) => (s.style.mode === 'dark' ? 0.4 : 0.2) * (s.drawing ? 0.5 : 1);
const canBlur = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

function drawFeatureShadow(ctx: CanvasRenderingContext2D, s: Scene, f: Feature) {
  const h = f.heightMm ?? 0;
  if (h <= 0 || f.kind === 'surface' || f.footprint.length < 3) return;
  const v = s.view;
  const d = shadowReach(f.kind === 'tree' ? Math.min(h, 3000) : h, v.scale);
  if (d < 1) return;
  const [lx, ly] = lightOf(s);
  const pts = f.footprint.map((p) => toScreen(v, p));
  const blur = Math.max(1, d * 0.5);
  const alpha = shadowAlpha(s) * (f.kind === 'greenhouse' || f.kind === 'cold-frame' ? 0.5 : 1);
  const b = bounds(pts)!;
  const pad = Math.ceil(blur * 3);
  const x0 = b.minX - pad + d * lx;
  const y0 = b.minY - pad + d * ly;
  const w = b.maxX - b.minX + 2 * pad;
  const hh = b.maxY - b.minY + 2 * pad;
  if (x0 > s.width || y0 > s.height || x0 + w < 0 || y0 + hh < 0) return;
  const dpr = ctx.getTransform().a || 1;
  // A blur over the whole plan is slow, so each shadow is blurred once on a canvas just big enough for it, and
  // kept until the feature or the zoom changes: the year's light only moves it.
  const pw = Math.ceil(w * dpr);
  const ph = Math.ceil(hh * dpr);
  if (canBlur && pw * ph < 4e6) {
    let img = shadowImages.get(f);
    if (!img || img.scale !== v.scale || img.dpr !== dpr || img.canvas.width !== pw || img.canvas.height !== ph) {
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const sc = c.getContext('2d')!;
      sc.setTransform(dpr, 0, 0, dpr, (pad - b.minX) * dpr, (pad - b.minY) * dpr);
      sc.filter = `blur(${blur.toFixed(1)}px)`;
      sc.fillStyle = '#1a140c';
      polyPath(sc, pts);
      sc.fill();
      img = { canvas: c, scale: v.scale, dpr };
      shadowImages.set(f, img);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img.canvas, x0, y0, pw / dpr, ph / dpr);
    ctx.restore();
    return;
  }
  ctx.save();
  if (canBlur) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1a140c';
  ctx.translate(d * lx, d * ly);
  polyPath(ctx, pts);
  ctx.fill();
  ctx.restore();
}

/** Each feature's blurred shadow, at the zoom it was drawn for. Features are replaced when they change, so these go with them. */
const shadowImages = new WeakMap<Feature, { canvas: HTMLCanvasElement; scale: number; dpr: number }>();

/** A soft round shadow, drawn once and reused for every plant. */
let plantShadow: HTMLCanvasElement | null = null;
function plantShadowImage(): HTMLCanvasElement {
  if (plantShadow) return plantShadow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(26,20,12,0.9)');
  grad.addColorStop(0.55, 'rgba(26,20,12,0.6)');
  grad.addColorStop(1, 'rgba(26,20,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (plantShadow = c);
}

/** Shadows under plants that stand up from the bed: not seeds, seedlings or anything still only planned. */
function drawPlantingShadow(ctx: CanvasRenderingContext2D, s: Scene, pl: Planting, plant: Plant) {
  const look = stageLook(stageFor(s, pl), plant, pl);
  const tall = (plant.size.heightMm ?? 300) * look.grow;
  if (look.ghost || look.seeds || look.seedling || tall < 250) return;
  const v = s.view;
  const r = (spreadOf(plant) / 2) * v.scale * look.grow;
  if (r < 4) return;
  const d = Math.min(shadowReach(tall, v.scale), r * 0.45);
  // A low sun's shadow is longer, but never leaves the plant behind.
  const [lx, ly] = lightOf(s);
  const k = Math.min(1, (r * 0.9) / Math.max(1e-6, d * Math.hypot(lx, ly)));
  const img = plantShadowImage();
  ctx.globalAlpha = shadowAlpha(s);
  const size = r * 2.1;
  for (const p of plantPositions(pl, plant)) {
    const [x, y] = toScreen(v, p);
    if (x < -size || y < -size || x > s.width + size || y > s.height + size) continue;
    ctx.drawImage(img, x + d * lx * k - size / 2, y + d * ly * k - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
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
    case 'cold-frame':
      return { fill: P.glass, stroke: P.glassStroke };
    case 'water':
      return { fill: P.water, stroke: P.buildingStroke };
    case 'tree':
      return { fill: P.canopy, stroke: P.canopyStroke, dash: [6, 5] };
    case 'compost':
      return { fill: P.bedFill, stroke: P.buildingStroke };
    case 'pot':
      return { fill: '#b8734a', stroke: '#8a5232' };
    case 'planter':
      return { fill: P.bedFill, stroke: '#5f6b62' };
    default:
      return { fill: P.building, stroke: P.buildingStroke };
  }
}

function drawFeature(ctx: CanvasRenderingContext2D, s: Scene, f: Feature, pats: Patterns) {
  const v = s.view;
  const c = featureColours(f, s.style.plan);
  const pts = f.footprint.map((p) => toScreen(v, p));
  // Curved beds are already round, so only straight-sided ones get the look's rounded corners.
  const radius = f.kind === 'bed' && !f.smooth ? s.style.bedRadiusMm * v.scale : 0;
  const material = f.material ?? (f.kind === 'surface' ? 'lawn' : undefined);
  polyPath(ctx, pts, true, radius);
  if (material) {
    // Lawns use the garden's own lawn pattern, so a drawn lawn matches the garden around it.
    ctx.fillStyle = material === 'lawn' && typeof pats.lawn !== 'string' ? placePattern(pats.lawn, v, pats.tileMm.lawn) : placePattern(materialFill(ctx, s.style, material), v, MATERIAL_TILE_MM[material]);
  } else if (f.kind === 'bed' || f.kind === 'planter' || f.kind === 'cold-frame') ctx.fillStyle = placePattern(pats.bed, v, pats.tileMm.bed);
  else if (f.kind === 'pot' && f.circle) return drawPot(ctx, s, f, pats);
  else if (f.kind === 'hedge') ctx.fillStyle = placePattern(hedgeFill(ctx, s.style), v, 800);
  else ctx.fillStyle = c.fill;
  if (f.kind === 'tree' && f.circle) return drawTree(ctx, s, f, c.stroke);
  ctx.fill();
  if (material === 'lawn' && s.time?.lawn) tintLawn(ctx, s, s.time.lawn);
  if (f.kind === 'cold-frame') {
    // A timber box, with soil seen through the glass lid.
    drawEdging(ctx, s, 'timber', 0);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (f.kind === 'greenhouse' || f.kind === 'cold-frame') {
    // A sheen across the glass.
    const bx = bounds(pts)!;
    const grad = ctx.createLinearGradient(bx.minX, bx.minY, bx.maxX, bx.maxY);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  if (f.edging && f.kind === 'bed') drawEdging(ctx, s, f.edging, radius);
  if (f.kind === 'planter') {
    ctx.save();
    ctx.clip();
    ctx.lineWidth = Math.max(3, 50 * v.scale) * 2;
    ctx.strokeStyle = s.style.mode === 'dark' ? '#55605a' : '#7d8a80';
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash(c.dash ?? []);
  // A surface's edge is just a little darker than the surface itself.
  ctx.strokeStyle = f.kind === 'surface' && material ? mix(materialColour(material, s.style.plan, s.style.mode), '#000000', s.style.mode === 'dark' ? 0.35 : 0.22) : c.stroke;
  ctx.lineWidth = s.hoverId === f.id ? 3 : f.kind === 'tree' || f.kind === 'surface' ? 1.5 : 2;
  ctx.stroke();
  ctx.setLineDash([]);

  if ((f.kind === 'greenhouse' || f.kind === 'cold-frame') && pts.length === 4) {
    // Glazing bars across the short side: four panes for a greenhouse, two lids for a cold frame.
    const panes = f.kind === 'greenhouse' ? 4 : 2;
    ctx.strokeStyle = c.stroke;
    ctx.globalAlpha = f.kind === 'greenhouse' ? 0.5 : 0.8;
    ctx.lineWidth = f.kind === 'greenhouse' ? 1 : Math.max(1, 40 * v.scale);
    ctx.beginPath();
    const [a, b, , d] = pts as [Point, Point, Point, Point];
    for (let i = 1; i < panes; i++) {
      const t = i / panes;
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

/** A pot from above: a terracotta rim round the compost. */
function drawPot(ctx: CanvasRenderingContext2D, s: Scene, f: Feature, pats: Patterns) {
  const v = s.view;
  const [cx, cy] = toScreen(v, f.circle!.centre);
  const r = Math.max(2, f.circle!.radiusMm * v.scale);
  const rim = Math.max(1.5, Math.min(r * 0.16, 40 * v.scale + 1));
  const terracotta = s.style.mode === 'dark' ? '#9a5f3c' : '#b8734a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = terracotta;
  ctx.fill();
  ctx.strokeStyle = s.style.mode === 'dark' ? '#6e3f24' : '#8a5232';
  ctx.lineWidth = s.hoverId === f.id ? 2.5 : 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, r - rim), 0, Math.PI * 2);
  ctx.fillStyle = placePattern(pats.bed, v, pats.tileMm.bed);
  ctx.fill();
  // A highlight on the rim, lit from the top left.
  ctx.beginPath();
  ctx.arc(cx, cy, r - rim / 2, Math.PI * 1.05, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, rim * 0.45);
  ctx.stroke();
}

/** A bed's rim of timber, brick or stone, drawn just inside its edge. */
function drawEdging(ctx: CanvasRenderingContext2D, s: Scene, e: Edging, radiusPx: number) {
  // The bed's outline is still the current path.
  const w = Math.max(2, EDGING_WIDTH_MM[e] * s.view.scale);
  ctx.save();
  ctx.clip();
  ctx.lineWidth = w * 2;
  ctx.lineJoin = e === 'stone' || radiusPx > 0 ? 'round' : 'miter';
  ctx.strokeStyle = placePattern(edgingFill(ctx, s.style, e), s.view, EDGING_TILE_MM[e]);
  ctx.stroke();
  ctx.restore();
}

/** A tree from above: its canopy in leaf, or bare branches over a faint canopy in winter. */
function drawTree(ctx: CanvasRenderingContext2D, s: Scene, f: Feature, stroke: string) {
  const v = s.view;
  const c = f.circle!;
  const [cx, cy] = toScreen(v, c.centre);
  const r = c.radiusMm * v.scale;
  const month = s.month ?? new Date().getMonth() + 1;
  const bare = !!f.deciduous && !LEAF_MONTHS.includes(month);
  const art = { form: 'tree' as const, leaf: 'broad' as const, foliage: s.style.mode === 'dark' ? '#4f6e42' : '#5e8a4a' };
  ctx.save();
  if (r < 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2);
    ctx.fillStyle = art.foliage;
    ctx.globalAlpha = bare ? 0.35 : 0.85;
    ctx.fill();
  } else {
    ctx.translate(cx, cy);
    if (bare) {
      // The canopy's reach, faintly, and branches from the trunk.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = art.foliage;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = s.style.mode === 'dark' ? '#a08a6a' : '#6a5038';
      ctx.lineCap = 'round';
      const rnd = mulberry(hashString(f.id));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
        const len = r * (0.65 + rnd() * 0.3);
        ctx.lineWidth = Math.max(1, r * 0.04);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const mx = Math.cos(a) * len * 0.5;
        const my = Math.sin(a) * len * 0.5;
        ctx.lineTo(mx, my);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.6, r * 0.02);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a + 0.6) * len * 0.35, my + Math.sin(a + 0.6) * len * 0.35);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a - 0.6) * len * 0.35, my + Math.sin(a - 0.6) * len * 0.35);
        ctx.stroke();
      }
    } else drawPlant(ctx, { art, look: stageLook('vegetative', { id: f.id, commonName: '', category: 'tree', conditions: { light: 'full-sun' }, size: { spacingMm: 1000 }, verified: true, userAdded: false }), r: r / OVERHANG, paint: paintFor(s.style.look, s.style.mode), seed: hashString(f.id) });
  }
  ctx.restore();
  // Its spread, faintly, so it can still be measured, and the trunk.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = s.hoverId === f.id ? 2.5 : 1.2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.style.mode === 'dark' ? '#a08a6a' : '#5a4330';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2.5, 150 * v.scale), 0, Math.PI * 2);
  ctx.fill();
}

/** A repeatable random sequence. */
function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
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
  // Fences, walls and surfaces only carry a label when named.
  if ((f.kind === 'fence' || f.kind === 'wall' || f.kind === 'surface') && !f.name) return;
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
    ctx.lineJoin = 'round'; // mitred joins spike out of sharp letters
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
  if (f?.smooth) {
    // A curve: a faint line joins the corners it passes through. Its sides aren't straight, so no lengths.
    polyPath(ctx, pts.map((p) => toScreen(v, p)), closed);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) lengthTag(ctx, s, pts[i]!, pts[(i + 1) % pts.length]!);
  pts.forEach((p, i) => handle(ctx, toScreen(v, p), sel, s.style.plan.paper, i === s.selectedVertex));
  if (s.rotatable && f && !f.circle) {
    const at = rotateHandleAt(s, f.footprint);
    const top = bounds(f.footprint.map((q) => toScreen(v, q)));
    if (at && top) {
      ctx.beginPath();
      ctx.moveTo(at[0], at[1] + 8);
      ctx.lineTo(at[0], top.minY);
      ctx.strokeStyle = sel;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(at[0], at[1], 8, 0, Math.PI * 2);
      ctx.fillStyle = s.style.plan.paper;
      ctx.fill();
      ctx.stroke();
      // A curved arrow inside the knob.
      ctx.beginPath();
      ctx.arc(at[0], at[1], 4, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(at[0] + 4 * Math.cos(Math.PI * 1.6) + 2.5, at[1] + 4 * Math.sin(Math.PI * 1.6));
      ctx.lineTo(at[0] + 4 * Math.cos(Math.PI * 1.6), at[1] + 4 * Math.sin(Math.PI * 1.6) - 0.5);
      ctx.lineTo(at[0] + 4 * Math.cos(Math.PI * 1.6) + 0.5, at[1] + 4 * Math.sin(Math.PI * 1.6) + 2.5);
      ctx.stroke();
    }
  }
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

/**
 * Draws a planting's plants as they look from above at their stage. Far out, where plants would be specks, a row
 * or block is one band of colour; a little closer, each is a dot; closer still, each is drawn in full.
 */
function drawPlants(ctx: CanvasRenderingContext2D, s: Scene, pts: Point[], shape: PlantingShape, spreadMm: number, plant: Plant, look: Look, alpha: number) {
  const v = s.view;
  const r = (spreadMm / 2) * v.scale;
  const art = artFor(plant);
  const paint = paintFor(s.style.look, s.style.mode);
  const colour = s.style.mode === 'dark' ? shadeHex(art.foliage, 0.15) : art.foliage;
  const a = alpha * (look.ghost ? 0.5 : 1);
  if (r < 2 && pts.length > 1) {
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = colour;
    shapePath(ctx, s, shape, Math.max(1.5, r));
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  if (r < 5) {
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = colour;
    ctx.beginPath();
    const dot = Math.max(1.2, r * Math.max(0.4, look.grow));
    for (const p of pts) {
      const [x, y] = toScreen(v, p);
      ctx.moveTo(x + dot, y);
      ctx.arc(x, y, dot, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  const dpr = ctx.getTransform().a || 1;
  const bucket = bucketFor(r);
  const styleKey = `${s.style.look}-${s.style.mode}`;
  const reach = r * 1.2;
  // The few drawings this planting needs, fetched once rather than for every plant.
  const sprites: (HTMLCanvasElement | undefined)[] = [];
  const spriteFor = (variant: number) => (sprites[variant] ??= plantSprite(plant.id, art, look, paint, styleKey, bucket!, dpr, variant));
  const seed = hashString(plant.id);
  ctx.globalAlpha = alpha;
  for (const p of pts) {
    const [x, y] = toScreen(v, p);
    if (x < -reach || y < -reach || x > s.width + reach || y > s.height + reach) continue;
    // Each plant gets its own variation and turn, worked out from where it is, so it never changes between frames.
    const h = (Math.imul(p[0], 73856093) ^ Math.imul(p[1], 19349663)) >>> 0;
    const variant = h % VARIANTS;
    const turn = ((h >>> 5) % 360) * (Math.PI / 180);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    if (bucket) {
      const sprite = spriteFor(variant);
      const size = (sprite.width / dpr) * (r / bucket);
      // One transform per plant: turned about its own centre, on top of the pixel ratio.
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * x, dpr * y);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * x, dpr * y);
      drawPlant(ctx, { art, look, r, paint, seed: seed + variant * 7919 });
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
}

function drawPlanting(ctx: CanvasRenderingContext2D, s: Scene, pl: Planting, plant: Plant) {
  const pts = plantPositions(pl, plant);
  const shape = plantingShape(pl, plant);
  const at = s.time?.stageOf(pl);
  drawPlants(ctx, s, pts, shape, spreadOf(plant), plant, stageLook(at?.stage ?? currentStage(pl), plant, pl), s.hoverId === pl.id ? 1 : 0.95);
  // A stage from the plant's usual months, not one you've marked: a dotted edge says it's a guess.
  if (at?.guessed && at.stage !== 'planned') {
    shapePath(ctx, s, shape, (spreadOf(plant) / 2) * s.view.scale + 2);
    ctx.save();
    ctx.strokeStyle = s.style.plan.label;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- The garden through the year ----------

/** Greener in spring, paler in a dry summer: a wash over the lawn path that's just been filled. */
function tintLawn(ctx: CanvasRenderingContext2D, s: Scene, k: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.abs(k)) * (s.style.mode === 'dark' ? 0.16 : 0.24);
  ctx.fillStyle = k > 0 ? '#4c9a36' : '#dcc57e';
  ctx.fill();
  ctx.restore();
}

/** Frost: a pale wash over the garden, with a sparkle of ice crystals that stay put as you scrub. */
function drawFrost(ctx: CanvasRenderingContext2D, s: Scene) {
  const g = s.garden;
  if (g.boundary.length < 3) return;
  ctx.save();
  polyPath(ctx, g.boundary.map((p) => toScreen(s.view, p)));
  // Greenhouses and cold frames clear of frost are cut out of it.
  for (const f of g.features)
    if (s.time?.thawed?.has(f.id) && f.footprint.length >= 3) {
      const pts = f.footprint.map((p) => toScreen(s.view, p));
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
    }
  ctx.clip('evenodd');
  ctx.fillStyle = s.style.mode === 'dark' ? 'rgba(200,220,255,0.10)' : 'rgba(255,255,255,0.28)';
  ctx.fillRect(0, 0, s.width, s.height);
  // Crystals on a grid in garden mm, so they don't shimmer when the plan moves.
  const b = bounds(g.boundary)!;
  const step = Math.max(150, 9 / s.view.scale);
  ctx.fillStyle = s.style.mode === 'dark' ? 'rgba(230,240,255,0.55)' : 'rgba(255,255,255,0.9)';
  for (let x = Math.floor(b.minX / step) * step; x <= b.maxX; x += step)
    for (let y = Math.floor(b.minY / step) * step; y <= b.maxY; y += step) {
      const h = (Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)) >>> 0;
      if (h % 3) continue;
      const [sx, sy] = toScreen(s.view, [x + ((h >>> 4) % 100) * step * 0.01, y + ((h >>> 11) % 100) * step * 0.01]);
      if (sx < -2 || sy < -2 || sx > s.width + 2 || sy > s.height + 2) continue;
      const r = 0.6 + ((h >>> 18) % 3) * 0.35;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  ctx.restore();
}

/** A bed standing empty glows faintly round its edge. */
function drawGap(ctx: CanvasRenderingContext2D, s: Scene, f: Feature) {
  const pts = f.footprint.map((p) => toScreen(s.view, p));
  if (pts.length < 3) return;
  ctx.save();
  polyPath(ctx, pts, true, f.kind === 'bed' && !f.smooth ? s.style.bedRadiusMm * s.view.scale : 0);
  ctx.shadowColor = s.style.accent;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = s.style.accent;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.restore();
}

/** Ring colours for each lens, and a dash so they differ by more than colour. */
export const FOCUS_STYLE: Record<FocusKind, { light: string; dark: string; dash: number[]; width: number }> = {
  flower: { light: '#b8357a', dark: '#f28cc4', dash: [1.5, 4], width: 3.5 },
  harvest: { light: '#b85c10', dark: '#f5a54a', dash: [], width: 3 },
  water: { light: '#1f64ad', dark: '#79b4f2', dash: [9, 5], width: 2.5 },
};

/** A lens: the plan dimmed, with the plantings it picks out drawn again on top and ringed. */
function drawFocus(ctx: CanvasRenderingContext2D, s: Scene, focus: Focus, planted: Planting[]) {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = s.style.plan.paper;
  ctx.fillRect(0, 0, s.width, s.height);
  ctx.restore();
  const st = FOCUS_STYLE[focus.kind];
  for (const pl of planted) {
    if (!focus.ids.has(pl.id)) continue;
    const plant = s.plantOf!(pl.plantId);
    drawPlanting(ctx, s, pl, plant);
    shapePath(ctx, s, plantingShape(pl, plant), (spreadOf(plant) / 2) * s.view.scale + 4);
    ctx.save();
    ctx.strokeStyle = s.style.mode === 'dark' ? st.dark : st.light;
    ctx.lineWidth = st.width;
    ctx.lineCap = 'round';
    ctx.setLineDash(st.dash);
    ctx.stroke();
    ctx.restore();
  }
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
  ctx.lineJoin = 'round';
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
  if (n <= MAX_PLANTS) drawPlants(ctx, s, plantPositions(pl, d.plant), plantingShape(pl, d.plant), spreadOf(d.plant), d.plant, stageLook('vegetative', d.plant), 0.6);
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


// ---------- Sketches ----------

const SKETCH_INK: Record<'light' | 'dark', Record<Exclude<SketchColour, 'ink'>, string>> = {
  light: { red: '#c0392b', blue: '#2d6cb5', green: '#2f7d32', yellow: '#f2c230' },
  dark: { red: '#ff8a7a', blue: '#8cc2ff', green: '#7bd88f', yellow: '#f5d76e' },
};
export const sketchColour = (c: SketchColour, s: PlanStyle) => (c === 'ink' ? s.plan.label : SKETCH_INK[s.mode][c]);

/** A line through the middle of each pair of points, so strokes look hand-drawn rather than jagged. */
function smoothPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath();
  if (!pts.length) return;
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  if (pts.length === 1) {
    ctx.lineTo(pts[0]![0] + 0.01, pts[0]![1]);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(pts[pts.length - 1]![0], pts[pts.length - 1]![1]);
}

/** The size words are drawn at, px: to scale, but never too small to read or so big they swamp the plan. */
export const sketchTextPx = (k: Sketch, scale: number) => Math.max(12, Math.min(44, k.widthMm * scale));

function drawSketch(ctx: CanvasRenderingContext2D, s: Scene, k: Sketch) {
  const v = s.view;
  const colour = sketchColour(k.colour, s.style);
  const pts = k.points.map((p) => toScreen(v, p));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  if (k.kind === 'text') {
    const px = sketchTextPx(k, v.scale);
    ctx.font = `600 ${px}px ${s.style.fontPlan}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, px / 5);
    ctx.strokeStyle = s.style.plan.paper;
    ctx.globalAlpha = 0.85;
    ctx.strokeText(k.text ?? '', pts[0]![0], pts[0]![1]);
    ctx.globalAlpha = 1;
    ctx.fillText(k.text ?? '', pts[0]![0], pts[0]![1]);
  } else if (k.kind === 'arrow' && pts.length >= 2) {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    const w = Math.max(2, k.widthMm * v.scale);
    const head = Math.max(10, w * 4);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0] - Math.cos(ang) * head * 0.6, b[1] - Math.sin(ang) * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(b[0] - Math.cos(ang - 0.45) * head, b[1] - Math.sin(ang - 0.45) * head);
    ctx.lineTo(b[0] - Math.cos(ang + 0.45) * head, b[1] - Math.sin(ang + 0.45) * head);
    ctx.closePath();
    ctx.fill();
  } else {
    const highlighter = k.kind === 'highlighter';
    ctx.lineWidth = Math.max(highlighter ? 6 : 1.5, k.widthMm * v.scale);
    if (highlighter) {
      ctx.globalAlpha = 0.38;
      ctx.lineCap = 'butt';
    }
    smoothPath(ctx, pts);
    ctx.stroke();
  }
  ctx.restore();
}

/** A stroke being drawn by hand: a sketch mark as it will look, or a freehand shape's outline. */
function drawStroke(ctx: CanvasRenderingContext2D, s: Scene, st: Stroke) {
  if (st.sketch) {
    if (st.points.length) drawSketch(ctx, s, { id: 'draft', kind: st.sketch.kind, colour: st.sketch.colour, points: st.points, widthMm: SKETCH_WIDTH[st.sketch.kind] });
    return;
  }
  const v = s.view;
  const pts = st.points.map((p) => toScreen(v, p));
  const sel = s.style.plan.selection;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (st.widthMm) {
    ctx.strokeStyle = sel;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = Math.max(2, st.widthMm * v.scale);
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  smoothPath(ctx, st.closed && pts.length > 2 ? [...pts, pts[0]!] : pts);
  if (st.closed) {
    ctx.fillStyle = sel;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = sel;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
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