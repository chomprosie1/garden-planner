// A plant's drawing, the same as on the plan, for lists, panels and cards.

import { useEffect, useRef, useState } from 'preact/hooks';
import { artFor, drawPlant, hashString, OVERHANG, showcaseStage, stageLook } from '../art/plants';
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
}

export function PlantIcon({ plant, size = 20, stage, class: cls = '' }: Props) {
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
    ctx.translate(size / 2, size / 2);
    drawPlant(ctx, { art, look: stageLook(shown, plant), r: size / 2 / OVERHANG - 0.5, paint: paintFor(look, mode), seed: hashString(plant.id) });
  }, [JSON.stringify(art), plant.id, size, shown, look, mode]);
  return <canvas ref={ref} class={`plant-icon ${cls}`} width={size} height={size} style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true" />;
}
