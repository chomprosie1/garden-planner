// The garden in 3D: a full-screen view to look round, with the year slider
// under it and the time of day. three.js is loaded only when this opens.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { LifeStage } from '../lifecycle/stages';
import type { Garden, Plant, Planting } from '../model/types';
import { fileSafe } from '../share/poster';
import { sunDay, ukClock } from '../sun/position';
import type { LookId, Mode } from '../theme/looks';
import { buildScene } from '../three/scene';
import type { GardenView, Preset } from '../three/view';
import { canShareFiles, download } from './ShareDialog';
import { Icon } from './icons';
import { clockText } from './SunBar';
import { YearScrubber } from './YearScrubber';

interface Props {
  garden: Garden;
  plantOf: (id: string) => Plant;
  /** Each planting's stage on the day shown. */
  stageAt: ((pl: Planting) => { stage: LifeStage; guessed: boolean }) | null;
  today: string;
  date: string;
  setDate: (iso: string) => void;
  look: LookId;
  mode: Mode;
  phone: boolean;
  close: () => void;
}

/** Whether this browser can draw in 3D, checked without loading three.js. */
function canDraw3d(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const minutesOf = (d: Date | null, fallback: number) => {
  if (!d) return fallback;
  const c = ukClock(d);
  return c.hour * 60 + c.minute;
};

/** A thumb pad for walking on a touch screen: push up to walk on, down to step back, and to the sides to step sideways. */
function ThumbPad({ move }: { move: (forward: number, strafe: number) => void }) {
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const centre = useRef<[number, number] | null>(null);
  const R = 44;
  const at = (e: PointerEvent) => {
    const c = centre.current;
    if (!c) return;
    let [dx, dy] = [e.clientX - c[0], e.clientY - c[1]];
    const d = Math.hypot(dx, dy);
    if (d > R) [dx, dy] = [(dx / d) * R, (dy / d) * R];
    setKnob([dx, dy]);
    // A small dead zone in the middle, so resting a thumb doesn't creep.
    const k = (v: number) => (Math.abs(v) < R * 0.15 ? 0 : v / R);
    move(-k(dy), k(dx));
  };
  const end = () => {
    centre.current = null;
    setKnob([0, 0]);
    move(0, 0);
  };
  return (
    <div
      class="thumb-pad"
      role="img"
      aria-label="Walking pad: push up to walk on"
      onPointerDown={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        centre.current = [r.left + r.width / 2, r.top + r.height / 2];
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        at(e);
      }}
      onPointerMove={at}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span class="thumb-knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}

export function Garden3D({ garden, plantOf, stageAt, today, date, setDate, look, mode, phone, close }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<GardenView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'none' | 'failed'>(() => (canDraw3d() ? 'loading' : 'none'));
  const [minutes, setMinutes] = useState(13 * 60);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const down = useRef<{ x: number; y: number; lastX: number; lastY: number; dragging: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [walking, setWalking] = useState(false);
  const keys = useRef(new Set<string>());
  const coarse = useMemo(() => phone || matchMedia('(pointer: coarse)').matches, [phone]);

  const day = useMemo(() => sunDay(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)), garden.latitude, garden.longitude), [date, garden.latitude, garden.longitude]);
  const rise = minutesOf(day.sunrise, 6 * 60);
  const set = minutesOf(day.sunset, 20 * 60);
  const shown = Math.min(set - 10, Math.max(rise + 10, minutes));
  const scene = useMemo(() => buildScene({ garden, plantOf, ...(stageAt ? { stageOf: stageAt } : {}), date, minutes: shown }), [garden, plantOf, stageAt, date, shown]);

  // Load three.js and start the view.
  useEffect(() => {
    if (status === 'none') return;
    let gone = false;
    let ro: ResizeObserver | null = null;
    import('../three/view')
      .then(({ GardenView }) => {
        if (gone || !canvas.current || !wrap.current) return;
        const v = new GardenView(canvas.current, { phone });
        view.current = v;
        const fit = () => wrap.current && v.resize(wrap.current.clientWidth, wrap.current.clientHeight);
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(wrap.current);
        setStatus('ready');
      })
      .catch(() => !gone && setStatus('failed'));
    return () => {
      gone = true;
      ro?.disconnect();
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    if (status === 'ready') view.current?.show(scene, { look, mode }, garden);
  }, [status, scene, look, mode, garden]);

  // Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);

  // A name shows for a few seconds.
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(null), 3500);
    return () => clearTimeout(t);
  }, [label]);

  // Walking on a keyboard: W, A, S and D or the arrows. Up and down walk; left and right turn, or step sideways with A and D.
  useEffect(() => {
    if (!walking) return;
    const held = keys.current;
    const apply = () => {
      const on = (...k: string[]) => k.some((x) => held.has(x));
      const forward = (on('w', 'arrowup') ? 1 : 0) - (on('s', 'arrowdown') ? 1 : 0);
      const strafe = (on('d') ? 1 : 0) - (on('a') ? 1 : 0);
      const turn = (on('arrowright', 'e') ? 1 : 0) - (on('arrowleft', 'q') ? 1 : 0);
      view.current?.setMove(forward, strafe, turn);
    };
    const WALK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!WALK_KEYS.includes(k) || (e.target as HTMLElement).closest?.('input, select, textarea')) return;
      e.preventDefault();
      held.add(k);
      apply();
    };
    const onUp = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      apply();
    };
    const onBlur = () => {
      held.clear();
      apply();
    };
    addEventListener('keydown', onDown);
    addEventListener('keyup', onUp);
    addEventListener('blur', onBlur);
    return () => {
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      removeEventListener('blur', onBlur);
      held.clear();
    };
  }, [walking]);

  const preset = (p: Preset) => {
    view.current?.preset(p);
    setWalking(false);
  };
  const walk = () => {
    view.current?.startWalk();
    setWalking(!!view.current?.isWalking);
    setLabel(null);
  };
  const share = async () => {
    setPlaying(false);
    const blob = await view.current?.picture();
    if (!blob) return setMessage('The picture couldn’t be made.');
    const file = new File([blob], `${fileSafe(`${garden.name} in 3D`)}.png`, { type: 'image/png' });
    if (canShareFiles('image/png')) {
      try {
        await navigator.share({ files: [file], title: garden.name });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    download(file);
    setMessage('Picture saved.');
  };

  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false };
    if (walking) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  // While walking, a drag looks round.
  const onPointerMove = (e: PointerEvent) => {
    const d = down.current;
    if (!walking || !d) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.dragging = true;
    if (d.dragging) view.current?.look(e.clientX - d.lastX, e.clientY - d.lastY);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || d.dragging || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || !view.current || !wrap.current) return;
    if (walking) {
      // A tap on the ground walks there; on anything else, its name.
      const text = view.current.walkTap(e.clientX, e.clientY);
      const r = wrap.current.getBoundingClientRect();
      setLabel(text ? { text, x: e.clientX - r.left, y: e.clientY - r.top } : null);
      return;
    }
    // Two taps in the same place: go there, and turn round it.
    const now = performance.now();
    const last = lastTap.current;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    if (last && now - last.t < 350 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
      lastTap.current = null;
      setLabel(null);
      view.current.goTo(e.clientX, e.clientY);
      return;
    }
    const text = view.current.pick(e.clientX, e.clientY);
    const r = wrap.current.getBoundingClientRect();
    setLabel(text ? { text, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };

  return (
    <div class="garden-3d" role="dialog" aria-modal="true" aria-label={`${garden.name} in 3D`}>
      <header class="garden-3d-bar">
        <h2 class="garden-3d-title">{garden.name} in 3D</h2>
        <div class="button-row">
          <button type="button" class="chip" onClick={() => preset('above')} disabled={status !== 'ready'}>
            From above
          </button>
          <button type="button" class="chip" onClick={() => preset('standing')} disabled={status !== 'ready'}>
            Standing in it
          </button>
          <button type="button" class="chip" aria-pressed={walking} onClick={walk} disabled={status !== 'ready'}>
            Walk
          </button>
          <button type="button" class="icon-btn" aria-label="Close the 3D view" title="Close (Esc)" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div class="garden-3d-stage" ref={wrap}>
        {status !== 'none' && status !== 'failed' && (
          <canvas ref={canvas} class={`garden-3d-canvas${walking ? ' walking' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (down.current = null)} />
        )}
        {walking && coarse && <ThumbPad move={(f, s) => view.current?.setMove(f, s, 0)} />}
        {status === 'loading' && <p class="garden-3d-note">Building your garden in 3D…</p>}
        {status === 'none' && <p class="garden-3d-note">This browser can’t show 3D here, as it has 3D graphics (WebGL) turned off or missing. The plan and its share picture still work.</p>}
        {status === 'failed' && <p class="garden-3d-note">The 3D view couldn’t load. Check you’re online the first time you open it, then try again.</p>}
        {label && (
          <p class="garden-3d-label" style={{ left: `${label.x}px`, top: `${label.y}px` }} role="status">
            {label.text}
          </p>
        )}
        {status === 'ready' && (
          <p class="garden-3d-hint" role="status">
            {message ??
              (walking
                ? coarse
                  ? 'Walk with the pad, drag to look round, tap the ground to walk there.'
                  : 'W A S D or the arrow keys to walk, drag to look round, click the ground to walk there.'
                : phone
                  ? 'Drag to turn, two fingers to move and zoom. Double-tap to go there; tap for a name.'
                  : 'Drag to turn, right-drag to move, scroll to zoom. Double-click to go there; click for a name.')}
          </p>
        )}
      </div>
      <div class="garden-3d-time">
        <label>
          <span>Time of day: {clockText(shown)}</span>
          <input type="range" min={rise + 10} max={set - 10} step={10} value={shown} onInput={(e) => setMinutes(Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      </div>
      <YearScrubber today={today} date={date} setDate={setDate} playing={playing} setPlaying={setPlaying} phone={phone} share={share} />
    </div>
  );
}
