// A picture of the plan to share: the garden on a chosen week, in your look,
// with its name and the month, framed for a story (9:16) or a post (4:5).
// Drawn on the device; nothing is uploaded.

import { planStyle, renderStatic, type TimeScene } from '../canvas/render';
import { fit } from '../canvas/viewport';
import { bounds } from '../geometry/polygon';
import type { Garden, Plant } from '../model/types';
import type { LookId, Mode } from '../theme/looks';

export type Frame = 'story' | 'post';

export const FRAMES: Record<Frame, { w: number; h: number; label: string; top: number; bottom: number; title: number }> = {
  story: { w: 1080, h: 1920, label: 'Story, 9:16', top: 300, bottom: 170, title: 84 },
  post: { w: 1080, h: 1350, label: 'Post, 4:5', top: 200, bottom: 110, title: 68 },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "July 2027". */
export const monthTitle = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

export interface Poster {
  garden: Garden;
  plantOf: (id: string) => Plant;
  look: LookId;
  mode: Mode;
  time: TimeScene | null;
  date: string;
  frame: Frame;
}

/** The page's own colours and fonts, so the picture matches the look you're using. */
function theme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--bg', '#f6f1e7'),
    text: v('--text', '#2b2a26'),
    muted: v('--muted', '#6b675e'),
    display: v('--font-display', 'Georgia, serif'),
    body: v('--font-body', 'system-ui, sans-serif'),
    /** The look's title: italic or not, and how heavy. */
    title: `${v('--title-style', 'normal')} ${v('--title-weight', '700')}`,
  };
}

/** A font size that fits the text in a width, from the size wanted down. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, size: number, width: number): number {
  for (let s = size; s > 18; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= width) return s;
  }
  return 18;
}

export function drawPoster(canvas: HTMLCanvasElement, p: Poster): void {
  const f = FRAMES[p.frame];
  if (canvas.width !== f.w || canvas.height !== f.h) {
    canvas.width = f.w;
    canvas.height = f.h;
  }
  const ctx = canvas.getContext('2d')!;
  const t = theme();
  const style = planStyle(p.look, p.mode);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, f.w, f.h);

  // The garden's name, and the month.
  const pad = 72;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.text;
  const size = fitFont(ctx, p.garden.name, t.display, t.title, f.title, f.w - 2 * pad);
  ctx.font = `${t.title} ${size}px ${t.display}`;
  ctx.fillText(p.garden.name, pad, f.top - 70 - f.title * 0.45);
  ctx.fillStyle = t.muted;
  ctx.font = `500 ${Math.round(f.title * 0.5)}px ${t.body}`;
  ctx.fillText(monthTitle(p.date), pad, f.top - 52);

  // The plan, on its own sheet with rounded corners.
  const pw = f.w - 2 * pad;
  const ph = f.h - f.top - f.bottom;
  const sheet = document.createElement('canvas');
  sheet.width = pw;
  sheet.height = ph;
  const sctx = sheet.getContext('2d')!;
  const g = p.garden;
  const b = bounds([...g.boundary, ...g.features.flatMap((x) => x.footprint)]);
  const view = fit(b, pw, ph, 36);
  renderStatic(sctx, { garden: g, view, width: pw, height: ph, style, selected: null, selectedVertex: null, hoverId: null, draft: null, trace: null, plantOf: p.plantOf, time: p.time, month: Number(p.date.slice(5, 7)), sketches: false, depth: true });
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  const r = 36;
  ctx.beginPath();
  ctx.roundRect(pad, f.top, pw, ph, r);
  ctx.fillStyle = style.plan.paper;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, f.top, pw, ph, r);
  ctx.clip();
  ctx.drawImage(sheet, pad, f.top);
  ctx.restore();

  // A quiet credit.
  ctx.fillStyle = t.muted;
  ctx.font = `500 ${Math.round(f.title * 0.36)}px ${t.body}`;
  ctx.fillText('Planned with Garden Planner', pad, f.h - f.bottom / 2 + f.title * 0.12);
}

/** The picture as a PNG file. */
export function posterFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], `${fileSafe(name)}.png`, { type: 'image/png' })) : reject(new Error('The picture could not be made.'))), 'image/png'),
  );
}

/** A name that works as a file name: "My balcony, July 2027" → "my-balcony-july-2027". */
export const fileSafe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'garden';
