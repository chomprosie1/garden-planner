// A small picture of a garden, drawn by the plan's own renderer: the dock's
// stickers, and the spaces offered by "Where are you growing?".

import { useEffect, useRef } from 'preact/hooks';
import { planStyle, renderStatic } from '../canvas/render';
import { fit } from '../canvas/viewport';
import { bounds } from '../geometry/polygon';
import type { Garden } from '../model/types';
import { useThemeAttrs } from './PlantIcon';

interface Props {
  garden: Garden;
  width: number;
  height?: number;
  /** Space round the garden, as a share of its longer side. */
  pad?: number;
  class?: string;
}

export function MiniPlan({ garden, width, height = width, pad = 0.12, class: cls }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { look, mode } = useThemeAttrs();
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = bounds([...garden.boundary, ...garden.features.flatMap((f) => f.footprint)]);
    if (!b) return ctx.clearRect(0, 0, width, height);
    const m = Math.max(b.maxX - b.minX, b.maxY - b.minY) * pad;
    const view = fit({ minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m }, width, height, 3);
    renderStatic(ctx, { garden, view, width, height, style: planStyle(look, mode), selected: null, selectedVertex: null, hoverId: null, draft: null, trace: null, minimal: true, depth: false, noLabels: true });
  }, [garden, width, height, look, mode]);
  return <canvas ref={ref} class={cls} width={width} height={height} style={{ width: `${width}px`, height: `${height}px` }} aria-hidden="true" />;
}
