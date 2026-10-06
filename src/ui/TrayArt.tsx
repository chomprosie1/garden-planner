// A tray or set of pots seen from above, with its seedlings at their stage:
// bare compost when just sown, seed leaves when they're up, young plants
// while hardening off.

import { useEffect, useRef } from 'preact/hooks';
import { artFor, drawPlant, hashString, mixHex, stageLook } from '../art/plants';
import { paintFor } from '../art/sprites';
import type { Container, Plant, Tray, TrayStage } from '../model/types';
import { useThemeAttrs } from './PlantIcon';

/** Columns and rows of cells or pots for each container. */
const GRID: Record<Container, [number, number] | null> = {
  'module-tray': [6, 4],
  'root-trainer': [8, 2],
  'pot-9cm': [3, 2],
  'pot-1l': [2, 2],
  'seed-tray': null, // one open tray
};

export function TrayArt({ tray, plant, stage, width = 120 }: { tray: Pick<Tray, 'container' | 'count' | 'id'>; plant: Plant; stage: TrayStage; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { look, mode } = useThemeAttrs();
  const height = Math.round(width * 0.68);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const paint = paintFor(look, mode);
    const plastic = mode === 'dark' ? '#3a3f44' : '#2f3337';
    const compost = mode === 'dark' ? '#4a3626' : '#5a4130';
    const crumb = mixHex(compost, '#000000', 0.25);
    const art = artFor(plant);
    const sl = stage === 'sown' ? null : stage === 'germinated' ? { ...stageLook('germinated', plant, { id: '', plantId: plant.id, featureId: '', x: 0, y: 0, sowing: 'direct' }), seedling: true, grow: 0.8 } : { ...stageLook('transplanted', plant), grow: 0.95 };
    const seed = hashString(tray.id);
    const grid = GRID[tray.container];
    const pad = 4;

    const soil = (x: number, y: number, w: number, h: number, round: boolean) => {
      ctx.beginPath();
      if (round) ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      else ctx.roundRect(x, y, w, h, 2);
      ctx.fillStyle = compost;
      ctx.fill();
      // A few crumbs, the same every time.
      let s = seed + Math.round(x * 7 + y * 13);
      ctx.fillStyle = crumb;
      for (let i = 0; i < 4; i++) {
        s = (s * 1103515245 + 12345) >>> 0;
        const cx = x + w * (0.2 + ((s >>> 8) % 60) / 100);
        s = (s * 1103515245 + 12345) >>> 0;
        const cy = y + h * (0.2 + ((s >>> 8) % 60) / 100);
        ctx.fillRect(cx, cy, 1.2, 1.2);
      }
    };
    const seedling = (x: number, y: number, r: number, i: number) => {
      if (!sl) return;
      ctx.save();
      ctx.translate(x, y);
      drawPlant(ctx, { art, look: sl, r, paint, seed: seed + i * 31 });
      ctx.restore();
    };

    if (!grid) {
      // An open seed tray: compost, with the seedlings scattered in rows.
      ctx.fillStyle = plastic;
      ctx.beginPath();
      ctx.roundRect(1, 1, width - 2, height - 2, 5);
      ctx.fill();
      soil(pad, pad, width - pad * 2, height - pad * 2, false);
      const n = Math.min(tray.count, 40);
      const cols = Math.ceil(Math.sqrt(n * 1.6));
      const rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const cx = pad + ((i % cols) + 0.5) * ((width - pad * 2) / cols);
        const cy = pad + (Math.floor(i / cols) + 0.5) * ((height - pad * 2) / rows);
        seedling(cx, cy, Math.min((width - pad * 2) / cols, (height - pad * 2) / rows) * 0.5, i);
      }
      return;
    }

    const [cols, rows] = grid;
    const pots = tray.container.startsWith('pot');
    if (!pots) {
      ctx.fillStyle = plastic;
      ctx.beginPath();
      ctx.roundRect(1, 1, width - 2, height - 2, 4);
      ctx.fill();
    }
    const cw = (width - pad * 2) / cols;
    const ch = (height - pad * 2) / rows;
    const cells = cols * rows;
    for (let i = 0; i < cells; i++) {
      const x = pad + (i % cols) * cw;
      const y = pad + Math.floor(i / cols) * ch;
      if (pots) {
        // Each pot: a terracotta-coloured rim round the compost.
        ctx.beginPath();
        ctx.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = mode === 'dark' ? '#8a5a3c' : '#b8734a';
        ctx.fill();
        soil(x + 3, y + 3, cw - 6, ch - 6, true);
      } else soil(x + 1, y + 1, cw - 2, ch - 2, false);
      // Cells past the count are sown but empty.
      if (i < Math.min(tray.count, cells)) seedling(x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.48, i);
    }
  }, [tray.container, tray.count, tray.id, plant.id, JSON.stringify(plant.art), stage, look, mode, width]);
  return <canvas ref={ref} class="tray-art" width={width} height={height} style={{ width: `${width}px`, height: `${height}px` }} aria-hidden="true" />;
}
