// Choosing a plant from the list: a grid of side-on drawings with the same
// lists as the plan's plant drawer (Sow or plant now, Easy to start, Want to
// grow, the seed tin, your own plants, all plants) and a search. Plants still
// being checked wait behind a button, as in the drawer.

import { useApp } from './appContext';
import { useMemo, useState } from 'preact/hooks';
import { canSowIn } from '../library/library';
import { beginnerOrder, isEasy, MORE_PLANTS, splitCore } from '../library/order';
import type { Garden, Plant } from '../model/types';
import { Icon } from './icons';
import { PlantIcon } from './PlantIcon';

type Filter = 'now' | 'easy' | 'list' | 'tin' | 'mine' | 'all';

export function PlantChooser({ plants, garden, month, pick }: { plants: Plant[]; garden: Garden; month: number; pick: (id: string) => void }) {
  const { draftPlants } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('now');
  const [showMore, setShowMore] = useState(false);
  const byId = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const growable = useMemo(() => plants.filter((p) => p.category !== 'weed' && !p.varietyOf), [plants]);
  const lists: Record<Filter, Plant[]> = useMemo(
    () => ({
      now: beginnerOrder(growable.filter((p) => canSowIn(p, month))),
      easy: beginnerOrder(growable.filter(isEasy)),
      list: [...new Set(garden.wishlist)].map((id) => byId.get(id)).filter((p): p is Plant => !!p),
      tin: [...new Set((garden.seeds ?? []).filter((k) => k.count !== 0).map((k) => k.plantId))].map((id) => byId.get(id)).filter((p): p is Plant => !!p),
      mine: plants.filter((p) => p.userAdded),
      all: beginnerOrder(growable),
    }),
    [plants, growable, month, garden.wishlist, garden.seeds, byId],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? plants.filter((p) => p.category !== 'weed' && `${p.commonName} ${p.latinName ?? ''}`.toLowerCase().includes(q)) : lists[filter];
  const split = !q && (filter === 'now' || filter === 'easy' || filter === 'all') ? splitCore(shown) : { core: shown, more: [] };
  // Plants still being checked are listed only if you've asked for them in Settings; search finds them anyway.
  const { core, more } = draftPlants ? split : { core: split.core, more: [] };
  const chips: [Filter, string][] = [
    ['now', 'Sow or plant now'],
    ['easy', 'Easy to start'],
    ['list', 'Want to grow'],
    ['tin', 'In the seed tin'],
    ['mine', 'Your plants'],
    ['all', 'All plants'],
  ];

  return (
    <div class="plant-chooser">
      <label class="dock-search">
        <Icon name="search" size={16} />
        <span class="visually-hidden">Find a plant</span>
        <input value={query} placeholder="Find a plant" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {!q && (
        <div class="dock-filters" role="radiogroup" aria-label="Show">
          {chips
            .filter(([id]) => id === 'now' || id === 'all' || lists[id].length > 0)
            .map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                class="chip"
                aria-checked={filter === id}
                onClick={() => {
                  setFilter(id);
                  setShowMore(false);
                }}
              >
                {label}
              </button>
            ))}
        </div>
      )}
      <ul class="dock-grid chooser-grid" aria-label="Plants">
        {[...core.slice(0, 80), ...(showMore ? more.slice(0, 120) : [])].map((p) => (
          <li key={p.id}>
            <button type="button" class="sticker" onClick={() => pick(p.id)} title={p.commonName}>
              <PlantIcon plant={p} size={44} view="side" />
              <span class="sticker-label">{p.commonName}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li class="muted small">{q ? 'No plants match.' : filter === 'list' ? 'Nothing here yet. Tap the heart on a plant you want to grow.' : 'Nothing here.'}</li>}
      </ul>
      {more.length > 0 && (
        <button type="button" class="link-btn small dock-more" aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
          {showMore ? 'Hide the plants still being checked' : `${MORE_PLANTS} · ${more.length}`}
        </button>
      )}
    </div>
  );
}
