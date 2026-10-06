import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { featureLabel, KINDS, type Target } from '../../model/features';
import type { Store } from '../../model/store';
import type { FeatureKind, Garden, Plant, Point } from '../../model/types';
import { isContainer, type Layout } from '../../planting/place';
import { checkGarden, formatHours, type Finding } from '../../planting/rules';
import { hoursAt } from '../../sun/hours';
import { fromUkClock, sunAt, sunDay, ukClock } from '../../sun/position';
import { shadowsAt } from '../../sun/shadow';
import { loadBlob } from '../../storage/idb';
import { resolveMode } from '../../theme/apply';
import { LOOKS } from '../../theme/looks';
import type { PlanMode, Prefs, PrefsStore } from '../../theme/prefs';
import { useIsPhone } from '../hooks';
import { Icon } from '../icons';
import { Inspector } from '../Inspector';
import { PhoneDrawBar, PhoneHandBar, PhoneModeBar, PhonePlantBar, PhoneSheet } from '../PhonePlanControls';
import { canDrawByHand, geometryForTool, PlanCanvas, type CanvasApi, type Placing, type SketchPen, type Tool } from '../PlanCanvas';
import { SketchBar } from '../SketchBar';
import { PlantPicker } from '../PlantPicker';
import { SeasonPhoto } from '../SeasonPhoto';
import { clockText, SunBar, type CalendarDate, type SunView } from '../SunBar';
import { usePlants } from '../usePlants';
import { spacingStyle } from '../../planting/place';
import { useSunHours } from '../useSunHours';

/** Something another screen asked the plan to do. */
export type PlanIntent = { kind: 'plant'; id: string } | { kind: 'select'; target: Target };

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  prefsStore: PrefsStore;
  intent?: PlanIntent | null;
  clearIntent?: () => void;
  now?: Date;
}

const MODES: { mode: PlanMode; label: string; hint: string }[] = [
  { mode: 'layout', label: 'Layout', hint: 'Draw the boundary, beds, paths and other things' },
  { mode: 'planting', label: 'Planting', hint: 'Put plants in beds and check them' },
  { mode: 'sun', label: 'Sun', hint: 'Shadows and hours of sun' },
];

const LAYOUT_TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 'V' },
  { tool: 'boundary', label: 'Boundary', key: 'B' },
  { tool: 'bed', label: 'Bed', key: 'R' },
  { tool: 'surface', label: 'Surface', key: 'U' },
  { tool: 'path', label: 'Path', key: 'P' },
  { tool: 'fence', label: 'Fence', key: 'L' },
  { tool: 'tree', label: 'Tree', key: 'T' },
];
const MORE: FeatureKind[] = ['wall', 'hedge', 'building', 'greenhouse', 'compost', 'water', 'other'];

const modeOfTool = (t: Tool): PlanMode | null => (t === 'plant' ? 'planting' : t === 'select' || t === 'sketch' ? null : 'layout');

function hintFor(tool: Tool, mode: PlanMode, byHand = false, pen?: SketchPen): string {
  if (tool === 'sketch') {
    if (pen?.kind === 'eraser') return 'Click or drag over sketches to rub them out. Sketches are for ideas: they are never measured or checked.';
    if (pen?.kind === 'text') return 'Type the words above, then click where they go.';
    if (pen?.kind === 'arrow') return 'Drag from the tail to the head of the arrow.';
    return 'Draw on the plan. Sketches are for ideas: they are never measured or checked. Esc when done.';
  }
  if (byHand && canDrawByHand(tool))
    return `Draw the ${KINDS[tool as FeatureKind].label.toLowerCase()} by hand: hold and drag${geometryForTool(tool) === 'area' ? ' all the way round its edge' : ' along its centre line'}. It becomes a smooth curve you can reshape by its handles.`;
  if (tool === 'select') {
    if (mode === 'planting') return 'Click a plant or bed to see it; drag a plant to move it. Double-click a bed to zoom in. Choose Plant to add plants.';
    return 'Click something to select it. Drag empty space to pan; scroll to zoom. Press 0 to fit the garden.';
  }
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Plan({ store, garden, userPlants, prefs, prefsStore, intent = null, clearIntent, now = new Date() }: Props) {
  const phone = useIsPhone();
  const [tool, setToolState] = useState<Tool>('select');
  const [selected, setSelected] = useState<Target | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const [calibration, setCalibration] = useState<[Point, Point] | null>(null);
  const [traceImage, setTraceImage] = useState<HTMLImageElement | null>(null);
  const [colourMode, setColourMode] = useState(() => resolveMode(prefs, matchMedia('(prefers-color-scheme: dark)').matches));
  const canvasApi = useRef<CanvasApi | null>(null);
  const [corners, setCorners] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gardenSheet, setGardenSheet] = useState(false);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('single');
  const [growingNow, setGrowingNow] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusFinding, setFocusFinding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [sketchPen, setSketchPen] = useState<SketchPen>({ kind: 'pen', colour: 'red', text: '' });

  // Which part of the plan: the layout until there's a boundary, then planting, unless you've chosen.
  const mode: PlanMode = prefs.planMode ?? (garden.boundary.length < 3 ? 'layout' : 'planting');
  const [previousMode, setPreviousMode] = useState<PlanMode>(mode === 'sun' ? 'planting' : mode);

  // Sun and shade.
  const clock = ukClock(now);
  const today: CalendarDate = { year: clock.year, month: clock.month, day: clock.day };
  const sunOn = mode === 'sun';
  const [sunView, setSunView] = useState<SunView>('shadows');
  const [sunDate, setSunDate] = useState<CalendarDate>(today);
  const [minutes, setMinutes] = useState(clock.hour * 60 + clock.minute);
  const [playing, setPlaying] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [tapPoint, setTapPoint] = useState<Point | null>(null);

  const hidePhotos = prefs.focus ?? LOOKS[prefs.look].focusByDefault;
  const showPhoto = prefs.photos === 'full' && !hidePhotos;
  const month = now.getMonth() + 1;
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;

  const setMode = (m: PlanMode) => {
    if (m === mode) {
      if (prefs.planMode !== m) prefsStore.set({ planMode: m });
      return;
    }
    if (mode !== 'sun') setPreviousMode(mode);
    prefsStore.set({ planMode: m });
    setToolState('select');
    setMessage(null);
    setPlaying(false);
    setSelectedVertex(null);
    setGardenSheet(false);
    // A plant selected for planting means nothing to the layout, and the other way round.
    if (m === 'layout' && selected?.type === 'planting') setSelected(null);
  };

  const setTool = (t: Tool) => {
    const m = modeOfTool(t);
    if (m && m !== mode && mode !== 'sun') setPreviousMode(mode);
    // Remember the mode as soon as a tool is used, so finishing a boundary doesn't flip you into Planting.
    if (m && prefs.planMode !== m) prefsStore.set({ planMode: m });
    setToolState(t);
    setMessage(null);
    if (t !== 'select') setSelectedVertex(null);
    if (t === 'plant') {
      setSelected(null);
      setGardenSheet(false);
    }
  };

  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const day = useMemo(() => sunDay(sunDate.year, sunDate.month, sunDate.day, garden.latitude, garden.longitude), [sunDate, garden.latitude, garden.longitude]);
  const minutesOf = (d: Date | null, fallback: number) => {
    if (!d) return fallback;
    const c = ukClock(d);
    return c.hour * 60 + c.minute;
  };
  const rise = minutesOf(day.sunrise, 0);
  const set = minutesOf(day.sunset, 24 * 60 - 1);
  // Night-time on the chosen day shows noon instead, so there's always something to see.
  const shownMinutes = minutes < rise || minutes > set ? minutesOf(day.noon, 12 * 60) : minutes;
  const sun = useMemo(
    () => (sunOn ? sunAt(fromUkClock(sunDate.year, sunDate.month, sunDate.day, Math.floor(shownMinutes / 60), shownMinutes % 60), garden.latitude, garden.longitude) : null),
    [sunOn, sunDate, shownMinutes, garden.latitude, garden.longitude],
  );
  const shadows = useMemo(
    () => (sun && sunView === 'shadows' ? shadowsAt(garden, sun, sunDate.month) : null),
    [sun, sunView, garden.features, garden.northRotationDeg, sunDate.month],
  );
  const viewGrid = useSunHours(garden, sunDate.month, sunDate.year, sunOn && sunView === 'hours');
  useEffect(() => {
    if (!playing) return;
    // With reduced motion, the day moves in bigger, slower steps.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setInterval(() => setMinutes((m) => (m + (reduced ? 30 : 10) > set || m < rise ? rise : m + (reduced ? 30 : 10))), reduced ? 700 : 120);
    return () => clearInterval(t);
  }, [playing, rise, set]);

  // Light is checked against June's sun hours, worked out once the plan has drawn.
  const growing = garden.plantings.some((p) => !p.removedOn);
  const juneGrid = useSunHours(garden, 6, today.year, (growing || sunOn) && !!plants);
  // Checks wait for the library, so plants never show as "unknown" for a moment.
  const findings: Finding[] = useMemo(() => (plants ? checkGarden(garden, plantOf, juneGrid ?? null) : []), [garden, plantOf, plants, juneGrid]);
  const hoverHours = sunOn && sunView === 'hours' && viewGrid && hoverPoint ? hoursAt(viewGrid, hoverPoint) : null;
  const tapHours = sunOn && sunView === 'hours' && viewGrid && tapPoint ? hoursAt(viewGrid, tapPoint) : null;
  const warnings = findings.filter((f) => f.level === 'warn').length;
  const placing: Placing | null = useMemo(
    () => (plantId && plants ? { plant: plantOf(plantId), layout, growing: growingNow } : null),
    [plantId, layout, growingNow, plants, plantOf],
  );

  // Another screen asked for something: a plant to place, or a thing to show.
  useEffect(() => {
    if (!intent || !plants) return;
    if (intent.kind === 'plant') {
      setPlantId(intent.id);
      setTool('plant');
    } else {
      const t = intent.target;
      const pts =
        t.type === 'planting'
          ? garden.plantings.filter((p) => p.id === t.id).flatMap((p): Point[] => [[p.x, p.y], ...(p.endPoint ? [p.endPoint] : [])])
          : t.type === 'feature'
            ? (garden.features.find((f) => f.id === t.id)?.footprint ?? [])
            : garden.boundary;
      const f = t.type === 'feature' ? garden.features.find((x) => x.id === t.id) : undefined;
      prefsStore.set({ planMode: t.type === 'planting' || (f && isContainer(f)) ? 'planting' : 'layout' });
      setToolState('select');
      setSelected(t);
      if (phone) setSheetOpen(true);
      // The canvas sizes itself on its first frame; zoom once it has.
      setTimeout(() => (t.type === 'planting' ? canvasApi.current?.show(pts) : canvasApi.current?.zoomTo(pts)), 80);
    }
    clearIntent?.();
  }, [intent, plants]);

  const showFinding = (f: Finding) => {
    const pts = garden.plantings.filter((p) => f.plantingIds.includes(p.id)).flatMap((p): Point[] => [[p.x, p.y], ...(p.endPoint ? [p.endPoint] : [])]);
    canvasApi.current?.show(pts);
    if (phone) {
      setGardenSheet(false);
      setSheetOpen(false);
    }
  };

  // S switches to sun and shade and back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 's') return;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      setMode(sunOn ? previousMode : 'sun');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // Follow light/dark changes from the device.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setColourMode(resolveMode(prefs, mq.matches));
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [prefs.mode]);

  // Drop a selection whose thing has gone (deleted, or undone).
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
  const sketchBar = (
    <SketchBar
      pen={sketchPen}
      setPen={(pen) => {
        setSketchPen(pen);
        setMessage(null);
      }}
      store={store}
      garden={garden}
      prefs={prefs}
      prefsStore={prefsStore}
      look={prefs.look}
      mode={colourMode}
      {...(phone ? { done: () => setTool('select') } : {})}
    />
  );
  const sketchButton = (
    <button type="button" class="tool" aria-pressed={tool === 'sketch'} title="Sketch (K)" onClick={() => setTool(tool === 'sketch' ? 'select' : 'sketch')}>
      Sketch
    </button>
  );
  const moreValue = MORE.includes(tool as FeatureKind) ? tool : '';
  const drawing = geometryForTool(tool) !== null;
  const select = (t: Target | null) => {
    setSelected(t);
    setSelectedVertex(null);
  };

  const inspector = (
    <Inspector
      store={store}
      garden={garden}
      mode={mode}
      setMode={setMode}
      selected={selected}
      setSelected={select}
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
      startPlanting={() => setTool('plant')}
      sunJune={sunOn && sunView === 'hours' && viewGrid ? viewGrid : (juneGrid ?? null)}
      zoomTo={(pts) => {
        canvasApi.current?.zoomTo(pts);
        if (phone) setSheetOpen(false);
      }}
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
      growing={growingNow}
      setGrowing={setGrowingNow}
      month={month}
      phone={phone}
      close={spacingStyle(garden) === 'close'}
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
          : mode === 'planting'
            ? 'Beds and plant checks'
            : mode === 'sun'
              ? 'Sun in your garden'
              : garden.name;
  const showSheet = phone && !drawing && tool !== 'plant' && (selected !== null || gardenSheet || calibration !== null);
  const sheetIsOpen = sheetOpen || gardenSheet || calibration !== null;
  const spotText =
    tapHours !== null
      ? `About ${formatHours(tapHours)} of direct sun where you tapped, on 15 ${MONTH_NAMES[sunDate.month - 1]}.`
      : null;

  const modeSwitch = (
    <div class="mode-switch" role="tablist" aria-label="Plan">
      {MODES.map((m) => (
        <button key={m.mode} type="button" role="tab" class="mode-tab" aria-selected={mode === m.mode} title={m.hint} onClick={() => setMode(m.mode)}>
          {m.mode === 'sun' && <Icon name="sun" size={16} />}
          {m.label}
          {m.mode === 'planting' && warnings > 0 && (
            <span class="mode-badge" aria-label={`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`}>
              {warnings}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // Desktop: the tools for the current mode, under the header.
  const desktopBar =
    mode === 'layout' ? (
      <div class="mode-bar" role="toolbar" aria-label="Drawing tools">
        {LAYOUT_TOOLS.map((t) => (
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
        <span class="tool-sep" aria-hidden="true" />
        <button
          type="button"
          class="tool"
          aria-pressed={byHand}
          title="Draw areas and lines by hand, as smooth curves"
          onClick={() => {
            setByHand(!byHand);
            setMessage(null);
          }}
        >
          By hand
        </button>
        {sketchButton}
      </div>
    ) : mode === 'planting' ? (
      <div class="mode-bar" role="toolbar" aria-label="Planting tools">
        <button type="button" class="tool" aria-pressed={tool === 'select'} title="Select (V)" onClick={() => setTool('select')}>
          Select
        </button>
        <button type="button" class="tool" aria-pressed={tool === 'plant'} title="Plant (G)" onClick={() => setTool('plant')}>
          Plant
        </button>
        {sketchButton}
        {warnings > 0 && (
          <button
            type="button"
            class="warn-count"
            onClick={() => {
              setTool('select');
              setSelected(null);
            }}
          >
            <span aria-hidden="true">!</span> {warnings} {warnings === 1 ? 'thing' : 'things'} to check
          </button>
        )}
      </div>
    ) : null;

  return (
    <div class={`plan plan-mode-${mode} ${hidePhotos ? 'plan-focus' : ''}`}>
      <header class="toolbar">
        <h1 class="toolbar-title">{garden.name}</h1>
        {!phone && modeSwitch}
        <div class="toolbar-actions">
          <button type="button" class="icon-btn" aria-label="Fit the garden to the screen" title="Fit (0)" onClick={() => setFitSignal((n) => n + 1)}>
            <Icon name="fit" />
          </button>
          <button type="button" class="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!store.canUndo()} onClick={() => store.undo()}>
            <Icon name="undo" />
          </button>
          <button type="button" class="icon-btn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!store.canRedo()} onClick={() => store.redo()}>
            <Icon name="redo" />
          </button>
          {prefs.photos === 'full' && (
            <button
              type="button"
              class="icon-btn"
              aria-pressed={hidePhotos}
              aria-label={hidePhotos ? 'Show photos around the plan' : 'Hide photos around the plan'}
              title={hidePhotos ? 'Show photos (H)' : 'Hide photos (H)'}
              onClick={() => prefsStore.set({ focus: !hidePhotos })}
            >
              <Icon name={hidePhotos ? 'image-off' : 'image'} />
            </button>
          )}
        </div>
      </header>
      {phone && <div class="mode-switch-row">{modeSwitch}</div>}

      {sunOn ? (
        <SunBar
          view={sunView}
          setView={setSunView}
          today={today}
          date={sunDate}
          setDate={setSunDate}
          minutes={shownMinutes}
          setMinutes={setMinutes}
          playing={playing}
          setPlaying={setPlaying}
          day={day}
          sun={sun}
          grid={viewGrid}
          spot={phone ? spotText : null}
          defaultLocation={garden.latitude === 52.5 && garden.longitude === -1.5}
        />
      ) : (
        !phone && desktopBar
      )}
      {!phone && !sunOn && tool === 'sketch' && sketchBar}
      <div class="plan-body">
        <main class="plan-stage">
          {showPhoto && <SeasonPhoto month={photoMonth} sizes="100vw" class="plan-margin-photo" credit={false} />}
          <div class="sheet">
            <PlanCanvas
              store={store}
              garden={garden}
              look={prefs.look}
              mode={colourMode}
              tool={tool}
              setTool={setTool}
              selected={selected}
              setSelected={setSelected}
              selectedVertex={selectedVertex}
              setSelectedVertex={setSelectedVertex}
              readOnly={false}
              edit={mode === 'sun' ? 'view' : mode}
              crosshair={phone}
              phone={phone}
              byHand={byHand}
              sketchPen={sketchPen}
              showSketches={prefs.sketches || tool === 'sketch'}
              apiRef={canvasApi}
              onDraftChange={setCorners}
              fitSignal={fitSignal}
              traceImage={traceImage}
              onCalibrate={(a, b) => {
                setCalibration([a, b]);
                setTool('select');
              }}
              plantOf={plantOf}
              findings={mode === 'planting' ? findings : []}
              focusFinding={focusFinding}
              placing={placing}
              onMessage={setMessage}
              shadows={shadows}
              sunGrid={sunOn && sunView === 'hours' ? (viewGrid ?? null) : null}
              sun={sun}
              onHoverPoint={setHoverPoint}
              onTap={setTapPoint}
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
                {message ??
                  (hoverHours !== null
                    ? `About ${formatHours(hoverHours)} of direct sun here on 15 ${MONTH_NAMES[sunDate.month - 1]}.`
                    : sunOn && sunView === 'shadows'
                      ? `Shadows at ${clockText(shownMinutes)}. Drag the slider or press play to watch them move.`
                      : sunOn
                        ? 'Point at the plan to see how many hours of sun each spot gets.'
                        : hintFor(tool, mode, byHand, sketchPen))}
              </p>
            )}
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
        ) : tool === 'sketch' ? (
          sketchBar
        ) : drawing && byHand && canDrawByHand(tool) ? (
          <PhoneHandBar tool={tool} message={message} useCorners={() => setByHand(false)} cancel={() => setTool('select')} />
        ) : drawing ? (
          <PhoneDrawBar key={tool} tool={tool} corners={corners} api={canvasApi} byHand={() => setByHand(true)} />
        ) : showSheet ? (
          <PhoneSheet
            title={sheetTitle}
            open={sheetIsOpen}
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
        ) : (
          <PhoneModeBar
            mode={mode}
            setTool={(t) => {
              // Picking a shape from the phone's bar draws with corners, unless you then choose to draw by hand.
              if (t !== 'sketch') setByHand(false);
              setTool(t);
            }}
            warnings={warnings}
            openDetails={() => setGardenSheet(true)}
            empty={empty}
          />
        ))}
    </div>
  );
}
