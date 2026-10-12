// Next year, drafted: this year's crops moved round the beds by the rotation,
// shown as next year's plan to look at and change (which bed takes which crops,
// and what goes in), then "Use this", which plans them all as one undo step.
// Every bed is listed, with what stays and why; a bed with nothing recorded
// this year can be told what grew there, so the first year still counts.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { perennial } from '../lifecycle/stages';
import { addDays } from '../model/dates';
import { featureLabel } from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant, Planting } from '../model/types';
import { isActive, plantCount } from '../planting/place';
import { applyDraft, draftNextYear, GROUP_LABEL, LEFT_OUT_TEXT, PAST_CROPS, pastCrop, STAYS_TEXT, swapSources, type DraftBed, type DraftItem } from '../planting/rotation';
import { useApp } from './appContext';
import { MiniPlan } from './MiniPlan';
import { useWeatherNow } from './useWeather';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const listed = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? ''));

export function NextYearDialog({ garden, store, plantOf, close }: { garden: Garden; store: Store; plantOf: (id: string) => Plant; close: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const { weather } = useWeatherNow();
  const today = todayIso();
  const [from, setFrom] = useState<Record<string, string>>({});
  /** Your choices, by this year's planting: in or out. Otherwise, in unless it's left out. */
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  /** What grew this year in beds with nothing recorded, by bed: a plant id. */
  const [past, setPast] = useState<Record<string, string>>({});
  /** The bed picked out on the small plan. */
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const draft = useMemo(() => draftNextYear(garden, plantOf, today, weather, from), [garden, plantOf, today, weather, from]);
  const isIn = (i: DraftItem) => chosen[i.was.id] ?? !i.leftOut;
  const going = draft.items.filter(isIn);
  const left = draft.items.filter((i) => i.leftOut);
  const draftBeds = new Set(draft.beds.map((b) => b.bed.id));
  const grew = new Set(draft.items.map((i) => i.was.featureId));
  // Next year's plan: what stays (pots, perennials, anything not in the draft's beds, next year's crops already in), and what's coming.
  const preview = useMemo(
    () => ({
      ...garden,
      plantings: [
        ...garden.plantings.filter((p) => isActive(p) && p.draft !== draft.year && (!draftBeds.has(p.featureId) || perennial(plantOf(p.plantId)) || draft.beds.some((b) => b.taken?.plantings.includes(p)))),
        ...going.map((i) => i.next),
      ],
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
  const lowerNames = (pls: Planting[]) => listed([...new Set(pls.map((p) => plantOf(p.plantId).commonName.toLowerCase()))]);

  const use = () => {
    store.apply(updateGarden((g) => applyDraft(g, going.map((i) => i.next), year)));
    app.notify(`${plural(going.length, 'planting', 'plantings')} planned for ${year}${draft.replaces ? `, in place of the ${draft.replaces} from last time` : ''}.`, { undo: true });
    ref.current?.close();
  };

  const told = Object.entries(past).filter(([, id]) => id);
  const addPast = () => {
    const pls = told.map(([bedId, id]) => pastCrop(plantOf(id), garden.features.find((f) => f.id === bedId)!, year - 1, today));
    store.apply(updateGarden((g) => ({ ...g, plantings: [...g.plantings, ...pls] })));
    app.notify(`Added to ${year - 1}: ${told.map(([bedId, id]) => `${plantOf(id).commonName.toLowerCase()} in ${nameOf(bedId)}`).join(', ')}. The draft moves them on.`, { undo: true });
    setPast({});
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

  const groups = (b: DraftBed) => {
    if (b.taken) {
      // Out by the start of a month: taken until the end of the one before.
      const until = b.taken.until ? `until about ${MONTH_NAMES[Number(addDays(b.taken.until, -1).slice(5, 7)) - 1]}` : 'for now';
      return (
        <p class="small next-groups">
          <strong>Taken {until}</strong> by {lowerNames(b.taken.plantings)}, already in for {year}. Nothing new goes in until it’s out.
        </p>
      );
    }
    if (!grew.has(b.from)) return <p class="small next-groups muted">No crops move here, so it’s free for whatever you like.</p>;
    if (!b.was && !b.next) return null;
    return (
      <p class="small next-groups">
        {b.was ? GROUP_LABEL[b.was] : 'Other crops'} → <strong>{b.next ? GROUP_LABEL[b.next] : 'other crops'}</strong>
        {b.was && b.next && b.was === b.next ? <span class="muted"> (the same again: there’s no other bed for them)</span> : null}
      </p>
    );
  };

  return (
    <dialog ref={ref} class="dialog clear-dialog next-dialog" aria-labelledby="next-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="next-title" class="title">
          Next year, drafted
        </h2>
        {draft.beds.length === 0 ? (
          <p>There are no beds or patches of ground to draft {year} for. Pots, planters and greenhouses keep what they have, so they aren’t moved round.</p>
        ) : (
          <>
            <p class="muted">
              {year}: each bed’s crops move on a step, as the RHS’s four-year rotation has it: peas and beans, then the cabbage family, then potatoes and tomatoes, then onions and roots. Change anything below.
              {draft.items.length === 0 && ` Nothing was recorded in the beds in ${year - 1}, so there’s nothing to move yet. Say what grew where, and the draft moves it on.`}
            </p>
            <MiniPlan garden={preview} width={300} height={200} pad={0.06} plantOf={plantOf} highlight={focus ?? byName[0]?.bed.id} class="next-plan" />
            {byName.map((b) => {
              const items = draft.items.filter((i) => i.next.featureId === b.bed.id);
              const ask = !grew.has(b.bed.id);
              return (
                <fieldset key={b.bed.id} class={`clear-group next-bed${(focus ?? byName[0]?.bed.id) === b.bed.id ? ' next-bed-on' : ''}`} onFocusIn={() => setFocus(b.bed.id)} onPointerEnter={() => setFocus(b.bed.id)}>
                  <legend>{featureLabel(b.bed)}</legend>
                  {(draft.items.length > 0 || b.taken) && groups(b)}
                  {draft.items.length > 0 && draft.beds.length > 1 && !b.taken && (
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
                  {items.length > 0 && <ul class="plain-list">{items.map(row)}</ul>}
                  {b.stays.length > 0 && (
                    <ul class="plain-list muted small next-stays">
                      {b.stays.map((s) => (
                        <li key={s.planting.id}>
                          {plantOf(s.planting.plantId).commonName}: {STAYS_TEXT[s.why]}.
                        </li>
                      ))}
                    </ul>
                  )}
                  {ask && (
                    <label class="small next-from">
                      What grew here in {year - 1}?{' '}
                      <select value={past[b.bed.id] ?? ''} onChange={(e) => setPast((p) => ({ ...p, [b.bed.id]: (e.currentTarget as HTMLSelectElement).value }))}>
                        <option value="">Nothing, or not sure</option>
                        {PAST_CROPS.map((id) => (
                          <option key={id} value={id}>
                            {plantOf(id).commonName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </fieldset>
              );
            })}
            {told.length > 0 && (
              <div class="button-row">
                <button type="button" class="btn" onClick={addPast}>
                  Add {told.length === 1 ? 'it' : 'them'} to {year - 1}
                </button>
              </div>
            )}
            {left.length > 0 && (
              <p class="muted small">
                {plural(left.length, 'planting is', 'plantings are')} left out: {left.map((i) => `${plantOf(i.next.plantId).commonName.toLowerCase()} (${LEFT_OUT_TEXT[i.leftOut!]}, from ${nameOf(i.was.featureId)})`).join(', ')}. Tick to put one back.
              </p>
            )}
            <p class="muted small">
              Each goes in as planned, to sow or plant on the same day as this year. Pots, planters, greenhouses and plants that come back each year stay as they are.
              {draft.already > 0 && ` You’ve ${plural(draft.already, 'planting', 'plantings')} planned for ${year} already; these go alongside.`}
              {draft.replaces > 0 && ` Using it again replaces the ${plural(draft.replaces, 'planting', 'plantings')} from last time that aren’t sown yet.`}
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
