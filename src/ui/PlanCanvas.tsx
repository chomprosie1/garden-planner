// The interactive plan: drawing, selecting, dragging, zooming and panning.
// Drags show a preview and commit once when released, so each is one undo step.

import { useEffect, useRef } from 'preact/hooks';
import { hitEdge, hitFeature, hitVertex } from '../canvas/hit';
import { northCentre, NORTH_RADIUS, planStyle, render, type Draft } from '../canvas/render';
import { parseLength, snapPoint, snapStepFor, type SnapKind } from '../canvas/snap';
import { fit, pan, toScreen, toWorld, zoomAt, type Viewport } from '../canvas/viewport';
import { distance } from '../geometry/polygon';
import { pointAtLength } from '../geometry/snap';
import {
  addFeature,
  deleteFeatures,
  duplicateFeature,
  gardenBounds,
  insertVertex,
  isClosed,
  KINDS,
  makeFeature,
  moveFeature,
  moveVertex,
  pointsOf,
  rectPoints,
  removeVertex,
  setPoints,
  updateFeature,
  type Target,
} from '../model/features';
import { updateGarden, type Store } from '../model/store';
import type { FeatureKind, Garden, Point } from '../model/types';
import type { LookId, Mode } from '../theme/looks';

export type Tool = 'select' | 'boundary' | 'calibrate' | 'trace' | FeatureKind;

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
  fitSignal: number;
  traceImage: HTMLImageElement | null;
  onCalibrate: (a: Point, b: Point) => void;
  /** Phones: draw with a fixed crosshair at the centre, moving the plan under it. */
  crosshair?: boolean;
  apiRef?: { current: CanvasApi | null };
  /** How many corners the current drawing has, so the drawing bar can enable its buttons. */
  onDraftChange?: (corners: number) => void;
}

type Drag =
  | { kind: 'pan'; last: Point; moved: boolean }
  | { kind: 'north'; base: Garden }
  | { kind: 'move'; id: string; base: Garden; start: Point; startScreen: Point; moved: boolean }
  | { kind: 'vertex'; target: Target; index: number; base: Garden }
  | { kind: 'radius'; id: string; base: Garden }
  | { kind: 'trace'; base: Garden; start: Point };

interface Drawing {
  points: Point[];
  cursor: Point | null;
  snap: SnapKind;
  typed: string;
  mode: 'idle' | 'rect' | 'circle';
  down: { screen: Point; world: Point } | null;
}

const emptyDrawing = (): Drawing => ({ points: [], cursor: null, snap: 'none', typed: '', mode: 'idle', down: null });

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function geometryForTool(tool: Tool): 'area' | 'line' | 'circle' | null {
  if (tool === 'boundary') return 'area';
  if (tool === 'select' || tool === 'calibrate' || tool === 'trace') return null;
  return KINDS[tool].geometry;
}

export function PlanCanvas(props: PlanCanvasProps) {
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
    const useCrosshair = !!p.crosshair && !!geometry;
    if (useCrosshair) {
      const sn = crosshairSnap();
      d.cursor = sn.point;
      d.snap = sn.kind;
    }
    p.onDraftChange?.(d.points.length);
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
    render(ctx, {
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
    });
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
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prev = size.current;
      // Keep the same spot in the middle when the canvas changes size, so the crosshair never drifts.
      if (view.current && prev.w && prev.h) view.current = pan(view.current, (r.width - prev.w) / 2, (r.height - prev.h) / 2);
      size.current = { w: r.width, h: r.height, dpr };
      const c = canvas.current!;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
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
    };
  }, []);

  useEffect(() => {
    if (props.fitSignal > 0) fitView();
  }, [props.fitSignal]);

  // A new tool starts a fresh drawing.
  useEffect(() => {
    drawing.current = emptyDrawing();
    redraw();
  }, [props.tool]);

  useEffect(redraw, [props.garden, props.look, props.mode, props.selected, props.selectedVertex, props.traceImage]);

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
        p.setSelected({ type: 'boundary' });
      } else {
        const f = makeFeature(p.tool as FeatureKind, { area: clean });
        commit((g) => addFeature(g, f));
        p.setSelected({ type: 'feature', id: f.id });
      }
      p.setTool('select');
    } else if (geometry === 'line' && clean.length >= 2) {
      const f = makeFeature(p.tool as FeatureKind, { line: clean });
      commit((g) => addFeature(g, f));
      p.setSelected({ type: 'feature', id: f.id });
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
    p.setSelected({ type: 'feature', id: f.id });
    p.setTool('select');
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
      return;
    }
    if (!view.current) return;
    const p = P.current;
    const world = toWorld(view.current, s);

    // With the crosshair, one finger always moves the plan; corners come from the drawing bar.
    if (p.crosshair && geometryForTool(p.tool)) {
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

    const geometry = geometryForTool(p.tool);
    if (geometry && !p.readOnly) {
      drawing.current.down = { screen: s, world };
      return;
    }

    // Select tool.
    const g = garden();
    const nc = northCentre({ width: size.current.w });
    if (!p.readOnly && distance(s, nc) <= NORTH_RADIUS + 4) {
      drag.current = { kind: 'north', base: g };
      return;
    }
    const touch = e.pointerType !== 'mouse';
    const tol = tolMm(touch ? 18 : 9);
    if (p.selected && !p.readOnly) {
      const f = p.selected.type === 'feature' ? g.features.find((x) => x.id === (p.selected as { id: string }).id) : null;
      if (f?.circle) {
        const handle = toScreen(view.current, [f.circle.centre[0] + f.circle.radiusMm, f.circle.centre[1]]);
        if (distance(handle, s) <= (touch ? 20 : 9)) {
          drag.current = { kind: 'radius', id: f.id, base: g };
          return;
        }
      }
      const pts = pointsOf(g, p.selected);
      const vi = pts ? hitVertex(pts, world, tol) : null;
      if (vi !== null) {
        p.setSelectedVertex(vi);
        drag.current = { kind: 'vertex', target: p.selected, index: vi, base: g };
        return;
      }
    }
    const f = hitFeature(g, world, tolMm(touch ? 6 : 9));
    if (f) {
      const wasSelected = p.selected?.type === 'feature' && p.selected.id === f.id;
      p.setSelected({ type: 'feature', id: f.id });
      p.setSelectedVertex(null);
      // On touch screens a first tap only selects, so panning never moves things by accident.
      drag.current =
        p.readOnly || (touch && !wasSelected)
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
        drag.current = vi !== null && !p.readOnly ? { kind: 'vertex', target: { type: 'boundary' }, index: vi, base: g } : { kind: 'pan', last: s, moved: false };
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
      let next = zoomAt(v, dist / (pinch.current.dist || dist), mid);
      next = pan(next, mid[0] - pinch.current.mid[0], mid[1] - pinch.current.mid[1]);
      view.current = next;
      pinch.current = { dist, mid };
      return redraw();
    }

    const p = P.current;
    const world = toWorld(v, s);
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
          const dx = Math.round((world[0] - d.start[0]) / step) * step;
          const dy = Math.round((world[1] - d.start[1]) / step) * step;
          preview.current = moveFeature(d.base, d.id, dx, dy);
          break;
        }
        case 'vertex': {
          const pts = pointsOf(d.base, d.target)!;
          const n = pts.length;
          const closed = isClosed(d.base, d.target);
          const prev = closed || d.index > 0 ? pts[(d.index - 1 + n) % n] : undefined;
          const pt = snapAt(world, e, prev, [], { target: d.target, index: d.index }).point;
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
      const h = hitFeature(garden(), world, tolMm(6))?.id ?? null;
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
    const d = drag.current;
    // Touch has no double-click: two quick taps in the same place add a corner to an edge.
    if (e.pointerType !== 'mouse' && d && (d.kind === 'pan' || d.kind === 'move') && !d.moved && p.tool === 'select') {
      const s = screenOf(e);
      const now = performance.now();
      const last = lastTap.current;
      if (last && now - last.t < 350 && distance(s, last.s) < 24) {
        lastTap.current = null;
        insertCornerAt(s, 16);
      } else lastTap.current = { t: now, s };
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
    if (p.readOnly) return;
    const geometry = geometryForTool(p.tool);
    if (geometry === 'area' || geometry === 'line') return finishShape(drawing.current.points);
    if (p.tool === 'select') insertCornerAt(screenOf(e), 8);
  };

  /** Adds a corner to the selected outline where the pointer is on one of its edges. */
  const insertCornerAt = (s: Point, tolPx: number) => {
    const p = P.current;
    if (!p.selected || !view.current) return;
    const g = p.garden;
    const pts = pointsOf(g, p.selected);
    if (!pts) return;
    const edge = hitEdge(pts, isClosed(g, p.selected), toWorld(view.current, s), tolMm(tolPx));
    if (edge) {
      const target = p.selected;
      commit((x) => insertVertex(x, target, edge.index, edge.point));
      p.setSelectedVertex(edge.index + 1);
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!view.current) return;
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

      // Typing an exact length while drawing.
      if ((geometry || p.tool === 'calibrate') && !p.readOnly && dr.points.length > 0 && !e.ctrlKey && !e.metaKey) {
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
            dr.points = [...dr.points, pointAtLength(from, toward, len)];
            return redraw();
          }
          return finishShape(dr.points);
        }
      }
      if (key === 'Escape') {
        if (dr.typed) dr.typed = '';
        else if (dr.points.length > 0) drawing.current = emptyDrawing();
        else if (p.tool !== 'select') p.setTool('select');
        else {
          p.setSelected(null);
          p.setSelectedVertex(null);
        }
        return redraw();
      }
      if (e.ctrlKey || e.metaKey) {
        if (key.toLowerCase() === 'd' && p.selected?.type === 'feature' && !p.readOnly) {
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
      if (p.readOnly) return;
      if ((key === 'Delete' || key === 'Backspace') && p.selected) {
        e.preventDefault();
        const t = p.selected;
        if (p.selectedVertex !== null) {
          const i = p.selectedVertex;
          commit((g) => removeVertex(g, t, i));
          p.setSelectedVertex(null);
        } else if (t.type === 'feature') {
          commit((g) => deleteFeatures(g, [t.id]));
          p.setSelected(null);
        } else {
          commit((g) => ({ ...g, boundary: [] }));
          p.setSelected(null);
        }
        return;
      }
      if (key.startsWith('Arrow') && p.selected?.type === 'feature') {
        e.preventDefault();
        const step = e.shiftKey ? 100 : 10;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowDown' ? -step : key === 'ArrowUp' ? step : 0;
        const id = p.selected.id;
        commit((g) => moveFeature(g, id, dx, dy));
        return;
      }
      const tools: Record<string, Tool> = { v: 'select', b: 'boundary', r: 'bed', p: 'path', l: 'fence', t: 'tree' };
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
    };

  const cursor = props.readOnly ? 'grab' : props.tool === 'select' ? 'default' : props.tool === 'trace' ? 'move' : 'crosshair';

  return (
    <div ref={wrap} class="plan-canvas-wrap">
      <canvas
        ref={canvas}
        class="plan-canvas"
        style={{ cursor }}
        role="img"
        aria-label={`Plan of ${props.garden.name}. Use the list of features beside the plan to select items.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDblClick={onDoubleClick}
        onWheel={onWheel}
      />
    </div>
  );
}
