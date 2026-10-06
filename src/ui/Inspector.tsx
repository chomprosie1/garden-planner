import { useState } from 'preact/hooks';
import { formatArea, formatLength } from '../canvas/viewport';
import { lineLength, perimeter, polygonArea } from '../geometry/polygon';
import {
  asRect,
  deleteFeatures,
  duplicateFeature,
  featureLabel,
  geometryOf,
  KINDS,
  kindsWithGeometry,
  resizeRect,
  restack,
  updateFeature,
  type Target,
} from '../model/features';
import { updateGarden, type Store } from '../model/store';
import type { Feature, FeatureKind, Garden, Point } from '../model/types';
import { deleteBlob, saveBlob } from '../storage/idb';
import { parseLength } from '../canvas/snap';
import type { Tool } from './PlanCanvas';

interface Props {
  store: Store;
  garden: Garden;
  selected: Target | null;
  setSelected: (t: Target | null) => void;
  setTool: (t: Tool) => void;
  calibration: [Point, Point] | null;
  clearCalibration: () => void;
}

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

export function Inspector({ store, garden, selected, setSelected, setTool, calibration, clearCalibration }: Props) {
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  if (calibration) return <Calibrate store={store} garden={garden} points={calibration} done={clearCalibration} />;

  const f = selected?.type === 'feature' ? garden.features.find((x) => x.id === selected.id) : undefined;
  if (f) return <FeaturePanel f={f} commit={commit} setSelected={setSelected} />;

  if (selected?.type === 'boundary') {
    const b = garden.boundary;
    return (
      <div class="inspector-body">
        <div>
          <p class="eyebrow muted">Boundary</p>
          <h2>The edge of your garden</h2>
        </div>
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

  return <GardenPanel store={store} garden={garden} setSelected={setSelected} setTool={setTool} />;
}

function FeaturePanel({ f, commit, setSelected }: { f: Feature; commit: (fn: (g: Garden) => Garden) => void; setSelected: (t: Target | null) => void }) {
  const geometry = geometryOf(f);
  const rect = geometry === 'area' ? asRect(f.footprint) : null;
  const set = (patch: Partial<Feature>) => commit((g) => updateFeature(g, f.id, patch));
  const kindOptions = kindsWithGeometry(geometry);
  const shading = f.opacityInLeaf !== undefined || f.kind === 'tree' || f.kind === 'hedge';

  return (
    <div class="inspector-body">
      <div>
        <p class="eyebrow muted">{KINDS[f.kind].label}</p>
        <h2>{featureLabel(f)}</h2>
      </div>
      <label class="field">
        Name
        <input
          value={f.name ?? ''}
          placeholder={KINDS[f.kind].label}
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
              set({ kind, heightMm: KINDS[kind].heightMm });
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

      {rect && (
        <div class="field-row">
          <NumberField label="Width" unit="mm" value={rect.w} min={50} onCommit={(w) => set({ footprint: resizeRect(f.footprint, w, rect.h)! })} />
          <NumberField label="Depth" unit="mm" value={rect.h} min={50} onCommit={(h) => set({ footprint: resizeRect(f.footprint, rect.w, h)! })} />
        </div>
      )}
      {geometry === 'line' && (
        <NumberField label="Thickness" unit="mm" value={f.widthMm ?? 100} min={10} onCommit={(widthMm) => set({ widthMm })} />
      )}
      {geometry === 'circle' && f.circle && (
        <NumberField
          label={f.kind === 'tree' ? 'Canopy spread (across)' : 'Diameter'}
          unit="mm"
          value={f.circle.radiusMm * 2}
          min={100}
          onCommit={(d) => set({ circle: { ...f.circle!, radiusMm: Math.round(d / 2) } })}
        />
      )}
      <NumberField label="Height" unit="mm" value={f.heightMm ?? 0} max={40000} onCommit={(heightMm) => set({ heightMm })} />

      <dl class="facts">
        {geometry === 'line' && f.line ? (
          <>
            <dt>Length</dt>
            <dd>{formatLength(lineLength(f.line))}</dd>
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
            <dd>{f.footprint.length}</dd>
          </>
        )}
      </dl>

      {shading && (
        <fieldset class="choice">
          <legend>Shade it casts (used by sun and shade later)</legend>
          {(f.kind === 'tree' || f.kind === 'hedge') && (
            <label class="check">
              <input type="checkbox" checked={!!f.deciduous} onChange={(e) => set({ deciduous: (e.currentTarget as HTMLInputElement).checked })} />
              Loses its leaves in winter
            </label>
          )}
          <label class="field">
            Light blocked {f.deciduous ? 'in leaf' : ''}: {Math.round((f.opacityInLeaf ?? 1) * 100)}%
            <input type="range" min={0} max={100} step={5} value={Math.round((f.opacityInLeaf ?? 1) * 100)} onChange={(e) => {
              const v = Number((e.currentTarget as HTMLInputElement).value) / 100;
              set(f.deciduous ? { opacityInLeaf: v } : { opacityInLeaf: v, opacityBare: v });
            }} />
          </label>
          {f.deciduous && (
            <label class="field">
              Light blocked when bare: {Math.round((f.opacityBare ?? 0.2) * 100)}%
              <input type="range" min={0} max={100} step={5} value={Math.round((f.opacityBare ?? 0.2) * 100)} onChange={(e) => set({ opacityBare: Number((e.currentTarget as HTMLInputElement).value) / 100 })} />
            </label>
          )}
        </fieldset>
      )}

      <p class="muted small">
        Drag to move. {geometry === 'circle' ? 'Drag the square handle to resize.' : 'Drag a corner to reshape; double-click an edge to add a corner.'} Arrow keys nudge by 10 mm (100 mm with Shift).
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
            commit((g) => deleteFeatures(g, [f.id]));
            setSelected(null);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function GardenPanel({ store, garden, setSelected, setTool }: { store: Store; garden: Garden; setSelected: (t: Target | null) => void; setTool: (t: Tool) => void }) {
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
    <div class="inspector-body">
      <div>
        <p class="eyebrow muted">Garden</p>
        <h2>{garden.name}</h2>
      </div>
      {b.length >= 3 ? (
        <dl class="facts">
          <dt>Area</dt>
          <dd>{formatArea(polygonArea(b))}</dd>
          <dt>Perimeter</dt>
          <dd>{formatLength(perimeter(b))}</dd>
        </dl>
      ) : (
        <p class="muted small">No boundary yet. Choose Boundary in the toolbar and click each corner of your garden.</p>
      )}

      <section class="inspector-section">
        <h3>On the plan</h3>
        {garden.features.length === 0 ? (
          <p class="muted small">Nothing yet. Beds, paths, fences and trees you draw are listed here.</p>
        ) : (
          <ul class="layer-list">
            {[...garden.features].reverse().map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setSelected({ type: 'feature', id: f.id })}>
                  <span class={`swatch swatch-${f.kind}`} aria-hidden="true" />
                  <span>{featureLabel(f)}</span>
                  <span class="muted small">{KINDS[f.kind].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="inspector-section">
        <h3>North</h3>
        <NumberField label="Degrees clockwise from the top of the plan" unit="°" value={garden.northRotationDeg} min={0} max={359} onCommit={(n) => commit((g) => ({ ...g, northRotationDeg: n }))} />
        <p class="muted small">Or drag the north arrow on the plan. Check true north against a map.</p>
      </section>

      <section class="inspector-section">
        <h3>Trace a photo</h3>
        {!garden.trace ? (
          <>
            <p class="muted small">Load a photo or screenshot of your garden from above, then trace over it. It stays on this device and is not part of the export.</p>
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
                }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </section>
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
      <div>
        <p class="eyebrow muted">Trace photo</p>
        <h2>Set the scale</h2>
      </div>
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
