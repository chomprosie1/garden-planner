// Simple and Advanced: what the plan offers in each. Simple is for dropping
// beds, pots, plants and trees and dragging them about; Advanced adds drawing
// by corners or by hand, reshaping, typed sizes, sketching, tracing a photo,
// the lock, and sun and shade. Switching never hides anything already on the
// plan: it only changes the tools.

import { resizesByHandles } from '../model/features';
import type { Prefs } from '../theme/prefs';

export type PlanMode = Prefs['planMode'];

export const MODE_LABEL: Record<PlanMode, string> = { simple: 'Simple', advanced: 'Advanced' };

/** The dock's drawers. */
export const DRAWERS_IN: Record<PlanMode, readonly string[]> = {
  simple: ['plants', 'beds', 'ground', 'build'],
  advanced: ['plants', 'beds', 'ground', 'build', 'draw'],
};

/** In Simple, a short list of the usual things in each drawer; Advanced has them all. Trees are listed in both. */
export const SIMPLE_STICKERS: readonly string[] = [
  'raised-bed',
  'small-bed',
  'long-bed',
  'pot',
  'big-pot',
  'window-box',
  'greenhouse',
  'lawn',
  'paving',
  'decking',
  'gravel',
  'path',
  'pond',
  'shed',
  'compost',
  'fence',
  'wall',
  'hedge',
];

export const showsSticker = (mode: PlanMode, id: string) => mode === 'advanced' || SIMPLE_STICKERS.includes(id);

/** Ways of looking at the plan. Sun hours and shade are Advanced. */
export const LENSES_IN: Record<PlanMode, readonly string[]> = {
  simple: ['none', 'flower', 'harvest', 'water'],
  advanced: ['none', 'sun', 'shade', 'flower', 'harvest', 'water'],
};

/** Tools that only Advanced has: the plan switches to Advanced when one is asked for (from search, say). */
export const isAdvancedTool = (tool: string) => tool !== 'select' && tool !== 'plant';

export const isAdvancedLens = (lens: string) => !LENSES_IN.simple.includes(lens);

/** What can be resized by its handles in Simple: a rectangle by its corners (it stays a rectangle) and a round thing by its edge. */
export const resizableInSimple = resizesByHandles;

/** The action pill's extras: typed sizes, curved edges and edging. */
export const pillHasExtras = (mode: PlanMode) => mode === 'advanced';

/** The padlock is Advanced: in Simple the layout is never locked, so nothing is stuck with no way to unlock it. */
export const isLocked = (prefs: Pick<Prefs, 'layoutLocked' | 'planMode'>) => prefs.planMode === 'advanced' && prefs.layoutLocked;
