// The pill of actions beside whatever's selected on the plan: only what fits
// it, with "More" for the full details. The canvas keeps it in place as the
// plan moves (PlanCanvas, pillRef).

import { useEffect, useState } from 'preact/hooks';
import { microclimateOf } from '../climate/microclimate';
import { isNewSeason, nextStage, STAGE_ACTION } from '../lifecycle/stages';
import { deleteFeatures, duplicateFeature, featureLabel, geometryOf, MATERIAL_LABEL, rectInfo, resizeRectAny, setSmooth, updateFeature, type Target } from '../model/features';
import { todayIso } from '../model/ids';
import { asTree, treeSizeText, treeType } from '../model/trees';
import { updateGarden, type Store } from '../model/store';
import { MATERIALS, PLANT_SIZES, type Feature, type PlantSize, type Garden, type Material, type Plant, type Point } from '../model/types';
import { canHold, canResize, containerAt, deletePlanting, duplicatePlanting, placeCopy, updatePlanting, plantCount, setPlantingSize, setRowCount, SIZE_FACTOR, SIZE_LABEL, spreadOf } from '../planting/place';
import { setStage } from '../lifecycle/stages';
import { useApp } from './appContext';
import { useCopied } from './clipboard';
import { Icon } from './icons';
import { deletedMessage } from './PlanCanvas';
import { pillHasExtras, type PlanMode } from './planMode';
import { PlantIcon } from './PlantIcon';

interface Props {
  pillRef: { current: HTMLDivElement | null };
  target: Target | null;
  garden: Garden;
  store: Store;
  plantOf: (id: string) => Plant;
  locked: boolean;
  /** Opens the full details: the panel beside the plan, or a sheet on a phone. */
  more: () => void;
  /** Opens the plants in the dock, to plant this bed. */
  plantHere: () => void;
  select: (t: Target | null) => void;
  unlock: () => void;
  redrawBoundary: () => void;
  /** Simple leaves out typed sizes, curved edges and edging. */
  mode?: PlanMode;
  /** Where the bed was last tapped, for "Paste here". */
  tapped?: Point | null;
}

/** The middle of an outline, as a place to start looking for room. */
const centreOf = (pts: Point[]): Point => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

const fmt = (mm: number) => (mm >= 1000 ? `${+(mm / 1000).toFixed(2)} m` : `${Math.round(mm / 10)} cm`);

export function ActionPill({ pillRef, target, garden, store, plantOf, locked, more, plantHere, select, unlock, redrawBoundary, mode = 'advanced', tapped = null }: Props) {
  const copied = useCopied();
  const app = useApp();
  const [sizing, setSizing] = useState(false);
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const key = target ? (target.type === 'boundary' ? 'boundary' : target.id) : '';
  useEffect(() => setSizing(false), [key]);

  let content: preact.JSX.Element | null = null;
  if (target?.type === 'planting') {
    const pl = garden.plantings.find((p) => p.id === target.id);
    if (pl) {
      const plant = plantOf(pl.plantId);
      const next = nextStage(plant, pl, !!microclimateOf(garden, pl));
      const n = plantCount(pl, plant);
      content = (
        <>
          <span class="pill-name" title={plant.commonName}>
            <PlantIcon plant={plant} size={22} />
            {/* On a narrow screen the icon stands for the name: the plan labels it too. */}
            <span class="pill-name-text">
              {plant.commonName}
              {n > 1 ? ` ×${n}` : ''}
            </span>
          </span>
          {plant.category === 'weed' && (
            <button
              type="button"
              class="pill-btn"
              aria-pressed={!!pl.keep}
              title={pl.keep ? 'You’re keeping it: tap if you want it gone' : 'You want it gone: tap to keep it instead'}
              onClick={() => commit((g) => updatePlanting(g, pl.id, { keep: !pl.keep }))}
            >
              {pl.keep ? 'Keeping it' : 'Remove'}
            </button>
          )}
          {next && plant.category !== 'weed' && (
            <button type="button" class="pill-btn" onClick={() => commit((g) => setStage(g, [pl.id], next, todayIso(), { newSeason: isNewSeason(plant, pl) }))}>
              {isNewSeason(plant, pl) ? 'New season' : STAGE_ACTION[next]}
            </button>
          )}
          {pl.layout === 'row' && (
            <span class="pill-stepper" role="group" aria-label="Plants in the row">
              <button type="button" class="pill-icon" aria-label="One fewer" onClick={() => commit((g) => setRowCount(g, pl.id, n - 1))} disabled={n <= 1}>
                −
              </button>
              <span>{n}</span>
              <button type="button" class="pill-icon" aria-label="One more" onClick={() => commit((g) => setRowCount(g, pl.id, n + 1))}>
                +
              </button>
            </span>
          )}
          {(pl.layout ?? 'single') === 'single' && canResize(plant) && (
            <SizeButton
              size={pl.spreadMm || pl.heightMm ? null : (pl.size ?? 'medium')}
              describe={(s) => `about ${fmt(Math.round(spreadOf(plant) * SIZE_FACTOR[s]))} across`}
              set={(s) => commit((g) => setPlantingSize(g, pl.id, s))}
            />
          )}
          <button
            type="button"
            class="pill-icon"
            aria-label={`Duplicate ${plant.commonName}`}
            title="Duplicate (Ctrl+D)"
            onClick={() => {
              const made = { id: null as string | null };
              commit((g) => {
                const [next, id] = duplicatePlanting(g, pl.id, plantOf);
                made.id = id;
                return next;
              });
              if (made.id) select({ type: 'planting', id: made.id });
              else app.notify(`No room for another ${plant.commonName.toLowerCase()} in this bed.`);
            }}
          >
            <Icon name="copy" size={18} />
          </button>
          <button type="button" class="pill-icon" aria-label={`About ${plant.commonName}`} title="About" onClick={() => app.openPlant(plant.id)}>
            <Icon name="info" size={18} />
          </button>
          <button
            type="button"
            class="pill-icon"
            aria-label={`Delete ${plant.commonName}`}
            title="Delete"
            onClick={() => {
              commit((g) => deletePlanting(g, pl.id));
              select(null);
              app.notify(`${plant.commonName} deleted.`, { undo: true });
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </>
      );
    }
  } else if (target?.type === 'feature') {
    const f = garden.features.find((x) => x.id === target.id);
    if (f) {
      // Something copied, and a bed to put it in: "Paste here", where the bed was tapped or in its middle.
      const paste =
        copied && canHold(f)
          ? () => {
              const inside = tapped && containerAt(garden, tapped)?.id === f.id ? tapped : centreOf(f.footprint);
              const made = { id: null as string | null };
              commit((g) => {
                const copy = placeCopy(g, copied, plantOf, inside);
                made.id = copy?.id ?? null;
                return copy ? { ...g, plantings: [...g.plantings, copy] } : g;
              });
              const name = plantOf(copied.plantId).commonName;
              if (made.id) {
                select({ type: 'planting', id: made.id });
                app.notify(`${name} pasted into ${featureLabel(f)}.`, { undo: true });
              } else app.notify(`No room for ${name.toLowerCase()} in ${featureLabel(f)}.`);
            }
          : null;
      content = <FeatureActions f={f} garden={garden} commit={commit} locked={locked} sizing={sizing} setSizing={setSizing} plantHere={plantHere} paste={paste} select={select} unlock={unlock} extras={pillHasExtras(mode)} />;
    }
  } else if (target?.type === 'boundary') {
    content = (
      <>
        <span class="pill-name">Boundary</span>
        {!locked && (
          <button type="button" class="pill-btn" onClick={redrawBoundary}>
            Redraw
          </button>
        )}
      </>
    );
  }

  return (
    <div ref={pillRef} class="action-pill" role="toolbar" aria-label="Actions" style={{ visibility: 'hidden' }}>
      {content}
      {content && (
        <button type="button" class="pill-icon" aria-label="More details" title="More" onClick={more}>
          <Icon name="more" size={20} />
        </button>
      )}
    </div>
  );
}

/** One button for small, medium and large: each tap goes to the next size. Typed sizes show as "Size" and go back to small. */
function SizeButton({ size, describe, set }: { size: PlantSize | null; describe: (s: PlantSize) => string; set: (s: PlantSize) => void }) {
  const next = size ? PLANT_SIZES[(PLANT_SIZES.indexOf(size) + 1) % PLANT_SIZES.length]! : 'small';
  return (
    <button
      type="button"
      class="pill-btn"
      aria-label={`Size: ${size ? SIZE_LABEL[size].toLowerCase() : 'your own'}. Tap for ${SIZE_LABEL[next].toLowerCase()}`}
      title={`Tap for ${SIZE_LABEL[next].toLowerCase()}: ${describe(next)}`}
      onClick={() => set(next)}
    >
      Size {size ? SIZE_LABEL[size][0] : '…'}
    </button>
  );
}

function FeatureActions({ f, garden, commit, locked, sizing, setSizing, plantHere, paste, select, unlock, extras }: { f: Feature; garden: Garden; commit: (fn: (g: Garden) => Garden) => void; locked: boolean; sizing: boolean; setSizing: (b: boolean) => void; plantHere: () => void; paste: (() => void) | null; select: (t: Target | null) => void; unlock: () => void; extras: boolean }) {
  const app = useApp();
  const rect = !f.smooth && geometryOf(f) === 'area' ? rectInfo(f.footprint) : null;
  const circle = f.circle;
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  useEffect(() => {
    if (rect) {
      setW(String(Math.round(rect.w)));
      setH(String(Math.round(rect.h)));
    } else if (circle) setW(String(circle.radiusMm * 2));
  }, [sizing, f]);
  const apply = (e: Event) => {
    e.preventDefault();
    const W = Math.round(Number(w));
    const H = Math.round(Number(h));
    if (rect && W >= 50 && H >= 50) commit((g) => updateFeature(g, f.id, { footprint: resizeRectAny(f.footprint, W, H)! }));
    if (circle && W >= 50) commit((g) => updateFeature(g, f.id, { circle: { ...circle, radiusMm: Math.round(W / 2) } }));
    setSizing(false);
  };
  if (sizing && (rect || circle))
    return (
      <form class="pill-size" onSubmit={apply}>
        <label>
          <span class="visually-hidden">{circle ? 'Across' : 'Width'}</span>
          <input type="number" inputMode="numeric" min={50} value={w} autoFocus onInput={(e) => setW((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {rect && (
          <>
            <span aria-hidden="true">×</span>
            <label>
              <span class="visually-hidden">Depth</span>
              <input type="number" inputMode="numeric" min={50} value={h} onInput={(e) => setH((e.currentTarget as HTMLInputElement).value)} />
            </label>
          </>
        )}
        <span class="muted small">mm</span>
        <button type="submit" class="pill-btn pill-primary">
          Set
        </button>
        <button type="button" class="pill-icon" aria-label="Cancel" onClick={() => setSizing(false)}>
          <Icon name="close" size={16} />
        </button>
      </form>
    );
  const sizeText = rect ? `${fmt(rect.w)} × ${fmt(rect.h)}` : circle ? `Ø ${fmt(circle.radiusMm * 2)}` : null;
  const kindOfTree = f.kind === 'tree' ? treeType(f.treeType) : undefined;
  return (
    <>
      <span class="pill-name">{featureLabel(f)}</span>
      {canHold(f) && (
        <button type="button" class="pill-btn pill-primary" onClick={plantHere}>
          Plant
        </button>
      )}
      {paste && (
        <button type="button" class="pill-btn" title="Paste the plant you copied here" onClick={paste}>
          <Icon name="paste" size={16} /> Paste here
        </button>
      )}
      {locked ? (
        <button type="button" class="pill-btn" onClick={unlock} title="The layout is locked">
          <Icon name="lock" size={16} /> Unlock
        </button>
      ) : (
        <>
          {kindOfTree && (
            <SizeButton size={f.size ?? 'medium'} describe={(s) => treeSizeText(kindOfTree, s)} set={(s) => commit((g) => updateFeature(g, f.id, asTree(f, kindOfTree, s)))} />
          )}
          {extras && sizeText && (
            <button type="button" class="pill-btn" title="Type an exact size" onClick={() => setSizing(true)}>
              {sizeText}
            </button>
          )}
          {extras && !circle && (
            <button type="button" class="pill-icon" aria-pressed={!!f.smooth} aria-label="Curved edges" title="Curved edges" onClick={() => commit((g) => setSmooth(g, f.id, !f.smooth))}>
              <Icon name="curve" size={18} />
            </button>
          )}
          {(f.kind === 'surface' || f.kind === 'path') && (
            <label class="pill-select">
              <span class="visually-hidden">Made of</span>
              <select value={f.material ?? (f.kind === 'surface' ? 'lawn' : '')} onChange={(e) => commit((g) => updateFeature(g, f.id, { material: ((e.currentTarget as HTMLSelectElement).value || undefined) as Material | undefined }))}>
                {f.kind === 'path' && <option value="">Plain</option>}
                {MATERIALS.filter((m) => f.kind === 'surface' || m !== 'meadow').map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {extras && f.kind === 'bed' && (
            <label class="pill-select">
              <span class="visually-hidden">Edging</span>
              <select value={f.edging ?? ''} onChange={(e) => commit((g) => updateFeature(g, f.id, { edging: ((e.currentTarget as HTMLSelectElement).value || undefined) as Feature['edging'] }))}>
                <option value="">No edging</option>
                <option value="timber">Timber</option>
                <option value="brick">Brick</option>
                <option value="stone">Stone</option>
              </select>
            </label>
          )}
          <button
            type="button"
            class="pill-icon"
            aria-label="Duplicate"
            title="Duplicate (Ctrl+D)"
            onClick={() => {
              const made = { id: null as string | null };
              commit((g) => {
                const [next, id] = duplicateFeature(g, f.id);
                made.id = id;
                return next;
              });
              if (made.id) select({ type: 'feature', id: made.id });
            }}
          >
            <Icon name="copy" size={18} />
          </button>
          <button
            type="button"
            class="pill-icon"
            aria-label={`Delete ${featureLabel(f)}`}
            title="Delete"
            onClick={() => {
              const text = deletedMessage(garden, f);
              commit((g) => deleteFeatures(g, [f.id]));
              select(null);
              app.notify(text, { undo: true });
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </>
      )}
    </>
  );
}
