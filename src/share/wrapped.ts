// "Your season, wrapped": a year in the garden as a few story-sized cards to
// look back on and share. What you grew, your first pick, how much you picked,
// your busiest month, a photo, and what to try next year. Worked out from the
// garden alone, and drawn on the device.

import { formatWeight, picksIn, type CropTotal } from '../planting/harvest';
import type { Garden } from '../model/types';
import { fitFont, theme } from './poster';

export interface SeasonStats {
  year: number;
  /** Plantings with anything dated in the year: sown, a stage reached, picked, cleared or noted. */
  plantings: number;
  /** The crops they were, by plant id. */
  crops: string[];
  firstPick: { plantId: string; date: string } | null;
  grams: number;
  top: CropTotal[];
  busiest: { month: number; count: number } | null;
  /** Photos on notes in the year, newest first, by photo id. */
  photos: { photo: string; text: string; date: string }[];
  /** Easy crops not grown this year, to try next. */
  tryNext: string[];
}

/** Easy, popular crops to suggest for next year, in order. */
const SUGGEST = ['courgette', 'sweet-pea', 'strawberry', 'french-bean', 'tomato', 'lettuce', 'radish', 'sunflower', 'basil', 'potato', 'garlic', 'cosmos', 'beetroot', 'pea'];

/** isWeed: weeds marked on the plan aren't counted as grown. */
export function seasonStats(g: Garden, year: number, known: (id: string) => boolean = () => true, isWeed: (id: string) => boolean = () => false): SeasonStats {
  const inYear = (d?: string) => !!d && Number(d.slice(0, 4)) === year;
  const months = new Array<number>(12).fill(0);
  const count = (d?: string) => {
    if (inYear(d)) months[Number(d!.slice(5, 7)) - 1]!++;
  };
  const grown = g.plantings.filter((pl) => {
    if (isWeed(pl.plantId)) return false;
    const dates = [pl.sownOn, pl.removedOn, ...Object.values(pl.stageDates ?? {}), ...(pl.picks ?? []).map((k) => k.date)];
    dates.forEach(count);
    return dates.some(inYear) || g.notes.some((n) => n.plantingId === pl.id && inYear(n.date));
  });
  g.notes.forEach((n) => count(n.date));
  const top = picksIn(g, year);
  const first = top.reduce<{ plantId: string; date: string } | null>((a, t) => (!a || t.first < a.date ? { plantId: t.plantId, date: t.first } : a), null);
  const peak = Math.max(...months);
  const crops = [...new Set(grown.map((p) => p.plantId))];
  return {
    year,
    plantings: grown.length,
    crops,
    firstPick: first,
    grams: top.reduce((a, t) => a + t.grams, 0),
    top,
    busiest: peak > 0 ? { month: months.indexOf(peak) + 1, count: peak } : null,
    photos: g.notes
      .filter((n) => n.photo && inYear(n.date))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((n) => ({ photo: n.photo!, text: n.text, date: n.date })),
    tryNext: SUGGEST.filter((id) => known(id) && !crops.includes(id)).slice(0, 2),
  };
}

export interface WrappedCard {
  eyebrow: string;
  big: string;
  line: string;
  /** A photo to show, by id. */
  photo?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${SHORT[Number(iso.slice(5, 7)) - 1]}`;

/** The cards for a season: only the ones there's something to say on. None if nothing was grown. */
export function wrappedCards(s: SeasonStats, gardenName: string, name: (id: string) => string): WrappedCard[] {
  if (!s.plantings) return [];
  const cards: WrappedCard[] = [
    { eyebrow: `${s.year} in ${gardenName}`, big: String(s.plantings), line: `${s.plantings === 1 ? 'planting' : 'plantings'}, of ${s.crops.length} ${s.crops.length === 1 ? 'crop' : 'crops'}` },
  ];
  if (s.firstPick) cards.push({ eyebrow: 'First pick of the year', big: day(s.firstPick.date), line: name(s.firstPick.plantId) });
  if (s.grams > 0) {
    const top = s.top[0]!;
    cards.push({ eyebrow: 'Picked this year', big: formatWeight(s.grams), line: s.top.length > 1 ? `Most of all: ${name(top.plantId).toLowerCase()}, ${formatWeight(top.grams)}` : name(top.plantId) });
  }
  if (s.busiest) cards.push({ eyebrow: 'Busiest month', big: MONTHS[s.busiest.month - 1]!, line: `${s.busiest.count} things sown, planted, picked or noted` });
  const best = s.photos[0];
  if (best) cards.push({ eyebrow: 'A moment from the year', big: '', line: best.text || day(best.date), photo: best.photo });
  if (s.tryNext.length) {
    const [a, b] = s.tryNext.map(name);
    cards.push({ eyebrow: `Next year, try`, big: a!, line: b ? `and ${b.toLowerCase()}` : 'Easy, and worth it' });
  }
  return cards;
}

const W = 1080;
const H = 1920;

/** A card as a story-sized picture, 9:16, in the look you're using. A photo card draws the photo given. */
export function drawWrappedCard(canvas: HTMLCanvasElement, card: WrappedCard, index: number, total: number, photo?: CanvasImageSource & { width: number; height: number }): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const t = theme();
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#5e7d4a';
  const onAccent = css.getPropertyValue('--accent-text').trim() || '#ffffff';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pad = 96;

  if (photo) {
    // The photo fills the card, with the words on a band at the foot.
    const k = Math.max(W / photo.width, H / photo.height);
    ctx.drawImage(photo, (W - photo.width * k) / 2, (H - photo.height * k) / 2, photo.width * k, photo.height * k);
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = onAccent;
  }

  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 46px ${t.body}`;
  ctx.fillText(card.eyebrow.toUpperCase(), pad, photo ? H - 420 : 520);
  if (card.big) {
    const size = fitFont(ctx, card.big, t.display, t.title, 260, W - 2 * pad);
    ctx.font = `${t.title} ${size}px ${t.display}`;
    ctx.fillText(card.big, pad, 520 + size + 30);
  }
  // The line under it, wrapped to the width.
  ctx.font = `500 58px ${t.body}`;
  const words = card.line.split(' ');
  let y = photo ? H - 320 : 1120;
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W - 2 * pad && line) {
      ctx.fillText(line, pad, y);
      y += 76;
      line = w;
    } else line = next;
  }
  if (line) ctx.fillText(line, pad, y);

  // Where it's from, and which card.
  ctx.font = `500 36px ${t.body}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(`Garden Planner · ${index + 1} of ${total}`, pad, H - 110);
  ctx.globalAlpha = 1;
}

/** The season to look back on: this year from September, last year until then. */
export const seasonYear = (today: string): number => (Number(today.slice(5, 7)) >= 9 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1);
