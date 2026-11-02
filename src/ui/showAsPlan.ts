// From a list to a plan, wherever it's asked for: a garden that fits, and what didn't if anything.

import { featureLabel } from '../model/features';
import { outsideBoundary, planFromList } from '../model/listLayout';
import { updateGarden, type Store } from '../model/store';
import { isListed } from '../planting/listPlant';
import { isContainer } from '../planting/place';

export function showAsPlan(store: Store, notify: (text: string, options: { undo: true }) => void) {
  // A garden that fits: beds moved apart, pots on the paving, and an outline that holds them all, before the plan shows it.
  store.apply(updateGarden(({ view: _v, ...g }) => planFromList(g, isListed(g))));
  // A boundary drawn to its own shape stays that shape, so something may not fit in it: better said than found.
  const now = store.get().garden;
  const listed = isListed(now);
  const left = outsideBoundary(now, (f) => listed(f) && isContainer(f));
  notify(
    left.length
      ? `Now a plan. ${left.length === 1 ? `${featureLabel(left[0]!)} didn’t fit inside your garden’s boundary, so it’s beside it` : `${left.length} beds and pots didn’t fit inside your garden’s boundary, so they’re beside it`}: move them in, or drag the boundary out.`
      : 'Now a plan: your beds are set out neatly, ready to arrange. Settings has the list again.',
    { undo: true },
  );
}
