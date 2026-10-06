// The details panel beside the plan (a sheet on phones). What it shows
// depends on what's selected and on the part of the plan you're in.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { parseLength } from '../canvas/snap';
import { formatArea, formatLength } from '../canvas/viewport';
import { lineLength, perimeter, polygonArea } from '../geometry/polygon';
import { monthRanges } from '../library/library';
import {
  asRect,
  centreLineOf,
  deleteFeatures,
  duplicateFeature,
  featureLabel,
  geometryOf,
  KINDS,
  kindsWithGeometry,
  MATERIAL_LABEL,
  resizeRect,
  restack,
  setSmooth,
  updateFeature,
  type Target,
} from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import { MATERIALS, type Feature, type FeatureKind, type Garden, type Material, type Plant, type Planting, type Point } from '../model/types';
import {
  clearBed,
  deletePlanting,
  harvestPlantings,
  isContainer,
  plantCount,
  plantingStatus,
  plantPositions,
  restorePlanting,
  rowSpacingOf,
  setRowCount,
  spreadOf,
  updatePlanting,
} from '../planting/place';
import { formatHours, sunNeeded, type Finding } from '../planting/rules';
import { currentStage, STAGE_LABEL, stageDate } from '../lifecycle/stages';
import { deleteBlob, saveBlob } from '../storage/idb';
import { areaHours, averageHours, lightBand, type SunGrid } from '../sun/hours';
import type { PlanMode } from '../theme/prefs';
import { useApp } from './appContext';
import { FindingsList } from './Findings';
import { UseLocationButton } from './GardenSettings';
import { formatDate, NotesSection } from './NotesSection';
import { deletedMessage, type Tool } from './PlanCanvas';
import { PlantIcon } from './PlantIcon';
import { StageStrip } from './StageStrip';

interface Props {
  store: Store;
  garden: Garden;
  mode: PlanMode;
  setMode: (m: PlanMode) => void;
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
  const { store, garden, mode, selected, setSelected, setTool, calibration, clearCalibration } = props;
  if (calibration) return <Calibrate store={store} garden={garden} points={calibration} done={clearCalibration} />;

  if (selected?.type === 'planting') {
    const pl = garden.plantings.find((x) => x.id === selected.id);
    if (pl) return <PlantingPanel {...props} pl={pl} />;
  }
  const f = selected?.type === 'feature' ? garden.features.find((x) => x.id === selected.id) : undefined;
  if (f) {
    if (mode === 'planting') return isContainer(f) ? <BedPanel {...props} bed={f} /> : <ElsewherePanel f={f} go={() => props.setMode('layout')} label="Layout" />;
    return <FeaturePanel {...props} f={f} variant={mode === 'sun' ? 'sun' : 'layout'} />;
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
        {mode === 'layout' ? (
          <>
            <p class="muted small">Drag a corner to move it. Double-click an edge to add a corner. Select a corner and press Delete to remove it.</p>
            <button type="button" class="btn" onClick={() => setTool('boundary')}>
              Redraw the boundary
            </button>
          </>
        ) : (
          <button type="button" class="btn" onClick={() => props.setMode('layout')}>
            Change it in Layout
          </button>
        )}
      </div>
    );
  }

  if (mode === 'planting') return <PlantingOverview {...props} />;
  if (mode === 'sun') return <SunOverview {...props} />;
  return <GardenPanel store={store} garden={garden} setSelected={setSelected} setTool={setTool} setMode={props.setMode} />;
}

/** A layout thing picked while planting: say where to change it. */
function ElsewherePanel({ f, go, label }: { f: Feature; go: () => void; label: string }) {
  return (
    <div class="inspector-body">
      <Heading eyebrow={KINDS[f.kind].label} title={featureLabel(f)} />
      <p class="muted">This is part of the layout. Plants go in beds and greenhouses.</p>
      <button type="button" class="btn" onClick={go}>
        Change it in {label}
      </button>
    </div>
  );
}

// ---------- Layout ----------

function FeaturePanel({ store, garden, f, variant, setSelected, setMode, sunJune }: Shared & { f: Feature; variant: 'layout' | 'sun' }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const geometry = geometryOf(f);
  const rect = geometry === 'area' ? asRect(f.footprint) : null;
  const set = (patch: Partial<Feature>) => commit((g) => updateFeature(g, f.id, patch));
  const kindOptions = kindsWithGeometry(geometry);
  const shading = f.opacityInLeaf !== undefined || f.kind === 'tree' || f.kind === 'hedge';
  const planted = garden.plantings.filter((p) => p.featureId === f.id && !p.removedOn).length;
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
    <div class="inspector-body">
      <Heading eyebrow={KINDS[f.kind].label} title={featureLabel(f)} />
      {isContainer(f) && (
        <p class="muted small">
          {planted ? `${planted} ${planted === 1 ? 'planting' : 'plantings'} in it. ` : ''}
          <button type="button" class="link-btn" onClick={() => setMode('planting')}>
            {planted ? 'See them in Planting' : 'Plant it in Planting'}
          </button>
        </p>
      )}
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
      {geometry !== 'circle' && (
        <label class="check">
          <input type="checkbox" checked={!!f.smooth} onChange={() => commit((g) => setSmooth(g, f.id, !f.smooth))} />
          Curved edges
        </label>
      )}

      <Section id="size" title="Size">
        {rect && (
          <div class="field-row">
            <NumberField label="Width" unit="mm" value={rect.w} min={50} onCommit={(w) => set({ footprint: resizeRect(f.footprint, w, rect.h)! })} />
            <NumberField label="Depth" unit="mm" value={rect.h} min={50} onCommit={(h) => set({ footprint: resizeRect(f.footprint, rect.w, h)! })} />
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

function GardenPanel({ store, garden, setSelected, setTool, setMode }: { store: Store; garden: Garden; setSelected: (t: Target | null) => void; setTool: (t: Tool) => void; setMode: (m: PlanMode) => void }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const b = garden.boundary;
  const beds = garden.features.filter(isContainer).length;
  const planted = garden.plantings.some((p) => !p.removedOn);
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
    <div class="inspector-body">
      <Heading eyebrow="Garden" title={garden.name} />
      {b.length >= 3 ? (
        <dl class="facts">
          <dt>Area</dt>
          <dd>{formatArea(polygonArea(b))}</dd>
          <dt>Perimeter</dt>
          <dd>{formatLength(perimeter(b))}</dd>
        </dl>
      ) : (
        <p class="muted small">No boundary yet. Choose Boundary and click each corner of your garden.</p>
      )}
      {beds > 0 && !planted && (
        <div class="next-step">
          <p>
            <strong>Next:</strong> put plants in your {beds === 1 ? 'bed' : 'beds'}.
          </p>
          <button type="button" class="btn btn-primary" onClick={() => setMode('planting')}>
            Go to Planting
          </button>
        </div>
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
  const beds = garden.features.filter(isContainer);
  const growing = garden.plantings.filter((p) => !p.removedOn);
  const warnings = findings.filter((f) => f.level === 'warn').length;
  return (
    <div class="inspector-body">
      <Heading eyebrow="Planting" title={garden.name} />
      {beds.length === 0 ? (
        <div class="next-step">
          <p>Plants go in beds and greenhouses. Draw one first.</p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              props.setTool('bed');
            }}
          >
            Draw a bed
          </button>
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
  return (
    <div class="inspector-body">
      <Heading eyebrow={KINDS[bed.kind].label} title={featureLabel(bed)} />
      {sun !== null && <SunFact hours={sun} month={sunJune!.month} />}
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
      <NotesSection store={store} garden={garden} on={{ featureId: bed.id }} />
    </div>
  );
}

/** "Next: sow outside Mar–Jul", from where the planting is in its life. */
export function nextStep(pl: Planting, plant: Plant): string | null {
  const status = plantingStatus(pl);
  const harvest = plant.cropping?.harvestMonths.length ? `Harvest ${monthRanges(plant.cropping.harvestMonths)}` : null;
  const plantOut = plant.plantOutMonths?.length ? `Next: plant out ${monthRanges(plant.plantOutMonths)}` : null;
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
  const { store, garden, pl, setSelected, plantOf, findings, sunJune, mode } = props;
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const plant = plantOf(pl.plantId);
  const bed = garden.features.find((f) => f.id === pl.featureId);
  const n = plantCount(pl, plant);
  const layout = pl.layout ?? 'single';
  const mine = findings.filter((f) => f.plantingIds.includes(pl.id));
  const length = pl.endPoint ? Math.hypot(pl.endPoint[0] - pl.x, pl.endPoint[1] - pl.y) : 0;
  const sun = sunJune ? averageHours(sunJune, plantPositions(pl, plant)) : null;
  const status = plantingStatus(pl);
  const stage = currentStage(pl);
  const step = nextStep(pl, plant);
  const canEdit = mode === 'planting';

  return (
    <div class="inspector-body">
      <Heading eyebrow={`${LAYOUT_LABEL[layout]}${bed ? ` in ${featureLabel(bed)}` : ''}`} title={plant.commonName} plant={plant} />
      <p class="status-line">
        <span class={`status-chip status-${status}`}>
          {STAGE_LABEL[stage]}
          {stageDate(pl, stage) ? ` ${formatDate(stageDate(pl, stage)!)}` : ''}
        </span>
        {step && <span class="muted small">{step}</span>}
      </p>
      <StageStrip store={store} pl={pl} plant={plant} canEdit={canEdit} />
      <button type="button" class="link-btn about-plant" onClick={() => app.openPlant(plant.id)}>
        About {plant.commonName.toLowerCase()}: when to sow, pests, neighbours
      </button>

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
        <dd>{formatLength(spreadOf(plant))}</dd>
        {sun !== null && (
          <>
            <dt>Sun in {MONTHS[sunJune!.month - 1]}</dt>
            <dd>
              {formatHours(sun)} a day <span class="muted">(wants {formatHours(sunNeeded(plant))})</span>
            </dd>
          </>
        )}
      </dl>
      {mine.length > 0 && (
        <Section id="planting-checks" title="Checks">
          <FindingsList findings={mine} {...findingsProps(props)} />
        </Section>
      )}

      {canEdit && (
        <Section id="planting-details" title="Details" open={false}>
          {layout === 'row' && <NumberField label="Plants in this row" unit="plants" value={n} min={1} max={5000} onCommit={(c) => commit((g) => setRowCount(g, pl.id, c))} />}
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
        </Section>
      )}

      <div class="button-row">
        {bed && (
          <button type="button" class="btn" onClick={() => setSelected({ type: 'feature', id: bed.id })}>
            Show {featureLabel(bed)}
          </button>
        )}
        {canEdit &&
          (status !== 'cleared' ? (
            <button
              type="button"
              class="btn"
              onClick={() => {
                commit((g) => harvestPlantings(g, [pl.id], todayIso()));
                setSelected(bed ? { type: 'feature', id: bed.id } : null);
                app.notify(`${plant.commonName} marked as cleared.`, { undo: true });
              }}
            >
              Mark as cleared
            </button>
          ) : (
            <button type="button" class="btn" onClick={() => commit((g) => restorePlanting(g, pl.id))}>
              Put back
            </button>
          ))}
        {canEdit && (
          <button
            type="button"
            class="btn btn-danger"
            onClick={() => {
              commit((g) => deletePlanting(g, pl.id));
              setSelected(null);
              app.notify(`${plant.commonName} deleted.`, { undo: true });
            }}
          >
            Delete
          </button>
        )}
      </div>
      <NotesSection store={store} garden={garden} on={{ plantingId: pl.id }} />
    </div>
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
