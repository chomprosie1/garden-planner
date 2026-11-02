// From a list to a plan, wherever it's asked for: a garden that fits, and it says what that took.

import { bounds } from '../geometry/polygon';
import { featureLabel } from '../model/features';
import { outsideBoundary, planFromList } from '../model/listLayout';
import { updateGarden, type Store } from '../model/store';
import { isListed } from '../planting/listPlant';
import { isContainer } from '../planting/place';

/** Moved by this, mm, it's been moved, not rounded. */
const MOVED_MM = 1;

export function showAsPlan(store: Store, notify: (text: string, options: { undo: true }) => void) {
  const was = store.get().garden;
  // A garden that fits: beds moved apart, pots on the paving, and an outline that holds them all, before the plan shows it.
  store.apply(updateGarden(({ view: _v, ...g }) => planFromList(g, isListed(g))));
  // A boundary drawn to its own shape stays that shape, so something may not fit in it: better said than found.
  const now = store.get().garden;
  const listed = isListed(now);
  const left = outsideBoundary(now, (f) => listed(f) && isContainer(f));
  if (left.length) {
    notify(`Now a plan. ${left.length === 1 ? `${featureLabel(left[0]!)} didn’t fit inside your garden’s boundary, so it’s beside it` : `${left.length} beds and pots didn’t fit inside your garden’s boundary, so they’re beside it`}: move them in, or drag the boundary out.`, { undo: true });
    return;
  }
  // Anything of yours that's gone somewhere else is said, so a plan you drew isn't changed behind your back.
  const moved = now.features.filter((f) => {
    const [a, b] = [bounds(f.footprint), bounds(was.features.find((x) => x.id === f.id)?.footprint ?? [])];
    return a && b && Math.abs(a.minX - b.minX) + Math.abs(a.minY - b.minY) >= MOVED_MM;
  }).length;
  const grew = JSON.stringify(now.boundary) !== JSON.stringify(was.boundary);
  const parts = [moved ? `${moved === 1 ? '1 bed or pot' : `${moved} beds and pots`} moved to fit` : '', grew ? 'your garden’s boundary grown to hold them' : ''].filter(Boolean);
  notify(parts.length ? `Now a plan, with ${parts.join(' and ')}. Undo puts it back.` : 'Now a plan: your beds are set out neatly, ready to arrange. Settings has the list again.', { undo: true });
}
