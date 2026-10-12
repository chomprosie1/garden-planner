// The Garden tab for a garden kept as a list: no plan to draw, just your beds
// and areas as cards, each with a picture of it as it looks this week and its
// plants under it, drawn from the side, with where each is in its season. The
// same planting panel as on the plan opens in a sheet, so everything you can do
// to a planting there, you can do here.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { jobLabel, jobsFor } from '../../calendar/jobs';
import { formatLength } from '../../canvas/viewport';
import { microclimateOf } from '../../climate/microclimate';
import { bounds } from '../../geometry/polygon';
import { stageIn, timeline, type Step } from '../../lifecycle/projection';
import { trayFrom } from '../../lifecycle/shed';
import { currentStage, STAGE_LABEL, type LifeStage } from '../../lifecycle/stages';
import { deleteFeatures, featureLabel, KINDS, rectInfo, resizeRectAny, updateFeature, type Target } from '../../model/features';
import { todayIso } from '../../model/ids';
import { addListBed, copyListBed, LIST_KIND_LABEL, LIST_KINDS, LIST_SIZE, moveInList, nameListBeds, type ListKind } from '../../model/listLayout';
import { updateGarden, type Store } from '../../model/store';
import { LIGHT_LEVELS, type Feature, type Garden, type Light, type Plant, type Planting } from '../../model/types';
import { FILL_LABEL, fillsFor, type Fill } from '../../planting/fill';
import { fullText, howFull, isListed, listBeds, moveToListBed, placeInList, plantableBeds, plantOutInList, type ListHow } from '../../planting/listPlant';
import { isActive, plantCount, spacingStyle } from '../../planting/place';
import { checkGarden } from '../../planting/rules';
import { isSupport } from '../../planting/supports';
import { nextStep } from '../../planting/windows';
import { NextYearDialog } from '../NextYear';
import { ShoppingDialog } from '../Shopping';
import type { Prefs, PrefsStore } from '../../theme/prefs';
import { useApp } from '../appContext';
import { ClearBedsDialog } from '../ClearBeds';
import { Icon } from '../icons';
import { Inspector } from '../Inspector';
import { InspireButton } from '../Inspire';
import { MiniPlan } from '../MiniPlan';
import { MoreMenu } from '../MoreMenu';
import { SettingsButton } from '../SettingsButton';
import { PlantChooser } from '../PlantChooser';
import { PlantIcon } from '../PlantIcon';
import { SeasonPhoto } from '../SeasonPhoto';
import { BedSoil } from '../SoilFields';
import { usePlants } from '../usePlants';
import { useWeatherNow } from '../useWeather';
import type { PlanIntent } from './Plan';
import { InGround } from '../InGround';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  prefsStore: PrefsStore;
  intent?: PlanIntent | null;
  clearIntent?: () => void;
}

const LIGHT_TEXT: Record<Light, string> = { 'full-sun': 'Full sun', 'part-shade': 'Part shade', shade: 'Shade' };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Said when a new bed wouldn't fit inside the garden's outline. */
const OUTSIDE_NOTE = ' There wasn’t room inside your garden’s outline, so it’s set just outside it.';
/** What you might add several of at once. */
const SEVERAL: ListKind[] = ['bed', 'pot', 'planter', 'cold-frame'];

/** A bed's size in words: "1.2 × 2.4 m", or "30 cm across" for a pot; nothing for a fence or arch. */
function sizeText(f: Feature): string {
  if (isSupport(f)) return '';
  if (f.circle) return `${formatLength(f.circle.radiusMm * 2)} across`;
  const b = bounds(f.footprint);
  return b ? `${formatLength(b.maxX - b.minX)} × ${formatLength(b.maxY - b.minY)}` : '';
}

/** What it is, in a word or two: "Raised bed", "Pot", "Patch of ground". */
const kindText = (f: Feature) => (f.kind === 'surface' ? 'Patch of ground' : KINDS[f.kind].label);

export function Beds({ store, garden, userPlants, prefs, intent, clearIntent }: Props) {
  const app = useApp();
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const { weather } = useWeatherNow();
  const today = todayIso();
  const month = Number(today.slice(5, 7));
  const year = Number(today.slice(0, 4));
  const [sheet, setSheet] = useState<Target | null>(null);
  // The rows shown with the one opened, as one line: what's happened applies to them too.
  const [together, setTogether] = useState<string[]>([]);
  const [adding, setAdding] = useState<{ bedId?: string; plantId?: string; trayId?: string } | null>(null);
  const [addingBed, setAddingBed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [shopping, setShopping] = useState(false);
  const beds = listBeds(garden);
  const findings = useMemo(() => (plants ? checkGarden(garden, plantOf) : []), [garden, plantOf, plants]);
  const jobs = useMemo(() => {
    if (!plants) return [];
    const done = new Set(garden.jobsDone.map((j) => j.key));
    return jobsFor(garden, plantOf, month, year, { weeding: prefs.weeding, feeding: prefs.feeding, today, weather, watering: false }).filter((j) => !done.has(j.key));
  }, [garden, plantOf, plants, month, year, prefs.weeding, prefs.feeding, today, weather]);

  // What the rest of the app asks for: show a planting or bed, plant something, plant out a tray, clear beds.
  useEffect(() => {
    if (!intent) return;
    if (intent.kind === 'select') {
      const t = intent.target;
      const bedId = t.type === 'planting' ? garden.plantings.find((p) => p.id === t.id)?.featureId : t.type === 'feature' ? t.id : undefined;
      if (bedId) document.getElementById(`bed-${bedId}`)?.scrollIntoView({ block: 'center' });
      setSheet(t);
    } else if (intent.kind === 'plant') setAdding({ plantId: intent.id });
    else if (intent.kind === 'tray') setAdding({ trayId: intent.trayId });
    else if (intent.kind === 'clear') setClearing(true);
    clearIntent?.();
  }, [intent]);

  const growing = garden.plantings.filter((p) => isActive(p) && plants && plantOf(p.plantId).category !== 'weed').length;

  return (
    <div class="page beds-page">
      {prefs.photos !== 'off' && <SeasonPhoto month={prefs.photoMonth === 'auto' ? month : prefs.photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="page-band" />}
      <header class="page-head beds-head">
        <div>
          <h1 class="title">{garden.name}</h1>
          <p class="muted small">
            {plural(beds.length, 'bed or area', 'beds and areas')} · {plural(growing, 'planting', 'plantings')}
          </p>
        </div>
        <div class="beds-head-actions">
          <button type="button" class="btn btn-primary" onClick={() => setAddingBed(true)}>
            <Icon name="plus" size={18} /> Add a bed
          </button>
          <MoreMenu
            label="More for your garden"
            items={[
              { label: 'Shopping list', icon: 'check', onSelect: () => setShopping(true) },
              ...(garden.plantings.length ? [{ label: 'Draft next year…', icon: 'month' as const, onSelect: () => setDrafting(true) }] : []),
              ...(growing ? [{ label: 'Clear beds…', icon: 'trash' as const, onSelect: () => setClearing(true) }] : []),
              {
                label: 'Show it as a plan',
                icon: 'plan',
                onSelect: () => {
                  store.apply(updateGarden(({ view: _v, ...g }) => g));
                  app.notify('Now a plan: your beds are set out neatly, ready to arrange. Settings has the list again.', { undo: true });
                },
              },
            ]}
          />
          <SettingsButton />
        </div>
      </header>

      {beds.length === 0 && (
        <section class="card beds-empty">
          <h2>Your beds and pots</h2>
          <p>Add the places you grow in: a bed, a pot, a greenhouse, a patch of ground. Then put plants in them, and their jobs come each month.</p>
          <button type="button" class="btn btn-primary" onClick={() => setAddingBed(true)}>
            Add your first bed
          </button>
        </section>
      )}

      {plants && growing > 0 && <SeasonKey today={today} />}

      {plants &&
        beds.map((bed, i) => (
          <BedCard
            key={bed.id}
            bed={bed}
            first={i === 0}
            last={i === beds.length - 1}
            garden={garden}
            store={store}
            plantOf={plantOf}
            jobs={jobs.filter((j) => j.featureId === bed.id).map((j) => `${jobLabel(j)}: ${j.plant}`)}
            warnings={findings.filter((f) => f.level === 'warn' && (f.featureIds.includes(bed.id) || garden.plantings.some((p) => p.featureId === bed.id && f.plantingIds.includes(p.id)))).map((f) => f.message)}
            today={today}
            weather={weather}
            open={(t, ids = []) => (setSheet(t), setTogether(ids))}
            addPlant={() => setAdding({ bedId: bed.id })}
            edit={() => setEditing(bed.id)}
          />
        ))}
      {!plants && <p class="muted">Loading your plants…</p>}

      <p class="muted small beds-foot">
        Want to see it laid out?{' '}
        <a
          href="#/settings"
          onClick={(e) => {
            e.preventDefault();
            app.go('settings');
          }}
        >
          Switch to a plan
        </a>{' '}
        in Settings: your beds are set out neatly, ready to arrange.
      </p>

      {sheet && plants && (
        <Sheet close={() => setSheet(null)}>
          <Inspector
            store={store}
            garden={garden}
            sunLens={false}
            locked={false}
            selected={sheet}
            setSelected={(t) => (setSheet(t), setTogether([]))}
            setTool={() => {}}
            calibration={null}
            clearCalibration={() => {}}
            plantOf={plantOf}
            findings={findings}
            focusFinding={null}
            setFocusFinding={() => {}}
            sunJune={null}
            startPlanting={() => {
              const bedId = sheet.type === 'feature' ? sheet.id : undefined;
              setSheet(null);
              setAdding(bedId ? { bedId } : {});
            }}
            zoomTo={() => {}}
            list
            moveToBed={(id) => setMoving(id)}
            together={sheet.type === 'planting' ? together : []}
          />
        </Sheet>
      )}
      {addingBed && <AddBedDialog store={store} close={() => setAddingBed(false)} />}
      {adding && plants && <AddPlantDialog store={store} garden={garden} plants={plants} plantOf={plantOf} month={month} start={adding} close={() => setAdding(null)} newBed={() => (setAdding(null), setAddingBed(true))} />}
      {editing && <EditBedDialog store={store} garden={garden} bedId={editing} close={() => setEditing(null)} />}
      {moving && <MoveDialog store={store} garden={garden} plantOf={plantOf} plantingId={moving} close={() => setMoving(null)} />}
      {clearing && plants && <ClearBedsDialog garden={garden} store={store} plantOf={plantOf} close={() => setClearing(false)} />}
      {drafting && plants && <NextYearDialog garden={garden} store={store} plantOf={plantOf} close={() => setDrafting(false)} />}
      {shopping && plants && <ShoppingDialog garden={garden} store={store} plantOf={plantOf} feeding={prefs.feeding} close={() => setShopping(false)} />}
    </div>
  );
}

// ---------- A bed ----------

interface CardProps {
  bed: Feature;
  first: boolean;
  last: boolean;
  garden: Garden;
  store: Store;
  plantOf: (id: string) => Plant;
  jobs: string[];
  warnings: string[];
  today: string;
  weather: ReturnType<typeof useWeatherNow>['weather'];
  /** Opens a bed or planting; for a line of rows alike, the others too. */
  open: (t: Target, together?: string[]) => void;
  addPlant: () => void;
  edit: () => void;
}

function BedCard({ bed, first, last, garden, store, plantOf, jobs, warnings, today, weather, open, addPlant, edit }: CardProps) {
  const app = useApp();
  const here = garden.plantings.filter((p) => p.featureId === bed.id && isActive(p));
  const share = howFull(garden, bed, plantOf);
  const name = featureLabel(bed);
  // A fence, wall or arch with a climber on it: shown, but planted and changed on the plan.
  const support = isSupport(bed);
  // Rows of the same plant at the same point in their lives are one line: "Onion × 48 · 2 rows".
  const groups = useMemo(() => {
    const out = new Map<string, Planting[]>();
    for (const pl of here) {
      const k = `${pl.plantId}|${currentStage(pl)}|${pl.sownOn ?? ''}|${pl.sowBy ?? ''}|${pl.layout ?? 'single'}`;
      out.set(k, [...(out.get(k) ?? []), pl]);
    }
    return [...out.values()];
  }, [here]);
  return (
    <section class="card bed-card" id={`bed-${bed.id}`} aria-labelledby={`bed-title-${bed.id}`}>
      <div class="bed-card-head">
        <button type="button" class="bed-picture" aria-label={`About ${name}`} onClick={() => open({ type: 'feature', id: bed.id })}>
          <BedPicture garden={garden} bed={bed} plantOf={plantOf} />
        </button>
        <div class="bed-card-title">
          <h2 id={`bed-title-${bed.id}`} class="bed-title">
            {name}
          </h2>
          <p class="muted small">
            {kindText(bed)}
            {sizeText(bed) ? ` · ${sizeText(bed)}` : ''}
          </p>
          {!support && (
            <p class="small bed-tags">
              <span class={`bed-full ${share > 1.15 ? 'bed-over' : ''}`}>{fullText(share)}</span>
              {bed.light && <span class="bed-sun">☀ {LIGHT_TEXT[bed.light].toLowerCase()}</span>}
            </p>
          )}
        </div>
        <MoreMenu
          label={`More for ${name}`}
          items={[
            ...(!support ? [{ label: 'Name, size, sun and soil', icon: 'pencil' as const, onSelect: edit }] : []),
            ...(!support
              ? [
                  {
                    label: 'Another like this',
                    icon: 'copy' as const,
                    onSelect: () => {
                      let outside = false;
                      store.apply(
                        updateGarden((g) => {
                          const made = copyListBed(g, bed.id);
                          if (!made) return g;
                          outside = made[2];
                          return nameListBeds(made[0], isListed(made[0]), featureLabel);
                        }),
                      );
                      app.notify(`Another ${kindText(bed).toLowerCase()} added, the same size.${outside ? OUTSIDE_NOTE : ''}`, { undo: true });
                    },
                  },
                ]
              : []),
            ...(!first ? [{ label: 'Move up the list', icon: 'chevron' as const, onSelect: () => store.apply(updateGarden((g) => moveInList(g, bed.id, true, isListed(g)))) }] : []),
            ...(!last ? [{ label: 'Move down the list', icon: 'chevron' as const, onSelect: () => store.apply(updateGarden((g) => moveInList(g, bed.id, false, isListed(g)))) }] : []),
            {
              label: 'Delete',
              icon: 'trash',
              onSelect: () => {
                store.apply(updateGarden((g) => deleteFeatures(g, [bed.id])));
                app.notify(`${name} deleted${here.length ? `, with ${plural(here.length, 'planting', 'plantings')}` : ''}.`, { undo: true });
              },
            },
          ]}
        />
      </div>

      {jobs.length > 0 && (
        <ul class="bed-jobs" aria-label="This month">
          {jobs.slice(0, 3).map((j) => (
            <li key={j} class="chip chip-static">
              {j}
            </li>
          ))}
          {jobs.length > 3 && <li class="chip chip-static">{jobs.length - 3} more</li>}
        </ul>
      )}
      {warnings.slice(0, 2).map((w) => (
        <p key={w} class="small bed-warn">
          <Icon name="warn" size={15} /> {w}
        </p>
      ))}

      {here.length > 0 ? (
        <ul class="bed-plants">
          {groups.map((group) => {
            const pl = group[0]!;
            const plant = plantOf(pl.plantId);
            // Several rows or blocks alike are one line, with all their plants; the same plant at different points in
            // its life stays apart, told apart by how far along it is.
            const n = group.reduce((t, x) => t + plantCount(x, plant), 0);
            const unit = pl.layout === 'row' ? ['row', 'rows'] : pl.layout === 'block' ? ['block', 'blocks'] : ['planting', 'plantings'];
            const which = group.length > 1 && pl.layout !== 'single' && pl.layout ? plural(group.length, unit[0]!, unit[1]!) : undefined;
            return (
              <li key={pl.id}>
                <PlantingRow pl={pl} plant={plant} count={n} garden={garden} today={today} weather={weather} which={which} open={() => open({ type: 'planting', id: pl.id }, group.slice(1).map((x) => x.id))} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="muted bed-room">Room to grow. Add a plant, or ask for an idea.</p>
      )}

      {support ? (
        <p class="muted small">Climbers along fences, walls and arches are planted on the plan.</p>
      ) : (
        <div class="button-row bed-actions">
          <button type="button" class="btn" onClick={addPlant}>
            <Icon name="plus" size={16} /> Add a plant
          </button>
          {here.length === 0 && <InspireButton store={store} garden={garden} f={bed} />}
        </div>
      )}
    </section>
  );
}

/** The bed from above, as on the plan, with its plants as they look this week. */
function BedPicture({ garden, bed, plantOf }: { garden: Garden; bed: Feature; plantOf: (id: string) => Plant }) {
  const mini = useMemo(() => ({ ...garden, boundary: [], features: [bed], plantings: garden.plantings.filter((p) => p.featureId === bed.id && isActive(p)) }), [garden.plantings, bed]);
  return <MiniPlan garden={mini} width={84} height={84} pad={0.08} plantOf={plantOf} class="bed-mini" />;
}

/** One planting: drawn from the side as it is now, its name and how many, its stage and what's next, and its season. */
function PlantingRow({ pl, plant, count, garden, today, weather, which, open }: { pl: Planting; plant: Plant; count?: number; garden: Garden; today: string; weather: ReturnType<typeof useWeatherNow>['weather']; which?: string; open: () => void }) {
  const steps = useMemo(() => timeline(plant, pl, garden, today, weather), [plant, pl, garden, today, weather]);
  const now = stageIn(steps, today).stage;
  const marked = currentStage(pl);
  const n = count ?? plantCount(pl, plant);
  const next = nextStep(pl, plant, Number(today.slice(5, 7)), microclimateOf(garden, pl)?.climate ?? null);
  return (
    <button type="button" class={`planting-row ${marked === 'planned' ? 'is-planned' : ''}`} onClick={open}>
      <PlantIcon plant={plant} size={46} view="side" {...(now !== 'planned' && now !== 'cleared' ? { stage: now } : {})} />
      <span class="planting-row-main">
        <span class="planting-row-name">
          {plant.commonName}
          {n > 1 && <span class="muted"> × {n}</span>}
          {which && <span class="muted small"> · {which}</span>}
        </span>
        <span class="small">
          <span class={`status-chip status-${marked === 'planned' ? 'planned' : marked === 'sown' ? 'sown' : 'growing'}`}>{STAGE_LABEL[marked]}</span>
          {next && <span class="muted"> {next}</span>}
        </span>
        <SeasonBar steps={steps} today={today} />
      </span>
    </button>
  );
}

/** Where each stage falls in the year ahead (from two months back, for twelve months): seed, leaf, flower, crop, with today marked. Guesses are paler. */
const BAND: Partial<Record<LifeStage, string>> = { sown: 'seed', germinated: 'seed', hardening: 'seed', transplanted: 'leaf', vegetative: 'leaf', flowering: 'flower', harvesting: 'crop' };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** What the bars under each plant mean, once, above the beds. */
function SeasonKey({ today }: { today: string }) {
  const m = Number(today.slice(5, 7));
  const from = MONTH_SHORT[(m + 9) % 12]!;
  const to = MONTH_SHORT[(m + 8) % 12]!;
  return (
    <div class="season-key small">
      <p class="muted">
        The bar under each plant is its year, {from} to {to}, with today’s line:
      </p>
      <ul class="season-key-list">
        <li>
          <span class="season-swatch season-seed" /> Seed and seedling
        </li>
        <li>
          <span class="season-swatch season-leaf" /> Growing
        </li>
        <li>
          <span class="season-swatch season-flower" /> In flower
        </li>
        <li>
          <span class="season-swatch season-crop" /> To pick
        </li>
        <li>
          <span class="season-swatch season-leaf season-guess" /> Paler: expected
        </li>
      </ul>
    </div>
  );
}

function SeasonBar({ steps, today }: { steps: Step[]; today: string }) {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const from = new Date(Date.UTC(y, m - 3, 1));
  const start = from.getTime();
  const span = Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), 1) - start;
  const at = (iso: string | null) => (iso === null ? 0 : Math.min(1, Math.max(0, (Date.parse(iso) - start) / span)));
  const parts = steps
    .map((s, i) => ({ band: BAND[s.stage], from: at(s.date), to: i + 1 < steps.length ? at(steps[i + 1]!.date) : 1, guessed: s.guessed }))
    .filter((p) => p.band && p.to > p.from);
  if (!parts.length) return null;
  return (
    <svg class="season-bar" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
      <rect class="season-track" x="0" y="2" width="100" height="2" rx="1" />
      {parts.map((p, i) => (
        <rect key={i} class={`season-${p.band} ${p.guessed ? 'season-guess' : ''}`} x={p.from * 100} y="1" width={(p.to - p.from) * 100} height="4" rx="1.5" />
      ))}
      <rect class="season-today" x={at(today) * 100 - 0.4} y="0" width="0.8" height="6" />
    </svg>
  );
}

// ---------- Sheets and dialogs ----------

function Sheet({ close, children }: { close: () => void; children: preact.ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} class="dialog list-sheet" onClose={close} aria-label="Details">
      <button type="button" class="icon-btn list-sheet-close" aria-label="Close" onClick={() => ref.current?.close()}>
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}

function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return ref;
}

/** A size typed in metres, in mm; the fallback if it isn't a sensible one. */
const metres = (s: string, fallback: number) => {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 1000) : fallback;
};

/** Add a bed or area (or several alike): what it is, a name, and (if you like) its size and how sunny it is. */
function AddBedDialog({ store, close }: { store: Store; close: () => void }) {
  const app = useApp();
  const ref = useModal();
  const [kind, setKind] = useState<ListKind>('bed');
  const [name, setName] = useState('');
  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const [light, setLight] = useState<Light | ''>('');
  const [many, setMany] = useState('1');
  const usual = LIST_SIZE[kind];
  const add = () => {
    const size: [number, number] = kind === 'pot' ? [metres(w, usual[0]), metres(w, usual[0])] : [metres(w, usual[0]), metres(d, usual[1])];
    const label = name.trim() || LIST_KIND_LABEL[kind].replace(/^An? /, '').replace(/^./, (c) => c.toUpperCase());
    const n = SEVERAL.includes(kind) ? Math.max(1, Math.min(24, Math.round(Number(many) || 1))) : 1;
    let outside = false;
    let first = label;
    store.apply(
      updateGarden((g) => {
        let next = g;
        const ids: string[] = [];
        for (let i = 0; i < n; i++) {
          const [after, id, out] = addListBed(next, kind, label, size);
          next = light ? updateFeature(after, id, { light }) : after;
          ids.push(id);
          outside ||= out;
        }
        // Two or more alike are numbered as they're added: "Pot 1", "Pot 2".
        next = nameListBeds(next, isListed(next), featureLabel);
        first = featureLabel(next.features.find((f) => f.id === ids[0])!);
        return next;
      }),
    );
    const noun = LIST_KIND_LABEL[kind].replace(/^An? /, '').replace(/ or window box$/, '');
    app.notify(`${n > 1 ? `${n} ${noun}s added.` : `${first} added.`}${outside ? OUTSIDE_NOTE : ''}`, { undo: true });
    ref.current?.close();
  };
  return (
    <dialog ref={ref} class="dialog add-bed-dialog" aria-labelledby="add-bed-title" onClose={close}>
      <form
        class="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <h2 id="add-bed-title" class="title">
          Add a bed
        </h2>
        <fieldset class="choice">
          <legend>What is it?</legend>
          <div class="kind-grid">
            {LIST_KINDS.map((k) => (
              <label key={k} class={`kind-option kind-${k}`}>
                <input type="radio" name="list-kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>{LIST_KIND_LABEL[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label class="field">
          Name
          <input value={name} placeholder={kind === 'bed' ? 'Veg bed' : kind === 'pot' ? 'Patio pot' : kind === 'ground' ? 'The plot' : LIST_KIND_LABEL[kind].replace(/^An? /, '')} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <div class="size-row">
          <label class="field">
            {kind === 'pot' ? 'Across' : 'Width'}
            <span class="input-unit">
              <input inputMode="decimal" value={w} placeholder={String(usual[0] / 1000)} onInput={(e) => setW((e.currentTarget as HTMLInputElement).value)} />
              <span>m</span>
            </span>
          </label>
          {kind !== 'pot' && (
            <label class="field">
              Length
              <span class="input-unit">
                <input inputMode="decimal" value={d} placeholder={String(usual[1] / 1000)} onInput={(e) => setD((e.currentTarget as HTMLInputElement).value)} />
                <span>m</span>
              </span>
            </label>
          )}
        </div>
        <p class="muted small">A rough size is fine; leave it for the usual. It tells you how many plants fit.</p>
        {SEVERAL.includes(kind) && (
          <label class="field count-field">
            How many?
            <input type="number" inputMode="numeric" min={1} max={24} value={many} onInput={(e) => setMany((e.currentTarget as HTMLInputElement).value)} />
          </label>
        )}
        <label class="field">
          How sunny is it?
          <select value={light} onChange={(e) => setLight((e.currentTarget as HTMLSelectElement).value as Light | '')}>
            <option value="">Not sure</option>
            {LIGHT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LIGHT_TEXT[l]}
              </option>
            ))}
          </select>
        </label>
        <div class="button-row">
          <button type="submit" class="btn btn-primary">
            Add it
          </button>
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Add a plant: to which bed (if not chosen), which plant, and how many. From the shed, a tray goes in as it is. */
function AddPlantDialog({ store, garden, plants, plantOf, month, start, close, newBed }: { store: Store; garden: Garden; plants: Plant[]; plantOf: (id: string) => Plant; month: number; start: { bedId?: string; plantId?: string; trayId?: string }; close: () => void; newBed: () => void }) {
  const app = useApp();
  const ref = useModal();
  const beds = plantableBeds(garden);
  const [bedId, setBedId] = useState(start.bedId ?? (beds.length === 1 ? beds[0]!.id : ''));
  const [plantId, setPlantId] = useState(start.plantId ?? '');
  const [how, setHow] = useState<Fill | 'count'>('one');
  const [count, setCount] = useState('6');
  const [growing, setGrowing] = useState<string | null>(null);
  // What didn't fit last time, said above the beds to choose from for the rest.
  const [short, setShort] = useState<string | null>(null);
  const bed = beds.find((b) => b.id === bedId);
  const tray = start.trayId ? garden.trays?.find((t) => t.id === start.trayId) : undefined;
  const plant = tray ? plantOf(tray.plantId) : plantId ? plantOf(plantId) : null;
  const ways = bed && plant ? fillsFor(plant, bed) : [];
  // The usual way for this plant in this bed, until you choose.
  const [chosenHow, setChosenHow] = useState(false);
  useEffect(() => {
    if (!chosenHow && bed && plant) setHow(ways.includes('row') && bed.kind !== 'pot' && plant.art?.crop?.kind === 'root' ? 'row' : (ways[ways.length - 1] ?? 'one'));
  }, [bedId, plantId]);
  /** Back to the beds, with the plants still to place as a number. */
  const theRest = (text: string, left?: number) => {
    setShort(text);
    if (left !== undefined) {
      setHow('count');
      setCount(String(left));
      setChosenHow(true);
    }
    setBedId('');
  };

  const add = () => {
    if (!bed || !plant) return;
    const today = todayIso();
    const name = plant.commonName.toLowerCase();
    if (tray) {
      // As many as fit; the rest stay in the tray, for another bed.
      const { planted, left } = plantOutInList(garden, tray.id, bed, plantOf, today);
      const from = trayFrom(garden, tray.id);
      if (!planted) return theRest(`There’s no room left in ${featureLabel(bed)}. Choose another bed.`);
      store.apply(updateGarden((g) => plantOutInList(g, tray.id, bed, plantOf, today).garden));
      if (left) return theRest(`Room for ${planted} of ${planted + left} in ${featureLabel(bed)}: they’re planted out. Put the other ${left} in another bed?`);
      app.notify(`${plant.commonName} planted out ${from} into ${featureLabel(bed)}.`, { undo: true });
      ref.current?.close();
      return;
    }
    const n = Math.max(1, Math.min(500, Math.round(Number(count) || 1)));
    const way: ListHow = how === 'count' ? n : how;
    const { plantings, left, full } = placeInList(garden, bed, plant, way, plantOf, growing);
    if (!plantings.length) return theRest(`There’s no room left in ${featureLabel(bed)} for ${how === 'row' ? 'another row' : how === 'fill' ? 'more' : 'that'}. Choose another bed.`);
    store.apply(updateGarden((g) => ({ ...g, plantings: [...g.plantings, ...plantings] })));
    const total = plantings.reduce((t, pl) => t + plantCount(pl, plant), 0);
    if (left) return theRest(`Room for ${total} of ${total + left} in ${featureLabel(bed)}: they’re in. Put the other ${left} in another bed?`, left);
    app.notify(`${plural(total, name, `${name} plants`)} in ${featureLabel(bed)}.${full ? ' It’s full now.' : ''}`, { undo: true });
    ref.current?.close();
  };

  return (
    <dialog ref={ref} class="dialog add-plant-dialog" aria-labelledby="add-plant-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="add-plant-title" class="title">
          {tray ? `Plant out ${plantOf(tray.plantId).commonName.toLowerCase()}` : plant ? `Add ${plant.commonName.toLowerCase()}` : 'Add a plant'}
        </h2>
        {!bed ? (
          <>
            {short && (
              <p class="bed-warn" role="status">
                {short}
              </p>
            )}
            <p>Which bed or pot?</p>
            {beds.length === 0 && <p class="muted">There are no beds yet.</p>}
            <ul class="plain-list bed-pick">
              {beds.map((b) => (
                <li key={b.id}>
                  <button type="button" class="btn bed-pick-btn" onClick={() => setBedId(b.id)}>
                    <BedPicture garden={garden} bed={b} plantOf={plantOf} />
                    <span>{featureLabel(b)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" class="link-btn" onClick={newBed}>
              Add a new bed first
            </button>
          </>
        ) : !plant ? (
          <>
            <p class="muted small">In {featureLabel(bed)}.</p>
            <PlantChooser plants={plants} garden={garden} month={month} pick={setPlantId} />
          </>
        ) : (
          <>
            <div class="add-plant-head">
              <PlantIcon plant={plant} size={56} view="side" />
              <p>
                {tray ? `${plural(tray.count, 'seedling', 'seedlings')} ${trayFrom(garden, tray.id)}, ` : ''}in <strong>{featureLabel(bed)}</strong>
                {!start.bedId && (
                  <>
                    {' '}
                    <button type="button" class="link-btn small" onClick={() => setBedId('')}>
                      Change
                    </button>
                  </>
                )}
              </p>
            </div>
            {!tray && (
              <>
                <fieldset class="choice">
                  <legend>How many?</legend>
                  <div class="choice-row how-row">
                    {ways.map((w) => (
                      <label key={w} class="choice-option">
                        <input type="radio" name="how" checked={how === w} onChange={() => (setHow(w), setChosenHow(true))} />
                        <span>{FILL_LABEL[w]}</span>
                      </label>
                    ))}
                    <label class="choice-option">
                      <input type="radio" name="how" checked={how === 'count'} onChange={() => (setHow('count'), setChosenHow(true))} />
                      <span>A number</span>
                    </label>
                  </div>
                  {how === 'count' && (
                    <label class="field count-field">
                      Plants
                      <input type="number" inputMode="numeric" min={1} max={500} value={count} onInput={(e) => setCount((e.currentTarget as HTMLInputElement).value)} />
                    </label>
                  )}
                </fieldset>
                <InGround value={growing} set={setGrowing} label="Already in the ground (not just planned)" />
                {!start.plantId && (
                  <button type="button" class="link-btn small" onClick={() => setPlantId('')}>
                    Choose another plant
                  </button>
                )}
              </>
            )}
          </>
        )}
        <div class="button-row">
          {bed && plant && (
            <button type="button" class="btn btn-primary" onClick={add}>
              {tray ? 'Plant out' : 'Add'}
            </button>
          )}
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** A bed's name, size, sun and soil. */
function EditBedDialog({ store, garden, bedId, close }: { store: Store; garden: Garden; bedId: string; close: () => void }) {
  const ref = useModal();
  const bed = garden.features.find((f) => f.id === bedId);
  if (!bed) return null;
  const set = (patch: Partial<Feature>) => store.apply(updateGarden((g) => updateFeature(g, bed.id, patch)));
  // A pot by how far across; a bed drawn as a rectangle by its width and length. A shape drawn by hand keeps its size.
  const rect = !bed.circle && !bed.smooth ? rectInfo(bed.footprint) : null;
  const m = (mm: number) => String(Math.round(mm / 10) / 100);
  return (
    <dialog ref={ref} class="dialog" aria-labelledby="edit-bed-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="edit-bed-title" class="title">
          {featureLabel(bed)}
        </h2>
        <label class="field">
          Name
          <input value={bed.name ?? ''} placeholder={kindText(bed)} onChange={(e) => set({ name: (e.currentTarget as HTMLInputElement).value.trim() || undefined })} />
        </label>
        {(bed.circle || rect) && (
          <div class="size-row">
            {bed.circle ? (
              <label class="field">
                Across
                <span class="input-unit">
                  <input inputMode="decimal" value={m(bed.circle.radiusMm * 2)} onChange={(e) => set({ circle: { ...bed.circle!, radiusMm: Math.round(metres((e.currentTarget as HTMLInputElement).value, bed.circle!.radiusMm * 2) / 2) } })} />
                  <span>m</span>
                </span>
              </label>
            ) : (
              rect && (
                <>
                  <label class="field">
                    Width
                    <span class="input-unit">
                      <input inputMode="decimal" value={m(rect.w)} onChange={(e) => set({ footprint: resizeRectAny(bed.footprint, metres((e.currentTarget as HTMLInputElement).value, rect.w), rect.h)! })} />
                      <span>m</span>
                    </span>
                  </label>
                  <label class="field">
                    Length
                    <span class="input-unit">
                      <input inputMode="decimal" value={m(rect.h)} onChange={(e) => set({ footprint: resizeRectAny(bed.footprint, rect.w, metres((e.currentTarget as HTMLInputElement).value, rect.h))! })} />
                      <span>m</span>
                    </span>
                  </label>
                </>
              )
            )}
          </div>
        )}
        <label class="field">
          How sunny is it?
          <select value={bed.light ?? ''} onChange={(e) => set({ light: ((e.currentTarget as HTMLSelectElement).value || undefined) as Light | undefined })}>
            <option value="">Not sure</option>
            {LIGHT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LIGHT_TEXT[l]}
              </option>
            ))}
          </select>
        </label>
        <p class="muted small">Plants that want more sun, or less, are flagged on the bed.</p>
        <BedSoil store={store} garden={garden} bed={bed} />
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Move a planting to another bed. */
function MoveDialog({ store, garden, plantOf, plantingId, close }: { store: Store; garden: Garden; plantOf: (id: string) => Plant; plantingId: string; close: () => void }) {
  const app = useApp();
  const ref = useModal();
  const pl = garden.plantings.find((p) => p.id === plantingId);
  if (!pl) return null;
  const others = plantableBeds(garden).filter((b) => b.id !== pl.featureId);
  return (
    <dialog ref={ref} class="dialog" aria-labelledby="move-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="move-title" class="title">
          Move {plantOf(pl.plantId).commonName.toLowerCase()}
        </h2>
        {others.length === 0 ? (
          <p class="muted">There's no other bed to move it to. Add one first.</p>
        ) : (
          <ul class="plain-list bed-pick">
            {others.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  class="btn bed-pick-btn"
                  onClick={() => {
                    store.apply(updateGarden((g) => moveToListBed(g, plantingId, b.id, plantOf)));
                    app.notify(`Moved to ${featureLabel(b)}.`, { undo: true });
                    ref.current?.close();
                  }}
                >
                  <BedPicture garden={garden} bed={b} plantOf={plantOf} />
                  <span>{featureLabel(b)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div class="button-row">
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
