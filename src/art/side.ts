// Plants drawn from the side, by code, for the 3D view: the same traits as the
// drawings from above (src/art/plants.ts), so a lettuce is a low rosette of
// broad leaves, a tomato an upright stem with lobed leaves and red fruit, and
// a leek a fan of blades. The stage decides the size and whether flowers or a
// crop show; winter can leave a plant bare or down to its crown.
//
// Pure canvas, drawn in a box w x h px with the plant's base at the bottom
// middle, so it can be used as a texture on crossed cards in 3D.

import type { PlantArt } from '../model/types';
import { mixHex, seeded, shadeHex, type Look } from './plants';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export interface SideOptions {
  art: PlantArt;
  look: Look;
  /** The box the full-grown plant fills, px: its spread and its height. */
  w: number;
  h: number;
  seed: number;
}

/** A leaf from (x, y), leaning `lean` radians from straight up, as an outline filled in a colour. */
function leaf(ctx: Ctx, shape: PlantArt['leaf'], x: number, y: number, lean: number, len: number, width: number, colour: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.beginPath();
  if (shape === 'feathery') {
    // Fronds: a midrib with fine side strands.
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    for (let i = 1; i <= 5; i++) {
      const yy = (-len * i) / 6;
      const s = width * (1 - i / 7);
      ctx.moveTo(0, yy);
      ctx.lineTo(-s, yy - s * 0.6);
      ctx.moveTo(0, yy);
      ctx.lineTo(s, yy - s * 0.6);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, width * 0.18);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    return;
  }
  const hw = shape === 'strap' ? width * 0.3 : shape === 'needle' ? width * 0.16 : shape === 'round' ? width * 0.62 : width * 0.5;
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-hw * 1.6, -len * 0.45, 0, -len);
  ctx.quadraticCurveTo(hw * 1.6, -len * 0.45, 0, 0);
  ctx.fillStyle = colour;
  ctx.fill();
  if (shape === 'lobed' || shape === 'broad') {
    ctx.strokeStyle = shadeHex(colour, -0.25);
    ctx.lineWidth = Math.max(0.6, width * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

/** A round cluster of leaves, for mounds, shrubs and canopies. */
function blob(ctx: Ctx, x: number, y: number, r: number, colour: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, shadeHex(colour, 0.18));
  g.addColorStop(1, shadeHex(colour, -0.12));
  ctx.fillStyle = g;
  ctx.fill();
}

function flowerAt(ctx: Ctx, art: PlantArt, x: number, y: number, r: number) {
  const c = art.flower!;
  ctx.fillStyle = c;
  switch (art.bloom) {
    case 'spike':
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(x, y - i * r * 0.7, r * (0.75 - i * 0.1), 0, TAU);
        ctx.fill();
      }
      return;
    case 'umbel':
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r * 0.75, 0, 0, TAU);
      ctx.fill();
      return;
    case 'big':
      ctx.beginPath();
      ctx.arc(x, y, r * 1.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = shadeHex(c, -0.3);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, TAU);
      ctx.fill();
      return;
    case 'cup':
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.quadraticCurveTo(x, y + r * 1.4, x + r, y - r);
      ctx.closePath();
      ctx.fill();
      return;
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8c040';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, TAU);
      ctx.fill();
  }
}

function cropAt(ctx: Ctx, art: PlantArt, x: number, y: number, r: number) {
  const c = art.crop!.colour;
  ctx.fillStyle = c;
  ctx.beginPath();
  if (art.crop!.kind === 'pod') ctx.ellipse(x, y + r * 1.2, r * 0.45, r * 1.6, 0, 0, TAU);
  else ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shadeHex(c, 0.35);
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU);
  ctx.fill();
}

/** Draws a plant from the side, base at (0, 0), growing up (negative y). */
export function drawPlantSide(ctx: Ctx, o: SideOptions): void {
  const { art, look } = o;
  const rnd = seeded(o.seed);
  if (look.seeds) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const W = o.w * look.grow;
  const H = o.h * look.grow;
  const foliage = look.seedling ? mixHex(art.foliage, '#d8e8a0', 0.35) : art.foliage;
  const tone = () => shadeHex(foliage, (rnd() - 0.5) * 0.3);
  const brown = '#6a5038';

  if (look.dormant) {
    ctx.strokeStyle = brown;
    ctx.lineWidth = Math.max(1, o.w * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = (rnd() - 0.5) * o.w * 0.25;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rnd() - 0.5) * o.w * 0.05, -o.h * (0.05 + rnd() * 0.06));
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (look.seedling) {
    const stem = Math.max(3, H * 0.6);
    ctx.strokeStyle = shadeHex(foliage, -0.2);
    ctx.lineWidth = Math.max(1, W * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -stem);
    ctx.stroke();
    const blades = art.form === 'clump' || art.form === 'grass' || art.form === 'bulb';
    leaf(ctx, blades ? 'strap' : 'round', 0, -stem * (blades ? 0 : 1), -0.9, Math.max(3, W * 0.45), Math.max(2, W * 0.3), foliage);
    leaf(ctx, blades ? 'strap' : 'round', 0, -stem * (blades ? 0 : 1), 0.9, Math.max(3, W * 0.45), Math.max(2, W * 0.3), foliage);
    ctx.restore();
    return;
  }

  if (look.bare) {
    // Bare twigs: a short trunk for trees and shrubs, canes for climbers.
    ctx.strokeStyle = brown;
    const n = art.form === 'climber' ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const lean = (i / (n - 1) - 0.5) * (art.form === 'climber' ? 0.3 : 1.1) + (rnd() - 0.5) * 0.2;
      const len = H * (0.75 + rnd() * 0.25);
      const fork = art.form === 'tree' ? H * 0.35 : 0;
      ctx.lineWidth = Math.max(1, W * 0.025);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -fork);
      const ex = Math.sin(lean) * (len - fork);
      const ey = -fork - Math.cos(lean) * (len - fork);
      ctx.lineTo(ex, ey);
      ctx.moveTo(ex * 0.6, -fork + (ey + fork) * 0.6);
      ctx.lineTo(ex * 0.6 + Math.sin(lean + 0.6) * len * 0.25, -fork + (ey + fork) * 0.6 - Math.cos(lean + 0.6) * len * 0.25);
      ctx.stroke();
    }
    if (art.form === 'tree') {
      ctx.lineWidth = Math.max(2, W * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -H * 0.35);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  /** Places flowers and fruit can go: tips of leaves, tops of mounds. */
  const tips: [number, number][] = [];

  // Stems that show (rhubarb, chard) go under the leaves.
  if (look.crop && art.crop?.kind === 'stem') {
    ctx.strokeStyle = art.crop.colour;
    ctx.lineWidth = Math.max(1.5, W * 0.05);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const lean = (i / 5 - 0.5) * 1.2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(lean) * H * 0.55, -Math.cos(lean) * H * 0.55);
    }
    ctx.stroke();
  }

  switch (art.form) {
    case 'rosette': {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const lean = (i / (n - 1) - 0.5) * 2.4 + (rnd() - 0.5) * 0.15;
        const len = Math.min(H * 1.05, W * 0.62) * (0.75 + rnd() * 0.25);
        leaf(ctx, art.leaf, (rnd() - 0.5) * W * 0.06, 0, lean, len, len * 0.55, tone());
        tips.push([Math.sin(lean) * len, -Math.cos(lean) * len]);
      }
      if (look.crop && art.crop?.kind === 'head') {
        ctx.fillStyle = art.crop.colour;
        ctx.beginPath();
        ctx.ellipse(0, -H * 0.3, W * 0.24, H * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'clump':
    case 'grass':
    case 'bulb': {
      const n = art.form === 'grass' ? 16 : 9;
      for (let i = 0; i < n; i++) {
        const lean = (i / (n - 1) - 0.5) * (art.form === 'bulb' ? 0.7 : 0.9) + (rnd() - 0.5) * 0.15;
        const len = H * (art.form === 'bulb' && look.flowers ? 0.6 : 0.95) * (0.7 + rnd() * 0.3);
        leaf(ctx, art.form === 'grass' ? 'needle' : art.leaf === 'feathery' ? 'feathery' : 'strap', (rnd() - 0.5) * W * 0.2, 0, lean, len, Math.max(2, W * 0.14), tone());
        tips.push([Math.sin(lean) * len, -Math.cos(lean) * len]);
      }
      if (look.flowers && art.flower) {
        // Flower stalks above the leaves.
        tips.length = 0;
        ctx.strokeStyle = shadeHex(foliage, -0.15);
        ctx.lineWidth = Math.max(1, W * 0.03);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * W * 0.15;
          ctx.beginPath();
          ctx.moveTo(x * 0.3, 0);
          ctx.lineTo(x, -H * 0.92);
          ctx.stroke();
          tips.push([x, -H * 0.92]);
        }
      }
      break;
    }
    case 'mound': {
      for (let i = 0; i < 16; i++) {
        const a = Math.PI * (0.08 + rnd() * 0.84);
        const d = 0.45 + rnd() * 0.5;
        const x = Math.cos(a) * W * 0.4 * d;
        const y = -Math.sin(a) * H * 0.62 * d - H * 0.15;
        blob(ctx, x, y, Math.min(W, H) * (0.16 + rnd() * 0.1), tone());
        tips.push([x, y - Math.min(W, H) * 0.15]);
      }
      break;
    }
    case 'upright':
    case 'climber': {
      const canes = art.form === 'climber' ? [-W * 0.12, W * 0.12] : [0];
      for (const cx of canes) {
        ctx.strokeStyle = art.form === 'climber' ? '#a08060' : shadeHex(foliage, -0.25);
        ctx.lineWidth = Math.max(1.2, W * 0.035);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, -H);
        ctx.stroke();
        const n = Math.max(5, Math.round(H / Math.max(4, W * 0.18)));
        for (let i = 1; i <= n; i++) {
          const y = (-H * i) / (n + 0.5);
          const side = i % 2 ? 1 : -1;
          const len = W * (art.form === 'climber' ? 0.32 : 0.45) * (0.8 + rnd() * 0.3) * (1 - (i / n) * 0.35);
          leaf(ctx, art.leaf, cx, y, side * (1.0 + rnd() * 0.3), len, len * 0.6, tone());
          tips.push([cx + side * len * 0.7, y - len * 0.3]);
        }
      }
      break;
    }
    case 'sprawl': {
      ctx.strokeStyle = shadeHex(foliage, -0.2);
      ctx.lineWidth = Math.max(1, W * 0.025);
      for (let i = 0; i < 9; i++) {
        const x = (i / 8 - 0.5) * W * 0.9;
        const y = -H * (0.35 + rnd() * 0.55);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(x * 0.5, y * 1.1, x, y);
        ctx.stroke();
        const len = Math.min(W * 0.32, H * 0.7);
        leaf(ctx, art.leaf, x, y + len * 0.5, (rnd() - 0.5) * 0.8, len, len * 0.8, tone());
        tips.push([x, y]);
      }
      break;
    }
    case 'shrub':
    case 'tree': {
      const tree = art.form === 'tree';
      ctx.strokeStyle = brown;
      ctx.lineWidth = Math.max(1.5, W * (tree ? 0.06 : 0.03));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -H * (tree ? 0.45 : 0.2));
      ctx.stroke();
      const cy = -H * (tree ? 0.68 : 0.55);
      const ry = H * (tree ? 0.3 : 0.42);
      for (let i = 0; i < 22; i++) {
        const a = rnd() * TAU;
        const d = Math.sqrt(rnd());
        const x = Math.cos(a) * W * 0.36 * d;
        const y = cy + Math.sin(a) * ry * 0.8 * d;
        blob(ctx, x, y, Math.min(W * 0.2, ry * 0.5) * (0.7 + rnd() * 0.4), tone());
        tips.push([x, y]);
      }
      break;
    }
  }

  const dot = Math.max(1.5, Math.min(W, H) * 0.06);
  if (look.flowers && art.flower) {
    const n = Math.min(tips.length, 9);
    for (let i = 0; i < n; i++) {
      const [x, y] = tips[Math.floor(rnd() * tips.length)]!;
      flowerAt(ctx, art, x, y, dot);
    }
  }
  if (look.crop && art.crop) {
    if (art.crop.kind === 'root') {
      // The shoulder of a root, showing at the soil.
      ctx.fillStyle = art.crop.colour;
      ctx.beginPath();
      ctx.ellipse(0, -dot * 0.4, dot * 1.6, dot, 0, 0, TAU);
      ctx.fill();
    } else if (art.crop.kind === 'fruit' || art.crop.kind === 'pod') {
      const n = Math.min(tips.length, 8);
      for (let i = 0; i < n; i++) {
        const [x, y] = tips[Math.floor(rnd() * tips.length)]!;
        cropAt(ctx, art, x * 0.85, y * 0.85, dot * 1.2);
      }
    }
  }
  ctx.restore();
}
