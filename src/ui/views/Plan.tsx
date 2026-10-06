import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { featureLabel, KINDS, type Target } from '../../model/features';
import type { Store } from '../../model/store';
import type { FeatureKind, Garden, Plant, Point } from '../../model/types';
import { allPlants, loadLibrary } from '../../library/library';
import { unknownPlant, type Layout } from '../../planting/place';
import { checkGarden, type Finding } from '../../planting/rules';
import { PlantPicker } from '../PlantPicker';
import { cropColour } from '../../canvas/render';
import { resolveMode } from '../../theme/apply';
import { LOOKS } from '../../theme/looks';
import type { Prefs, PrefsStore } from '../../theme/prefs';
import { loadBlob } from '../../storage/idb';
import { useIsPhone } from '../hooks';
import { Icon } from '../icons';
import { Inspector } from '../Inspector';
import { geometryForTool, PlanCanvas, type CanvasApi, type Placing, type Tool } from '../PlanCanvas';
import { PhoneDrawBar, PhonePlantBar, PhoneSheet, PhoneToolTray } from '../PhonePlanControls';
import { SeasonPhoto } from '../SeasonPhoto';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  prefsStore: PrefsStore;
  /** A plant chosen elsewhere (the Plants tab) to place on the plan. */
  pendingPlant?: string | null;
  clearPending?: () => void;
  now?: Date;
}

const MAIN_TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 'V' },
  { tool: 'boundary', label: 'Boundary', key: 'B' },
  { tool: 'bed', label: 'Bed', key: 'R' },
  { tool: 'path', label: 'Path', key: 'P' },
  { tool: 'fence', label: 'Fence', key: 'L' },
  { tool: 'tree', label: 'Tree', key: 'T' },
  { tool: 'plant', label: 'Plant', key: 'G' },
];
const MORE: FeatureKind[] = ['wall', 'hedge', 'building', 'greenhouse', 'compost', 'water', 'other'];

function hintFor(tool: Tool): string {
  if (tool === 'select') return 'Click something to select it. Drag empty space to pan; scroll to zoom. Press 0 to fit the garden.';
  if (tool === 'calibrate') return 'Click two points on the photo that you know the real distance between, such as the ends of a fence.';
  if (tool === 'trace') return 'Drag to move the photo under the plan. Press Esc when done.';
  if (tool === 'plant') return 'Choose a plant on the right, then click in a bed. For a row, click both ends or type its length; for a block, click two corners. Esc when done.';
  const g = geometryForTool(tool);
  const exact = 'Type a length and press Enter for an exact edge (3450, or 3.45m).';
  if (tool === 'boundary') return `Click each corner of your garden. ${exact} Click the first corner or press Enter to finish.`;
  if (g === 'area') return `Drag for a rectangle, or click each corner for any shape. ${exact}`;
  if (g === 'line') return `Click along the ${KINDS[tool as FeatureKind].label.toLowerCase()}'s centre line. ${exact} Double-click or press Enter to finish.`;
  return 'Drag out from the centre, or click the centre and type the radius.';
}

export function Plan({ store, garden, userPlants, prefs, prefsStore, pendingPlant = null, clearPending, now = new Date() }: Props) {
  const phone = useIsPhone();
  const [tool, setToolState] = useState<Tool>('select');
  const [selected, setSelected] = useState<Target | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const [calibration, setCalibration] = useState<[Point, Point] | null>(null);
  const [traceImage, setTraceImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState(() => resolveMode(prefs, matchMedia('(prefers-color-scheme: dark)').matches));
  const canvasApi = useRef<CanvasApi | null>(null);
  const [corners, setCorners] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gardenSheet, setGardenSheet] = useState(false);
  const [library, setLibrary] = useState<Plant[] | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('single');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusFinding, setFocusFinding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const focus = prefs.focus ?? LOOKS[prefs.look].focusByDefault;
  const showPhoto = prefs.photos === 'full' && !focus;
  const month = now.getMonth() + 1;
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;

  const setTool = (t: Tool) => {
    setToolState(t);
    setMessage(null);
    if (t !== 'select') setSelectedVertex(null);
    if (t === 'plant') {
      setSelected(null);
      setGardenSheet(false);
    }
  };

  useEffect(() => {
    loadLibrary().then(setLibrary, () => setLibrary([]));
  }, []);
  const plants = useMemo(() => (library ? allPlants(library, userPlants) : null), [library, userPlants]);
  const plantOf = useMemo(() => {
    const byId = new Map((plants ?? []).map((p) => [p.id, p]));
    return (id: string) => byId.get(id) ?? unknownPlant(id);
  }, [plants]);
  // Checks wait for the library, so plants never show as "unknown" for a moment.
  const findings: Finding[] = useMemo(() => (plants ? checkGarden(garden, plantOf) : []), [garden, plantOf, plants]);
  const warnings = findings.filter((f) => f.level === 'warn').length;
  const placing: Placing | null = useMemo(() => (plantId && plants ? { plant: plantOf(plantId), layout } : null), [plantId, layout, plants, plantOf]);

  // A plant picked on the Plants tab opens the Plant tool with it.
  useEffect(() => {
    if (!pendingPlant || !plants) return;
    setPlantId(pendingPlant);
    setTool('plant');
    clearPending?.();
  }, [pendingPlant, plants]);

  const showFinding = (f: Finding) => {
    const pts = garden.plantings.filter((p) => f.plantingIds.includes(p.id)).flatMap((p): Point[] => [[p.x, p.y], ...(p.endPoint ? [p.endPoint] : [])]);
    canvasApi.current?.show(pts);
    if (phone) {
      setGardenSheet(false);
      setSheetOpen(false);
    }
  };

  // Follow light/dark changes from the device.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setMode(resolveMode(prefs, mq.matches));
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [prefs.mode]);

  // Drop a selection whose feature has gone (deleted, or undone).
  useEffect(() => {
    if (selected?.type === 'feature' && !garden.features.some((f) => f.id === selected.id)) setSelected(null);
    if (selected?.type === 'planting' && !garden.plantings.some((p) => p.id === selected.id)) setSelected(null);
  }, [garden, selected]);

  // The trace photo lives in IndexedDB, not in the garden file.
  const hasTrace = !!garden.trace;
  useEffect(() => {
    if (!hasTrace) return setTraceImage(null);
    let url = '';
    let cancelled = false;
    loadBlob('trace')
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => !cancelled && setTraceImage(img);
        img.src = url;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasTrace]);

  const empty = garden.boundary.length === 0 && garden.features.length === 0;
  const moreValue = MORE.includes(tool as FeatureKind) ? tool : '';
  const drawing = geometryForTool(tool) !== null;

  const inspector = (
    <Inspector
      store={store}
      garden={garden}
      selected={selected}
      setSelected={(t) => {
        setSelected(t);
        setSelectedVertex(null);
      }}
      setTool={(t) => {
        setTool(t);
        setGardenSheet(false);
      }}
      calibration={calibration}
      clearCalibration={() => setCalibration(null)}
      plantOf={plantOf}
      findings={findings}
      focusFinding={focusFinding}
      setFocusFinding={setFocusFinding}
      onPickFinding={showFinding}
      colourOf={(id) => cropColour(id, mode)}
      startPlanting={() => setTool('plant')}
    />
  );

  const picker = (
    <PlantPicker
      plants={plants}
      plantId={plantId}
      setPlantId={(id) => {
        setPlantId(id);
        setPickerOpen(false);
        setMessage(null);
      }}
      layout={layout}
      setLayout={setLayout}
      month={month}
      phone={phone}
    />
  );

  const selectedFeature = selected?.type === 'feature' ? garden.features.find((f) => f.id === selected.id) : undefined;
  const selectedPlanting = selected?.type === 'planting' ? garden.plantings.find((p) => p.id === selected.id) : undefined;
  const sheetTitle = calibration
    ? 'Set the scale'
    : selectedFeature
      ? featureLabel(selectedFeature)
      : selectedPlanting
        ? plantOf(selectedPlanting.plantId).commonName
        : selected?.type === 'boundary'
          ? 'Boundary'
          : garden.name;
  const showSheet = phone && !drawing && (selected !== null || gardenSheet || calibration !== null);

  return (
    <div class={`plan ${focus ? 'plan-focus' : ''}`}>
      <header class="toolbar">
        <h1 class="toolbar-title">{garden.name}</h1>
        {!phone && (
          <div class="tools" role="toolbar" aria-label="Drawing tools">
            {MAIN_TOOLS.map((t) => (
              <button key={t.tool} type="button" class="tool" aria-pressed={tool === t.tool} title={`${t.label} (${t.key})`} onClick={() => setTool(t.tool)}>
                {t.label}
              </button>
            ))}
            <select
              class="tool tool-more"
              aria-label="More things to draw"
              value={moreValue}
              onChange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value as FeatureKind;
                if (v) setTool(v);
              }}
            >
              <option value="">More…</option>
              {MORE.map((k) => (
                <option key={k} value={k}>
                  {KINDS[k].label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div class="toolbar-actions">
          {warnings > 0 && (
            <button
              type="button"
              class="warn-count"
              aria-label={`${warnings} planting ${warnings === 1 ? 'warning' : 'warnings'}: show them`}
              title="Planting warnings"
              onClick={() => {
                setTool('select');
                setSelected(null);
                setCalibration(null);
                if (phone) setGardenSheet(true);
              }}
            >
              <span aria-hidden="true">!</span> {warnings}
            </button>
          )}
          <button type="button" class="icon-btn" aria-label="Fit the garden to the screen" title="Fit (0)" onClick={() => setFitSignal((n) => n + 1)}>
            <Icon name="fit" />
          </button>
          <button type="button" class="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!store.canUndo()} onClick={() => store.undo()}>
            <Icon name="undo" />
          </button>
          <button type="button" class="icon-btn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!store.canRedo()} onClick={() => store.redo()}>
            <Icon name="redo" />
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-pressed={focus}
            aria-label={focus ? 'Focus is on: photos hidden. Show photos' : 'Focus: hide photos'}
            title="Focus (F)"
            onClick={() => prefsStore.set({ focus: !focus })}
          >
            <Icon name="focus" />
          </button>
        </div>
      </header>

      <div class="plan-body">
        <main class="plan-stage">
          {showPhoto && <SeasonPhoto month={photoMonth} sizes="100vw" class="plan-margin-photo" credit={false} />}
          <div class="sheet">
            <PlanCanvas
              store={store}
              garden={garden}
              look={prefs.look}
              mode={mode}
              tool={tool}
              setTool={setTool}
              selected={selected}
              setSelected={setSelected}
              selectedVertex={selectedVertex}
              setSelectedVertex={setSelectedVertex}
              readOnly={false}
              crosshair={phone}
              apiRef={canvasApi}
              onDraftChange={setCorners}
              fitSignal={fitSignal}
              traceImage={traceImage}
              onCalibrate={(a, b) => {
                setCalibration([a, b]);
                setTool('select');
              }}
              plantOf={plantOf}
              findings={findings}
              focusFinding={focusFinding}
              placing={placing}
              onMessage={setMessage}
            />
            {empty && tool === 'select' && (
              <div class="plan-empty">
                <p class="plan-empty-title">Start with your boundary</p>
                <p>
                  {phone
                    ? 'Measure each side of your garden with a tape. Then put the crosshair on each corner and type the lengths.'
                    : 'Measure each side of your garden with a tape, then click its corners and type the lengths.'}
                </p>
                <button type="button" class="btn btn-primary" onClick={() => setTool('boundary')}>
                  Draw the boundary
                </button>
              </div>
            )}
            {!phone && (
              <p class={`plan-hint ${message ? 'plan-message' : ''}`} role="status">
                {message ?? hintFor(tool)}
              </p>
            )}
            {phone && !drawing && tool !== 'plant' && !showSheet && !empty && <p class="plan-hint">Tap something to select it; tap again and drag to move it. Pinch to zoom.</p>}
          </div>
        </main>
        {!phone && (
          <aside class="inspector" aria-label={tool === 'plant' ? 'Choose a plant' : 'Details'}>
            {tool === 'plant' ? picker : inspector}
          </aside>
        )}
      </div>

      {phone &&
        (tool === 'trace' || tool === 'calibrate' ? (
          <div class="draw-bar">
            <p class="draw-hint">
              {tool === 'trace' ? 'Drag to move the photo under the plan.' : 'Tap two points on the photo that you know the real distance between.'}
            </p>
            <div class="draw-buttons">
              <button type="button" class="btn btn-primary" onClick={() => setTool('select')}>
                Done
              </button>
            </div>
          </div>
        ) : tool === 'plant' ? (
          !placing || pickerOpen ? (
            <PhoneSheet title="Choose a plant" open fixed setOpen={() => undefined} onClose={() => (placing ? setPickerOpen(false) : setTool('select'))}>
              {picker}
            </PhoneSheet>
          ) : (
            <PhonePlantBar
              placing={placing}
              setLayout={setLayout}
              points={corners}
              api={canvasApi}
              message={message}
              changePlant={() => setPickerOpen(true)}
              done={() => setTool('select')}
            />
          )
        ) : drawing ? (
          <PhoneDrawBar key={tool} tool={tool} corners={corners} api={canvasApi} />
        ) : showSheet ? (
          <>
          <PhoneSheet
            title={sheetTitle}
            open={sheetOpen || gardenSheet || calibration !== null}
            setOpen={setSheetOpen}
            onClose={() => {
              setSelected(null);
              setSelectedVertex(null);
              setGardenSheet(false);
              setCalibration(null);
              setSheetOpen(false);
            }}
          >
            {inspector}
          </PhoneSheet>
          {!(sheetOpen || gardenSheet || calibration !== null) && (
            <PhoneToolTray setTool={setTool} gardenOpen={gardenSheet} toggleGarden={() => setGardenSheet((o) => !o)} />
          )}
          </>
        ) : (
          <PhoneToolTray setTool={setTool} gardenOpen={gardenSheet} toggleGarden={() => setGardenSheet((o) => !o)} />
        ))}
    </div>
  );
}
