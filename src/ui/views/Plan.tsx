import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { jobsFor } from '../../calendar/jobs';
import type { Focus, TimeScene } from '../../canvas/render';
import { pickedBy, timeline, wetness } from '../../lifecycle/projection';
import { featureLabel, KINDS, type Target } from '../../model/features';
import { makeSpace, spaceInfo } from '../../model/spaces';
import { updateGarden, type Store } from '../../model/store';
import type { FeatureKind, Garden, Plant, Point } from '../../model/types';
import { checkGarden, formatHours, type Finding } from '../../planting/rules';
import { hoursAt } from '../../sun/hours';
import { fromUkClock, sunAt, sunDay, ukClock } from '../../sun/position';
import { shadowsAt } from '../../sun/shadow';
import { loadBlob } from '../../storage/idb';
import { resolveMode } from '../../theme/apply';
import { LOOKS } from '../../theme/looks';
import type { Prefs, PrefsStore } from '../../theme/prefs';
import { ActionPill } from '../ActionPill';
import { Dock, type Drawer } from '../Dock';
import { FillPopover, type Placed } from '../FillPopover';
import { useIsPhone } from '../hooks';
import { Icon } from '../icons';
import { Inspector } from '../Inspector';
import { isFocusLens, LensBar, LensLegend, type Lens } from '../Lenses';
import { PhoneDrawBar, PhoneHandBar, PhoneSheet, PlantingBar } from '../PhonePlanControls';
import { canDrawByHand, geometryForTool, PlanCanvas, type CanvasApi, type Placing, type SketchPen, type Tool } from '../PlanCanvas';
import { SeasonPhoto } from '../SeasonPhoto';
import { PlanChips } from '../PlanChips';
import { ShareDialog } from '../ShareDialog';
import { SketchBar } from '../SketchBar';
import { SpaceDialog } from '../SpacePicker';
import { useApp } from '../appContext';
import { clockText, SunBar, type CalendarDate, type SunView } from '../SunBar';
import { usePlants } from '../usePlants';
import { spacingStyle } from '../../planting/place';
import { useSunHours } from '../useSunHours';
import { useWeatherNow } from '../useWeather';
import { yearScene } from '../yearScene';
import { YearScrubber } from '../YearScrubber';

/** Something another screen (or search) asked the plan to do. */
export type PlanIntent =
  | { kind: 'plant'; id: string }
  | { kind: 'select'; target: Target }
  | { kind: 'tray'; trayId: string }
  | { kind: 'lens'; lens: Lens }
  /** Drop this sticker in the middle of the view. */
  | { kind: 'sticker'; id: string }
  | { kind: 'tool'; tool: Tool }
  | { kind: 'fit' }
  /** Ask "Where are you growing?". */
  | { kind: 'setup' }
  /** Share a picture of the plan. */
  | { kind: 'share' };

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

function hintFor(tool: Tool, phone: boolean, byHand = false, pen?: SketchPen): string {
  if (tool === 'sketch') {
    if (pen?.kind === 'eraser') return 'Click or drag over sketches to rub them out. Sketches are for ideas: they are never measured or checked.';
    if (pen?.kind === 'text') return 'Type the words above, then click where they go.';
    if (pen?.kind === 'arrow') return 'Drag from the tail to the head of the arrow.';
    return 'Draw on the plan. Sketches are for ideas: they are never measured or checked. Esc when done.';
  }
  if (byHand && canDrawByHand(tool))
    return `Draw the ${KINDS[tool as FeatureKind].label.toLowerCase()} by hand: hold and drag${geometryForTool(tool) === 'area' ? ' all the way round its edge' : ' along its centre line'}. It becomes a smooth curve you can reshape by its handles.`;
  if (tool === 'select')
    return phone
      ? 'Tap anything to pick it; drag it to move it. Add beds, pots and plants from below.'
      : 'Click anything to pick it, and drag it to move it; pull a corner to resize. Drag beds, pots and plants in from below. Scroll to zoom; 0 fits the garden.';
  if (tool === 'calibrate') return 'Click two points on the photo that you know the real distance between, such as the ends of a fence.';
  if (tool === 'trace') return 'Drag to move the photo under the plan. Press Esc when done.';
  if (tool === 'plant') return 'Click a bed, pot or planter to plant it. Esc when done.';
  const g = geometryForTool(tool);
  const exact = 'Type a length and press Enter for an exact edge (3450, or 3.45m).';
  if (tool === 'boundary') return `Click each corner of your garden. ${exact} Click the first corner or press Enter to finish.`;
  if (g === 'area') return `Drag for a rectangle, or click each corner for any shape. ${exact}`;
  if (g === 'line') return `Click along the ${KINDS[tool as FeatureKind].label.toLowerCase()}'s centre line. ${exact} Double-click or press Enter to finish.`;
  return 'Drag out from the centre, or click the centre and type the radius.';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: CalendarDate) => `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
const calendarOf = (iso: string): CalendarDate => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) });

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
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [corners, setCorners] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Placing['layout']>('auto');
  const [growingNow, setGrowingNow] = useState(false);
  /** A tray from the Potting Shed being planted out. */
  const [trayId, setTrayId] = useState<string | null>(null);
  const tray = trayId ? garden.trays?.find((t) => t.id === trayId) ?? null : null;
  const [focusFinding, setFocusFinding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [sketchPen, setSketchPen] = useState<SketchPen>({ kind: 'pen', colour: 'red', text: '' });
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [lens, setLens] = useState<Lens>('none');
  const [settingUp, setSettingUp] = useState(false);
  const [sharing, setSharing] = useState(false);
  const locked = prefs.layoutLocked;
  const app = useApp();

  // Sun and shade.
  const clock = ukClock(now);
  const today: CalendarDate = { year: clock.year, month: clock.month, day: clock.day };
  const sunOn = lens === 'sun' || lens === 'shade';
  const sunView: SunView = lens === 'sun' ? 'hours' : 'shadows';
  // The day the plan shows: today, or a week chosen on the year scrubber. The sun and shade lenses use it too.
  const todayIso = isoOf(today);
  const [when, setWhen] = useState(todayIso);
  const [yearPlaying, setYearPlaying] = useState(false);
  const sunDate = useMemo(() => calendarOf(when), [when]);
  const setSunDate = (d: CalendarDate) => setWhen(isoOf(d));
  const [minutes, setMinutes] = useState(clock.hour * 60 + clock.minute);
  const [playing, setPlaying] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [tapPoint, setTapPoint] = useState<Point | null>(null);

  const hidePhotos = prefs.focus ?? LOOKS[prefs.look].focusByDefault;
  const showPhoto = prefs.photos === 'full' && !hidePhotos;
  const month = now.getMonth() + 1;
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;

  const setTool = (t: Tool) => {
    setToolState(t);
    setMessage(null);
    setPlaced(null);
    if (t !== 'select') setSelectedVertex(null);
    if (t === 'plant') setSelected(null);
    // Drawing and sketching need the plan clear, so the dock's drawer closes on a phone.
    if (phone && t !== 'select') setDrawer(null);
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
  const shadows = useMemo(() => (sun && lens === 'shade' ? shadowsAt(garden, sun, sunDate.month) : null), [sun, lens, garden.features, garden.northRotationDeg, sunDate.month]);
  const viewGrid = useSunHours(garden, sunDate.month, sunDate.year, lens === 'sun');
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
  // The garden through the year: each planting's life, read at the chosen day.
  // With this year's weather on, the days it covers count as they were (or are forecast to be).
  const { weather } = useWeatherNow();
  const timelines = useMemo(() => (plants ? new Map(garden.plantings.map((pl) => [pl.id, timeline(plantOf(pl.plantId), pl, garden, todayIso, weather)])) : null), [garden, plants, plantOf, todayIso, weather]);
  const plantById = useMemo(() => new Map((plants ?? []).map((pl) => [pl.id, pl])), [plants]);
  const ideaOf = (id: string) => plantById.get(id) ?? null;
  const year = useMemo(() => (timelines ? yearScene(garden, plantOf, timelines, when, ideaOf) : null), [garden, plantOf, timelines, when, plantById]);
  const stageAt = year?.stageAt ?? null;
  const gaps = year?.gaps ?? [];
  // A week that looks the same as the last (same stages, month, frost, light and gaps) keeps the same scene, so
  // the plan isn't redrawn: scrubbing a big garden only redraws when something on it changes.
  const lastScene = useRef<{ key: string; garden: Garden; time: TimeScene } | null>(null);
  const time = useMemo(() => {
    if (!year) return null;
    const t = year.time;
    const key = [year.month, t.frost, [...(t.thawed ?? [])].sort().join('.'), t.light?.map((n) => n.toFixed(3)).join(':'), [...t.gaps].sort().join('.'), garden.plantings.map((pl) => `${t.stageOf(pl).stage}${t.stageOf(pl).guessed ? '?' : ''}`).join(',')].join('|');
    const prev = lastScene.current;
    if (prev && prev.key === key && prev.garden === garden) return prev.time;
    lastScene.current = { key, garden, time: t };
    return t;
  }, [year]);
  const shownMonth = Number(when.slice(5, 7));
  // The same goes for a lens that picks out the same plantings as last week.
  const lastFocus = useRef<Focus | null>(null);
  const focus: Focus | null = useMemo(() => {
    if (!isFocusLens(lens) || !stageAt) return (lastFocus.current = null);
    const ids = pickedBy(lens, garden, plantOf, stageAt, when, weather);
    const prev = lastFocus.current;
    if (prev && prev.kind === lens && prev.ids.size === ids.size && [...ids].every((id) => prev.ids.has(id))) return prev;
    return (lastFocus.current = { kind: lens, ids });
  }, [lens, stageAt, garden, plantOf, when, weather]);
  const focusGuessed = !!focus && !!stageAt && garden.plantings.some((pl) => focus.ids.has(pl.id) && stageAt(pl).guessed);
  // The month's jobs on their beds, from this month on; they can be ticked off in this month.
  const monthJobs = useMemo(() => {
    if (!plants || when.slice(0, 7) < todayIso.slice(0, 7)) return [];
    const done = new Set(garden.jobsDone.map((j) => j.key));
    return jobsFor(garden, plantOf, shownMonth, Number(when.slice(0, 4))).filter((j) => !done.has(j.key));
  }, [garden, plants, plantOf, when, todayIso, shownMonth]);
  const hoverHours = lens === 'sun' && viewGrid && hoverPoint ? hoursAt(viewGrid, hoverPoint) : null;
  const tapHours = lens === 'sun' && viewGrid && tapPoint ? hoursAt(viewGrid, tapPoint) : null;
  const warnings = findings.filter((f) => f.level === 'warn').length;
  const placing: Placing | null = useMemo(
    () => (plantId && plants ? { plant: plantOf(plantId), layout, growing: growingNow, ...(tray && tray.plantId === plantId ? { trayId: tray.id } : {}) } : null),
    [plantId, layout, growingNow, plants, plantOf, tray],
  );

  /** Ready to plant this: the next tap or click on a bed plants it. */
  const startPlanting = (id: string, fromTray: string | null = null) => {
    setTrayId(fromTray);
    setPlantId(id);
    setLayout('auto');
    setTool('plant');
  };

  // Another screen asked for something: a plant to place, a tray to plant out, a thing to show, or (from search) a lens, a sticker or a tool.
  useEffect(() => {
    if (!intent) return;
    // Plants wait for the library; the rest can happen straight away.
    if ((intent.kind === 'plant' || intent.kind === 'tray') && !plants) return;
    if (intent.kind === 'lens') setLens(intent.lens);
    else if (intent.kind === 'tool') setTool(intent.tool);
    else if (intent.kind === 'fit') setFitSignal((n) => n + 1);
    else if (intent.kind === 'setup') setSettingUp(true);
    else if (intent.kind === 'share') setSharing(true);
    else if (intent.kind === 'sticker') {
      const id = intent.id;
      setToolState('select');
      // The canvas sizes itself on its first frame; drop it once it has.
      setTimeout(() => canvasApi.current?.dropSticker(id), 80);
    } else if (intent.kind === 'plant') startPlanting(intent.id);
    else if (intent.kind === 'tray') {
      const t = garden.trays?.find((x) => x.id === intent.trayId);
      if (t) {
        startPlanting(t.plantId, t.id);
        setMessage(`Planting out ${t.count} ${plantOf(t.plantId).commonName.toLowerCase()} ${t.count === 1 ? 'plant' : 'plants'} from the Potting Shed: ${phone ? 'tap' : 'click'} the bed they go in.`);
      }
    } else {
      const t = intent.target;
      const pts =
        t.type === 'planting'
          ? garden.plantings.filter((p) => p.id === t.id).flatMap((p): Point[] => [[p.x, p.y], ...(p.endPoint ? [p.endPoint] : [])])
          : t.type === 'feature'
            ? (garden.features.find((f) => f.id === t.id)?.footprint ?? [])
            : garden.boundary;
      setToolState('select');
      setSelected(t);
      // The canvas sizes itself on its first frame; zoom once it has.
      setTimeout(() => (t.type === 'planting' ? canvasApi.current?.show(pts) : canvasApi.current?.zoomTo(pts)), 80);
    }
    clearIntent?.();
  }, [intent, plants]);

  const showFinding = (f: Finding) => {
    const pts = garden.plantings.filter((p) => f.plantingIds.includes(p.id)).flatMap((p): Point[] => [[p.x, p.y], ...(p.endPoint ? [p.endPoint] : [])]);
    canvasApi.current?.show(pts);
    if (phone) setSheetOpen(false);
  };

  // A tray is only being planted out while the Plant tool is on, and until it's planted.
  useEffect(() => {
    if (trayId && (tool !== 'plant' || !tray)) setTrayId(null);
  }, [tool, tray, trayId]);

  // S shows the shade and takes it away again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 's') return;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      setLens(lens === 'shade' ? 'none' : 'shade');
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
  // The fill pop-over belongs to the planting just dropped; picking something else puts it away.
  useEffect(() => {
    if (placed && !(selected?.type === 'planting' && selected.id === placed.id)) setPlaced(null);
  }, [selected]);

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
  const drawing = geometryForTool(tool) !== null;
  const select = (t: Target | null) => {
    setSelected(t);
    setSelectedVertex(null);
  };
  const makeTheSpace = (space: Parameters<typeof makeSpace>[1], w: number, d: number) => {
    store.apply(updateGarden((g) => makeSpace(g, space, w, d)));
    setFitSignal((n) => n + 1);
    setDrawer('plants');
    setMessage(`Your ${spaceInfo(space).label.toLowerCase()} is laid out. Drop plants from below into a bed or pot.`);
  };
  const toggleLock = () => {
    prefsStore.set({ layoutLocked: !locked });
    setMessage(locked ? 'Layout unlocked: beds and paths can be moved and reshaped.' : 'Layout locked: beds and paths stay put. Plants can still be moved.');
  };

  const inspector = (
    <Inspector
      store={store}
      garden={garden}
      sunLens={sunOn}
      locked={locked}
      selected={selected}
      setSelected={select}
      setTool={(t) => {
        setTool(t);
        setSheetOpen(false);
      }}
      calibration={calibration}
      clearCalibration={() => setCalibration(null)}
      plantOf={plantOf}
      findings={findings}
      focusFinding={focusFinding}
      setFocusFinding={setFocusFinding}
      onPickFinding={showFinding}
      startPlanting={() => {
        setDrawer('plants');
        setSheetOpen(false);
      }}
      sunJune={lens === 'sun' && viewGrid ? viewGrid : (juneGrid ?? null)}
      zoomTo={(pts) => {
        canvasApi.current?.zoomTo(pts);
        if (phone) setSheetOpen(false);
      }}
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
  const spotText = tapHours !== null ? `About ${formatHours(tapHours)} of direct sun where you tapped, on 15 ${MONTH_NAMES[sunDate.month - 1]}.` : null;

  const lockButton = (
    <button type="button" class="icon-btn" aria-pressed={locked} aria-label={locked ? 'Unlock the layout' : 'Lock the layout'} title={locked ? 'Layout locked: click to unlock' : 'Lock the layout, so beds and paths stay put'} onClick={toggleLock}>
      <Icon name={locked ? 'lock' : 'unlock'} />
    </button>
  );
  const lensBar = <LensBar lens={lens} setLens={setLens} phone={phone} warnings={warnings} />;

  const dock = (
    <Dock
      open={drawer}
      setOpen={(d) => {
        setDrawer(d);
        if (d && tool === 'plant') setTool('select');
      }}
      plants={plants}
      plantOf={plantOf}
      garden={garden}
      month={month}
      onPlant={(id) => {
        startPlanting(id);
        if (phone) setDrawer(null);
      }}
      onTray={(id) => {
        const t = garden.trays?.find((x) => x.id === id);
        if (t) startPlanting(t.plantId, t.id);
        if (phone) setDrawer(null);
      }}
      onSticker={(id) => {
        canvasApi.current?.dropSticker(id);
        if (phone) setDrawer(null);
      }}
      tool={tool}
      setTool={setTool}
      byHand={byHand}
      setByHand={setByHand}
      phone={phone}
    />
  );
  const plantingBar = placing && (
    <PlantingBar
      placing={placing}
      setLayout={setLayout}
      growing={growingNow}
      setGrowing={setGrowingNow}
      points={corners}
      api={canvasApi}
      message={message}
      changePlant={() => {
        setTool('select');
        setDrawer('plants');
      }}
      done={() => setTool('select')}
      phone={phone}
    />
  );

  // What sits under the plan: a bar for what you're doing, or the dock.
  const bottom =
    tool === 'trace' || tool === 'calibrate' ? (
      <div class="draw-bar">
        <p class="draw-hint">{tool === 'trace' ? 'Drag to move the photo under the plan.' : 'Tap two points on the photo that you know the real distance between.'}</p>
        <div class="draw-buttons">
          <button type="button" class="btn btn-primary" onClick={() => setTool('select')}>
            Done
          </button>
        </div>
      </div>
    ) : tool === 'plant' && plantingBar ? (
      plantingBar
    ) : tool === 'sketch' && phone ? (
      sketchBar
    ) : drawing && phone && byHand && canDrawByHand(tool) ? (
      <PhoneHandBar tool={tool} message={message} useCorners={() => setByHand(false)} cancel={() => setTool('select')} />
    ) : drawing && phone ? (
      <PhoneDrawBar key={tool} tool={tool} corners={corners} api={canvasApi} byHand={() => setByHand(true)} />
    ) : phone && (sheetOpen || calibration) ? (
      <PhoneSheet
        title={sheetTitle}
        open
        setOpen={(o) => !o && setSheetOpen(false)}
        onClose={() => {
          setSheetOpen(false);
          setCalibration(null);
        }}
      >
        {inspector}
      </PhoneSheet>
    ) : (
      dock
    );

  return (
    <div class={`plan ${hidePhotos ? 'plan-focus' : ''} ${locked ? 'plan-locked' : ''}`}>
      <header class="toolbar">
        <h1 class="toolbar-title">{garden.name}</h1>
        {!phone && lensBar}
        <div class="toolbar-actions">
          <button type="button" class="icon-btn" aria-label="Search everything" title="Search everything (Ctrl+K)" onClick={() => app.openSearch()}>
            <Icon name="search" />
          </button>
          {lockButton}
          {!phone && (
            <button type="button" class="icon-btn" aria-label="Fit the garden to the screen" title="Fit (0)" onClick={() => setFitSignal((n) => n + 1)}>
              <Icon name="fit" />
            </button>
          )}
          <button type="button" class="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!store.canUndo()} onClick={() => store.undo()}>
            <Icon name="undo" />
          </button>
          <button type="button" class="icon-btn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!store.canRedo()} onClick={() => store.redo()}>
            <Icon name="redo" />
          </button>
          {phone && (
            <button type="button" class="icon-btn" aria-label="Garden details" title="Details" onClick={() => setSheetOpen(true)}>
              <Icon name="info" />
            </button>
          )}
          {prefs.photos === 'full' && !phone && (
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
      {phone && <div class="lens-row">{lensBar}</div>}

      {sunOn && (
        <SunBar
          view={sunView}
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
      )}
      {!phone && tool === 'sketch' && sketchBar}
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
              // G with no plant chosen opens the plants in the dock.
              setTool={(t) => (t === 'plant' && !placing ? setDrawer('plants') : setTool(t))}
              selected={selected}
              setSelected={setSelected}
              selectedVertex={selectedVertex}
              setSelectedVertex={setSelectedVertex}
              readOnly={false}
              edit="all"
              locked={locked}
              pillRef={pillRef}
              onPlaced={(id, at, world) => setPlaced({ id, at, world })}
              crosshair={phone}
              phone={phone}
              byHand={byHand}
              sketchPen={sketchPen}
              showSketches={prefs.sketches || tool === 'sketch'}
              depth={prefs.depth ?? prefs.look !== 'minimal'}
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
              shadows={shadows}
              sunGrid={lens === 'sun' ? (viewGrid ?? null) : null}
              sun={sun}
              time={time}
              month={shownMonth}
              focus={focus}
              onHoverPoint={setHoverPoint}
              onTap={setTapPoint}
            >
              <ActionPill
                pillRef={pillRef}
                target={tool === 'select' ? selected : null}
                garden={garden}
                store={store}
                plantOf={plantOf}
                locked={locked}
                more={() => (phone ? setSheetOpen(true) : document.querySelector<HTMLElement>('.inspector')?.focus())}
                plantHere={() => setDrawer('plants')}
                select={select}
                unlock={toggleLock}
                redrawBoundary={() => setTool('boundary')}
              />
              {placed && <FillPopover placed={placed} garden={garden} store={store} plantOf={plantOf} close={() => setPlaced(null)} />}
              {tool === 'select' && lens === 'none' && plants && (
                <PlanChips
                  garden={garden}
                  store={store}
                  plantOf={plantOf}
                  jobs={monthJobs}
                  canTick={when.slice(0, 7) === todayIso.slice(0, 7)}
                  gaps={gaps}
                  today={todayIso}
                  plant={(id) => startPlanting(id)}
                />
              )}
            </PlanCanvas>
            {focus && (
              <div class="lens-legend-wrap">
                <LensLegend kind={focus.kind} count={focus.ids.size} guessed={focusGuessed} live={!!weather} rain={focus.kind === 'water' ? (wetness(weather, when)?.rain3 ?? null) : null} />
              </div>
            )}
            {empty && tool === 'select' && (
              <div class="plan-empty">
                <p class="plan-empty-title">Start your plan</p>
                <p>Say where you’re growing and it’s laid out for you. Or drag a raised bed, a pot or a lawn in from below, or draw your garden’s boundary to scale.</p>
                <div class="button-row">
                  <button type="button" class="btn btn-primary" onClick={() => setSettingUp(true)}>
                    Where are you growing?
                  </button>
                  <button type="button" class="btn" onClick={() => setDrawer('beds')}>
                    Beds and pots
                  </button>
                  <button type="button" class="btn" onClick={() => setTool('boundary')}>
                    Draw the boundary
                  </button>
                </div>
              </div>
            )}
            {!phone && (
              <p class={`plan-hint ${message ? 'plan-message' : ''}`} role="status">
                {message ??
                  (hoverHours !== null
                    ? `About ${formatHours(hoverHours)} of direct sun here on 15 ${MONTH_NAMES[sunDate.month - 1]}.`
                    : lens === 'shade'
                      ? `Shadows at ${clockText(shownMinutes)}. Drag the slider or press play to watch them move.`
                      : lens === 'sun'
                        ? 'Point at the plan to see how many hours of sun each spot gets.'
                        : hintFor(tool, phone, byHand, sketchPen))}
              </p>
            )}
          </div>
          {(tool === 'select' || tool === 'plant') && !empty && (
            <YearScrubber
              today={todayIso}
              date={when}
              setDate={setWhen}
              playing={yearPlaying}
              setPlaying={setYearPlaying}
              phone={phone}
              share={() => {
                setYearPlaying(false);
                setSharing(true);
              }}
            />
          )}
          {!phone && bottom}
        </main>
        {!phone && (
          <aside class="inspector" tabIndex={-1} aria-label="Details">
            {inspector}
          </aside>
        )}
      </div>
      {phone && bottom}
      {settingUp && <SpaceDialog make={(c) => makeTheSpace(c.space, c.w, c.d)} close={() => setSettingUp(false)} />}
      {sharing && timelines && <ShareDialog garden={garden} plantOf={plantOf} ideaOf={ideaOf} timelines={timelines} date={when} look={prefs.look} mode={colourMode} close={() => setSharing(false)} />}
    </div>
  );
}
