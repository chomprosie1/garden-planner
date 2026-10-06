// Plants drawn from above, by code: a lettuce is a rosette of broad leaves, a
// tomato an upright plant of lobed leaves with yellow flowers and red fruit.
// Each plant is a few traits (src/model/types.ts, PlantArt), and its stage
// decides how big it is and whether it shows flowers or its crop.
//
// Drawing is pure canvas, centred on (0, 0) with a radius in pixels, so the
// same drawing serves the plan (via cached sprites), plant cards and lists.

import { flowers as hasFlowerStage, harvests, pathFor, sowingOf, type LifeStage } from '../lifecycle/stages';
import type { Plant, PlantArt, Planting } from '../model/types';

// ---------- Colour ----------

type Rgb = [number, number, number];
const rgb = (c: string): Rgb => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const mixHex = (a: string, b: string, k: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
};
/** Lighter (k > 0) or darker (k < 0). */
export const shadeHex = (c: string, k: number) => (k >= 0 ? mixHex(c, '#ffffff', k) : mixHex(c, '#000000', -k));

// ---------- What a plant looks like ----------

/** Greens for plants with no drawing of their own (your own plants), picked by id so each keeps its colour. */
const GREENS = ['#5a8a3c', '#4f7f45', '#6a9a4a', '#3f7a52', '#7a9a3a', '#4a8a6a'];
const pick = (id: string, list: string[]) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
};

const CATEGORY_ART: Record<Plant['category'], Omit<PlantArt, 'foliage'>> = {
  vegetable: { form: 'rosette', leaf: 'broad' },
  herb: { form: 'mound', leaf: 'round', flower: '#f4f1e6' },
  fruit: { form: 'shrub', leaf: 'lobed', flower: '#f6f0ee', crop: { kind: 'fruit', colour: '#c8302a' } },
  flower: { form: 'mound', leaf: 'broad', flower: '#d9608c', bloom: 'daisy' },
  shrub: { form: 'shrub', leaf: 'broad', flower: '#f0e6f0' },
  tree: { form: 'tree', leaf: 'broad', flower: '#f6e6ee' },
};

/** A plant's drawing: its own, or one for its category. */
export function artFor(p: Plant): PlantArt {
  return p.art ?? { ...CATEGORY_ART[p.category], foliage: pick(p.id, GREENS) };
}

/** The stage that shows a plant at its best, for cards and lists: its crop, its flowers, or in full leaf. */
export function showcaseStage(p: Plant): LifeStage {
  const art = artFor(p);
  if (harvests(p) && art.crop) return 'harvesting';
  if (hasFlowerStage(p) && art.flower) return 'flowering';
  return 'vegetative';
}

/** How a stage is drawn: its size, whether it's only planned (faint), and what's showing. */
export interface Look {
  /** 0 = just sown, 1 = full size. */
  grow: number;
  /** Not in the bed yet: planned, or growing indoors. Drawn faintly at full size, so the plan reads as a plan. */
  ghost: boolean;
  seedling: boolean;
  seeds: boolean;
  flowers: boolean;
  crop: boolean;
}

export function stageLook(stage: LifeStage, plant: Plant, pl?: Planting): Look {
  const base: Look = { grow: 1, ghost: false, seedling: false, seeds: false, flowers: false, crop: false };
  const outside = sowingOf(plant, pl) === 'direct';
  switch (stage) {
    case 'planned':
    case 'cleared':
      return { ...base, ghost: true };
    case 'sown':
      return outside ? { ...base, grow: 0, seeds: true } : { ...base, ghost: true };
    case 'germinated':
      return outside ? { ...base, grow: 0.3, seedling: true } : { ...base, ghost: true };
    case 'hardening':
      return { ...base, ghost: true };
    case 'transplanted':
      // Bought plants and bulbs are planted at a good size; seedlings start small.
      return { ...base, grow: sowingOf(plant, pl) === 'none' ? 0.8 : 0.55 };
    case 'vegetative':
      return base;
    case 'flowering':
      return { ...base, flowers: true };
    case 'harvesting':
      // The crop shows when there's one to draw; otherwise the plant stays in flower (cut flowers).
      return { ...base, crop: true, flowers: pathFor(plant, pl).includes('flowering') && !artFor(plant).crop };
  }
}

// ---------- Style ----------

/** How plants are drawn in each look. */
export type ArtStyle = 'wash' | 'ink' | 'flat' | 'outline';

export interface Paint {
  style: ArtStyle;
  mode: 'light' | 'dark';
  /** Line colour for ink and outline styles. */
  ink: string;
  /** The paper, for outline fills and highlights. */
  paper: string;
  /** Soil, for seeds just sown. */
  soil: string;
}

// ---------- Randomness that repeats ----------

export function seeded(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
export const hashString = (str: string) => {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};

// ---------- Drawing ----------

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

interface Leaf {
  angle: number;
  /** Where the leaf starts, out from the centre. */
  from: number;
  len: number;
  width: number;
  shade: number;
}

/** Fills and strokes the current path in the look's style. */
function paintPath(ctx: Ctx, P: Paint, colour: string, r: number, opts: { line?: number; strokeOnly?: boolean } = {}) {
  const c = P.mode === 'dark' ? shadeHex(colour, 0.08) : colour;
  // Lines grow a little with the plant, but stay fine: a tree drawn large is still drawn with a fine pen.
  const line = opts.line ?? Math.min(P.style === 'outline' ? 1.3 : 1.6, Math.max(0.5, r / 45));
  if (P.style === 'outline') {
    if (!opts.strokeOnly) {
      ctx.fillStyle = P.paper;
      ctx.fill();
    }
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = line;
    ctx.stroke();
    return;
  }
  if (opts.strokeOnly) {
    ctx.strokeStyle = c;
    ctx.lineWidth = line * 2;
    ctx.stroke();
    return;
  }
  ctx.fillStyle = P.style === 'ink' ? mixHex(c, P.paper, 0.2) : c;
  ctx.fill();
  if (P.style === 'flat') return;
  ctx.strokeStyle = P.style === 'ink' ? P.ink : shadeHex(c, -0.35);
  ctx.globalAlpha *= P.style === 'ink' ? 0.9 : 0.6;
  ctx.lineWidth = line;
  ctx.stroke();
  ctx.globalAlpha /= P.style === 'ink' ? 0.9 : 0.6;
}

/** One leaf, pointing along +x from (from, 0). */
function leafPath(ctx: Ctx, shape: PlantArt['leaf'], from: number, len: number, w: number) {
  const a = from;
  const b = from + len;
  ctx.beginPath();
  switch (shape) {
    case 'round': {
      const rr = Math.min(w, len / 2);
      ctx.moveTo(b, 0);
      ctx.arc(b - rr, 0, rr, 0, TAU);
      return;
    }
    case 'strap':
    case 'needle': {
      const hw = shape === 'strap' ? w * 0.32 : w * 0.18;
      ctx.moveTo(a, -hw);
      ctx.quadraticCurveTo(a + len * 0.7, -hw, b, 0);
      ctx.quadraticCurveTo(a + len * 0.7, hw, a, hw);
      ctx.closePath();
      return;
    }
    case 'lobed': {
      // Three bumps a side, narrowing to the tip, like a tomato's or an oak's leaf.
      const n = 3;
      const taper = (i: number) => 1 - ((i - 1) / n) * 0.5;
      ctx.moveTo(a, 0);
      for (let i = 1; i <= n; i++) {
        const x0 = a + (len * (i - 1)) / n;
        const x1 = a + (len * i) / n;
        ctx.quadraticCurveTo((x0 + x1) / 2, -w * 1.25 * taper(i), x1, i === n ? 0 : -w * 0.45 * taper(i));
      }
      for (let i = n; i >= 1; i--) {
        const x0 = a + (len * (i - 1)) / n;
        const x1 = a + (len * i) / n;
        ctx.quadraticCurveTo((x0 + x1) / 2, w * 1.25 * taper(i), x0, i === 1 ? 0 : w * 0.45 * taper(i - 1));
      }
      ctx.closePath();
      return;
    }
    case 'feathery':
    case 'broad':
    default: {
      const hw = shape === 'feathery' ? w * 0.5 : w;
      ctx.moveTo(a, 0);
      ctx.bezierCurveTo(a + len * 0.25, -hw, a + len * 0.75, -hw * 0.8, b, 0);
      ctx.bezierCurveTo(a + len * 0.75, hw * 0.8, a + len * 0.25, hw, a, 0);
      ctx.closePath();
    }
  }
}

function drawLeaf(ctx: Ctx, P: Paint, art: PlantArt, l: Leaf, r: number, colour: string) {
  ctx.save();
  ctx.rotate(l.angle);
  leafPath(ctx, art.leaf, l.from, l.len, l.width);
  paintPath(ctx, P, colour, r);
  // A midrib on bigger leaves; fine leaflets on feathery ones.
  if (l.len > 6 && P.style !== 'outline' && art.leaf !== 'round') {
    ctx.beginPath();
    ctx.moveTo(l.from + l.len * 0.05, 0);
    ctx.lineTo(l.from + l.len * 0.9, 0);
    ctx.strokeStyle = art.leaf === 'feathery' ? shadeHex(colour, -0.2) : shadeHex(colour, 0.28);
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = Math.max(0.4, l.width / 7);
    ctx.stroke();
    ctx.globalAlpha /= 0.7;
    if (art.leaf === 'feathery') {
      ctx.beginPath();
      const n = Math.max(3, Math.round(l.len / 4));
      for (let i = 1; i < n; i++) {
        const x = l.from + (l.len * i) / n;
        const s = l.width * 0.9 * (1 - i / n);
        ctx.moveTo(x, 0);
        ctx.lineTo(x + s * 0.6, -s);
        ctx.moveTo(x, 0);
        ctx.lineTo(x + s * 0.6, s);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(0.5, l.width / 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Where the leaves go for each form. Outer leaves first, so inner ones lie on top. */
function leavesFor(art: PlantArt, r: number, rnd: () => number): Leaf[] {
  const out: Leaf[] = [];
  const ring = (n: number, from: number, len: number, width: number, shade: number, twist = 0) => {
    const start = rnd() * TAU;
    for (let i = 0; i < n; i++) out.push({ angle: start + (i / n) * TAU + twist + (rnd() - 0.5) * 0.35, from, len: len * (0.85 + rnd() * 0.25), width: width * (0.85 + rnd() * 0.3), shade });
  };
  const scatter = (n: number, within: number, len: number, width: number, shade: number) => {
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(rnd()) * within;
      const a = rnd() * TAU;
      out.push({ angle: a, from: d, len: len * (0.7 + rnd() * 0.5), width: width * (0.8 + rnd() * 0.4), shade: shade + (rnd() - 0.5) * 0.1 });
    }
  };
  switch (art.form) {
    case 'rosette':
      ring(8, r * 0.05, r * 0.9, r * 0.3, -0.06);
      ring(6, r * 0.04, r * 0.62, r * 0.24, 0.04, 0.3);
      ring(4, 0, r * 0.36, r * 0.17, 0.14, 0.7);
      break;
    case 'clump':
      ring(16, 0, r * 0.95, r * 0.12, -0.04);
      ring(9, 0, r * 0.65, r * 0.11, 0.08, 0.2);
      break;
    case 'grass':
      ring(26, 0, r * 0.95, r * 0.07, -0.02);
      ring(12, 0, r * 0.6, r * 0.07, 0.1, 0.13);
      break;
    case 'bulb':
      ring(5, 0, r * 0.85, r * 0.2, 0);
      break;
    case 'mound':
      ring(11, r * 0.35, r * 0.6, r * 0.2, -0.08);
      scatter(18, r * 0.55, r * 0.32, r * 0.13, 0.06);
      break;
    case 'upright':
      ring(5, r * 0.08, r * 0.88, r * 0.26, -0.08);
      ring(5, r * 0.06, r * 0.66, r * 0.22, 0.02, 0.6);
      ring(4, r * 0.04, r * 0.42, r * 0.17, 0.12, 0.25);
      break;
    case 'climber':
      // Leaves spiralling round a cane.
      for (let i = 0; i < 14; i++) {
        const t = i / 14;
        out.push({ angle: i * 2.4 + rnd() * 0.3, from: r * (0.12 + t * 0.35), len: r * (0.5 - t * 0.12), width: r * 0.17, shade: -0.06 + t * 0.18 });
      }
      break;
    case 'sprawl':
      ring(6, r * 0.12, r * 0.85, r * 0.4, -0.06);
      ring(3, r * 0.05, r * 0.5, r * 0.3, 0.08, 0.5);
      break;
    case 'shrub':
    case 'tree':
      // Leaf texture over the canopy, drawn after its body.
      scatter(art.form === 'tree' ? 34 : 28, r * 0.72, r * 0.2, r * 0.08, 0.1);
      break;
  }
  return out;
}

/** A soft, lumpy body for shrubs and trees, made of overlapping rounds. */
function canopy(ctx: Ctx, P: Paint, colour: string, r: number, rnd: () => number, tree: boolean) {
  const n = tree ? 8 : 9;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.3;
    const d = r * (tree ? 0.55 : 0.5);
    const rr = r * (tree ? 0.45 : 0.42) * (0.85 + rnd() * 0.25);
    ctx.moveTo(Math.cos(a) * d + rr, Math.sin(a) * d);
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU);
  }
  ctx.moveTo(r * 0.6, 0);
  ctx.arc(0, 0, r * 0.6, 0, TAU);
  paintPath(ctx, P, shadeHex(colour, -0.12), r);
  if (P.style === 'outline') return;
  // Light from the top left.
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.22, r * 0.45, 0, TAU);
  ctx.fillStyle = shadeHex(colour, 0.12);
  ctx.globalAlpha *= 0.55;
  ctx.fill();
  ctx.globalAlpha /= 0.55;
}

function flowerAt(ctx: Ctx, P: Paint, art: PlantArt, x: number, y: number, size: number, rnd: () => number) {
  const colour = art.flower ?? '#f4f1e6';
  const centre = art.bloom === 'big' && art.flower && rgb(art.flower)[0] > 200 && rgb(art.flower)[1] > 150 ? '#5a3a1a' : '#f2c94c';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd() * TAU);
  switch (art.bloom ?? 'daisy') {
    case 'cup': {
      // Three petals round a cup, like a tulip or crocus seen from above.
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.cos((i / 3) * TAU) * size * 0.35, Math.sin((i / 3) * TAU) * size * 0.35, size * 0.6, size * 0.42, (i / 3) * TAU, 0, TAU);
        paintPath(ctx, P, colour, size * 4);
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, TAU);
      paintPath(ctx, P, shadeHex(colour, -0.25), size * 4);
      break;
    }
    case 'spike': {
      // A spike of small flowers, lying outwards.
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(i * size * 0.35, (i % 2 ? 1 : -1) * size * 0.15, size * (0.32 - i * 0.03), 0, TAU);
        paintPath(ctx, P, i < 2 ? shadeHex(colour, -0.1) : colour, size * 4);
      }
      break;
    }
    case 'umbel': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.75, 0, TAU);
      paintPath(ctx, P, shadeHex(colour, -0.15), size * 4);
      ctx.fillStyle = shadeHex(colour, 0.25);
      for (let i = 0; i < 9; i++) {
        const a = rnd() * TAU;
        const d = Math.sqrt(rnd()) * size * 0.55;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.5, size * 0.12), 0, TAU);
        if (P.style !== 'outline') ctx.fill();
      }
      break;
    }
    default: {
      // Daisy, or one big bloom: petals round a centre.
      const petals = art.bloom === 'big' ? 12 : 5;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.5, size * 0.42, size * (art.bloom === 'big' ? 0.2 : 0.3), a, 0, TAU);
        paintPath(ctx, P, colour, size * 4);
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * (art.bloom === 'big' ? 0.38 : 0.26), 0, TAU);
      paintPath(ctx, P, centre, size * 4);
    }
  }
  ctx.restore();
}

function drawFlowers(ctx: Ctx, P: Paint, art: PlantArt, r: number, rnd: () => number) {
  const bloom = art.bloom ?? 'daisy';
  const big = bloom === 'big';
  const n = big ? (art.form === 'upright' ? 1 : 3) : bloom === 'spike' ? 5 : bloom === 'umbel' ? (art.form === 'bulb' ? 1 : 5) : bloom === 'cup' ? (art.form === 'bulb' ? 1 : 4) : art.form === 'shrub' || art.form === 'tree' || art.form === 'mound' ? 9 : 6;
  const size = r * (big ? (n === 1 ? 0.48 : 0.26) : bloom === 'umbel' && n === 1 ? 0.42 : bloom === 'cup' && n === 1 ? 0.34 : bloom === 'spike' ? 0.26 : 0.14);
  for (let i = 0; i < n; i++) {
    if (n === 1) {
      flowerAt(ctx, P, art, 0, 0, size, rnd);
      continue;
    }
    const a = (i / n) * TAU + rnd() * 0.5;
    const d = bloom === 'spike' ? r * 0.15 : r * (0.3 + rnd() * 0.45);
    if (bloom === 'spike') {
      ctx.save();
      ctx.rotate(a);
      flowerAt(ctx, P, { ...art }, d, 0, size, () => 0);
      ctx.restore();
    } else flowerAt(ctx, P, art, Math.cos(a) * d, Math.sin(a) * d, size * (0.85 + rnd() * 0.3), rnd);
  }
}

function drawCrop(ctx: Ctx, P: Paint, art: PlantArt, r: number, rnd: () => number) {
  const crop = art.crop!;
  const c = crop.colour;
  switch (crop.kind) {
    case 'fruit': {
      const n = art.form === 'tree' ? 11 : art.form === 'sprawl' ? 3 : 7;
      const size = r * (art.form === 'sprawl' ? 0.2 : art.form === 'tree' ? 0.085 : 0.11);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const d = r * (art.form === 'sprawl' ? 0.35 + rnd() * 0.35 : 0.25 + rnd() * 0.55);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        ctx.beginPath();
        if (art.form === 'sprawl' && art.leaf === 'lobed' && rgb(c)[1] < 120) ctx.ellipse(x, y, size * 1.4, size * 0.55, a, 0, TAU); // courgettes, cucumbers
        else ctx.arc(x, y, size, 0, TAU);
        paintPath(ctx, P, c, r);
        if (P.style !== 'outline') {
          ctx.beginPath();
          ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.28, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fill();
        }
      }
      return;
    }
    case 'head': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.36, 0, TAU);
      paintPath(ctx, P, c, r);
      // Florets or folds on the head.
      ctx.fillStyle = shadeHex(c, 0.18);
      ctx.strokeStyle = shadeHex(c, -0.2);
      ctx.lineWidth = Math.max(0.4, r / 60);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18, r * 0.11, 0, TAU);
        if (P.style !== 'outline') ctx.fill();
        ctx.stroke();
      }
      return;
    }
    case 'pod': {
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU;
        const d = r * (0.3 + rnd() * 0.5);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.17, r * 0.05, a + Math.PI / 2 + (rnd() - 0.5), 0, TAU);
        paintPath(ctx, P, c, r);
      }
      return;
    }
    case 'root': {
      // The shoulder of the root, showing at the soil.
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      paintPath(ctx, P, c, r);
      return;
    }
    case 'stem':
      return; // drawn under the leaves
  }
}

export interface DrawOptions {
  art: PlantArt;
  look: Look;
  /** Radius in px at full size. */
  r: number;
  paint: Paint;
  seed: number;
}

/** Draws a plant centred on (0, 0). */
export function drawPlant(ctx: Ctx, o: DrawOptions): void {
  const { art, look, paint: P } = o;
  const rnd = seeded(o.seed);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (look.ghost) ctx.globalAlpha *= 0.5;

  if (look.seeds) {
    // Just sown: a few seeds in the soil.
    ctx.fillStyle = shadeHex(P.soil, P.mode === 'dark' ? 0.25 : -0.3);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc((rnd() - 0.5) * o.r * 0.3, (rnd() - 0.5) * o.r * 0.3, Math.max(0.8, o.r * 0.05), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const r = o.r * look.grow;
  const foliage = look.seedling ? mixHex(art.foliage, '#d8e8a0', 0.35) : art.foliage;

  if (look.seedling) {
    // Seed leaves: a pair (or a few blades for grasses and onions).
    const blades = art.form === 'clump' || art.form === 'grass' || art.form === 'bulb';
    const n = blades ? 3 : 2;
    const a0 = rnd() * TAU;
    for (let i = 0; i < n; i++) drawLeaf(ctx, P, { ...art, leaf: blades ? 'strap' : 'round' }, { angle: a0 + (i / n) * TAU, from: 0, len: r, width: blades ? r * 0.35 : r * 0.42, shade: 0.1 }, o.r, foliage);
    ctx.restore();
    return;
  }

  // Stems that show from above (rhubarb, chard), then the cane for climbers.
  if (look.crop && art.crop?.kind === 'stem') {
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.4;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    }
    ctx.strokeStyle = art.crop.colour;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
  }
  if (art.form === 'shrub' || art.form === 'tree') canopy(ctx, P, foliage, r, rnd, art.form === 'tree');

  for (const l of leavesFor(art, r, rnd)) drawLeaf(ctx, P, art, l, o.r, shadeHex(foliage, l.shade));

  if (art.form === 'climber') {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r * 0.07), 0, TAU);
    paintPath(ctx, P, '#8a6a44', o.r);
  }
  if (look.flowers && art.flower) drawFlowers(ctx, P, art, r, rnd);
  if (look.crop && art.crop) drawCrop(ctx, P, art, r, rnd);
  ctx.restore();
}

/** How far past its radius a drawing can reach (flowers and fruit poke out a little). */
export const OVERHANG = 1.12;
