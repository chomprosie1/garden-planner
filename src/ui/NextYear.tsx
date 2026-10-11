// Next year, drafted: this year's crops moved round the beds by the rotation,
// shown as next year's plan to look at and change (which bed takes which crops,
// and what goes in), then "Use this", which plans them all as one undo step.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { perennial } from '../lifecycle/stages';
import { featureLabel } from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { isActive, plantCount } from '../planting/place';
import { applyDraft, draftNextYear, GROUP_LABEL, LEFT_OUT_TEXT, swapSources, type DraftItem } from '../planting/rotation';
import { useApp } from './appContext';
import { MiniPlan } from './MiniPlan';
import { useWeatherNow } from './useWeather';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function NextYearDialog({ garden, store, plantOf, close }: { garden: Garden; store: Store; plantOf: (id: string) => Plant; close: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const { weather } = useWeatherNow();
  const today = todayIso();
  const [from, setFrom] = useState<Record<string, string>>({});
  /** Your choices, by this year's planting: in or out. Otherwise, in unless it's left out. */
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const draft = useMemo(() => draftNextYear(garden, plantOf, today, weather, from), [garden, plantOf, today, weather, from]);
  const isIn = (i: DraftItem) => chosen[i.was.id] ?? !i.leftOut;
  const going = draft.items.filter(isIn);
  const left = draft.items.filter((i) => i.leftOut);
  const draftBeds = new Set(draft.beds.map((b) => b.bed.id));
  // Next year's plan: what stays (pots, perennials, anything not in the draft's beds), and what's coming.
  const preview = useMemo(
    () => ({
      ...garden,
      plantings: [...garden.plantings.filter((p) => isActive(p) && (!draftBeds.has(p.featureId) || perennial(plantOf(p.plantId)))), ...going.map((i) => i.next)],
    }),
    [garden, draft, chosen],
  );
  const year = draft.year;
  const byName = [...draft.beds].sort((x, y) => featureLabel(x.bed).localeCompare(featureLabel(y.bed), undefined, { numeric: true }));
  const nameOf = (id: string) => featureLabel(garden.features.find((f) => f.id === id)!);
  const label = (i: DraftItem) => {
    const plant = plantOf(i.next.plantId);
    const n = plantCount(i.next, plant);
    return `${plant.commonName}${n > 1 ? ` (${n})` : ''}`;
  };
  const toggle = (i: DraftItem, on: boolean) => setChosen((c) => ({ ...c, [i.was.id]: on }));

  const use = () => {
    store.apply(updateGarden((g) => applyDraft(g, going.map((i) => i.next))));
    app.notify(`${plural(going.length, 'planting', 'plantings')} planned for ${year}.`, { undo: true });
    ref.current?.close();
  };

  const row = (i: DraftItem) => (
    <li key={i.was.id}>
      <label class="clear-option">
        <input type="checkbox" checked={isIn(i)} onChange={(e) => toggle(i, (e.currentTarget as HTMLInputElement).checked)} />
        <span>
          {label(i)}
          {i.didWell && <span class="badge badge-ok next-badge">Did well</span>}
          {i.leftOut && <span class="muted small"> · {LEFT_OUT_TEXT[i.leftOut]}</span>}
        </span>
      </label>
    </li>
  );

  return (
    <dialog ref={ref} class="dialog clear-dialog next-dialog" aria-labelledby="next-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="next-title" class="title">
          Next year, drafted
        </h2>
        {draft.items.length === 0 ? (
          <p>
            Nothing was grown in the beds in {year - 1} to draft {year} from. Next year is drafted from what you sow and plant, so mark it as you go: ticking a sowing or planting job does it.
          </p>
        ) : (
          <>
            <p class="muted">
              {year}: each bed’s crops move on a step, as the RHS’s four-year rotation has it: peas and beans, then the cabbage family, then potatoes and tomatoes, then onions and roots. Change anything below.
            </p>
            <MiniPlan garden={preview} width={300} height={200} pad={0.06} plantOf={plantOf} class="next-plan" />
            {byName.map((b) => {
              const items = draft.items.filter((i) => i.next.featureId === b.bed.id);
              return (
                <fieldset key={b.bed.id} class="clear-group">
                  <legend>{featureLabel(b.bed)}</legend>
                  {b.was || b.next ? (
                    <p class="small next-groups">
                      {b.was ? GROUP_LABEL[b.was] : 'Other crops'} → <strong>{b.next ? GROUP_LABEL[b.next] : 'other crops'}</strong>
                      {b.was && b.next && b.was === b.next ? <span class="muted"> (the same again: there’s no other bed for them)</span> : null}
                    </p>
                  ) : null}
                  {draft.beds.length > 1 && (
                    <label class="small next-from">
                      Takes the crops from{' '}
                      <select value={b.from} onChange={(e) => setFrom(swapSources(draft, b.bed.id, (e.currentTarget as HTMLSelectElement).value))}>
                        {byName.map((o) => (
                          <option key={o.bed.id} value={o.bed.id}>
                            {featureLabel(o.bed)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <ul class="plain-list">{items.map(row)}</ul>
                </fieldset>
              );
            })}
            {left.length > 0 && (
              <p class="muted small">
                {plural(left.length, 'planting is', 'plantings are')} left out: {left.map((i) => `${plantOf(i.next.plantId).commonName.toLowerCase()} (${LEFT_OUT_TEXT[i.leftOut!]}, from ${nameOf(i.was.featureId)})`).join(', ')}. Tick to put one back.
              </p>
            )}
            <p class="muted small">
              Each goes in as planned, to sow or plant on the same day as this year. Pots, planters, greenhouses and plants that come back each year stay as they are.
              {draft.already > 0 && ` You’ve ${plural(draft.already, 'planting', 'plantings')} planned for ${year} already; these go alongside.`}
            </p>
          </>
        )}
        <div class="button-row">
          {draft.items.length > 0 && (
            <button type="button" class="btn btn-primary" disabled={!going.length} onClick={use}>
              Use this for {year} ({plural(going.length, 'planting', 'plantings')})
            </button>
          )}
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            {draft.items.length ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
