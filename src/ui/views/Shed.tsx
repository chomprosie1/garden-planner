// The Potting Shed: seeds sown in trays and pots, on shelves, windowsills, a
// propagator or a cold frame, until they're ready for the garden. Drag a tray
// to move it, or pick it and tap where it should go.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { climateOf, climateText, isCover, microclimateOf, placeClimate } from '../../climate/microclimate';
import { canSowIn } from '../../library/library';
import {
  addPlace,
  CONTAINER_COUNT,
  CONTAINER_LABEL,
  daysBetween,
  failTray,
  frostDates,
  inYear,
  makePlace,
  moveTray,
  PLACE_LABEL,
  placesOf,
  plantingNext,
  plantingsIndoors,
  readyToPlantOut,
  removePlace,
  removeTray,
  setIndoorStage,
  setTrayStage,
  short,
  sowInTray,
  trayAt,
  trayNext,
  traysOf,
  trayStage,
  updatePlace,
  updateTray,
  type Spot,
} from '../../lifecycle/shed';
import { currentStage } from '../../lifecycle/stages';
import { featureLabel } from '../../model/features';
import { todayIso } from '../../model/ids';
import { updateGarden, type Store } from '../../model/store';
import { CONTAINERS, SHED_PLACE_KINDS, type Container, type Garden, type Plant, type ShedPlace, type ShedPlaceKind, type Tray, type TrayStage } from '../../model/types';
import { useApp } from '../appContext';
import { useIsPhone } from '../hooks';
import { PlantIcon } from '../PlantIcon';
import { TrayArt } from '../TrayArt';
import { usePlants } from '../usePlants';

const TRAY_DRAG = 'application/x-garden-tray';
const STAGE_NAME: Record<TrayStage, string> = { sown: 'Sown', germinated: 'Up', hardening: 'Hardening off' };
const STAGES: TrayStage[] = ['sown', 'germinated', 'hardening'];

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  /** Open the sowing form with this plant chosen. */
  sowPlantId?: string | null;
  clearSow?: () => void;
}

/** Plants sown indoors or under cover: the ones the shed is for. */
const sownUnderCover = (p: Plant) => !!p.sowing?.some((s) => s.method !== 'direct');

export function Shed({ store, garden, userPlants, sowPlantId = null, clearSow }: Props) {
  const app = useApp();
  const phone = useIsPhone();
  const { plants, plantOf } = usePlants(userPlants);
  const today = todayIso();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const [selected, setSelected] = useState<string | null>(null);
  const [sowing, setSowing] = useState<string | null>(sowPlantId);
  const [tab, setTab] = useState<string | null>(null);
  const places = placesOf(garden);
  const trays = traysOf(garden);
  const indoors = plants ? plantingsIndoors(garden, plantOf) : [];
  const ready = plants ? readyToPlantOut(garden, plantOf, today) : [];
  const frost = frostDates(garden);
  const tray = trays.find((t) => t.id === selected) ?? null;
  const shownPlaces = phone && places.length ? places.filter((p) => p.id === (tab ?? places[0]!.id)) : places;

  useEffect(() => {
    if (sowPlantId) {
      setSowing(sowPlantId);
      clearSow?.();
    }
  }, [sowPlantId]);
  // Forget a tray that's gone (planted out, deleted, or undone).
  useEffect(() => {
    if (selected && !trays.some((t) => t.id === selected)) setSelected(null);
  }, [trays, selected]);

  const move = (id: string, to: Spot) => commit((g) => moveTray(g, id, to));

  return (
    <div class="page shed-page">
      <header class="page-head">
        <h1 class="title">Seedlings</h1>
        <button type="button" class="btn btn-primary shed-sow-btn" onClick={() => setSowing('')}>
          Sow seeds
        </button>
      </header>
      <p class="muted small shed-frost">
        Last frost about {short(inYear(frost.lastFrost, 2027))}, first frost about {short(inYear(frost.firstFrost, 2027))}
        {frost.estimated ? ', estimated from your location' : ''}.{' '}
        <a
          href="#/your-garden"
          onClick={(e) => {
            e.preventDefault();
            app.go('profile');
          }}
        >
          Change
        </a>
      </p>

      {ready.length > 0 && (
        <section class="card shed-ready" aria-labelledby="ready-head">
          <h2 id="ready-head">Ready for the garden</h2>
          <ul class="plain-list">
            {ready.map((r) => {
              const p = plantOf(r.plantId);
              return (
                <li key={r.id} class="shed-ready-row">
                  <PlantIcon plant={p} size={28} stage="transplanted" />
                  <span>
                    <strong>{p.commonName}</strong>
                    {r.kind === 'tray' ? ` · ${r.count} ${r.count === 1 ? 'plant' : 'plants'}` : ' · already has its place on the plan'}
                  </span>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => (r.kind === 'tray' ? app.plantOutTray(r.id) : commit((g) => setIndoorStage(g, r.id, 'transplanted', today)))}
                  >
                    {r.kind === 'tray' ? 'Plant out' : 'Mark as planted out'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sowing !== null && plants && (
        <SowForm
          plants={plants}
          places={places}
          initial={sowing || null}
          onCancel={() => setSowing(null)}
          onSow={(plant, o) => {
            let made: string | null = null;
            commit((g) => {
              const [next, id] = sowInTray(g, plant, o);
              made = id;
              return next;
            });
            setSowing(null);
            if (made) setSelected(made);
            app.notify(`${plant.commonName} sown in the shed.`, { undo: true });
          }}
        />
      )}

      {tray && plants && <TrayPanel tray={tray} plant={plantOf(tray.plantId)} garden={garden} commit={commit} close={() => setSelected(null)} today={today} />}

      {places.length === 0 ? (
        <section class="card shed-empty">
          <div class="shed-empty-art" aria-hidden="true" />
          <h2>Nothing sown yet</h2>
          <p class="muted">
            Sow seeds in trays and pots here, on a windowsill, in a propagator or on shelves. Each tray shows when its seedlings are due, when to harden them off, and when they’re ready for the garden.
          </p>
          <button type="button" class="btn btn-primary" onClick={() => setSowing('')}>
            Sow seeds
          </button>
        </section>
      ) : (
        <>
          {phone && places.length > 1 && (
            <div class="shed-tabs" role="tablist" aria-label="Places">
              {places.map((p) => {
                const n = trays.filter((t) => t.placeId === p.id).length;
                return (
                  <button key={p.id} type="button" role="tab" class="mode-tab" aria-selected={(tab ?? places[0]!.id) === p.id} onClick={() => setTab(p.id)}>
                    {p.name}
                    {n > 0 && <span class="mode-badge">{n}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {tray && <p class="shed-move-hint small">Tap an empty space to move {plantOf(tray.plantId).commonName.toLowerCase()} there, or drag it.</p>}
          <div class="shed-places">
            {shownPlaces.map((place) => (
              <PlaceScene
                key={place.id}
                place={place}
                garden={garden}
                plantOf={plantOf}
                selected={selected}
                select={(id) => setSelected(id === selected ? null : id)}
                move={move}
                commit={commit}
                today={today}
              />
            ))}
          </div>
        </>
      )}

      {indoors.length > 0 && (
        <section class="card" aria-labelledby="indoors-head">
          <h2 id="indoors-head">Sown for the plan</h2>
          <p class="muted small">These already have a place in a bed. They’re here while they grow on indoors.</p>
          <ul class="plain-list shed-indoors">
            {indoors.map((pl) => {
              const p = plantOf(pl.plantId);
              const stage = currentStage(pl) as TrayStage;
              const next = plantingNext(pl, p, garden, today);
              const bed = garden.features.find((f) => f.id === pl.featureId);
              // Going into a greenhouse or cold frame: straight in, with no hardening off.
              const covered = !!microclimateOf(garden, pl);
              const forward = stage === 'sown' ? 'germinated' : stage === 'germinated' && !covered ? 'hardening' : 'transplanted';
              return (
                <li key={pl.id} class="shed-indoor-row">
                  <PlantIcon plant={p} size={30} stage={stage} />
                  <span class="shed-indoor-text">
                    <strong>{p.commonName}</strong> for {bed ? featureLabel(bed) : 'a bed'} · {STAGE_NAME[stage]}
                    <span class="small muted">{next.text}</span>
                  </span>
                  <button type="button" class={`btn ${next.ready ? 'btn-primary' : ''}`} onClick={() => commit((g) => setIndoorStage(g, pl.id, forward, today))}>
                    {forward === 'germinated' ? 'Mark as up' : forward === 'hardening' ? 'Start hardening off' : 'Mark as planted out'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AddPlace onAdd={(kind) => commit((g) => addPlace(g, makePlace(kind)))} />
      <p class="assumption">Germination times and frost dates are averages. Seeds come up faster somewhere warm, and a late frost can catch anyone out.</p>
    </div>
  );
}

// ---------- A place, drawn ----------

interface PlaceProps {
  place: ShedPlace;
  garden: Garden;
  plantOf: (id: string) => Plant;
  selected: string | null;
  select: (id: string) => void;
  move: (id: string, to: Spot) => void;
  commit: (fn: (g: Garden) => Garden) => void;
  today: string;
}

function PlaceScene({ place, garden, plantOf, selected, select, move, commit, today }: PlaceProps) {
  const [over, setOver] = useState<string | null>(null);
  const count = traysOf(garden).filter((t) => t.placeId === place.id).length;
  const climate = placeClimate(garden, place);
  const linked = place.featureId ? garden.features.find((f) => f.id === place.featureId && climateOf(f)) : undefined;
  return (
    <section class={`shed-place shed-${place.kind}`} aria-label={place.name}>
      <header class="shed-place-head">
        <h2>{place.name}</h2>
        <span class="muted small">
          {count} of {place.shelves * place.slots}
        </span>
        <PlaceMenu place={place} empty={count === 0} commit={commit} garden={garden} />
      </header>
      {climate && (
        <p class="muted small shed-climate">
          {linked ? `In ${featureLabel(linked)} on the plan: ` : 'Warmer than outside: '}
          {climateText(climate)}.
        </p>
      )}
      <div class="shed-scene">
        {Array.from({ length: place.shelves }, (_, shelf) => (
          <div key={shelf} class="shed-shelf" style={{ '--slots': place.slots } as Record<string, number>}>
            {Array.from({ length: place.slots }, (_, slot) => {
              const spot: Spot = { placeId: place.id, shelf, slot };
              const key = `${shelf}-${slot}`;
              const t = trayAt(garden, spot);
              const dropProps = {
                onDragOver: (e: DragEvent) => {
                  if (e.dataTransfer?.types.includes(TRAY_DRAG)) {
                    e.preventDefault();
                    setOver(key);
                  }
                },
                onDragLeave: () => setOver(null),
                onDrop: (e: DragEvent) => {
                  const id = e.dataTransfer?.getData(TRAY_DRAG);
                  setOver(null);
                  if (id) {
                    e.preventDefault();
                    move(id, spot);
                  }
                },
              };
              if (!t)
                return (
                  <button
                    key={key}
                    type="button"
                    class={`shed-slot ${over === key ? 'shed-over' : ''}`}
                    aria-label={selected ? `Move here: shelf ${shelf + 1}, space ${slot + 1}` : `Empty space, shelf ${shelf + 1}`}
                    disabled={!selected}
                    onClick={() => selected && move(selected, spot)}
                    {...dropProps}
                  />
                );
              const p = plantOf(t.plantId);
              const stage = trayStage(t);
              const next = trayNext(t, p, garden, today);
              return (
                <button
                  key={key}
                  type="button"
                  class={`shed-tray ${selected === t.id ? 'is-selected' : ''} ${next.ready ? 'is-ready' : next.due ? 'is-due' : ''} ${over === key ? 'shed-over' : ''}`}
                  aria-pressed={selected === t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData(TRAY_DRAG, t.id);
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => select(t.id)}
                  {...dropProps}
                >
                  <TrayArt tray={t} plant={p} stage={stage} width={112} />
                  <span class="shed-tray-name">{p.commonName}</span>
                  <span class="shed-tray-meta">
                    {STAGE_NAME[stage]} · {daysBetween(t.sownOn, today)} d{next.ready ? ' · ready' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlaceMenu({ place, empty, commit, garden }: { place: ShedPlace; empty: boolean; commit: (fn: (g: Garden) => Garden) => void; garden: Garden }) {
  // A greenhouse bench or cold frame can be one on the plan, and share its climate.
  const covers = place.kind === 'greenhouse-bench' || place.kind === 'cold-frame' ? garden.features.filter(isCover) : [];
  return (
    <details class="shed-place-menu">
      <summary aria-label={`Change ${place.name}`}>Change</summary>
      <div class="shed-place-form">
        <label class="field">
          Name
          <input value={place.name} maxLength={30} onChange={(e) => commit((g) => updatePlace(g, place.id, { name: (e.currentTarget as HTMLInputElement).value.trim() || PLACE_LABEL[place.kind] }))} />
        </label>
        <div class="field-row">
          <label class="field">
            Shelves
            <input type="number" min={1} max={8} value={place.shelves} onChange={(e) => commit((g) => updatePlace(g, place.id, { shelves: Number((e.currentTarget as HTMLInputElement).value) || 1 }))} />
          </label>
          <label class="field">
            Trays a shelf
            <input type="number" min={1} max={12} value={place.slots} onChange={(e) => commit((g) => updatePlace(g, place.id, { slots: Number((e.currentTarget as HTMLInputElement).value) || 1 }))} />
          </label>
        </div>
        {covers.length > 0 && (
          <label class="field">
            On the plan
            <select value={place.featureId ?? ''} onChange={(e) => commit((g) => updatePlace(g, place.id, { featureId: (e.currentTarget as HTMLSelectElement).value || undefined }))}>
              <option value="">Not on the plan</option>
              {covers.map((f) => (
                <option key={f.id} value={f.id}>
                  {featureLabel(f)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" class="btn btn-danger" disabled={!empty} onClick={() => commit((g) => removePlace(g, place.id))}>
          Remove {empty ? '' : '(move its trays first)'}
        </button>
      </div>
    </details>
  );
}

function AddPlace({ onAdd }: { onAdd: (kind: ShedPlaceKind) => void }) {
  const [kind, setKind] = useState<ShedPlaceKind>('shelves');
  return (
    <details class="card form-more shed-add">
      <summary>Add a place</summary>
      <div class="field-row">
        <label class="field">
          Kind
          <select value={kind} onChange={(e) => setKind((e.currentTarget as HTMLSelectElement).value as ShedPlaceKind)}>
            {SHED_PLACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {PLACE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" class="btn" onClick={() => onAdd(kind)}>
          Add
        </button>
      </div>
    </details>
  );
}

// ---------- Sowing ----------

function SowForm({ plants, places, initial, onSow, onCancel }: { plants: Plant[]; places: ShedPlace[]; initial: string | null; onSow: (p: Plant, o: { container: Container; count: number; placeId?: string; date: string }) => void; onCancel: () => void }) {
  const month = new Date().getMonth() + 1;
  const groups = useMemo(() => {
    const cover = plants.filter(sownUnderCover);
    return [
      { label: 'Sow under cover now', list: cover.filter((p) => p.sowing!.some((s) => s.method !== 'direct' && s.months.includes(month))) },
      { label: 'Sow under cover later', list: cover.filter((p) => !p.sowing!.some((s) => s.method !== 'direct' && s.months.includes(month))) },
      { label: 'Other plants', list: plants.filter((p) => !sownUnderCover(p)) },
    ];
  }, [plants]);
  const [plantId, setPlantId] = useState(initial ?? groups[0]!.list[0]?.id ?? plants[0]?.id ?? '');
  const plant = plants.find((p) => p.id === plantId);
  const [container, setContainer] = useState<Container>(plant && plant.size.spreadMm && plant.size.spreadMm >= 400 ? 'pot-9cm' : 'module-tray');
  const [count, setCount] = useState(String(CONTAINER_COUNT[container]));
  const [placeId, setPlaceId] = useState('');
  const [date, setDate] = useState(todayIso());
  const note = plant?.sowing?.find((s) => s.method !== 'direct');
  return (
    <form
      class="card shed-sow"
      onSubmit={(e) => {
        e.preventDefault();
        if (plant) onSow(plant, { container, count: Math.max(1, Number(count) || 1), ...(placeId ? { placeId } : {}), date });
      }}
    >
      <h2>Sow seeds</h2>
      <div class="shed-sow-plant">
        {plant && <PlantIcon plant={plant} size={44} />}
        <label class="field">
          Plant
          <select value={plantId} onChange={(e) => setPlantId((e.currentTarget as HTMLSelectElement).value)}>
            {groups.map((g) =>
              g.list.length ? (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.commonName}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </label>
      </div>
      {plant && (
        <p class="muted small">
          {note ? `Sow under cover ${note.months.length ? `in ${monthNames(note.months)}` : ''}${note.depthMm ? `, about ${note.depthMm >= 10 ? `${note.depthMm / 10} cm` : `${note.depthMm} mm`} deep` : ''}. ${note.notes ?? ''}` : 'Usually sown outside or bought as plants, but you can start it in the shed.'}
          {plant && !canSowIn(plant, month) && ' Not the usual time to sow it.'}
        </p>
      )}
      <div class="field-row">
        <label class="field">
          In
          <select
            value={container}
            onChange={(e) => {
              const c = (e.currentTarget as HTMLSelectElement).value as Container;
              setContainer(c);
              setCount(String(CONTAINER_COUNT[c]));
            }}
          >
            {CONTAINERS.map((c) => (
              <option key={c} value={c}>
                {CONTAINER_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          How many
          <input type="number" min={1} max={200} inputMode="numeric" value={count} onInput={(e) => setCount((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="field-row">
        <label class="field">
          Where
          <select value={placeId} onChange={(e) => setPlaceId((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">{places.length ? 'First free space' : 'Windowsill (set up for you)'}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Sown on
          <input type="date" value={date} onChange={(e) => setDate((e.currentTarget as HTMLInputElement).value || todayIso())} />
        </label>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary" disabled={!plant}>
          Sow
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthNames = (months: number[]) => (months.length > 2 ? `${MONTH_NAMES[months[0]! - 1]} to ${MONTH_NAMES[months[months.length - 1]! - 1]}` : months.map((m) => MONTH_NAMES[m - 1]).join(' or '));

// ---------- A tray, picked ----------

function TrayPanel({ tray, plant, garden, commit, close, today }: { tray: Tray; plant: Plant; garden: Garden; commit: (fn: (g: Garden) => Garden) => void; close: () => void; today: string }) {
  const app = useApp();
  const stage = trayStage(tray);
  const next = trayNext(tray, plant, garden, today);
  const places = placesOf(garden);
  const days = daysBetween(tray.sownOn, today);
  const forward: TrayStage | null = stage === 'sown' ? 'germinated' : stage === 'germinated' ? 'hardening' : null;
  return (
    <section class="card shed-panel" aria-label={`${plant.commonName} tray`}>
      <header class="shed-panel-head">
        <TrayArt tray={tray} plant={plant} stage={stage} width={150} />
        <div>
          <p class="eyebrow muted">{CONTAINER_LABEL[tray.container]}</p>
          <h2 class="panel-title">{plant.commonName}</h2>
          <p class="muted small">
            {tray.count} {tray.count === 1 ? 'seedling' : 'seedlings'} · sown {short(tray.sownOn)}, {days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="Close" onClick={close}>
          ✕
        </button>
      </header>
      <ol class="stage-strip" aria-label="Stages">
        {STAGES.map((s) => {
          const state = STAGES.indexOf(s) < STAGES.indexOf(stage) ? 'done' : s === stage ? 'now' : 'todo';
          const date = s === 'sown' ? tray.sownOn : tray.stageDates?.[s];
          return (
            <li key={s} class={`stage stage-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span class="stage-dot" aria-hidden="true" />
              <span class="stage-name">
                {STAGE_NAME[s]}
                {date && state !== 'todo' && <span class="stage-date"> {short(date)}</span>}
              </span>
            </li>
          );
        })}
        <li class="stage stage-todo">
          <span class="stage-dot" aria-hidden="true" />
          <span class="stage-name">Planted out</span>
        </li>
        <li class="stage-names-break" aria-hidden="true" />
      </ol>
      <p class={`shed-next ${next.ready ? 'is-ready' : next.due ? 'is-due' : ''}`}>{next.text}</p>
      <div class="button-row">
        {forward && (
          <button type="button" class={`btn ${next.due ? 'btn-primary' : ''}`} onClick={() => commit((g) => setTrayStage(g, tray.id, forward, today))}>
            {forward === 'germinated' ? 'Mark as up' : 'Start hardening off'}
          </button>
        )}
        {stage !== 'sown' && (
          <button type="button" class={`btn ${next.ready ? 'btn-primary' : ''}`} onClick={() => app.plantOutTray(tray.id)}>
            Plant out
          </button>
        )}
        <label class="stage-correct">
          <span class="visually-hidden">Change the stage</span>
          <select
            value=""
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value as TrayStage | '';
              if (v) commit((g) => setTrayStage(g, tray.id, v, today));
            }}
          >
            <option value="">Change stage…</option>
            {STAGES.map((s) => (
              <option key={s} value={s} disabled={s === stage}>
                {STAGE_NAME[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details class="form-more">
        <summary>Tray details</summary>
        <div class="field-row">
          <label class="field">
            Seedlings
            <input type="number" min={1} max={500} value={tray.count} onChange={(e) => commit((g) => updateTray(g, tray.id, { count: Number((e.currentTarget as HTMLInputElement).value) || 1 }))} />
          </label>
          <label class="field">
            In
            <select value={tray.container} onChange={(e) => commit((g) => updateTray(g, tray.id, { container: (e.currentTarget as HTMLSelectElement).value as Container }))}>
              {CONTAINERS.map((c) => (
                <option key={c} value={c}>
                  {CONTAINER_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label class="field">
          Move to
          <select
            value={`${tray.placeId}|${tray.shelf}|${tray.slot}`}
            onChange={(e) => {
              const [placeId, shelf, slot] = (e.currentTarget as HTMLSelectElement).value.split('|');
              commit((g) => moveTray(g, tray.id, { placeId: placeId!, shelf: Number(shelf), slot: Number(slot) }));
            }}
          >
            {places.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {Array.from({ length: p.shelves * p.slots }, (_, i) => {
                  const shelf = Math.floor(i / p.slots);
                  const slot = i % p.slots;
                  const there = trayAt(garden, { placeId: p.id, shelf, slot });
                  return (
                    <option key={i} value={`${p.id}|${shelf}|${slot}`}>
                      {p.shelves > 1 ? `Shelf ${shelf + 1}, ` : ''}space {slot + 1}
                      {there && there.id !== tray.id ? ' (swap)' : ''}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </label>
        <label class="field">
          Sown on
          <input type="date" value={tray.sownOn} onChange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            if (v) commit((g) => updateTray(g, tray.id, { sownOn: v }));
          }} />
        </label>
      </details>
      <div class="button-row">
        {stage !== 'hardening' && (
          <button
            type="button"
            class="btn"
            onClick={() => {
              commit((g) => failTray(g, tray.id, plant.commonName, today));
              app.notify(`${plant.commonName} tray removed, with a note in the journal.`, { undo: true });
            }}
          >
            Sowing failed
          </button>
        )}
        <button
          type="button"
          class="btn btn-danger"
          onClick={() => {
            commit((g) => removeTray(g, tray.id));
            app.notify(`${plant.commonName} tray deleted.`, { undo: true });
          }}
        >
          Delete
        </button>
      </div>
    </section>
  );
}
