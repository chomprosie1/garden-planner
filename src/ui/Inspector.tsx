// The details panel beside the plan (a sheet on phones). What it shows
// depends on what's selected and on the part of the plan you're in.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { parseLength } from '../canvas/snap';
import { climateOf, climateText, coverEffects, DEFAULT_CLIMATE, isCover, microclimateAt, microclimateOf, placeFor, type CoverKind } from '../climate/microclimate';
import { addPlace, makePlace, plantOutMonthsUnder } from '../lifecycle/shed';
import { formatArea, formatLength } from '../canvas/viewport';
import { lineLength, perimeter, polygonArea } from '../geometry/polygon';
import { monthRanges } from '../library/library';
import {
  centreLineOf,
  deleteFeatures,
  duplicateFeature,
  featureLabel,
  geometryOf,
  KINDS,
  kindsWithGeometry,
  MATERIAL_LABEL,
  pivotOf,
  placeLabel,
  rectInfo,
  resizeRectAny,
  restack,
  setSmooth,
  updateFeature,
  type Target,
} from '../model/features';
import { todayIso } from '../model/ids';
import { photosOf } from '../model/notes';
import { updateGarden, type Store } from '../model/store';
import { asTree, findTrees, treeSizeText, treeType } from '../model/trees';
import { MATERIALS, PLANT_SIZES, type Climate, type Feature, type FeatureKind, type Garden, type Material, type Plant, type Planting, type Point } from '../model/types';
import {
  clearBed,
  deletePlanting,
  harvestPlantings,
  canHold,
  isContainer,
  isSoftGround,
  plantCount,
  plantingStatus,
  plantPositions,
  restorePlanting,
  rowSpacingOf,
  setPlantingMm,
  setPlantingSize,
  setRowCount,
  SIZE_LABEL,
  sizedPlant,
  spreadOf,
  updatePlanting,
} from '../planting/place';
import { formatHours, sunNeeded, type Finding } from '../planting/rules';
import { expectedText, nextInMonths, shortDate, timeline } from '../lifecycle/projection';
import { batchDates, batchesOf, batchLabel, canSowInBatches, maxBatches, MIN_BATCHES, setSowBy, splitIntoBatches } from '../planting/batches';
import { currentStage, sowingOf, STAGE_LABEL, stageDate } from '../lifecycle/stages';
import { deleteBlob, saveBlob } from '../storage/idb';
import { areaHours, averageHours, lightBand, type SunGrid } from '../sun/hours';
import { useApp } from './appContext';
import { FindingsList } from './Findings';
import { UseLocationButton } from './GardenSettings';
import { formatDate, NotesSection } from './NotesSection';
import { deletedMessage, type Tool } from './PlanCanvas';
import { PlantIcon } from './PlantIcon';
import { StageAdvice, StageCorrect, StageRail, WhatsHappened } from './PlantingStages';
import { MoreMenu } from './MoreMenu';
import { PanelTabs } from './PanelTabs';
import { useWeatherNow } from './useWeather';

interface Props {
  store: Store;
  garden: Garden;
  /** The sun lenses show how sunny each bed and planting is. */
  sunLens: boolean;
  /** The layout is locked: beds and paths show their details but can't be reshaped here. */
  locked: boolean;
  selected: Target | null;
  setSelected: (t: Target | null) => void;
  setTool: (t: Tool) => void;
  calibration: [Point, Point] | null;
  clearCalibration: () => void;
  plantOf: (id: string) => Plant;
  findings: Finding[];
  focusFinding: string | null;
  setFocusFinding: (id: string | null) => void;
  onPickFinding?: (f: Finding) => void;
  /** Sun hours on the 15th of a month (June, or the month shown in the sun view), for how sunny a bed or planting is. */
  sunJune: SunGrid | null;
  /** Opens the Plant tool. */
  startPlanting: () => void;
  /** Zooms the plan to these points. */
  zoomTo: (pts: Point[]) => void;
}

type Shared = Omit<Props, 'calibration' | 'clearCalibration' | 'selected' | 'setTool'>;

const LAYOUT_LABEL = { single: 'Plant', row: 'Row', block: 'Block' } as const;
const BAND_LABEL = { 'full-sun': 'full sun', 'part-shade': 'part shade', shade: 'shade' } as const;

/** A number field that saves on Enter or when you leave it, so each edit is one undo step. */
function NumberField({ label, value, unit, min = 0, max, onCommit }: { label: string; value: number; unit: string; min?: number; max?: number; onCommit: (n: number) => void }) {
  return (
    <label class="field">
      {label}
      <span class="input-unit">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number((e.currentTarget as HTMLInputElement).value);
            if (Number.isFinite(n) && n >= min && (max === undefined || n <= max) && n !== value) onCommit(Math.round(n));
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

// ---------- Collapsible sections, remembered on this device ----------

const SECTIONS_KEY = 'garden-planner:sections';
function readSections(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Section({ id, title, open: openByDefault = true, children }: { id: string; title: string; open?: boolean; children: ComponentChildren }) {
  const [open, setOpen] = useState(() => readSections()[id] ?? openByDefault);
  return (
    <details
      class="inspector-section"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (now === open) return;
        setOpen(now);
        try {
          localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...readSections(), [id]: now }));
        } catch {
          // Storage blocked: the section still opens and closes, it just won't be remembered.
        }
      }}
    >
      <summary>
        <h3>{title}</h3>
      </summary>
      <div class="section-body">{children}</div>
    </details>
  );
}

const Heading = ({ eyebrow, title, plant }: { eyebrow: string; title: string; plant?: Plant }) => (
  <div class={plant ? 'panel-head-plant' : undefined}>
    {plant && <PlantIcon plant={plant} size={44} />}
    <div>
      <p class="eyebrow muted">{eyebrow}</p>
      <h2 class="panel-title">{title}</h2>
    </div>
  </div>
);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function SunFact({ hours, month }: { hours: number; month: number }) {
  return (
    <p class="sun-fact">
      <span aria-hidden="true">☀</span> About <strong>{formatHours(hours)}</strong> of direct sun a day in {MONTHS[month - 1]}: {BAND_LABEL[lightBand(hours)]}.
    </p>
  );
}

// ---------- Which panel ----------

export function Inspector(props: Props) {
  const { store, garden, selected, setSelected, setTool, calibration, clearCalibration } = props;
  if (calibration) return <Calibrate store={store} garden={garden} points={calibration} done={clearCalibration} />;

  if (selected?.type === 'planting') {
    const pl = garden.plantings.find((x) => x.id === selected.id);
    if (pl) return <PlantingPanel {...props} pl={pl} />;
  }
  const f = selected?.type === 'feature' ? garden.features.find((x) => x.id === selected.id) : undefined;
  if (f) {
    if (isContainer(f)) return <BedPanel {...props} bed={f} />;
    return <FeaturePanel {...props} f={f} variant={props.sunLens ? 'sun' : 'layout'} />;
  }

  if (selected?.type === 'boundary') {
    const b = garden.boundary;
    return (
      <div class="inspector-body">
        <Heading eyebrow="Boundary" title="The edge of your garden" />
        <dl class="facts">
          <dt>Area</dt>
          <dd>{b.length >= 3 ? formatArea(polygonArea(b)) : '–'}</dd>
          <dt>Perimeter</dt>
          <dd>{b.length >= 3 ? formatLength(perimeter(b)) : '–'}</dd>
          <dt>Corners</dt>
          <dd>{b.length}</dd>
        </dl>
        <p class="muted small">Drag a corner to move it. Double-click an edge to add a corner. Select a corner and press Delete to remove it.</p>
        <button type="button" class="btn" onClick={() => setTool('boundary')}>
          Redraw the boundary
        </button>
      </div>
    );
  }

  // Nothing picked: the whole garden. Its sun first when a sun lens is on.
  return (
    <>
      {props.sunLens && <SunOverview {...props} />}
      <PlantingOverview {...props} />
      <GardenPanel store={store} garden={garden} setSelected={setSelected} setTool={setTool} embedded />
    </>
  );
}

// ---------- Layout ----------

/** Which tree it is, and small, medium or large: sets its name, canopy, height and shade together. */
function TreeTypePicker({ f, set }: { f: Feature; set: (patch: Partial<Feature>) => void }) {
  const type = treeType(f.treeType);
  const size = f.size ?? 'medium';
  return (
    <>
      <label class="field">
        Kind of tree
        <select
          value={type?.id ?? ''}
          onChange={(e) => {
            const next = treeType((e.currentTarget as HTMLSelectElement).value);
            if (next) set(asTree(f, next, size));
            else set({ treeType: undefined, size: undefined });
          }}
        >
          <option value="">Not chosen</option>
          {findTrees('').map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      {type && (
        <fieldset class="choice">
          <legend>Size</legend>
          <div class="happened-chips">
            {PLANT_SIZES.map((s) => (
              <button key={s} type="button" class="chip" aria-pressed={size === s} title={treeSizeText(type, s)} onClick={() => set(asTree(f, type, s))}>
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>
          <p class="muted small">
            {type.latinName}. {treeSizeText(type, size)}, {type.evergreen ? 'evergreen' : 'loses its leaves in winter'}. Type an exact size below if you know it.
          </p>
        </fieldset>
      )}
    </>
  );
}

/** Bulbs in a lawn, wildflowers in gravel: what's planted on a stretch of ground, to pick one. */
function GrowingOnGround({ garden, f, plantOf, setSelected }: { garden: Garden; f: Feature; plantOf: (id: string) => Plant; setSelected: (t: Target | null) => void }) {
  const growing = garden.plantings.filter((p) => p.featureId === f.id && !p.removedOn);
  if (!growing.length) return <p class="muted small">Plants can go here too: bulbs in a lawn, or a tree. Drop one from Plants below the plan.</p>;
  return (
    <Section id="growing" title={`Growing here (${growing.length})`}>
      <ul class="layer-list">
        {growing.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setSelected({ type: 'planting', id: p.id })}>
              <PlantIcon plant={plantOf(p.plantId)} size={22} />
              <span>{plantOf(p.plantId).commonName}</span>
              <span class="muted small">{STAGE_LABEL[currentStage(p)]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FeaturePanel({ store, garden, f, variant, setSelected, sunJune, plantOf, embedded = false }: Shared & { f: Feature; variant: 'layout' | 'sun'; embedded?: boolean }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const geometry = geometryOf(f);
  // Rectangles at any angle keep a width and depth to type.
  const rect = geometry === 'area' && !f.smooth ? rectInfo(f.footprint) : null;
  const set = (patch: Partial<Feature>) => commit((g) => updateFeature(g, f.id, patch));
  const kindOptions = kindsWithGeometry(geometry);
  const shading = f.opacityInLeaf !== undefined || f.kind === 'tree' || f.kind === 'hedge';
  const sun = variant === 'sun' && sunJune && isContainer(f) ? areaHours(sunJune, f.footprint) : null;

  const shade = (
    <fieldset class="choice">
      <legend>How much light it blocks</legend>
      {(f.kind === 'tree' || f.kind === 'hedge') && (
        <label class="check">
          <input type="checkbox" checked={!!f.deciduous} onChange={(e) => set({ deciduous: (e.currentTarget as HTMLInputElement).checked })} />
          Loses its leaves in winter
        </label>
      )}
      <label class="field">
        Light blocked {f.deciduous ? 'in leaf' : ''}: {Math.round((f.opacityInLeaf ?? 1) * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round((f.opacityInLeaf ?? 1) * 100)}
          onChange={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value) / 100;
            set(f.deciduous ? { opacityInLeaf: v } : { opacityInLeaf: v, opacityBare: v });
          }}
        />
      </label>
      {f.deciduous && (
        <label class="field">
          Light blocked when bare: {Math.round((f.opacityBare ?? 0.2) * 100)}%
          <input type="range" min={0} max={100} step={5} value={Math.round((f.opacityBare ?? 0.2) * 100)} onChange={(e) => set({ opacityBare: Number((e.currentTarget as HTMLInputElement).value) / 100 })} />
        </label>
      )}
    </fieldset>
  );
  const height = <NumberField label="Height" unit="mm" value={f.heightMm ?? 0} max={40000} onCommit={(heightMm) => set({ heightMm })} />;

  if (variant === 'sun')
    return (
      <div class="inspector-body">
        <Heading eyebrow={KINDS[f.kind].label} title={featureLabel(f)} />
        {sun !== null && <SunFact hours={sun} month={sunJune!.month} />}
        <p class="muted small">Its height and how much light it blocks decide the shade it casts.</p>
        {height}
        {shading && shade}
      </div>
    );

  return (
    <div class={embedded ? 'feature-details' : 'inspector-body'}>
      {!embedded && <Heading eyebrow={KINDS[f.kind].label} title={featureLabel(f)} />}
      <label class="field">
        Name
        <input
          value={f.name ?? ''}
          placeholder={f.kind === 'surface' ? MATERIAL_LABEL[f.material ?? 'lawn'] : KINDS[f.kind].label}
          maxLength={40}
          onChange={(e) => {
            const name = (e.currentTarget as HTMLInputElement).value.trim();
            set(name ? { name } : { name: undefined });
          }}
        />
      </label>
      {kindOptions.length > 1 && (
        <label class="field">
          Kind
          <select
            value={f.kind}
            onChange={(e) => {
              const kind = (e.currentTarget as HTMLSelectElement).value as FeatureKind;
              // Only surfaces and paths are made of something; a bed made of lawn would be drawn as grass.
              const material = kind === 'surface' ? (f.material ?? 'lawn') : kind === 'path' ? f.material : undefined;
              set({ kind, heightMm: KINDS[kind].heightMm, material });
            }}
          >
            {kindOptions.map((k) => (
              <option key={k} value={k}>
                {KINDS[k].label}
              </option>
            ))}
          </select>
        </label>
      )}

      {(f.kind === 'surface' || f.kind === 'path') && <MaterialPicker f={f} set={set} />}
      {!embedded && isSoftGround(f) && <GrowingOnGround garden={garden} f={f} plantOf={plantOf} setSelected={setSelected} />}
      {f.kind === 'bed' && (
        <label class="field">
          Edging
          <select value={f.edging ?? ''} onChange={(e) => set({ edging: ((e.currentTarget as HTMLSelectElement).value || undefined) as Feature['edging'] })}>
            <option value="">None</option>
            <option value="timber">Timber boards</option>
            <option value="brick">Brick</option>
            <option value="stone">Stone</option>
          </select>
        </label>
      )}
      {geometry !== 'circle' && (
        <label class="check">
          <input type="checkbox" checked={!!f.smooth} onChange={() => commit((g) => setSmooth(g, f.id, !f.smooth))} />
          Curved edges
        </label>
      )}

      {f.kind === 'tree' && <TreeTypePicker f={f} set={set} />}

      <Section id="size" title="Size">
        {rect && (
          <div class="field-row">
            <NumberField label="Width" unit="mm" value={Math.round(rect.w)} min={50} onCommit={(w) => set({ footprint: resizeRectAny(f.footprint, w, rect.h)! })} />
            <NumberField label="Depth" unit="mm" value={Math.round(rect.h)} min={50} onCommit={(h) => set({ footprint: resizeRectAny(f.footprint, rect.w, h)! })} />
          </div>
        )}
        {geometry === 'line' && <NumberField label="Thickness" unit="mm" value={f.widthMm ?? 100} min={10} onCommit={(widthMm) => set({ widthMm })} />}
        {geometry === 'circle' && f.circle && (
          <NumberField
            label={f.kind === 'tree' ? 'Canopy spread (across)' : 'Diameter'}
            unit="mm"
            value={f.circle.radiusMm * 2}
            min={100}
            onCommit={(d) => set({ circle: { ...f.circle!, radiusMm: Math.round(d / 2) } })}
          />
        )}
        {height}
        <dl class="facts">
          {geometry === 'line' && f.line ? (
            <>
              <dt>Length</dt>
              <dd>{formatLength(lineLength(centreLineOf(f)))}</dd>
            </>
          ) : (
            <>
              <dt>Area</dt>
              <dd>{formatArea(polygonArea(f.footprint))}</dd>
            </>
          )}
          {geometry === 'area' && !rect && (
            <>
              <dt>Corners</dt>
              <dd>{(f.controls ?? f.footprint).length}</dd>
            </>
          )}
        </dl>
      </Section>

      {shading && (
        <Section id="shade" title="Shade it casts" open={false}>
          {shade}
        </Section>
      )}

      <p class="muted small">
        Drag to move.{' '}
        {geometry === 'circle'
          ? 'Drag the square handle to resize.'
          : f.smooth
            ? 'The curve runs through the square handles: drag one to reshape it; double-click near the dotted line to add one.'
            : 'Drag a corner to reshape; double-click an edge to add a corner.'}{' '}
        Arrow keys nudge by 10 mm (100 mm with Shift).
      </p>
      <div class="button-row">
        <button
          type="button"
          class="btn"
          onClick={() => {
            const made = { id: null as string | null };
            commit((g) => {
              const [next, id] = duplicateFeature(g, f.id);
              made.id = id;
              return next;
            });
            if (made.id) setSelected({ type: 'feature', id: made.id });
          }}
        >
          Duplicate
        </button>
        <button type="button" class="btn" onClick={() => commit((g) => restack(g, f.id, 'top'))}>
          Bring to front
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onClick={() => {
            const text = deletedMessage(garden, f);
            commit((g) => deleteFeatures(g, [f.id]));
            setSelected(null);
            app.notify(text, { undo: true });
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** What a surface or path is made of, as a row of swatches. */
function MaterialPicker({ f, set }: { f: Feature; set: (patch: Partial<Feature>) => void }) {
  const path = f.kind === 'path';
  const current = f.material ?? (path ? null : 'lawn');
  const options: (Material | null)[] = path ? [null, ...MATERIALS.filter((m) => m !== 'meadow')] : [...MATERIALS];
  return (
    <fieldset class="choice">
      <legend>Made of</legend>
      <div class="material-picker">
        {options.map((m) => (
          <label key={m ?? 'plain'} class="material-option">
            <input type="radio" name={`material-${f.id}`} checked={current === m} onChange={() => set({ material: m ?? undefined })} />
            <span class={`material-swatch material-${m ?? 'plain'}`} aria-hidden="true" />
            <span>{m ? MATERIAL_LABEL[m] : 'Plain'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GardenPanel({ store, garden, setSelected, setTool, embedded = false }: { store: Store; garden: Garden; setSelected: (t: Target | null) => void; setTool: (t: Tool) => void; embedded?: boolean }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const b = garden.boundary;
  const pickTrace = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    await saveBlob('trace', file);
    const xs = b.map((p) => p[0]);
    const ys = b.map((p) => p[1]);
    const width = b.length >= 2 ? Math.max(...xs) - Math.min(...xs) : 10000;
    commit((g) => ({ ...g, trace: { x: b.length ? Math.min(...xs) : 0, y: b.length ? Math.min(...ys) : 0, widthMm: width || 10000, opacity: 0.5, calibrated: false } }));
    setTool('calibrate');
  };

  return (
    <div class={embedded ? 'inspector-body inspector-more' : 'inspector-body'}>
      {!embedded && <Heading eyebrow="Garden" title={garden.name} />}
      {b.length >= 3 ? (
        <dl class="facts">
          <dt>Area</dt>
          <dd>{formatArea(polygonArea(b))}</dd>
          <dt>Perimeter</dt>
          <dd>{formatLength(perimeter(b))}</dd>
        </dl>
      ) : (
        <p class="muted small">No boundary. That's fine for a balcony or a few pots; for a garden, Draw → Boundary marks its edge.</p>
      )}

      <Section id="layers" title="On the plan">
        {garden.features.length === 0 ? (
          <p class="muted small">Nothing yet. Beds, paths, fences and trees you draw are listed here.</p>
        ) : (
          <ul class="layer-list">
            {[...garden.features].reverse().map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setSelected({ type: 'feature', id: f.id })}>
                  <span class={`swatch swatch-${f.kind}${f.material ? ` material-${f.material}` : ''}`} aria-hidden="true" />
                  <span>{featureLabel(f)}</span>
                  <span class="muted small">{KINDS[f.kind].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="north" title="North">
        <NumberField label="Degrees clockwise from the top of the plan" unit="°" value={garden.northRotationDeg} min={0} max={359} onCommit={(n) => commit((g) => ({ ...g, northRotationDeg: n }))} />
        <p class="muted small">Or drag the north arrow on the plan. Check true north against a map: every shadow depends on it.</p>
      </Section>

      <Section id="trace" title="Trace a photo" open={false}>
        {!garden.trace ? (
          <>
            <p class="muted small">Load a photo or screenshot of your garden from above, then trace over it. It stays on this device and is not part of the backup file.</p>
            <label class="btn">
              Choose a photo…
              <input type="file" accept="image/*" hidden onChange={pickTrace} />
            </label>
          </>
        ) : (
          <>
            <label class="field">
              See-through: {Math.round(garden.trace.opacity * 100)}%
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(garden.trace.opacity * 100)}
                onChange={(e) => commit((g) => ({ ...g, trace: { ...g.trace!, opacity: Number((e.currentTarget as HTMLInputElement).value) / 100 } }))}
              />
            </label>
            <p class="muted small">{garden.trace.calibrated ? 'Scale set.' : 'Set the scale: click two points on the photo a known distance apart.'}</p>
            <div class="button-row">
              <button type="button" class="btn" onClick={() => setTool('calibrate')}>
                Set scale
              </button>
              <button type="button" class="btn" onClick={() => setTool('trace')}>
                Move photo
              </button>
              <button
                type="button"
                class="btn btn-danger"
                onClick={async () => {
                  commit((g) => {
                    const { trace: _drop, ...rest } = g;
                    return rest;
                  });
                  await deleteBlob('trace');
                  app.notify('Photo removed.');
                }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </Section>
      <p class="assumption">Assumes flat ground.</p>
    </div>
  );
}

function Calibrate({ store, garden, points, done }: { store: Store; garden: Garden; points: [Point, Point]; done: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const measured = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]);
  const apply = (e: Event) => {
    e.preventDefault();
    const real = parseLength(text);
    if (!real) return setError('Type a length, such as 4200 or 4.2 m.');
    if (!garden.trace || measured === 0) return done();
    const k = real / measured;
    const [ax, ay] = points[0];
    const t = garden.trace;
    // Scale about the first point so it stays where it is.
    store.apply(
      updateGarden((g) => ({
        ...g,
        trace: { ...t, widthMm: Math.round(t.widthMm * k), x: Math.round(ax - (ax - t.x) * k), y: Math.round(ay - (ay - t.y) * k), calibrated: true },
      })),
    );
    done();
  };
  return (
    <form class="inspector-body" onSubmit={apply}>
      <Heading eyebrow="Trace photo" title="Set the scale" />
      <p>The two points you clicked are {formatLength(measured)} apart on the plan. How far apart are they really?</p>
      <label class="field">
        Real distance
        <input autoFocus value={text} placeholder="e.g. 4200 or 4.2 m" onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {error && <p class="message">{error}</p>}
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          Set scale
        </button>
        <button type="button" class="btn" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- Planting ----------

const findingsProps = (p: Shared) => ({ focus: p.focusFinding, setFocus: p.setFocusFinding, ...(p.onPickFinding ? { onPick: p.onPickFinding } : {}) });

/** Planting, with nothing selected: the checks, and every bed with what's in it. */
function PlantingOverview(props: Props) {
  const { garden, findings, plantOf, setSelected, startPlanting } = props;
  // Beds, pots and planters, and a lawn or other ground once something's planted in it.
  const beds = garden.features.filter((f) => isContainer(f) || (isSoftGround(f) && garden.plantings.some((p) => p.featureId === f.id && !p.removedOn)));
  const growing = garden.plantings.filter((p) => !p.removedOn);
  const warnings = findings.filter((f) => f.level === 'warn').length;
  return (
    <div class="inspector-body">
      <Heading eyebrow="Your garden" title={garden.name} />
      {!garden.features.some(canHold) ? (
        <div class="next-step">
          <p>Plants go in beds, pots and planters, or on a lawn. Drag one in from <strong>Beds and pots</strong> below the plan.</p>
        </div>
      ) : (
        <button type="button" class="btn btn-primary" onClick={startPlanting}>
          Plant something
        </button>
      )}

      {growing.length > 0 && (
        <Section id="checks" title={warnings ? `Plant checks (${warnings})` : 'Plant checks'}>
          <p class="small">{warnings === 0 ? 'No problems found with spacing, neighbours or light.' : `${warnings} ${warnings === 1 ? 'thing' : 'things'} to look at. Pick one to see it on the plan.`}</p>
          <FindingsList findings={findings} {...findingsProps(props)} />
          <p class="assumption">Light is checked against the sun each planting gets on 15 June. Assumes flat ground.</p>
        </Section>
      )}

      {beds.length > 0 && (
        <Section id="beds" title="Beds and plants">
          <ul class="bed-tree">
            {beds.map((b) => {
              const here = growing.filter((p) => p.featureId === b.id);
              return (
                <li key={b.id}>
                  <button type="button" class="bed-tree-bed" onClick={() => setSelected({ type: 'feature', id: b.id })}>
                    <span class={`swatch swatch-${b.kind}`} aria-hidden="true" />
                    <span>{featureLabel(b)}</span>
                    <span class="muted small">{here.length ? `${here.length} ${here.length === 1 ? 'planting' : 'plantings'}` : 'empty'}</span>
                  </button>
                  {here.length > 0 && (
                    <ul>
                      {here.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => setSelected({ type: 'planting', id: p.id })}>
                            <PlantIcon plant={plantOf(p.plantId)} size={22} />
                            <span>{plantOf(p.plantId).commonName}</span>
                            <span class="muted small">{STAGE_LABEL[currentStage(p)]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** A bed while planting: its sun, what's growing, its checks, what grew before, and notes. */
function BedPanel(props: Shared & { bed: Feature }) {
  const { store, garden, bed, setSelected, startPlanting, plantOf, findings, sunJune, zoomTo } = props;
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const here = garden.plantings.filter((p) => p.featureId === bed.id);
  const growing = here.filter((p) => !p.removedOn);
  const past = here.filter((p) => p.removedOn).sort((a, b) => b.removedOn!.localeCompare(a.removedOn!));
  const mine = findings.filter((f) => f.featureIds.includes(bed.id));
  const sun = sunJune ? areaHours(sunJune, bed.footprint) : null;
  // A bed inside a greenhouse is under cover too.
  const over = isCover(bed) ? null : microclimateAt(garden, pivotOf(bed));
  return (
    <div class="inspector-body">
      <Heading eyebrow={KINDS[bed.kind].label} title={featureLabel(bed)} />
      {sun !== null && <SunFact hours={sun} month={sunJune!.month} />}
      {over && (
        <p class="cover-fact">
          Under cover in {featureLabel(over.feature)}: {climateText(over.climate)}.
        </p>
      )}
      <div class="button-row">
        <button type="button" class="btn btn-primary" onClick={startPlanting}>
          Add plants
        </button>
        <button type="button" class="btn" onClick={() => zoomTo(bed.footprint)}>
          Zoom to bed
        </button>
      </div>

      <Section id="growing" title={`Growing here${growing.length ? ` (${growing.length})` : ''}`}>
        {growing.length === 0 ? (
          <p class="muted small">Nothing growing.</p>
        ) : (
          <ul class="layer-list">
            {growing.map((p) => {
              const plant = plantOf(p.plantId);
              const n = plantCount(p, plant);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelected({ type: 'planting', id: p.id })}>
                    <PlantIcon plant={plantOf(p.plantId)} size={22} />
                    <span>{plant.commonName}</span>
                    <span class="muted small">
                      {n > 1 ? `${LAYOUT_LABEL[p.layout ?? 'single']} of ${n}` : '1 plant'} · {STAGE_LABEL[currentStage(p)]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <FindingsList findings={mine} {...findingsProps(props)} />
        {growing.length > 0 && (
          <>
            <button
              type="button"
              class="btn"
              onClick={() => {
                commit((g) => clearBed(g, bed.id, todayIso()));
                app.notify(`${featureLabel(bed)} cleared. What grew there is kept under "Grown here before".`, { undo: true });
              }}
            >
              Clear this bed
            </button>
            <p class="muted small">Clearing keeps a record of what grew here, for rotating crops.</p>
          </>
        )}
      </Section>

      {isCover(bed) && <CoverSection store={store} garden={garden} f={bed} locked={props.locked} />}

      {past.length > 0 && (
        <Section id="history" title={`Grown here before (${past.length})`} open={false}>
          <ul class="history-list">
            {past.map((p) => (
              <li key={p.id}>
                <span>
                  {plantOf(p.plantId).commonName}
                  <span class="muted small"> · cleared {formatDate(p.removedOn!)}</span>
                </span>
                <button type="button" class="link-btn small" onClick={() => commit((g) => restorePlanting(g, p.id))}>
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section id="bed-shape" title="Shape, size and edging" open={false}>
        {props.locked ? <p class="muted small">The layout is locked. Unlock it with the padlock to change the bed.</p> : <FeaturePanel {...props} f={bed} variant="layout" embedded />}
      </Section>
      <NotesSection store={store} garden={garden} on={{ featureId: bed.id }} />
    </div>
  );
}

/** A greenhouse or cold frame: how much warmer it is, what that changes, and its place in the Potting Shed. */
function CoverSection({ store, garden, f, locked }: { store: Store; garden: Garden; f: Feature; locked: boolean }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const c = climateOf(f)!;
  const set = (patch: Partial<Climate>) => commit((g) => updateFeature(g, f.id, { climate: { ...c, ...patch } }));
  const usual = DEFAULT_CLIMATE[f.kind as CoverKind];
  const isUsual = c.heated === usual.heated && c.dayGainC === usual.dayGainC && c.nightGainC === usual.nightGainC;
  const place = placeFor(garden, f.id);
  return (
    <Section id="cover" title="Under cover">
      <p class="cover-fact">Warmer than outside: {climateText(c)}.</p>
      <p class="muted small">{coverEffects(c)}</p>
      {!locked && (
        <>
          {f.kind === 'greenhouse' && (
            <label class="check">
              <input type="checkbox" checked={c.heated} onChange={(e) => set({ heated: (e.currentTarget as HTMLInputElement).checked })} />
              Heated, kept frost-free
            </label>
          )}
          <div class="field-row">
            <NumberField label="Warmer by day" unit="°C" value={c.dayGainC} max={20} onCommit={(dayGainC) => set({ dayGainC })} />
            {!c.heated && <NumberField label="At night" unit="°C" value={c.nightGainC} max={10} onCommit={(nightGainC) => set({ nightGainC })} />}
          </div>
          {!isUsual && (
            <button type="button" class="link-btn small" onClick={() => commit((g) => updateFeature(g, f.id, { climate: undefined }))}>
              Back to the usual for a {KINDS[f.kind].label.toLowerCase()}
            </button>
          )}
        </>
      )}
      {place ? (
        <p class="small">
          Seedlings raised in here are on <strong>{place.name}</strong> in Seedlings.{' '}
          <button type="button" class="link-btn" onClick={() => app.go('shed')}>
            Open the shed
          </button>
        </p>
      ) : (
        <button
          type="button"
          class="btn"
          onClick={() => {
            commit((g) => addPlace(g, { ...makePlace(f.kind === 'greenhouse' ? 'greenhouse-bench' : 'cold-frame', featureLabel(f)), featureId: f.id }));
            app.notify(`${featureLabel(f)} added to Seedlings, for trays raised in here.`, { undo: true });
          }}
        >
          Raise seedlings in here
        </button>
      )}
      <p class="assumption">Rough averages for a sunny day and a clear night in spring. Shade it and open the vents on hot days.</p>
    </Section>
  );
}

/** "Next: sow outside Mar–Jul", from where the planting is in its life. Under a greenhouse or cold frame, planting out starts sooner. */
export function nextStep(pl: Planting, plant: Plant, under: Climate | null = null): string | null {
  const status = plantingStatus(pl);
  const harvest = plant.cropping?.harvestMonths.length ? `Harvest ${monthRanges(plant.cropping.harvestMonths)}` : null;
  const outMonths = plantOutMonthsUnder(plant, under);
  const plantOut = outMonths.length ? `Next: plant out ${monthRanges(outMonths)}` : null;
  if (status === 'planned') {
    const s = plant.sowing?.[0];
    if (s) return `Next: ${s.method === 'direct' ? 'sow outside' : 'sow indoors or under cover'} ${monthRanges(s.months)}`;
    return plantOut ?? harvest;
  }
  if (status === 'sown') {
    const indoors = plant.sowing?.some((s) => s.method !== 'direct') && !plant.sowing?.some((s) => s.method === 'direct');
    return (indoors && plantOut) || harvest;
  }
  if (status === 'growing') return harvest;
  return null;
}

function PlantingPanel(props: Props & { pl: Planting }) {
  const { store, garden, pl, setSelected, plantOf, findings, sunJune } = props;
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const plant = plantOf(pl.plantId);
  const sized = sizedPlant(plant, pl);
  const bed = garden.features.find((f) => f.id === pl.featureId);
  const n = plantCount(pl, plant);
  const layout = pl.layout ?? 'single';
  const mine = findings.filter((f) => f.plantingIds.includes(pl.id));
  const length = pl.endPoint ? Math.hypot(pl.endPoint[0] - pl.x, pl.endPoint[1] - pl.y) : 0;
  const sun = sunJune ? averageHours(sunJune, plantPositions(pl, plant)) : null;
  const status = plantingStatus(pl);
  const stage = currentStage(pl);
  const cover = microclimateOf(garden, pl);
  const step = nextStep(pl, plant, cover?.climate ?? null);
  const today = todayIso();
  // When it's likely to be ready, from the warmth it gets here (UK climate averages), and under glass if it's covered.
  const { weather } = useWeatherNow();
  const expected = status !== 'planned' ? expectedText(timeline(plant, pl, garden, today, weather), plant, today) : null;
  const canEdit = true;

  const steps = timeline(plant, pl, garden, today, weather);

  return (
    <div class="inspector-body">
      <Heading eyebrow={`${LAYOUT_LABEL[layout]}${bed ? ` in ${placeLabel(bed)}` : ''}`} title={plant.commonName} plant={plant} />
      <p class="status-line">
        <span class={`status-chip status-${status}`}>
          {STAGE_LABEL[stage]}
          {stageDate(pl, stage) ? ` ${formatDate(stageDate(pl, stage)!)}` : ''}
        </span>
        {step && <span class="muted small">{step}</span>}
      </p>
      {expected && <p class="expect-line">{expected}<span class="muted small">, {weather ? 'by this year’s weather and the forecast' : 'by the usual warmth here'}</span></p>}
      {cover && (
        <p class="cover-fact">
          Under cover in {featureLabel(cover.feature)}: {climateText(cover.climate)}.
        </p>
      )}
      {canEdit && <WhatsHappened key={pl.id} store={store} garden={garden} pl={pl} plant={plant} covered={!!cover} />}

      <PanelTabs
        id="planting"
        tabs={[
          {
            id: 'care',
            label: mine.length ? `Care (${mine.length})` : 'Care',
            body: (
              <>
                <StageAdvice pl={pl} plant={plant} covered={!!cover} />
                {bed && isSoftGround(bed) && (bed.material ?? 'lawn') === 'lawn' && plant.art?.form === 'bulb' && (
                  <p class="muted small">In a lawn: leave the grass long round them until their leaves die back, about six weeks after flowering, so they flower again next year.</p>
                )}
                {mine.length > 0 && <FindingsList findings={mine} {...findingsProps(props)} />}
                {canEdit && <BatchesSection key={pl.id} store={store} garden={garden} pl={pl} plant={plant} select={(id) => setSelected({ type: 'planting', id })} />}
                <dl class="facts">
                  <dt>Plants</dt>
                  <dd>{n}</dd>
                  {layout === 'row' && (
                    <>
                      <dt>Row length</dt>
                      <dd>{formatLength(Math.round(length))}</dd>
                    </>
                  )}
                  <dt>Spacing</dt>
                  <dd>{formatLength(plant.size.spacingMm)}</dd>
                  {layout === 'row' && (
                    <>
                      <dt>Between rows</dt>
                      <dd>{formatLength(rowSpacingOf(plant))}</dd>
                    </>
                  )}
                  <dt>Spread</dt>
                  <dd>{formatLength(spreadOf(sized))}</dd>
                  {sized.size.heightMm !== undefined && (
                    <>
                      <dt>Height</dt>
                      <dd>{formatLength(sized.size.heightMm)}</dd>
                    </>
                  )}
                  {sun !== null && (
                    <>
                      <dt>Sun in {MONTHS[sunJune!.month - 1]}</dt>
                      <dd>
                        {formatHours(sun)} a day <span class="muted">(wants {formatHours(sunNeeded(plant))})</span>
                      </dd>
                    </>
                  )}
                </dl>
                {canEdit && (
                  <details class="advanced">
                    <summary>Change the details</summary>
          {layout === 'row' && <NumberField label="Plants in this row" unit="plants" value={n} min={1} max={5000} onCommit={(c) => commit((g) => setRowCount(g, pl.id, c))} />}
          {layout === 'single' && (
            <>
              <fieldset class="choice">
                <legend>Size</legend>
                <div class="happened-chips">
                  {PLANT_SIZES.map((s) => (
                    <button key={s} type="button" class="chip" aria-pressed={!pl.spreadMm && !pl.heightMm && (pl.size ?? 'medium') === s} onClick={() => commit((g) => setPlantingSize(g, pl.id, s))}>
                      {SIZE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div class="field-row">
                <NumberField label="Spread" unit="mm" value={spreadOf(sized)} min={10} max={50000} onCommit={(mm) => commit((g) => setPlantingMm(g, pl.id, 'spreadMm', mm))} />
                <NumberField label="Height" unit="mm" value={sized.size.heightMm ?? 0} min={0} max={50000} onCommit={(mm) => commit((g) => setPlantingMm(g, pl.id, 'heightMm', mm))} />
              </div>
            </>
          )}
          <label class="field">
            Sown or planted on
            <input
              type="date"
              value={pl.sownOn ?? ''}
              onChange={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                commit((g) => updatePlanting(g, pl.id, { sownOn: v || undefined }));
              }}
            />
          </label>
          <p class="muted small">
            Drag to move{layout !== 'single' ? '; drag the square handles to change its size' : ''}. Arrow keys nudge by 10 mm.
          </p>
                  </details>
                )}
                <button type="button" class="link-btn about-plant" onClick={() => app.openPlant(plant.id)}>
                  About {plant.commonName.toLowerCase()}: when to sow, pests, neighbours
                </button>
              </>
            ),
          },
          {
            id: 'timeline',
            label: 'Timeline',
            body: (
              <>
                <StageRail pl={pl} plant={plant} covered={!!cover} steps={steps} photos={photosOf(garden, pl.id)} />
                {canEdit && <StageCorrect store={store} pl={pl} plant={plant} covered={!!cover} />}
              </>
            ),
          },
          {
            id: 'notes',
            label: (() => {
              const count = garden.notes.filter((x) => x.plantingId === pl.id).length;
              return count ? `Notes (${count})` : 'Notes';
            })(),
            body: <NotesSection store={store} garden={garden} on={{ plantingId: pl.id }} />,
          },
        ]}
      />

      <div class="button-row panel-foot">
        {bed && (
          <button type="button" class="btn" onClick={() => setSelected({ type: 'feature', id: bed.id })}>
            Show {featureLabel(bed)}
          </button>
        )}
        {canEdit && (
          <MoreMenu
            label="More for this planting"
            items={[
              status !== 'cleared'
                ? {
                    label: 'Mark as cleared',
                    icon: 'check',
                    onSelect: () => {
                      commit((g) => harvestPlantings(g, [pl.id], todayIso()));
                      setSelected(bed ? { type: 'feature', id: bed.id } : null);
                      app.notify(`${plant.commonName} marked as cleared.`, { undo: true });
                    },
                  }
                : { label: 'Put back on the plan', icon: 'undo', onSelect: () => commit((g) => restorePlanting(g, pl.id)) },
              {
                label: 'Delete',
                icon: 'trash',
                onSelect: () => {
                  commit((g) => deletePlanting(g, pl.id));
                  setSelected(null);
                  app.notify(`${plant.commonName} deleted.`, { undo: true });
                },
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Sowing in batches ----------

const WEEK_CHOICES = [1, 2, 3, 4];

/**
 * Sowing little and often: split a row or block into batches a few weeks apart, or, for a batch, when it's to be sown
 * and the others in its set.
 */
function BatchesSection({ store, garden, pl, plant, select }: { store: Store; garden: Garden; pl: Planting; plant: Plant; select: (id: string) => void }) {
  const app = useApp();
  const today = todayIso();
  const direct = sowingOf(plant, pl) === 'direct';
  const sowMonths = (plant.sowing ?? []).filter((x) => (direct ? x.method === 'direct' : x.method !== 'direct')).flatMap((x) => x.months);
  const months = sowMonths.length ? sowMonths : (plant.sowing ?? []).flatMap((x) => x.months);
  const most = maxBatches(pl, plant);
  const [count, setCount] = useState(Math.min(3, Math.max(MIN_BATCHES, most)));
  const [weeks, setWeeks] = useState(3);
  const [first, setFirst] = useState(() => nextInMonths(today, months) ?? today);

  if (pl.batch) {
    const set = batchesOf(garden, pl);
    return (
      <Section id="batches" title={batchLabel(pl)!}>
        {!pl.sownOn && pl.sowBy && (
          <label class="field">
            Sow on
            <input type="date" value={pl.sowBy} onChange={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              if (v) store.apply(updateGarden((g) => setSowBy(g, pl.id, v)));
            }} />
          </label>
        )}
        <ul class="plain-list batch-list">
          {set.map((b) => (
            <li key={b.id}>
              <button type="button" class="link-btn" aria-current={b.id === pl.id ? 'true' : undefined} disabled={b.id === pl.id} onClick={() => select(b.id)}>
                {batchLabel(b)}
              </button>{' '}
              <span class="muted small">{b.sownOn ? `sown ${formatDate(b.sownOn)}` : b.sowBy ? `to sow about ${formatDate(b.sowBy)}` : ''}</span>
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  if (!canSowInBatches(plant, pl) || most < MIN_BATCHES) return null;
  const dates = batchDates(first, count, weeks * 7);
  const late = dates.filter((d) => !months.includes(Number(d.slice(5, 7))));
  return (
    <Section id="batches" title="Sow in batches" open={false}>
      <p class="muted small">
        Sow a little at a time, a few weeks apart, for a steady supply instead of a glut. The {pl.layout === 'row' ? 'row is split into shorter rows' : 'block is split into strips'}, each
        sown on its own date, with its own sowing job.
      </p>
      <div class="field-row">
        <label class="field">
          Batches
          <select value={count} onChange={(e) => setCount(Number((e.currentTarget as HTMLSelectElement).value))}>
            {Array.from({ length: most - MIN_BATCHES + 1 }, (_, i) => i + MIN_BATCHES).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Every
          <select value={weeks} onChange={(e) => setWeeks(Number((e.currentTarget as HTMLSelectElement).value))}>
            {WEEK_CHOICES.map((w) => (
              <option key={w} value={w}>
                {w === 1 ? 'week' : `${w} weeks`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label class="field">
        First sowing
        <input type="date" value={first} onChange={(e) => setFirst((e.currentTarget as HTMLInputElement).value || first)} />
      </label>
      <p class="small">Sow on {dates.map((d) => shortDate(d)).join(', ')}.</p>
      {late.length > 0 && <p class="muted small">{late.length === 1 ? `${shortDate(late[0]!)} is` : 'Some of these are'} outside its usual sowing months, {monthRanges(months)}.</p>}
      <button
        type="button"
        class="btn"
        onClick={() => {
          store.apply(updateGarden((g) => splitIntoBatches(g, pl.id, plant, count, weeks * 7, first)));
          app.notify(`${plant.commonName} split into ${count} batches, ${weeks === 1 ? 'a week' : `${weeks} weeks`} apart.`, { undo: true });
        }}
      >
        Split into {count} batches
      </button>
    </Section>
  );
}

// ---------- Sun ----------

/** Sun, with nothing selected: whether the location is set, and how sunny each bed is. */
function SunOverview({ store, garden, sunJune, setSelected }: Props) {
  const app = useApp();
  const beds = garden.features.filter(isContainer);
  const defaultLocation = garden.latitude === 52.5 && garden.longitude === -1.5;
  return (
    <div class="inspector-body">
      <Heading eyebrow="Sun and shade" title={garden.name} />
      {defaultLocation ? (
        <div class="next-step">
          <p>
            <strong>Set your location</strong> for exact sun times. Until then the plan uses the middle of England.
          </p>
          <UseLocationButton store={store} onMessage={(m) => m && app.notify(m.lines.join(" "))} />
        </div>
      ) : (
        <p class="muted small">
          Location {garden.latitude.toFixed(2)}°, {garden.longitude.toFixed(2)}°. North is turned {garden.northRotationDeg}° from the top of the plan.
        </p>
      )}
      <Section id="sun-beds" title={`Sun in each bed (${MONTHS[(sunJune?.month ?? 6) - 1]})`}>
        {beds.length === 0 ? (
          <p class="muted small">Draw beds to see how much sun each one gets.</p>
        ) : sunJune === null ? (
          <p class="muted small">Working out the sun…</p>
        ) : (
          <ul class="layer-list">
            {beds
              .map((b) => ({ b, h: areaHours(sunJune, b.footprint) }))
              .sort((x, y) => (y.h ?? -1) - (x.h ?? -1))
              .map(({ b, h }) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setSelected({ type: 'feature', id: b.id })}>
                    <span class={`swatch swatch-${b.kind}`} aria-hidden="true" />
                    <span>{featureLabel(b)}</span>
                    <span class="muted small">{h === null ? 'outside the boundary' : `${formatHours(h)} · ${BAND_LABEL[lightBand(h)]}`}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Section>
      <p class="assumption">Sun hours count direct sun only, from what you've drawn. Assumes flat ground.</p>
    </div>
  );
}
