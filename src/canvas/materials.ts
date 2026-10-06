// What surfaces look like on the plan: lawn, gravel, paving, decking, bark,
// meadow and bare soil. Colours come from each look's plan palette, nudged
// towards the look's paper, so every material sits well in every look, light
// and dark. Textures are drawn by code (no images to license) on 64 px tiles
// tied to real-world sizes, so slabs and boards stay to scale as you zoom.

import type { Feature, Material } from '../model/types';
import type { Mode, PlanPalette } from '../theme/looks';

type Rgb = [number, number, number];

const hex = (c: string): Rgb => {
  const h = c.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};
const css = ([r, g, b]: Rgb) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
/** a mixed with b: k = 0 gives a, k = 1 gives b. */
export const mix = (a: string, b: string, k: number): string => {
  const x = hex(a);
  const y = hex(b);
  return css([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
};
const toHex = (c: string): string => {
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g);
  if (!m) return c;
  return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
};
/** Lighter (k > 0) or darker (k < 0). */
const shade = (c: string, k: number) => toHex(k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k));

/** Natural colours for each material, light and dark, before they're tuned to the look. */
const BASE: Record<Mode, Record<Exclude<Material, 'lawn' | 'soil'>, string>> = {
  light: { gravel: '#cfc5b2', paving: '#cdc7bc', decking: '#b08a5e', bark: '#7d5a3c', meadow: '#a9bf72' },
  dark: { gravel: '#625b50', paving: '#5b5750', decking: '#6e543a', bark: '#4c3726', meadow: '#4f6233' },
};

/** The main colour of a material in this look and mode. */
export function materialColour(m: Material, P: PlanPalette, mode: Mode): string {
  if (m === 'lawn') return toHex(P.lawn);
  if (m === 'soil') return toHex(P.bedFill);
  return toHex(mix(BASE[mode][m], P.paper, 0.18));
}

// ---------- Bed edging and hedges ----------

export type Edging = NonNullable<Feature['edging']>;
/** How wide each edging is on the ground, mm. */
export const EDGING_WIDTH_MM: Record<Edging, number> = { timber: 50, brick: 110, stone: 160 };
/** The real-world size of one edging tile, mm. */
export const EDGING_TILE_MM: Record<Edging, number> = { timber: 600, brick: 450, stone: 500 };
const EDGING_BASE: Record<Mode, Record<Edging, string>> = {
  light: { timber: '#8f6c45', brick: '#a8573d', stone: '#a29d92' },
  dark: { timber: '#7a5c3b', brick: '#8a4632', stone: '#7d7970' },
};

/** One tile of a bed's edging: boards with grain, brick courses, or rough stones. */
export function drawEdgingTile(c: CanvasRenderingContext2D, e: Edging, P: PlanPalette, mode: Mode): void {
  const base = toHex(mix(EDGING_BASE[mode][e], P.paper, 0.1));
  const light = shade(base, 0.2);
  const dark = shade(base, -0.3);
  const rnd = seeded(e.length * 31 + 7);
  c.fillStyle = base;
  c.fillRect(0, 0, T, T);
  if (e === 'timber') {
    // Grain running both ways, so it reads as wood along any side of a bed.
    c.strokeStyle = dark;
    c.globalAlpha = 0.45;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const y = rnd() * T;
      c.moveTo(0, y);
      c.bezierCurveTo(T / 3, y + (rnd() - 0.5) * 4, (2 * T) / 3, y + (rnd() - 0.5) * 4, T, y);
      const x = rnd() * T;
      c.moveTo(x, 0);
      c.bezierCurveTo(x + (rnd() - 0.5) * 4, T / 3, x + (rnd() - 0.5) * 4, (2 * T) / 3, x, T);
    }
    c.stroke();
    c.globalAlpha = 1;
    return;
  }
  if (e === 'brick') {
    const h = T / 6;
    for (let row = 0; row < 6; row++) {
      for (let col = -1; col < 3; col++) {
        const x = col * (T / 2) + (row % 2 ? T / 4 : 0);
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.16);
        c.fillRect(x + 1, row * h + 1, T / 2 - 2, h - 2);
      }
    }
    c.strokeStyle = light;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    c.beginPath();
    for (let row = 0; row <= 6; row++) {
      c.moveTo(0, row * h);
      c.lineTo(T, row * h);
    }
    c.stroke();
    c.globalAlpha = 1;
    return;
  }
  // Stone: rounded, uneven blocks.
  c.fillStyle = dark;
  c.fillRect(0, 0, T, T);
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * (T / 3) + T / 6 + (rnd() - 0.5) * 4;
    const y = Math.floor(i / 3) * (T / 3) + T / 6 + (rnd() - 0.5) * 4;
    c.fillStyle = shade(base, (rnd() - 0.5) * 0.2);
    c.beginPath();
    c.ellipse(x, y, T / 6 - 1.5, T / 6 - 2, rnd() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
}

/** One tile of a clipped hedge: overlapping leafy clumps, lit from the top left. */
export function drawHedgeTile(c: CanvasRenderingContext2D, colour: string, mode: Mode): void {
  const base = toHex(colour.startsWith('#') ? colour : '#5d7a4d');
  const rnd = seeded(4242);
  c.fillStyle = shade(base, -0.15);
  c.fillRect(0, 0, T, T);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * T;
    const y = rnd() * T;
    const r = 4 + rnd() * 5;
    // The same clump on each side of the tile's edges, so the tiles meet without a seam.
    const fill = shade(base, (rnd() - 0.4) * (mode === 'dark' ? 0.2 : 0.25));
    for (const [dx, dy] of [[0, 0], [T, 0], [-T, 0], [0, T], [0, -T]] as const) {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** The real-world size of one 64 px tile, mm. */
export const MATERIAL_TILE_MM: Record<Material, number> = { lawn: 400, gravel: 300, paving: 1200, decking: 1200, bark: 400, meadow: 500, soil: 300 };

const T = 64;

/** A repeatable random sequence, so a texture looks the same every time it's drawn. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Draws one tile of a material's texture. */
export function drawMaterialTile(c: CanvasRenderingContext2D, m: Material, P: PlanPalette, mode: Mode): void {
  const base = materialColour(m, P, mode);
  const light = shade(base, mode === 'dark' ? 0.14 : 0.22);
  const dark = shade(base, mode === 'dark' ? -0.3 : -0.18);
  const rnd = seeded(m.length * 7919 + m.charCodeAt(0));
  c.fillStyle = base;
  c.fillRect(0, 0, T, T);
  switch (m) {
    case 'lawn':
    case 'meadow': {
      // Short blades of grass, and in a meadow, flowers among them.
      c.lineWidth = 1;
      for (let i = 0; i < 46; i++) {
        const x = rnd() * T;
        const y = rnd() * T;
        c.strokeStyle = rnd() < 0.5 ? light : dark;
        c.globalAlpha = 0.55;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (rnd() - 0.5) * 3, y - 2.5 - rnd() * 2.5);
        c.stroke();
      }
      c.globalAlpha = 1;
      if (m === 'meadow') {
        const flowers = mode === 'dark' ? ['#e9e3cf', '#e6c14a', '#e58fb0', '#9fb6f0'] : ['#ffffff', '#f2c230', '#d9608c', '#6f8fdc'];
        for (let i = 0; i < 14; i++) {
          c.fillStyle = flowers[i % flowers.length]!;
          c.beginPath();
          c.arc(rnd() * T, rnd() * T, 1.3 + rnd() * 1.1, 0, Math.PI * 2);
          c.fill();
        }
      }
      return;
    }
    case 'gravel':
    case 'soil': {
      // Stones or crumbs, scattered.
      const n = m === 'gravel' ? 70 : 40;
      for (let i = 0; i < n; i++) {
        c.fillStyle = rnd() < 0.5 ? light : dark;
        c.globalAlpha = m === 'gravel' ? 0.85 : 0.5;
        c.beginPath();
        c.ellipse(rnd() * T, rnd() * T, 0.9 + rnd() * 1.6, 0.8 + rnd() * 1.2, rnd() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      return;
    }
    case 'paving': {
      // Four 600 mm slabs, each a slightly different tone, with joints between.
      const half = T / 2;
      for (const [x, y] of [[0, 0], [half, 0], [0, half], [half, half]] as const) {
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.12);
        c.fillRect(x, y, half, half);
      }
      c.strokeStyle = dark;
      c.lineWidth = 1.5;
      c.beginPath();
      for (const k of [0, half, T]) {
        c.moveTo(k, 0);
        c.lineTo(k, T);
        c.moveTo(0, k);
        c.lineTo(T, k);
      }
      c.stroke();
      return;
    }
    case 'decking': {
      // Eight long boards, 150 mm wide, each with one butt joint somewhere along it, and a little grain.
      const board = T / 8;
      for (let i = 0; i < 8; i++) {
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.1);
        c.fillRect(0, i * board, T, board);
      }
      c.strokeStyle = light;
      c.globalAlpha = 0.4;
      c.lineWidth = 0.6;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const y = i * board + 2 + rnd() * (board - 4);
        const x0 = rnd() * T * 0.5;
        c.moveTo(x0, y);
        c.lineTo(x0 + T * (0.3 + rnd() * 0.4), y);
      }
      c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = dark;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i <= 8; i++) {
        c.moveTo(0, i * board);
        c.lineTo(T, i * board);
      }
      // Joints spread along the boards, never lined up in a column.
      for (let i = 0; i < 8; i++) {
        const x = Math.round(((i * 37) % T) + rnd() * 5) % T;
        c.moveTo(x, i * board);
        c.lineTo(x, (i + 1) * board);
      }
      c.stroke();
      return;
    }
    case 'bark': {
      // Chips: short, chunky strokes at every angle.
      c.lineCap = 'round';
      for (let i = 0; i < 38; i++) {
        const x = rnd() * T;
        const y = rnd() * T;
        const a = rnd() * Math.PI;
        const len = 2.5 + rnd() * 3.5;
        c.strokeStyle = rnd() < 0.55 ? dark : light;
        c.lineWidth = 1.4 + rnd() * 1.4;
        c.beginPath();
        c.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        c.stroke();
      }
      return;
    }
  }
}
