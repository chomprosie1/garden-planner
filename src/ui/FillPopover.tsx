// After a plant is dropped into a bed: how it was filled, and the other ways,
// one tap each. It goes away on its own after a few seconds.

import { useEffect } from 'preact/hooks';
import { fillPlanting, fillsFor, FILL_LABEL, type Fill } from '../planting/fill';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant, Point } from '../model/types';

export interface Placed {
  id: string;
  /** Where it was dropped, on screen and in the garden. */
  at: Point;
  world: Point;
}

/** Which fill a planting is: one plant, a row, or a block. */
const fillOf = (layout: string | undefined): Fill => (layout === 'row' ? 'row' : layout === 'block' ? 'fill' : 'one');

export function FillPopover({ placed, garden, store, plantOf, close }: { placed: Placed; garden: Garden; store: Store; plantOf: (id: string) => Plant; close: () => void }) {
  const pl = garden.plantings.find((p) => p.id === placed.id);
  const bed = pl ? garden.features.find((f) => f.id === pl.featureId) : undefined;
  useEffect(() => {
    const t = setTimeout(close, 7000);
    return () => clearTimeout(t);
  }, [placed.id, pl?.layout]);
  if (!pl || !bed) return null;
  const plant = plantOf(pl.plantId);
  const current = fillOf(pl.layout);
  const options = fillsFor(plant, bed);
  if (options.length < 2) return null;
  const choose = (fill: Fill) =>
    store.apply(
      updateGarden((g) => ({
        ...g,
        plantings: g.plantings.map((p) => {
          if (p.id !== pl.id) return p;
          const { endPoint: _e, count: _c, ...rest } = p;
          return { ...rest, ...fillPlanting(plant, bed, fill, placed.world) };
        }),
      })),
    );
  return (
    <div
      class="fill-popover"
      role="group"
      aria-label={`How to plant ${plant.commonName}`}
      // The canvas keeps it on the drop point as the plan moves; this is where it starts.
      data-world={`${placed.world[0]},${placed.world[1]}`}
      style={{ left: `${placed.at[0]}px`, top: `${placed.at[1]}px` }}
    >
      {options.map((f) => (
        <button key={f} type="button" class="pill-btn" aria-pressed={current === f} onClick={() => choose(f)}>
          {FILL_LABEL[f]}
        </button>
      ))}
    </div>
  );
}
