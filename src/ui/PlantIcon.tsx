// A plant's drawing, the same as on the plan, for lists, panels and cards.

import { useEffect, useRef, useState } from 'preact/hooks';
import { artFor, drawPlant, hashString, OVERHANG, showcaseStage, stageLook } from '../art/plants';
import { drawPlantSide } from '../art/side';
import { paintFor } from '../art/sprites';
import type { LifeStage } from '../lifecycle/stages';
import type { Plant } from '../model/types';
import { LOOK_IDS, type LookId, type Mode } from '../theme/looks';

/** The look and mode on the page now, following changes to them. */
export function useThemeAttrs(): { look: LookId; mode: Mode } {
  const read = () => {
    const d = document.documentElement.dataset;
    const look = (LOOK_IDS as readonly string[]).includes(d.look ?? '') ? (d.look as LookId) : 'cottage';
    return { look, mode: d.mode === 'dark' ? ('dark' as const) : ('light' as const) };
  };
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look', 'data-mode'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

interface Props {
  plant: Plant;
  /** Width and height, px. */
  size?: number;
  /** The stage to show; by default the plant at its best (in flower or with its crop). */
  stage?: LifeStage;
  class?: string;
  /** From above, as on the plan (the default), or from the side, as it stands: easier to tell apart in a list. */
  view?: 'top' | 'side';
}

export function PlantIcon({ plant, size = 20, stage, class: cls = '', view = 'top' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { look, mode } = useThemeAttrs();
  const art = artFor(plant);
  const shown = stage ?? showcaseStage(plant);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (view === 'side') {
      // Its shape from the side, standing on the bottom edge: tall plants tall, low ones wide, but never so squat or
      // so thin that it can't be made out.
      const ratio = Math.max(0.7, Math.min(1.6, (plant.size.heightMm ?? 300) / Math.max(1, plant.size.spreadMm ?? plant.size.spacingMm)));
      const fit = size * 0.92;
      const [w, h] = ratio >= 1 ? [fit / ratio, fit] : [fit, fit * ratio];
      ctx.translate(size / 2, size - 1);
      drawPlantSide(ctx, { art, look: stageLook(shown, plant), w, h, seed: hashString(plant.id) });
      return;
    }
    ctx.translate(size / 2, size / 2);
    drawPlant(ctx, { art, look: stageLook(shown, plant), r: size / 2 / OVERHANG - 0.5, paint: paintFor(look, mode), seed: hashString(plant.id) });
  }, [JSON.stringify(art), plant.id, size, shown, look, mode, view]);
  return <canvas ref={ref} class={`plant-icon ${cls}`} width={size} height={size} style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true" />;
}
