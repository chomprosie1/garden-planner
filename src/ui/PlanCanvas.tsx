// The interactive plan: drawing, selecting, dragging, zooming and panning.
// Drags show a preview and commit once when released, so each is one undo step.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useApp } from './appContext';
import { copiedPlanting, copyPlanting } from './clipboard';
import { hitEdge, hitFeature, hitPlanting, hitVertex } from '../canvas/hit';
import { northCentre, NORTH_RADIUS, plantingHandles, planStyle, renderLive, renderStatic, rotateHandleAt, sketchTextPx, type Draft, type Focus, type Guide, type PlantDraft, type Scene, type Stroke, type TimeScene } from '../canvas/render';
import { parseLength, snapPoint, snapStepFor, type SnapKind } from '../canvas/snap';
import { fit, pan, toScreen, toWorld, zoomAt, type Viewport } from '../canvas/viewport';
import { bounds, distance, type Bounds } from '../geometry/polygon';
import { pointAtLength } from '../geometry/snap';
import { simplify, simplifyClosed } from '../geometry/simplify';
import { plantOutTray } from '../lifecycle/shed';
import { todayIso } from '../model/ids';
import { addSketch, deleteSketches, makeSketch, sketchesAt } from '../model/sketches';
import {
  addFeature,
  deleteFeatures,
  duplicateFeature,
  featureLabel,
  placeLabel,
  gardenBounds,
  insertVertex,
  isClosed,
  KINDS,
  makeFeature,
  moveFeature,
  moveVertex,
  pivotOf,
  resizesByHandles,
  pointsOf,
  rectCorners,
  rectInfo,
  rotateFeature,
  rectPoints,
  removeVertex,
  setPoints,
  updateFeature,
  type Target,
} from '../model/features';
import { updateGarden, type Store } from '../model/store';
import { stickerById, stickerFeature, type Sticker } from '../model/stickers';
import type { Feature, FeatureKind, Garden, Plant, Planting, Point, SketchColour, SketchKind } from '../model/types';
import { defaultFill, fillPlanting } from '../planting/fill';
import { addPlanting, blockGrid, containerAt, deletePlanting, duplicatePlanting, makePlanting, placeCopy, MAX_PLANTS, movePlanting, plantCount, plantPositions, rowCount, sizedPlant, spreadOf, updatePlanting, type Layout } from '../planting/place';
import type { Finding } from '../planting/rules';
import type { SunGrid } from '../sun/hours';
import type { Sun } from '../sun/position';
import type { Shade } from '../sun/shadow';
import type { LookId, Mode } from '../theme/looks';

export type Tool = 'select' | 'boundary' | 'calibrate' | 'trace' | 'plant' | 'sketch' | FeatureKind;

/** The sketch tool's settings: what it draws, in what colour, and the words to place. */
export interface SketchPen {
  kind: SketchKind | 'eraser';
  colour: SketchColour;
  text: string;
}

/** Tools that can draw by hand: areas and lines, but not the boundary, which stays exact. */
export const canDrawByHand = (t: Tool) => t !== 'boundary' && (geometryForTool(t) === 'area' || geometryForTool(t) === 'line');

/** The plant being placed with the Plant tool, and how. */
export interface Placing {
  plant: Plant;
  /** "auto": dropped into a bed, it fills it the usual way for the plant (one, a row, or the whole bed). */
  layout: Layout | 'auto';
  /** Already in the ground, rather than planned. */
  growing?: boolean;
  /** Planting out this tray from the Potting Shed: the planting takes its sowing date and stages. */
  trayId?: string;
}

/** Said when a plant is dropped somewhere it can't grow. */
export const NOWHERE_TO_PLANT = "Plants can't go on paving, decking or paths. Drop it in a bed, a pot or on the lawn.";

/** Drag-and-drop type for a plant dragged from a list onto the plan. */
export const PLANT_DRAG_TYPE = 'application/x-garden-plant';
/** Drag-and-drop types for a sticker from the dock, and a tray from the Potting Shed. */
export const STICKER_DRAG_TYPE = 'application/x-garden-sticker';
export const TRAY_DRAG_TYPE = 'application/x-garden-tray-out';

/** Tools that draw at the crosshair on a phone. Drawing by hand uses a finger instead. */
export const usesCrosshair = (t: Tool, byHand = false) => geometryForTool(t) !== null && !(byHand && canDrawByHand(t));

/** Commands the phone's drawing bar sends to the canvas. */
export interface CanvasApi {
  addCorner(): void;
  undoCorner(): void;
  /** Places the next corner this far along the crosshair's direction. Returns a problem to show, or null. */
  typeLength(mm: number): string | null;
  finish(): void;
  cancel(): void;
  /** A rectangle of this size centred on the crosshair. */
  placeRect(w: number, h: number): void;
  /** A circle of this radius centred on the crosshair. */
  placeCircle(radius: number): void;
  /** Plant tool: a plant, or the start or end of a row or block, at the crosshair. */
  placePlant(): void;
  /** Brings these garden points into view, centred. */
  show(points: Point[]): void;
  /** Drops a sticker from the dock in the middle of the view. */
  dropSticker(id: string): void;
  /** Zooms so these points fill the view, with a margin. */
  zoomTo(points: Point[]): void;
}

export interface PlanCanvasProps {
  store: Store;
  garden: Garden;
  look: LookId;
  mode: Mode;
  tool: Tool;
  setTool: (t: Tool) => void;
  selected: Target | null;
  setSelected: (t: Target | null) => void;
  selectedVertex: number | null;
  setSelectedVertex: (i: number | null) => void;
  readOnly: boolean;
  /**
   * What can be changed: the layout (features and boundary), the planting (plants; beds can be picked
   * but stay put), or nothing (just looking, as in the sun view). Defaults to the layout.
   */
  edit?: 'layout' | 'planting' | 'view' | 'all';
  /** With edit "all": the layout can't be moved or reshaped by accident. Plants still can. */
  locked?: boolean;
  /** The floating action pill, kept beside whatever's selected as the plan moves. */
  pillRef?: { current: HTMLElement | null };
  /** A plant has just been dropped and filled the usual way: offer the other ways at this screen point. */
  onPlaced?: (plantingId: string, at: Point, world: Point) => void;
  /** Things laid over the plan: the action pill, pop-overs. */
  children?: ComponentChildren;
  /** A tap or click that didn't drag, at this garden point. */
  onTap?: (p: Point) => void;
  fitSignal: number;
  traceImage: HTMLImageElement | null;
  onCalibrate: (a: Point, b: Point) => void;
  /** Phones: draw with a fixed crosshair at the centre, moving the plan under it. */
  crosshair?: boolean;
  /** A phone-sized screen: after drawing, say what was added rather than opening its details over the tools. */
  phone?: boolean;
  apiRef?: { current: CanvasApi | null };
  /** How many corners the current drawing has, so the drawing bar can enable its buttons. */
  onDraftChange?: (corners: number) => void;
  /** Looks up a plant by id, for drawing and checking plantings. */
  plantOf: (id: string) => Plant;
  findings: Finding[];
  focusFinding: string | null;
  placing: Placing | null;
  shadows?: Shade[] | null;
  sunGrid?: SunGrid | null;
  sun?: Sun | null;
  /** The plan on a day: plantings at their stage then, and that week's light, lawn and frost. */
  time?: TimeScene | null;
  /** The month shown, for trees in or out of leaf. */
  month?: number;
  /** A lens picking out some plantings. */
  focus?: Focus | null;
  /** The garden point under a mouse pointer, or null when it leaves. */
  onHoverPoint?: (p: Point | null) => void;
  /** A short message about the last action, e.g. why a plant couldn't go there. null clears it. */
  onMessage?: (text: string | null) => void;
  /** Areas and lines are drawn with a finger or the mouse, as smooth curves. */
  byHand?: boolean;
  /** The sketch tool's settings. */
  sketchPen?: SketchPen;
  /** Show the sketch layer. */
  showSketches?: boolean;
  /** Soft shadows under things with height. */
  depth?: boolean;
  /** Simple: things are moved and resized, not reshaped or turned; the boundary and north stay put. */
  simple?: boolean;
}

type Drag =
  | { kind: 'pan'; last: Point; moved: boolean }
  | { kind: 'north'; base: Garden }
  | { kind: 'move'; id: string; base: Garden; start: Point; startScreen: Point; moved: boolean }
  | { kind: 'movePlanting'; id: string; base: Garden; start: Point; startScreen: Point; moved: boolean }
  | { kind: 'plantEnd'; id: string; end: 0 | 1; base: Garden }
  | { kind: 'vertex'; target: Target; index: number; base: Garden }
  | { kind: 'radius'; id: string; base: Garden }
  | { kind: 'trace'; base: Garden; start: Point }
  | { kind: 'erase'; base: Garden; ids: Set<string> }
  | { kind: 'rotate'; id: string; base: Garden; pivot: Point; from: number };

interface Drawing {
  points: Point[];
  cursor: Point | null;
  snap: SnapKind;
  typed: string;
  mode: 'idle' | 'rect' | 'circle';
  down: { screen: Point; world: Point } | null;
}

const emptyDrawing = (): Drawing => ({ points: [], cursor: null, snap: 'none', typed: '', mode: 'idle', down: null });

/** "Veg bed deleted, with 3 plantings and 1 note." */
export function deletedMessage(g: Garden, f: { id: string; name?: string; kind: FeatureKind }): string {
  const plantings = g.plantings.filter((p) => p.featureId === f.id);
  const ids = new Set(plantings.map((p) => p.id));
  const notes = g.notes.filter((n) => n.featureId === f.id || (n.plantingId && ids.has(n.plantingId))).length;
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
  const extra = [plantings.length && n(plantings.length, 'planting'), notes && n(notes, 'note')].filter(Boolean).join(' and ');
  return `${featureLabel(f as Feature)} deleted${extra ? `, with ${extra}` : ''}.`;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function geometryForTool(tool: Tool): 'area' | 'line' | 'circle' | null {
  if (tool === 'boundary') return 'area';
  if (tool === 'select' || tool === 'calibrate' || tool === 'trace' || tool === 'plant' || tool === 'sketch') return null;
  return KINDS[tool].geometry;
}

export function PlanCanvas(props: PlanCanvasProps) {
  const app = useApp();
  const A = useRef(app);
  /** Where the mouse last was over the plan, for pasting there. */
  const pointerWorld = useRef<Point | null>(null);
  A.current = app;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;
  const view = useRef<Viewport | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const preview = useRef<Garden | null>(null);
  const drawing = useRef<Drawing>(emptyDrawing());
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  const hover = useRef<string | null>(null);
  const space = useRef(false);
  const raf = useRef(0);
  const lastTap = useRef<{ t: number; s: Point } | null>(null);
  /** A stroke being drawn by hand, in garden mm, and the screen point it last grew from. */
  const stroke = useRef<{ points: Point[]; last: Point } | null>(null);
  /**
   * What's on the ground, drawn once into an image with a margin round the screen. Panning moves the image;
   * wheel and pinch zooming stretch it until you stop, then it's redrawn sharp at the new zoom.
   */
  const layer = useRef<{ canvas: HTMLCanvasElement; key: unknown[]; view: Viewport; margin: number } | null>(null);
  const zoomingUntil = useRef(0);
  /**
   * While the year is being scrubbed, the ground is drawn just the size of the screen, which is much quicker;
   * the margin for panning is filled in once it stops.
   */
  const yearMoved = useRef<{ time: unknown; until: number }>({ time: undefined, until: 0 });
  const yearSettle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Alignment lines while moving something, and which ones were showing (for a haptic tick when they change). */
  const guides = useRef<Guide[]>([]);
  const guideKey = useRef('');
  /** A zoom asked for just before the canvas changes size (the dock's drawer closing on a phone): it's done again at the new size. */
  const zoomGoal = useRef<{ box: Bounds; until: number } | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zooming = () => {
    zoomingUntil.current = performance.now() + 150;
  };

  const garden = () => preview.current ?? P.current.garden;

  const draw = () => {
    raf.current = 0;
    const c = canvas.current;
    const v = view.current;
    if (!c || !v) return;
    const ctx = c.getContext('2d')!;
    const { w, h, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = P.current;
    const d = drawing.current;
    const geometry = geometryForTool(p.tool);
    const useCrosshair = !!p.crosshair && usesCrosshair(p.tool, p.byHand);
    if (useCrosshair) {
      const sn = crosshairSnap();
      d.cursor = sn.point;
      d.snap = sn.kind;
    }
    p.onDraftChange?.(d.points.length);
    const plantDraft: PlantDraft | null =
      p.tool === 'plant' && p.placing ? { plant: p.placing.plant, layout: p.placing.layout === 'auto' ? 'single' : p.placing.layout, points: d.points, cursor: d.cursor, typed: d.typed } : null;
    let draft: Draft | null = null;
    if (p.tool === 'calibrate') draft = { geometry: 'line', points: d.points, cursor: d.cursor, snap: d.snap };
    else if (geometry && (d.points.length > 0 || d.cursor))
      draft = {
        geometry: d.mode === 'rect' ? 'rect' : geometry,
        points: d.points,
        cursor: d.cursor,
        snap: d.snap,
        typed: d.typed,
        ...(geometry === 'line' && p.tool !== 'boundary' ? { widthMm: KINDS[p.tool as FeatureKind].widthMm } : {}),
      };
    const st = stroke.current;
    const strokeScene: Stroke | null = !st
      ? null
      : p.tool === 'sketch' && p.sketchPen && p.sketchPen.kind !== 'eraser'
        ? { points: st.points, sketch: { kind: p.sketchPen.kind, colour: p.sketchPen.colour } }
        : { points: st.points, closed: geometry === 'area', ...(geometry === 'line' ? { widthMm: KINDS[p.tool as FeatureKind].widthMm } : {}) };
    const scene: Scene = {
      stroke: strokeScene,
      sketches: p.showSketches !== false,
      depth: p.depth !== false,
      rotatable: p.selected?.type === 'feature' && p.tool === 'select' && layoutEditable() && !p.simple,
      reshape: !p.simple,
      guides: drag.current?.kind === 'move' ? guides.current : [],
      drawing: !!geometry || p.tool === 'plant' || p.tool === 'sketch',
      garden: garden(),
      view: v,
      width: w,
      height: h,
      style: planStyle(p.look, p.mode),
      selected: p.selected,
      selectedVertex: p.selectedVertex,
      hoverId: hover.current,
      draft,
      trace: p.traceImage,
      crosshair: useCrosshair,
      plantOf: p.plantOf,
      findings: p.findings,
      focusFinding: p.focusFinding,
      plantDraft,
      shadows: p.shadows ?? null,
      sunGrid: p.sunGrid ?? null,
      sun: p.sun ?? null,
      time: p.time ?? null,
      focus: p.focus ?? null,
      ...(p.month ? { month: p.month } : {}),
    };

    // The ground: redrawn only when something on it changes, the zoom settles, or a pan runs past the margin.
    const key = [scene.garden, p.look, p.mode, hover.current, p.findings, p.focusFinding, p.traceImage, p.plantOf, p.shadows, p.sunGrid, p.time, p.focus, p.month, scene.sketches, scene.depth, scene.drawing, w, h, dpr];
    let L = layer.current;
    const stale = !L || key.some((k, i) => k !== L!.key[i]);
    const ym = yearMoved.current;
    if (p.time !== ym.time) yearMoved.current = { time: p.time, until: ym.time === undefined ? 0 : performance.now() + 350 };
    const scrubbing = performance.now() < yearMoved.current.until;
    if (scrubbing) {
      clearTimeout(yearSettle.current);
      yearSettle.current = setTimeout(redraw, 380);
    }
    // Drawn without its margin while scrubbing: fill it in now that it's stopped.
    const thin = !!L && L.margin === 0 && !scrubbing;
    const rescaled = !!L && L.view.scale !== v.scale;
    const outside = !!L && (Math.abs(v.ox - L.view.ox) > L.margin || Math.abs(v.oy - L.view.oy) > L.margin);
    if (stale || outside || thin || (rescaled && performance.now() >= zoomingUntil.current)) {
      const margin = scrubbing ? 0 : Math.round(Math.max(w, h) * 0.3);
      const lc = L?.canvas ?? document.createElement('canvas');
      const cw = Math.round((w + 2 * margin) * dpr);
      const ch = Math.round((h + 2 * margin) * dpr);
      if (lc.width !== cw || lc.height !== ch) {
        lc.width = cw;
        lc.height = ch;
      }
      const lctx = lc.getContext('2d')!;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderStatic(lctx, { ...scene, view: { ...v, ox: v.ox + margin, oy: v.oy + margin }, width: w + 2 * margin, height: h + 2 * margin });
      L = layer.current = { canvas: lc, key, view: { ...v }, margin };
    }
    const k = v.scale / L!.view.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (k !== 1) {
      // Mid-zoom: the old image, stretched, until the zoom settles.
      ctx.fillStyle = scene.style.plan.paper;
      ctx.fillRect(0, 0, c.width, c.height);
      clearTimeout(settle.current);
      settle.current = setTimeout(redraw, 160);
    }
    const x = (v.ox - (L!.view.ox + L!.margin) * k) * dpr;
    const y = (v.oy - (L!.view.oy + L!.margin) * k) * dpr;
    ctx.drawImage(L!.canvas, k === 1 ? Math.round(x) : x, k === 1 ? Math.round(y) : y, L!.canvas.width * k, L!.canvas.height * k);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderLive(ctx, scene);
    placePill();
    placeAnchors();
  };

  /** Things laid over the plan at a garden point (data-world="x,y"), kept on that point as the plan moves. */
  const placeAnchors = () => {
    const v = view.current;
    if (!v || !wrap.current) return;
    for (const el of wrap.current.querySelectorAll<HTMLElement>('[data-world]')) {
      const [x = 0, y = 0] = el.dataset.world!.split(',').map(Number);
      const [sx, sy] = toScreen(v, [x, y]);
      el.style.left = `${Math.round(sx)}px`;
      el.style.top = `${Math.round(sy)}px`;
      // Chips on a bed too small on screen to carry them are hidden until you zoom in.
      const w = Number(el.dataset.worldW ?? 0);
      el.style.visibility = w && w * v.scale < 56 ? 'hidden' : '';
      // No wider than the bed, so chips on neighbouring beds don't run into each other.
      if (w) el.style.maxWidth = `${Math.round(Math.max(140, w * v.scale + 16))}px`;
    }
  };

  /** Whether the layout can be changed now: drawing it, or with everything editable and the layout unlocked. */
  const layoutEditable = () => {
    const p = P.current;
    if (p.readOnly) return false;
    const edit = p.edit ?? 'layout';
    return edit === 'layout' || (edit === 'all' && !p.locked);
  };

  /** The selected thing's box on screen. */
  const selectionBox = (): Bounds | null => {
    const p = P.current;
    const t = p.selected;
    const v = view.current;
    if (!t || !v) return null;
    const g = garden();
    let pts: Point[] = [];
    if (t.type === 'boundary') pts = g.boundary;
    else if (t.type === 'feature') pts = g.features.find((f) => f.id === t.id)?.footprint ?? [];
    else {
      const pl = g.plantings.find((x) => x.id === t.id);
      if (pl) {
        const plant = sizedPlant(p.plantOf(pl.plantId), pl);
        const r = spreadOf(plant) / 2;
        pts = plantPositions(pl, plant).flatMap(([x, y]): Point[] => [[x - r, y - r], [x + r, y + r]]);
      }
    }
    return bounds(pts.map((q) => toScreen(v, q)));
  };

  /** Keeps the action pill just below the selection (or above it, near the bottom), inside the plan. */
  const placePill = () => {
    const pill = P.current.pillRef?.current;
    if (!pill) return;
    const box = P.current.tool === 'select' ? selectionBox() : null;
    const busy = !!drag.current && drag.current.kind !== 'pan';
    const { w, h } = size.current;
    if (!box || busy || box.maxX < 0 || box.minX > w || box.maxY < 0 || box.minY > h) {
      pill.style.visibility = 'hidden';
      return;
    }
    const pw = pill.offsetWidth;
    const ph = pill.offsetHeight;
    const x = Math.max(8, Math.min(w - pw - 8, (box.minX + box.maxX) / 2 - pw / 2));
    let y = box.maxY + 12;
    if (y + ph > h - 8) y = box.minY - ph - 40;
    y = Math.max(8, Math.min(h - ph - 8, y));
    pill.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    pill.style.visibility = 'visible';
  };
  const redraw = () => {
    if (!raf.current) raf.current = requestAnimationFrame(draw);
  };

  const fitView = () => {
    const { w, h } = size.current;
    if (w && h) view.current = fit(gardenBounds(P.current.garden), w, h);
    redraw();
  };

  // Size the canvas to its box, sharp on high-density screens.
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const c = canvas.current;
      if (!c) return; // the plan has just closed
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prev = size.current;
      // Keep the same spot in the middle when the canvas changes size, so the crosshair never drifts.
      if (view.current && prev.w && prev.h) view.current = pan(view.current, (r.width - prev.w) / 2, (r.height - prev.h) / 2);
      size.current = { w: r.width, h: r.height, dpr };
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const goal = zoomGoal.current;
      if (goal && performance.now() < goal.until && r.width && r.height) view.current = fit(goal.box, r.width, r.height);
      if (!view.current) fitView();
      else redraw();
    });
    ro.observe(el);
    const onFonts = () => redraw();
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    void document.fonts?.ready.then(onFonts);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      cancelAnimationFrame(raf.current);
      clearTimeout(settle.current);
      clearTimeout(yearSettle.current);
    };
  }, []);

  useEffect(() => {
    if (props.fitSignal > 0) fitView();
  }, [props.fitSignal]);

  // A new tool, plant or layout starts a fresh drawing. This happens during render, not in an
  // effect: effects run a frame later, which could wipe a point clicked straight after the change.
  const drawKey = `${props.tool}|${props.placing?.plant.id ?? ''}|${props.placing?.layout ?? ''}`;
  const lastDrawKey = useRef(drawKey);
  if (lastDrawKey.current !== drawKey) {
    lastDrawKey.current = drawKey;
    drawing.current = emptyDrawing();
  }
  useEffect(redraw, [drawKey]);

  useEffect(redraw, [props.garden, props.look, props.mode, props.selected, props.selectedVertex, props.traceImage, props.findings, props.focusFinding, props.shadows, props.sunGrid, props.sun, props.showSketches, props.byHand, props.depth, props.locked, props.simple, props.tool, props.time, props.focus, props.month]);

  // ---------- helpers ----------

  const screenOf = (e: PointerEvent | MouseEvent | WheelEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const tolMm = (px: number) => px / (view.current?.scale ?? 0.05);

  /** Every corner on the plan, for snapping, except the ones being moved. */
  const allVertices = (g: Garden, except?: { target: Target; index: number }): Point[] => {
    const out: Point[] = [];
    g.boundary.forEach((p, i) => {
      if (!(except?.target.type === 'boundary' && except.index === i)) out.push(p);
    });
    for (const f of g.features) {
      const pts = f.line ?? (f.circle ? [] : f.footprint);
      pts.forEach((p, i) => {
        if (!(except?.target.type === 'feature' && except.target.id === f.id && except.index === i)) out.push(p);
      });
    }
    return out;
  };

  const snapAt = (world: Point, e: { altKey: boolean; shiftKey: boolean }, from?: Point, extra: Point[] = [], except?: { target: Target; index: number }) =>
    snapPoint(world, {
      vertices: [...extra, ...allVertices(garden(), except)],
      ...(from ? { from } : {}),
      gridMm: snapStepFor(view.current!.scale),
      toleranceMm: tolMm(10),
      free: e.altKey,
      forceAngle: e.shiftKey,
    });

  const commit = (fn: (g: Garden) => Garden) => P.current.store.apply(updateGarden(fn));

  /** The snapped garden point under the crosshair at the centre of the canvas. */
  function crosshairSnap() {
    const v = view.current!;
    const centre: Point = [size.current.w / 2, size.current.h / 2];
    const dr = drawing.current;
    return snapAt(toWorld(v, centre), { altKey: false, shiftKey: false }, dr.points[dr.points.length - 1], dr.points.slice(0, 1));
  }

  /** Pans so a garden point sits under the crosshair. */
  const centreOn = (pt: Point) => {
    const v = view.current;
    if (!v) return;
    view.current = { ...v, ox: size.current.w / 2 - pt[0] * v.scale, oy: size.current.h / 2 + pt[1] * v.scale };
  };

  const finishShape = (pts: Point[]) => {
    const p = P.current;
    const geometry = geometryForTool(p.tool);
    // Drop repeated points left by double-clicks.
    const clean = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1]![0] || q[1] !== pts[i - 1]![1]);
    if (clean.length > 2 && clean[0]![0] === clean[clean.length - 1]![0] && clean[0]![1] === clean[clean.length - 1]![1]) clean.pop();
    drawing.current = emptyDrawing();
    if (geometry === 'area' && clean.length >= 3) {
      if (p.tool === 'boundary') {
        commit((g) => setPoints(g, { type: 'boundary' }, clean));
        drawn({ type: 'boundary' }, 'Boundary drawn.');
      } else {
        const f = makeFeature(p.tool as FeatureKind, { area: clean });
        commit((g) => addFeature(g, f));
        drawn({ type: 'feature', id: f.id }, `${KINDS[f.kind].label} added.`);
      }
      p.setTool('select');
    } else if (geometry === 'line' && clean.length >= 2) {
      const f = makeFeature(p.tool as FeatureKind, { line: clean });
      commit((g) => addFeature(g, f));
      drawn({ type: 'feature', id: f.id }, `${KINDS[f.kind].label} added.`);
      p.setTool('select');
    }
    p.setSelectedVertex(null);
    redraw();
  };

  const finishCircle = (centre: Point, radius: number) => {
    const p = P.current;
    drawing.current = emptyDrawing();
    if (radius < 50) return redraw();
    const f = makeFeature(p.tool as FeatureKind, { circle: { centre, radiusMm: radius } });
    commit((g) => addFeature(g, f));
    drawn({ type: 'feature', id: f.id }, `${KINDS[f.kind].label} added.`);
    p.setTool('select');
  };

  /**
   * After drawing something: on a computer it's selected, ready to name or adjust. On a phone the
   * details would cover the tools, so it says what was added and leaves the tools ready for the next thing.
   */
  const drawn = (t: Target, text: string) => {
    const p = P.current;
    if (!p.crosshair && !p.phone) return p.setSelected(t);
    p.setSelected(null);
    A.current.notify(`${text} Tap it to name it or change its size.`, { undo: true });
  };

  const finishRect = (a: Point, b: Point) => {
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    const w = Math.abs(b[0] - a[0]);
    const h = Math.abs(b[1] - a[1]);
    if (w < 50 || h < 50) {
      drawing.current = emptyDrawing();
      return redraw();
    }
    finishShape(rectPoints({ x, y, w, h }));
  };

  // ---------- drawing by hand ----------

  /** A freehand stroke becomes a curved area or line, thinned to the corners that keep its shape. */
  const finishByHand = (pts: Point[]) => {
    const p = P.current;
    const geometry = geometryForTool(p.tool);
    const tol = tolMm(4);
    if (geometry === 'area') {
      const corners = simplifyClosed(pts, tol);
      const b = bounds(pts);
      if (corners.length < 3 || !b || Math.min(b.maxX - b.minX, b.maxY - b.minY) < 100) return say('Draw all the way round the shape, back to where you started.');
      const f = makeFeature(p.tool as FeatureKind, { area: corners }, { smooth: true });
      commit((g) => addFeature(g, f));
      drawn({ type: 'feature', id: f.id }, `${KINDS[f.kind].label} added.`);
    } else if (geometry === 'line') {
      const line = simplify(pts, tol);
      if (line.length < 2 || distance(line[0]!, line[line.length - 1]!) < 100) return say('Draw along the whole line.');
      const f = makeFeature(p.tool as FeatureKind, { line }, { smooth: true });
      commit((g) => addFeature(g, f));
      drawn({ type: 'feature', id: f.id }, `${KINDS[f.kind].label} added.`);
    }
    p.setTool('select');
  };

  /** A finished sketch mark: a pen or highlighter stroke, or an arrow. */
  const finishSketch = (pts: Point[]) => {
    const pen = P.current.sketchPen;
    if (!pen || pen.kind === 'eraser' || pen.kind === 'text') return;
    const k = makeSketch(pen.kind, pen.colour, pts, { toleranceMm: tolMm(1.2) });
    commit((g) => addSketch(g, k));
  };

  /** Sketches under a screen point, for the eraser. Words are as wide as they're drawn. */
  const sketchesUnder = (g: Garden, world: Point, touch: boolean) => {
    const ctx = canvas.current?.getContext('2d');
    const scale = view.current?.scale ?? 0.05;
    return sketchesAt(g, world, tolMm(touch ? 12 : 6), (k) => {
      if (!ctx) return (k.text?.length ?? 0) * k.widthMm * 0.55;
      ctx.font = `600 ${sketchTextPx(k, scale)}px sans-serif`;
      return ctx.measureText(k.text ?? '').width / scale;
    });
  };

  // ---------- planting ----------

  const say = (text: string | null) => P.current.onMessage?.(text);

  /** Adds a planting. Its bed is the one under a single plant, or under the middle of a row or block. */
  const placePlanting = (start: Point, end?: Point) => {
    const p = P.current;
    const placing = p.placing;
    drawing.current = emptyDrawing();
    redraw();
    if (!placing) return;
    const { plant, layout } = placing;
    const middle: Point = end ? [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] : start;
    const bed = containerAt(garden(), middle);
    if (!bed) return say(NOWHERE_TO_PLANT);
    const sp = plant.size.spacingMm;
    const n = layout === 'row' && end ? rowCount(start, end, sp) : layout === 'block' && end ? blockGrid(start, end, sp).cols * blockGrid(start, end, sp).rows : 1;
    if (n > MAX_PLANTS) return say(`That's ${n.toLocaleString()} plants, which is more than one planting can hold. Make it smaller.`);
    const pl = makePlanting(plant, bed.id, layout === 'auto' ? 'single' : layout, start, end, !!placing.growing);
    if (placing.trayId) {
      const trayId = placing.trayId;
      commit((g) => plantOutTray(g, trayId, pl, todayIso()));
      A.current.notify(`Planted out ${n === 1 ? `a ${plant.commonName.toLowerCase()}` : `${n} ${plant.commonName.toLowerCase()} plants`} from the shed into ${placeLabel(bed)}.`, { undo: true });
      say(null);
      p.setTool('select');
      return;
    }
    commit((g) => addPlanting(g, pl));
    say(`Planted ${n === 1 ? `a ${plant.commonName.toLowerCase()}` : `${n} ${plant.commonName.toLowerCase()} plants`} in ${placeLabel(bed)}.`);
  };

/**
   * Drops a plant into the bed, pot or planter under a point, filled the usual way for the plant: one, a row
   * across the bed, or the whole bed. Then it's selected, and the other ways are offered beside it.
   */
  const placeAuto = (pt: Point) => {
    const p = P.current;
    const placing = p.placing;
    drawing.current = emptyDrawing();
    redraw();
    if (!placing || !view.current) return;
    const bed = containerAt(garden(), pt);
    if (!bed) return say(NOWHERE_TO_PLANT);
    const shape = fillPlanting(placing.plant, bed, defaultFill(placing.plant, bed), pt);
    const pl: Planting = { ...makePlanting(placing.plant, bed.id, 'single', [shape.x, shape.y], undefined, !!placing.growing), ...shape };
    const n = plantCount(pl, placing.plant);
    if (n > MAX_PLANTS) return say(`That's ${n.toLocaleString()} plants, which is more than one planting can hold.`);
    const name = placing.plant.commonName.toLowerCase();
    if (placing.trayId) {
      const trayId = placing.trayId;
      commit((g) => plantOutTray(g, trayId, pl, todayIso()));
      A.current.notify(`Planted out ${n === 1 ? `a ${name}` : `${n} ${name} plants`} from the shed into ${placeLabel(bed)}.`, { undo: true });
    } else {
      commit((g) => addPlanting(g, pl));
      say(`Planted ${n === 1 ? `a ${name}` : `${n} ${name} plants`} in ${placeLabel(bed)}.`);
    }
    p.setTool('select');
    p.setSelected({ type: 'planting', id: pl.id });
    p.onPlaced?.(pl.id, toScreen(view.current, pt), pt);
  };

  /** A sticker from the dock, dropped at a point: it's added, selected, and ready to drag into place. */
  const dropStickerAt = (st: Sticker, pt: Point) => {
    const p = P.current;
    const f = stickerFeature(st, pt);
    const first = garden().features.length === 0 && garden().boundary.length < 3;
    commit((g) => addFeature(g, f));
    // The first thing in an empty garden: zoom in on it, with room round it for what comes next.
    if (first) {
      const b = bounds(f.footprint)!;
      const pad = Math.max(400, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.5);
      zoomToPoints([[b.minX - pad, b.minY - pad], [b.maxX + pad, b.maxY + pad]]);
    }
    p.setTool('select');
    p.setSelected({ type: 'feature', id: f.id });
    p.setSelectedVertex(null);
    say(`${st.label} added. Drag it into place; pull a corner to resize it.`);
  };

  /** A click, tap or crosshair press with the Plant tool. */
  const plantAt = (pt: Point, dragged: boolean) => {
    const p = P.current;
    const dr = drawing.current;
    if (!p.placing) return say('Choose a plant to place first.');
    if (p.placing.layout === 'auto') return placeAuto(pt);
    if (p.placing.layout === 'single') return placePlanting(pt);
    const start = dr.points[0];
    if (start && (dragged || dr.points.length === 1)) {
      if (start[0] === pt[0] && start[1] === pt[1]) return;
      return placePlanting(start, pt);
    }
    dr.points = [pt];
    say(p.placing.layout === 'row' ? 'Now the other end of the row.' : 'Now the opposite corner of the block.');
    redraw();
  };

  // ---------- pointer ----------

  const onPointerDown = (e: PointerEvent) => {
    const c = canvas.current!;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      // Some synthetic or already-ended pointers can't be captured; dragging still works without it.
    }
    const s = screenOf(e);
    pointers.current.set(e.pointerId, s);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = { dist: distance(a, b), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      drag.current = null;
      preview.current = null;
      // A second finger means moving the plan, not drawing.
      stroke.current = null;
      return;
    }
    if (!view.current) return;
    const p = P.current;
    const world = toWorld(view.current, s);

    // Sketching: pen, highlighter and arrows follow the pointer; words go where you click; the eraser rubs out.
    if (p.tool === 'sketch' && !p.readOnly && p.sketchPen && e.button === 0 && !space.current) {
      const pen = p.sketchPen;
      if (pen.kind === 'eraser') {
        const g = garden();
        const ids = new Set(sketchesUnder(g, world, e.pointerType !== 'mouse').map((k) => k.id));
        drag.current = { kind: 'erase', base: g, ids };
        preview.current = deleteSketches(g, [...ids]);
        return redraw();
      }
      if (pen.kind === 'text') {
        if (!pen.text.trim()) return say('Type the words first, then click where they go.');
        const k = makeSketch('text', pen.colour, [world], { text: pen.text });
        commit((g) => addSketch(g, k));
        return;
      }
      stroke.current = { points: [world], last: s };
      return redraw();
    }
    // Drawing a shape by hand.
    if (p.byHand && canDrawByHand(p.tool) && !p.readOnly && e.button === 0 && !space.current) {
      stroke.current = { points: [world], last: s };
      return redraw();
    }

    // With the crosshair, one finger always moves the plan; corners and plants come from the drawing bar.
    if (p.crosshair && usesCrosshair(p.tool, p.byHand)) {
      drag.current = { kind: 'pan', last: s, moved: false };
      return;
    }

    if (e.button === 1 || space.current || (p.readOnly && e.pointerType !== 'mouse')) {
      drag.current = { kind: 'pan', last: s, moved: false };
      return;
    }
    if (e.button !== 0) return;

    if (p.tool === 'calibrate') {
      const d = drawing.current;
      const pt = snapAt(world, e).point;
      d.points = [...d.points, pt];
      if (d.points.length === 2) {
        p.onCalibrate(d.points[0]!, d.points[1]!);
        drawing.current = emptyDrawing();
      }
      return redraw();
    }

    if (p.tool === 'trace') {
      if (garden().trace) drag.current = { kind: 'trace', base: garden(), start: world };
      return;
    }

    // On a touch screen, a finger dragged with the Plant tool moves the plan; a tap plants.
    if (p.tool === 'plant' && e.pointerType !== 'mouse' && !p.readOnly) {
      drag.current = { kind: 'pan', last: s, moved: false };
      return;
    }

    const geometry = geometryForTool(p.tool);
    if ((geometry || p.tool === 'plant') && !p.readOnly) {
      drawing.current.down = { screen: s, world };
      return;
    }

    // Select tool.
    const g = garden();
    const edit = p.readOnly ? 'view' : (p.edit ?? 'layout');
    const layoutEdits = layoutEditable();
    const plantEdits = edit === 'planting' || edit === 'all';
    const nc = northCentre({ width: size.current.w });
    if (layoutEdits && !p.simple && distance(s, nc) <= NORTH_RADIUS + 4) {
      drag.current = { kind: 'north', base: g };
      return;
    }
    const touch = e.pointerType !== 'mouse';
    const tol = tolMm(touch ? 18 : 9);
    // The rotate handle above a selected shape.
    if (p.selected?.type === 'feature' && layoutEdits && !p.simple) {
      const id = p.selected.id;
      const f = g.features.find((x) => x.id === id);
      const at = f && !f.circle ? rotateHandleAt({ view: view.current }, f.footprint) : null;
      if (f && at && distance(s, at) <= (touch ? 22 : 11)) {
        const pivot = pivotOf(f);
        drag.current = { kind: 'rotate', id, base: g, pivot, from: Math.atan2(world[1] - pivot[1], world[0] - pivot[0]) };
        return;
      }
    }
    if (p.selected && layoutEdits) {
      const f = p.selected.type === 'feature' ? g.features.find((x) => x.id === (p.selected as { id: string }).id) : null;
      if (f?.circle) {
        const handle = toScreen(view.current, [f.circle.centre[0] + f.circle.radiusMm, f.circle.centre[1]]);
        if (distance(handle, s) <= (touch ? 20 : 9)) {
          drag.current = { kind: 'radius', id: f.id, base: g };
          return;
        }
      }
      // In Simple, a rectangle's corners resize it; other shapes show no corners, so a drag there moves the shape.
      const pts = p.simple && !(f && resizesByHandles(f)) ? null : pointsOf(g, p.selected);
      const vi = pts ? hitVertex(pts, world, tol) : null;
      if (vi !== null) {
        p.setSelectedVertex(vi);
        drag.current = { kind: 'vertex', target: p.selected, index: vi, base: g };
        return;
      }
    }
    if (p.selected && plantEdits) {
      // The ends of a selected row, or the corners of a block.
      const pl = p.selected.type === 'planting' ? g.plantings.find((x) => x.id === (p.selected as { id: string }).id) : null;
      const end = pl ? hitVertex(plantingHandles(pl), world, tol) : null;
      if (pl && end !== null) {
        drag.current = { kind: 'plantEnd', id: pl.id, end: end as 0 | 1, base: g };
        return;
      }
    }
    // What's already selected is what you drag, even with plants over it (a pot dropped on a row of lettuce).
    const selectedId = p.selected?.type === 'feature' ? p.selected.id : null;
    const selF = selectedId ? g.features.find((x) => x.id === selectedId) : undefined;
    const onSelected = selF && hitFeature({ ...g, features: [selF] }, world, tolMm(touch ? 6 : 9)) ? selF : null;
    // Otherwise plants sit on top of beds, so they're picked first, except when you're only drawing the layout.
    const planting = edit === 'layout' || onSelected ? null : hitPlanting(g, p.plantOf, world, tolMm(touch ? 6 : 3));
    if (planting) {
      const wasSelected = p.selected?.type === 'planting' && p.selected.id === planting.id;
      p.setSelected({ type: 'planting', id: planting.id });
      p.setSelectedVertex(null);
      drag.current =
        !plantEdits || (touch && !wasSelected)
          ? { kind: 'pan', last: s, moved: false }
          : { kind: 'movePlanting', id: planting.id, base: g, start: world, startScreen: s, moved: false };
      return;
    }
    const f = onSelected ?? hitFeature(g, world, tolMm(touch ? 6 : 9));
    if (f) {
      const wasSelected = p.selected?.type === 'feature' && p.selected.id === f.id;
      p.setSelected({ type: 'feature', id: f.id });
      p.setSelectedVertex(null);
      if (wasSelected && edit === 'all' && p.locked) say('The layout is locked. Unlock it with the padlock to move or reshape beds and paths.');
      // On touch screens a first tap only selects, so panning never moves things by accident.
      drag.current =
        !layoutEdits || (touch && !wasSelected)
          ? { kind: 'pan', last: s, moved: false }
          : { kind: 'move', id: f.id, base: g, start: world, startScreen: s, moved: false };
      return;
    }
    if (g.boundary.length >= 2) {
      const vi = hitVertex(g.boundary, world, tol);
      const edge = hitEdge(g.boundary, g.boundary.length >= 3, world, tol);
      if (vi !== null || edge) {
        p.setSelected({ type: 'boundary' });
        p.setSelectedVertex(vi);
        drag.current = vi !== null && layoutEdits && !p.simple ? { kind: 'vertex', target: { type: 'boundary' }, index: vi, base: g } : { kind: 'pan', last: s, moved: false };
        return;
      }
    }
    p.setSelected(null);
    p.setSelectedVertex(null);
    drag.current = { kind: 'pan', last: s, moved: false };
  };

  const onPointerMove = (e: PointerEvent) => {
    const s = screenOf(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    const v = view.current;
    if (!v) return;

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const dist = distance(a, b);
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      zooming();
      let next = zoomAt(v, dist / (pinch.current.dist || dist), mid);
      next = pan(next, mid[0] - pinch.current.mid[0], mid[1] - pinch.current.mid[1]);
      view.current = next;
      pinch.current = { dist, mid };
      return redraw();
    }

    const p = P.current;
    const world = toWorld(v, s);
    const st = stroke.current;
    if (st) {
      // Grow the stroke every few pixels; an arrow just follows its head.
      if (p.tool === 'sketch' && p.sketchPen?.kind === 'arrow') st.points = [st.points[0]!, world];
      else if (distance(s, st.last) >= 2.5) st.points.push(world);
      else return;
      st.last = s;
      return redraw();
    }
    const d = drag.current;
    if (d) {
      switch (d.kind) {
        case 'pan':
          view.current = pan(v, s[0] - d.last[0], s[1] - d.last[1]);
          if (Math.abs(s[0] - d.last[0]) + Math.abs(s[1] - d.last[1]) > 0) d.moved = true;
          d.last = s;
          break;
        case 'north': {
          const [cx, cy] = northCentre({ width: size.current.w });
          let deg = Math.round((Math.atan2(s[0] - cx, -(s[1] - cy)) * 180) / Math.PI);
          if (deg < 0) deg += 360;
          preview.current = { ...d.base, northRotationDeg: deg };
          break;
        }
        case 'move': {
          if (!d.moved && distance(s, d.startScreen) < 3) return;
          d.moved = true;
          const step = e.altKey ? 1 : snapStepFor(v.scale);
          let dx = Math.round((world[0] - d.start[0]) / step) * step;
          let dy = Math.round((world[1] - d.start[1]) / step) * step;
          // Line edges and middles up with other things, and show the line they share.
          guides.current = [];
          const f0 = d.base.features.find((x) => x.id === d.id);
          const b0 = f0 ? bounds(f0.footprint) : null;
          if (b0 && !e.altKey) {
            const others = d.base.features.filter((x) => x.id !== d.id).map((x) => bounds(x.footprint)).filter((b): b is Bounds => !!b);
            if (d.base.boundary.length >= 3) others.push(bounds(d.base.boundary)!);
            const tol = tolMm(7);
            const nearest = (axis: 'x' | 'y', shift: number) => {
              const lo = (axis === 'x' ? b0.minX : b0.minY) + shift;
              const hi = (axis === 'x' ? b0.maxX : b0.maxY) + shift;
              let best: { diff: number; at: number; o: Bounds } | null = null;
              for (const o of others) {
                const olo = axis === 'x' ? o.minX : o.minY;
                const ohi = axis === 'x' ? o.maxX : o.maxY;
                for (const a of [lo, (lo + hi) / 2, hi])
                  for (const b of [olo, (olo + ohi) / 2, ohi]) if (Math.abs(b - a) <= tol && (!best || Math.abs(b - a) < Math.abs(best.diff))) best = { diff: b - a, at: b, o };
              }
              return best;
            };
            const sx = nearest('x', dx);
            if (sx) dx += sx.diff;
            const sy = nearest('y', dy);
            if (sy) dy += sy.diff;
            if (sx) guides.current.push({ axis: 'x', at: sx.at, from: Math.min(b0.minY + dy, sx.o.minY), to: Math.max(b0.maxY + dy, sx.o.maxY) });
            if (sy) guides.current.push({ axis: 'y', at: sy.at, from: Math.min(b0.minX + dx, sy.o.minX), to: Math.max(b0.maxX + dx, sy.o.maxX) });
          }
          const key = guides.current.map((x) => `${x.axis}${x.at}`).join();
          if (key && key !== guideKey.current) navigator.vibrate?.(8);
          guideKey.current = key;
          preview.current = moveFeature(d.base, d.id, dx, dy);
          break;
        }
        case 'rotate': {
          let deg = ((Math.atan2(world[1] - d.pivot[1], world[0] - d.pivot[0]) - d.from) * 180) / Math.PI;
          // Turns in steps of 15° unless Alt is held.
          if (!e.altKey) deg = Math.round(deg / 15) * 15;
          preview.current = rotateFeature(d.base, d.id, deg);
          break;
        }
        case 'movePlanting': {
          if (!d.moved && distance(s, d.startScreen) < 3) return;
          d.moved = true;
          const step = e.altKey ? 1 : snapStepFor(v.scale);
          const dx = Math.round((world[0] - d.start[0]) / step) * step;
          const dy = Math.round((world[1] - d.start[1]) / step) * step;
          preview.current = movePlanting(d.base, d.id, dx, dy);
          break;
        }
        case 'plantEnd': {
          const pl = d.base.plantings.find((x) => x.id === d.id)!;
          const other: Point = d.end === 0 ? pl.endPoint! : [pl.x, pl.y];
          const pt = snapAt(world, e, pl.layout === 'row' ? other : undefined).point;
          const start: Point = d.end === 0 ? pt : [pl.x, pl.y];
          const end: Point = d.end === 0 ? pl.endPoint! : pt;
          // A row keeps its spacing as it's stretched.
          const count = pl.layout === 'row' ? { count: rowCount(start, end, p.plantOf(pl.plantId).size.spacingMm) } : {};
          preview.current = updatePlanting(d.base, d.id, { x: start[0], y: start[1], endPoint: end, ...count });
          break;
        }
        case 'vertex': {
          const pts = pointsOf(d.base, d.target)!;
          const n = pts.length;
          const closed = isClosed(d.base, d.target);
          const prev = closed || d.index > 0 ? pts[(d.index - 1 + n) % n] : undefined;
          const pt = snapAt(world, e, prev, [], { target: d.target, index: d.index }).point;
          // A rectangle stays a rectangle: dragging a corner resizes it from the opposite corner, at any angle. Alt frees the corner.
          const tid = d.target.type === 'feature' ? d.target.id : null;
          const f = tid ? d.base.features.find((x) => x.id === tid) : undefined;
          const r = f && !f.smooth && !f.line && !f.circle && !e.altKey ? rectInfo(f.footprint) : null;
          if (f && r) {
            const opp = f.footprint[(d.index + 2) % 4]!;
            const u: Point = [Math.cos(r.angle), Math.sin(r.angle)];
            const vv: Point = [-u[1] * r.turn, u[0] * r.turn];
            const du = (pt[0] - opp[0]) * u[0] + (pt[1] - opp[1]) * u[1];
            const dv = (pt[0] - opp[0]) * vv[0] + (pt[1] - opp[1]) * vv[1];
            const w = Math.max(50, Math.abs(du));
            const h = Math.max(50, Math.abs(dv));
            const su = du < 0 ? -1 : 1;
            const sv = dv < 0 ? -1 : 1;
            const cx = opp[0] + (u[0] * su * w) / 2 + (vv[0] * sv * h) / 2;
            const cy = opp[1] + (u[1] * su * w) / 2 + (vv[1] * sv * h) / 2;
            preview.current = updateFeature(d.base, f.id, { footprint: rectCorners({ ...r, cx, cy, w, h }) });
            break;
          }
          preview.current = moveVertex(d.base, d.target, d.index, pt);
          break;
        }
        case 'radius': {
          const f = d.base.features.find((x) => x.id === d.id)!;
          const step = e.altKey ? 1 : snapStepFor(v.scale);
          const r = Math.max(step, Math.round(distance(f.circle!.centre, world) / step) * step);
          preview.current = updateFeature(d.base, d.id, { circle: { ...f.circle!, radiusMm: r } });
          break;
        }
        case 'erase': {
          for (const k of sketchesUnder(d.base, world, e.pointerType !== 'mouse')) d.ids.add(k.id);
          preview.current = deleteSketches(d.base, [...d.ids]);
          break;
        }
        case 'trace': {
          const t = d.base.trace!;
          preview.current = { ...d.base, trace: { ...t, x: Math.round(t.x + world[0] - d.start[0]), y: Math.round(t.y + world[1] - d.start[1]) } };
          break;
        }
      }
      return redraw();
    }

    const geometry = geometryForTool(p.tool);
    const dr = drawing.current;
    if (p.tool === 'plant' && !p.readOnly) {
      const layout = p.placing?.layout ?? 'single';
      // Pressing and dragging marks out a row or block in one go.
      if (layout !== 'single' && dr.down && dr.points.length === 0 && distance(s, dr.down.screen) > 6) {
        dr.mode = 'rect';
        dr.points = [snapAt(dr.down.world, e).point];
      }
      const sn = snapAt(world, e, layout === 'row' ? dr.points[0] : undefined);
      dr.cursor = sn.point;
      dr.snap = sn.kind;
      return redraw();
    }
    if ((geometry || p.tool === 'calibrate') && !p.readOnly) {
      // Pressing and dragging with nothing drawn yet makes a rectangle (areas) or sizes a circle.
      if (dr.down && dr.points.length === 0 && distance(s, dr.down.screen) > 6) {
        if (geometry === 'area') {
          dr.mode = 'rect';
          dr.points = [snapAt(dr.down.world, e).point];
        } else if (geometry === 'circle') {
          dr.mode = 'circle';
          dr.points = [snapAt(dr.down.world, e).point];
        }
      }
      const from = dr.mode === 'rect' || dr.mode === 'circle' ? undefined : dr.points[dr.points.length - 1];
      const sn = snapAt(world, e, from, dr.points.slice(0, 1));
      dr.cursor = sn.point;
      dr.snap = sn.kind;
      return redraw();
    }

    if (e.pointerType === 'mouse') {
      pointerWorld.current = world;
      p.onHoverPoint?.(world);
      const g = garden();
      const h = hitPlanting(g, p.plantOf, world, tolMm(3))?.id ?? hitFeature(g, world, tolMm(6))?.id ?? null;
      if (h !== hover.current) {
        hover.current = h;
        redraw();
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const p = P.current;
    const st = stroke.current;
    if (st) {
      stroke.current = null;
      if (p.tool === 'sketch') finishSketch(st.points);
      else finishByHand(st.points);
      return redraw();
    }
    const d = drag.current;
    guides.current = [];
    // A tap with the Plant tool on a touch screen plants; a drag only moved the plan.
    if (d && d.kind === 'pan' && !d.moved && p.tool === 'plant' && view.current) {
      drag.current = null;
      // A plant dropped with "fill for me" goes exactly where you tapped: snapping could miss a small pot or window box.
      const raw = toWorld(view.current, screenOf(e));
      plantAt(p.placing?.layout === 'auto' ? raw : snapAt(raw, e).point, false);
      return redraw();
    }
    // Touch has no double-click: two quick taps in the same place add a corner to an edge.
    if (d && (d.kind === 'pan' || d.kind === 'move' || d.kind === 'movePlanting') && !d.moved && p.tool === 'select' && view.current) {
      const s = screenOf(e);
      p.onTap?.(toWorld(view.current, s));
      if (e.pointerType !== 'mouse') {
        const now = performance.now();
        const last = lastTap.current;
        if (last && now - last.t < 350 && distance(s, last.s) < 24) {
          lastTap.current = null;
          doubleTapAt(s, 16);
        } else lastTap.current = { t: now, s };
      }
    }
    if (d) {
      drag.current = null;
      const next = preview.current;
      preview.current = null;
      if (next && next !== p.garden) commit(() => next);
      return redraw();
    }

    const geometry = geometryForTool(p.tool);
    const dr = drawing.current;
    if (p.tool === 'plant' && dr.down && !p.readOnly) {
      const raw = toWorld(view.current!, screenOf(e));
      const pt = p.placing?.layout === 'auto' ? raw : (dr.cursor ?? snapAt(raw, e).point);
      dr.down = null;
      return plantAt(pt, dr.mode === 'rect');
    }
    if (!geometry || !dr.down || p.readOnly) return;
    const pt = dr.cursor ?? snapAt(toWorld(view.current!, screenOf(e)), e).point;
    dr.down = null;
    if (dr.mode === 'rect') return finishRect(dr.points[0]!, pt);
    if (geometry === 'circle') {
      if (dr.mode === 'circle' || dr.points.length === 1) return finishCircle(dr.points[0]!, Math.round(distance(dr.points[0]!, pt)));
      dr.points = [pt];
      return redraw();
    }
    // A click adds a corner; clicking the first corner again closes an area.
    if (geometry === 'area' && dr.points.length >= 3 && pt[0] === dr.points[0]![0] && pt[1] === dr.points[0]![1]) return finishShape(dr.points);
    dr.points = [...dr.points, pt];
    redraw();
  };

  const onDoubleClick = (e: MouseEvent) => {
    const p = P.current;
    const geometry = geometryForTool(p.tool);
    if (!p.readOnly && (geometry === 'area' || geometry === 'line')) return finishShape(drawing.current.points);
    if (p.tool === 'select') doubleTapAt(screenOf(e), 8);
  };

  /** Double-click or double-tap: in the layout, adds a corner to an edge; when planting, zooms in on a bed. */
  const doubleTapAt = (s: Point, tolPx: number) => {
    const p = P.current;
    const edit = p.readOnly ? 'view' : (p.edit ?? 'layout');
    if (edit === 'layout') return void insertCornerAt(s, tolPx);
    // With everything editable: on the edge of a selected shape, add a corner; otherwise zoom in on the bed.
    if (edit === 'all' && layoutEditable() && !p.simple && p.selected && p.selected.type !== 'planting' && insertCornerAt(s, tolPx)) return;
    if (!view.current) return;
    const bed = containerAt(garden(), toWorld(view.current, s));
    if (bed) zoomToPoints(bed.footprint);
  };

  /** Fits these points in the view with a half-metre margin, zooming in or out. */
  const zoomToPoints = (pts: Point[]) => {
    const b = bounds(pts);
    const { w, h } = size.current;
    if (!b || !w || !h) return;
    const pad = 500;
    const box = { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
    view.current = fit(box, w, h);
    zoomGoal.current = { box, until: performance.now() + 600 };
    redraw();
  };

  /** Adds a corner to the selected outline where the pointer is on one of its edges. */
  const insertCornerAt = (s: Point, tolPx: number): boolean => {
    const p = P.current;
    if (!p.selected || !view.current) return false;
    const g = p.garden;
    const pts = pointsOf(g, p.selected);
    if (!pts) return false;
    const edge = hitEdge(pts, isClosed(g, p.selected), toWorld(view.current, s), tolMm(tolPx));
    if (!edge) return false;
    const target = p.selected;
    commit((x) => insertVertex(x, target, edge.index, edge.point));
    p.setSelectedVertex(edge.index + 1);
    return true;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!view.current) return;
    zooming();
    const k = e.ctrlKey ? 0.01 : 0.0015; // trackpad pinch arrives as ctrl+wheel
    view.current = zoomAt(view.current, Math.exp(-e.deltaY * k), screenOf(e));
    redraw();
  };

  // ---------- keyboard ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') space.current = e.type === 'keydown';
      if (e.type !== 'keydown' || isTyping(e.target)) return;
      const p = P.current;
      const dr = drawing.current;
      const geometry = geometryForTool(p.tool);
      const key = e.key;

      // Typing an exact length while drawing, or for a row of plants.
      const plantRow = p.tool === 'plant' && p.placing?.layout === 'row';
      if ((geometry || p.tool === 'calibrate' || plantRow) && !p.readOnly && dr.points.length > 0 && !e.ctrlKey && !e.metaKey) {
        if (/^[0-9.,]$/.test(key) || (dr.typed && /^[mc]$/i.test(key))) {
          dr.typed += key;
          e.preventDefault();
          return redraw();
        }
        if (key === 'Backspace') {
          e.preventDefault();
          if (dr.typed) dr.typed = dr.typed.slice(0, -1);
          else dr.points = dr.points.slice(0, -1);
          if (dr.points.length === 0) dr.mode = 'idle';
          return redraw();
        }
        if (key === 'Enter') {
          e.preventDefault();
          if (dr.typed) {
            const len = parseLength(dr.typed);
            dr.typed = '';
            if (len === null) return redraw();
            const from = dr.points[dr.points.length - 1]!;
            if (geometry === 'circle') return finishCircle(dr.points[0]!, len);
            const toward = dr.cursor && (dr.cursor[0] !== from[0] || dr.cursor[1] !== from[1]) ? dr.cursor : ([from[0] + 1, from[1]] as Point);
            if (plantRow) return placePlanting(from, pointAtLength(from, toward, len));
            dr.points = [...dr.points, pointAtLength(from, toward, len)];
            return redraw();
          }
          if (plantRow) return;
          return finishShape(dr.points);
        }
      }
      if (key === 'Escape') {
        if (stroke.current) stroke.current = null;
        else if (dr.typed) dr.typed = '';
        else if (dr.points.length > 0) drawing.current = emptyDrawing();
        else if (p.tool !== 'select') p.setTool('select');
        else {
          p.setSelected(null);
          p.setSelectedVertex(null);
        }
        return redraw();
      }
      if (e.ctrlKey || e.metaKey) {
        const letter = key.toLowerCase();
        const plantsEditable = !p.readOnly && (p.edit === 'all' || p.edit === 'planting');
        const sel = p.selected;
        // Copy, paste and duplicate a planting. Text selected on the page is left for the browser to copy.
        if (letter === 'c' && sel?.type === 'planting' && !getSelection()?.toString()) {
          const pl = p.garden.plantings.find((x) => x.id === sel.id);
          if (pl) {
            copyPlanting(pl);
            A.current.notify(`${p.plantOf(pl.plantId).commonName} copied. Point at a bed and press Ctrl+V to paste it there.`);
          }
          return;
        }
        if (letter === 'v' && plantsEditable && copiedPlanting()) {
          e.preventDefault();
          const copied = copiedPlanting()!;
          const g = p.garden;
          // Where the mouse is, if that's somewhere it can grow; or the bed that's picked; or beside the one it was copied from.
          const over = pointerWorld.current && containerAt(g, pointerWorld.current) ? pointerWorld.current : null;
          const picked = sel?.type === 'feature' ? g.features.find((f) => f.id === sel.id) : undefined;
          const box = picked && picked.footprint.length >= 3 ? bounds(picked.footprint) : null;
          const point: Point | undefined = over ?? (box ? [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2] : undefined);
          const made = { id: null as string | null };
          commit((gg) => {
            const copy = placeCopy(gg, copied, p.plantOf, point);
            made.id = copy?.id ?? null;
            return copy ? addPlanting(gg, copy) : gg;
          });
          const name = p.plantOf(copied.plantId).commonName;
          if (made.id) p.setSelected({ type: 'planting', id: made.id });
          else A.current.notify(`No room for ${name.toLowerCase()} there.`);
          return;
        }
        if (letter === 'd' && sel?.type === 'planting' && plantsEditable) {
          e.preventDefault();
          const made = { id: null as string | null };
          commit((g) => {
            const [next, copy] = duplicatePlanting(g, sel.id, p.plantOf);
            made.id = copy;
            return next;
          });
          if (made.id) p.setSelected({ type: 'planting', id: made.id });
          else A.current.notify(`No room for another ${p.plantOf(p.garden.plantings.find((x) => x.id === sel.id)?.plantId ?? '').commonName.toLowerCase()} in this bed.`);
          return;
        }
        if (letter === 'd' && p.selected?.type === 'feature' && layoutEditable()) {
          e.preventDefault();
          const id = p.selected.id;
          const made = { id: null as string | null };
          commit((g) => {
            const [next, copy] = duplicateFeature(g, id);
            made.id = copy;
            return next;
          });
          if (made.id) p.setSelected({ type: 'feature', id: made.id });
        }
        return;
      }
      const edit = p.readOnly ? 'view' : (p.edit ?? 'layout');
      if (edit === 'view') return;
      if ((key === 'Delete' || key === 'Backspace') && p.selected) {
        const t = p.selected;
        if (edit === 'all' ? t.type !== 'planting' && !layoutEditable() : (t.type === 'planting') !== (edit === 'planting')) return;
        e.preventDefault();
        if (t.type === 'planting') {
          const pl = p.garden.plantings.find((x) => x.id === t.id);
          commit((g) => deletePlanting(g, t.id));
          p.setSelected(null);
          if (pl) A.current.notify(`${p.plantOf(pl.plantId).commonName} deleted.`, { undo: true });
        } else if (p.selectedVertex !== null) {
          const i = p.selectedVertex;
          commit((g) => removeVertex(g, t, i));
          p.setSelectedVertex(null);
        } else if (t.type === 'feature') {
          const f = p.garden.features.find((x) => x.id === t.id);
          commit((g) => deleteFeatures(g, [t.id]));
          p.setSelected(null);
          if (f) A.current.notify(deletedMessage(p.garden, f), { undo: true });
        } else {
          commit((g) => ({ ...g, boundary: [] }));
          p.setSelected(null);
        }
        return;
      }
      if (key.startsWith('Arrow') && ((p.selected?.type === 'feature' && layoutEditable()) || (p.selected?.type === 'planting' && (edit === 'planting' || edit === 'all')))) {
        e.preventDefault();
        const step = e.shiftKey ? 100 : 10;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowDown' ? -step : key === 'ArrowUp' ? step : 0;
        const t = p.selected;
        commit((g) => (t.type === 'planting' ? movePlanting(g, t.id, dx, dy) : moveFeature(g, t.id, dx, dy)));
        return;
      }
      const tools: Record<string, Tool> = { v: 'select', b: 'boundary', r: 'bed', p: 'path', l: 'fence', t: 'tree', u: 'surface', g: 'plant', k: 'sketch' };
      const t = tools[key.toLowerCase()];
      if (t && !e.altKey) return p.setTool(t);
      if (key === '0') return fitView();
      if ((key === '+' || key === '=' || key === '-') && view.current) {
        view.current = zoomAt(view.current, key === '-' ? 1 / 1.25 : 1.25, [size.current.w / 2, size.current.h / 2]);
        redraw();
      }
    };
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
    };
  }, []);

  // Commands for the phone's drawing bar. They act on the point under the crosshair.
  if (props.apiRef)
    props.apiRef.current = {
      addCorner() {
        const geometry = geometryForTool(P.current.tool);
        if (!geometry || !view.current) return;
        const dr = drawing.current;
        const pt = crosshairSnap().point;
        if (geometry === 'circle') return finishCircle(pt, KINDS[P.current.tool as FeatureKind].radiusMm ?? 1000);
        const first = dr.points[0];
        if (geometry === 'area' && dr.points.length >= 3 && first && pt[0] === first[0] && pt[1] === first[1]) return finishShape(dr.points);
        const last = dr.points[dr.points.length - 1];
        if (last && last[0] === pt[0] && last[1] === pt[1]) return;
        dr.points = [...dr.points, pt];
        redraw();
      },
      undoCorner() {
        drawing.current.points = drawing.current.points.slice(0, -1);
        drawing.current.mode = 'idle';
        redraw();
      },
      typeLength(mm) {
        const dr = drawing.current;
        const from = dr.points[dr.points.length - 1];
        if (!from) return 'Add the first corner, then type the length of the next side.';
        const toward = crosshairSnap().point;
        if (distance(from, toward) < 1) return 'Drag the plan so the crosshair shows which way this side goes.';
        const pt = pointAtLength(from, toward, mm);
        dr.points = [...dr.points, pt];
        centreOn(pt);
        redraw();
        return null;
      },
      finish() {
        finishShape(drawing.current.points);
      },
      cancel() {
        drawing.current = emptyDrawing();
        P.current.setTool('select');
        redraw();
      },
      placeRect(w, h) {
        const [cx, cy] = crosshairSnap().point;
        finishShape(rectPoints({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) }));
      },
      placeCircle(radius) {
        finishCircle(crosshairSnap().point, Math.round(radius));
      },
      placePlant() {
        if (view.current) plantAt(crosshairSnap().point, false);
      },
      zoomTo(points) {
        zoomToPoints(points);
      },
      dropSticker(id) {
        const st = stickerById(id);
        const v = view.current;
        if (!st || !v) return;
        const step = snapStepFor(v.scale);
        const [x, y] = toWorld(v, [size.current.w / 2, size.current.h / 2]);
        dropStickerAt(st, [Math.round(x / step) * step, Math.round(y / step) * step]);
      },
      show(points) {
        const b = bounds(points);
        const v = view.current;
        if (!b || !v) return;
        // Zoom in so about 2 m around the plants fills the view; never zoom out to do it.
        const pad = 1000;
        const target = fit({ minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }, size.current.w, size.current.h);
        view.current = { ...v, scale: Math.max(v.scale, Math.min(target.scale, 0.35)) };
        centreOn([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]);
        redraw();
      },
    };

  // Plants, trays and stickers dragged from the dock or a list land where they're dropped.
  const DROP_TYPES = [PLANT_DRAG_TYPE, STICKER_DRAG_TYPE, TRAY_DRAG_TYPE];
  const onDragOver = (e: DragEvent) => {
    if (!props.readOnly && DROP_TYPES.some((t) => e.dataTransfer?.types.includes(t))) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    }
  };
  const onDrop = (e: DragEvent) => {
    const dt = e.dataTransfer;
    if (!dt || !view.current || props.readOnly) return;
    const p = P.current;
    const pt = snapAt(toWorld(view.current, screenOf(e)), { altKey: e.altKey, shiftKey: false }).point;
    const sticker = dt.getData(STICKER_DRAG_TYPE);
    if (sticker) {
      e.preventDefault();
      const st = stickerById(sticker);
      if (st) dropStickerAt(st, pt);
      return;
    }
    const plantId = dt.getData(PLANT_DRAG_TYPE);
    const trayId = dt.getData(TRAY_DRAG_TYPE);
    const tray = trayId ? garden().trays?.find((t) => t.id === trayId) : undefined;
    if (!plantId && !tray) return;
    e.preventDefault();
    const placing = p.placing;
    // Dropped plants fill the bed the usual way for the plant, whatever the Plant tool is set to.
    P.current = { ...p, placing: { plant: p.plantOf(tray ? tray.plantId : plantId), layout: 'auto', growing: !!placing?.growing, ...(tray ? { trayId: tray.id } : {}) } };
    placeAuto(pt);
    P.current = { ...P.current, placing };
  };

  const cursor = props.readOnly ? 'grab' : props.tool === 'select' ? 'default' : props.tool === 'trace' ? 'move' : props.tool === 'sketch' && props.sketchPen?.kind === 'text' ? 'text' : 'crosshair';

  return (
    <div ref={wrap} class="plan-canvas-wrap">
      <canvas
        ref={canvas}
        class="plan-canvas"
        tabIndex={0}
        style={{ cursor }}
        role="img"
        aria-label={`Plan of ${props.garden.name}. Use the list of features beside the plan to select items.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => props.onHoverPoint?.(null)}
        onDblClick={onDoubleClick}
        onWheel={onWheel}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
      {props.children}
    </div>
  );
}
