// Clear beds: one, several or all of them at once. Tick the beds and pots to
// clear, and choose everything in them or only what's finished (an end-of-
// season tidy). What grew there is kept in each bed's history, and it's one
// undo step.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { isFinished } from '../lifecycle/projection';
import { featureLabel } from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { clearBeds, isActive } from '../planting/place';
import { isPot } from '../planting/pots';
import { useApp } from './appContext';
import { useWeatherNow } from './useWeather';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ClearBedsDialog({ garden, store, plantOf, close }: { garden: Garden; store: Store; plantOf: (id: string) => Plant; close: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const { weather } = useWeatherNow();
  const today = todayIso();
  const [onlyFinished, setOnlyFinished] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Each bed or pot with something on it, and what clearing it would take away.
  const rows = useMemo(() => {
    const finished = (id: string) => {
      const pl = garden.plantings.find((p) => p.id === id)!;
      return isFinished(plantOf(pl.plantId), pl, garden, today, weather);
    };
    return garden.features
      .map((f) => {
        const growing = garden.plantings.filter((p) => p.featureId === f.id && isActive(p));
        return { f, all: growing.length, done: growing.filter((p) => finished(p.id)).length };
      })
      .filter((r) => r.all > 0);
  }, [garden, plantOf, today, weather]);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(rows.map((r) => r.f.id)));

  const shown = rows.filter((r) => (onlyFinished ? r.done > 0 : true));
  const chosen = shown.filter((r) => ticked.has(r.f.id));
  const plants = chosen.reduce((n, r) => n + (onlyFinished ? r.done : r.all), 0);
  const groups = [
    { label: 'Beds and ground', list: shown.filter((r) => !isPot(r.f)) },
    { label: 'Pots and planters', list: shown.filter((r) => isPot(r.f)) },
  ].filter((g) => g.list.length);
  const setAll = (ids: string[], on: boolean) =>
    setTicked((t) => {
      const next = new Set(t);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  const clear = () => {
    const ids = chosen.map((r) => r.f.id);
    store.apply(updateGarden((g) => clearBeds(g, ids, today, onlyFinished ? (pl) => isFinished(plantOf(pl.plantId), pl, g, today, weather) : undefined)));
    app.notify(`${plural(ids.length, 'place', 'places')} cleared: ${plural(plants, 'planting', 'plantings')}. What grew there is kept under “Grown here before”.`, { undo: true });
    ref.current?.close();
  };

  return (
    <dialog ref={ref} class="dialog clear-dialog" aria-labelledby="clear-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="clear-title" class="title">
          Clear beds
        </h2>
        {rows.length === 0 ? (
          <p>Nothing is growing on the plan, so there’s nothing to clear.</p>
        ) : (
          <>
            <div class="clear-what" role="radiogroup" aria-label="What to clear">
              <label class="clear-option">
                <input type="radio" name="clear-what" checked={!onlyFinished} onChange={() => setOnlyFinished(false)} />
                <span>Everything in them</span>
              </label>
              <label class="clear-option">
                <input type="radio" name="clear-what" checked={onlyFinished} onChange={() => setOnlyFinished(true)} />
                <span>Only what’s finished this season</span>
              </label>
            </div>
            {shown.length === 0 && <p class="muted">Nothing has finished yet: everything is still growing or cropping.</p>}
            {groups.map((g) => (
              <fieldset key={g.label} class="clear-group">
                <legend>{g.label}</legend>
                <div class="button-row clear-all-row">
                  <button type="button" class="link-btn small" onClick={() => setAll(g.list.map((r) => r.f.id), true)}>
                    All
                  </button>
                  <button type="button" class="link-btn small" onClick={() => setAll(g.list.map((r) => r.f.id), false)}>
                    None
                  </button>
                </div>
                <ul class="plain-list">
                  {g.list.map((r) => (
                    <li key={r.f.id}>
                      <label class="clear-option">
                        <input type="checkbox" checked={ticked.has(r.f.id)} onChange={(e) => setAll([r.f.id], (e.currentTarget as HTMLInputElement).checked)} />
                        <span>
                          {featureLabel(r.f)} <span class="muted small">({plural(onlyFinished ? r.done : r.all, 'planting', 'plantings')})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            <p class="muted small">Cleared plants leave the plan but stay in each bed’s history, under “Grown here before”. Beds, pots and paths stay where they are.</p>
          </>
        )}
        <div class="button-row">
          {rows.length > 0 && (
            <button type="button" class="btn btn-primary" disabled={!plants} onClick={clear}>
              {plants ? `Clear ${plural(chosen.length, 'place', 'places')} (${plural(plants, 'planting', 'plantings')})` : 'Clear'}
            </button>
          )}
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            {rows.length ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
