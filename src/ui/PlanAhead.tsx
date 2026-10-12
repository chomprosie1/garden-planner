// Planning ahead: the shopping list and next year's draft, side by side. On
// Today from September to February, when people look for them, and always on
// the month's page.

import { useMemo, useState } from 'preact/hooks';
import { todayIso } from '../model/ids';
import type { Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { draftYear } from '../planting/rotation';
import { shoppingList } from '../planting/shopping';
import { NextYearDialog } from './NextYear';
import { ShoppingDialog } from './Shopping';

/** The months Today offers it: from the last of the harvest to the first sowings. */
export const PLAN_AHEAD_MONTHS = [9, 10, 11, 12, 1, 2];

export function PlanAheadCard({ store, garden, plantOf, feeding }: { store: Store; garden: Garden; plantOf: (id: string) => Plant; feeding: boolean }) {
  const today = todayIso();
  const [shopping, setShopping] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const toBuy = useMemo(() => shoppingList(garden, plantOf, today, { feeding }).filter((i) => !i.bought).length, [garden, plantOf, today, feeding]);
  const hasPlants = garden.plantings.some((p) => !p.removedOn) || garden.wishlist.length > 0;
  if (!hasPlants) return null;
  return (
    <section class="card plan-ahead" aria-labelledby="plan-ahead-title">
      <h2 id="plan-ahead-title">Planning ahead</h2>
      <div class="plan-ahead-row">
        <span>
          <strong>Shopping list</strong>
          <span class="muted small"> · {toBuy ? `${toBuy} to buy` : 'nothing to buy'}</span>
        </span>
        <button type="button" class="btn btn-small" onClick={() => setShopping(true)}>
          Open
        </button>
      </div>
      {garden.plantings.length > 0 && (
        <div class="plan-ahead-row">
          <span>
            <strong>Next year</strong>
            <span class="muted small"> · {draftYear(today)}, with the crops rotated</span>
          </span>
          <button type="button" class="btn btn-small" onClick={() => setDrafting(true)}>
            Draft it
          </button>
        </div>
      )}
      {shopping && <ShoppingDialog garden={garden} store={store} plantOf={plantOf} feeding={feeding} close={() => setShopping(false)} />}
      {drafting && <NextYearDialog garden={garden} store={store} plantOf={plantOf} close={() => setDrafting(false)} />}
    </section>
  );
}
