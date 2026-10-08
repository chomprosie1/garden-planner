// Set north with the phone's compass: point the phone the way the top of the
// plan does, and it works out where north is. Only on phones that have one.
// The same reading says which way a windowsill faces, in the Potting Shed.

import { useEffect, useRef, useState } from 'preact/hooks';
import { compassPoint, headingOf, meanHeading, northFromHeading } from '../geometry/compass';
import { updateGarden, type Store } from '../model/store';
import type { Facing } from '../model/types';

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** A phone or tablet that may have a compass. */
export const mayHaveCompass = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;

/** The phone's compass: start it, and read the heading its top edge points, smoothed over the last few readings. */
function useCompass(fallback: string) {
  const [on, setOn] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const recent = useRef<number[]>([]);

  useEffect(() => {
    if (!on) return;
    const read = (e: Event) => {
      const h = headingOf(e as DeviceOrientationEvent & { webkitCompassHeading?: number });
      if (h === null) return;
      recent.current = [...recent.current.slice(-9), h];
      setHeading(meanHeading(recent.current));
    };
    addEventListener('deviceorientationabsolute', read);
    addEventListener('deviceorientation', read);
    const quiet = setTimeout(() => recent.current.length === 0 && setProblem(`This device isn’t giving a compass reading. ${fallback}`), 3000);
    return () => {
      removeEventListener('deviceorientationabsolute', read);
      removeEventListener('deviceorientation', read);
      clearTimeout(quiet);
    };
  }, [on]);

  const start = async () => {
    setProblem(null);
    recent.current = [];
    setHeading(null);
    const ask = (window.DeviceOrientationEvent as unknown as OrientationCtor).requestPermission;
    if (ask) {
      try {
        if ((await ask()) !== 'granted') return setProblem(`The compass needs your permission. ${fallback}`);
      } catch {
        return setProblem(`The compass isn’t available here. ${fallback}`);
      }
    }
    setOn(true);
  };
  return { on, setOn, heading, problem, start };
}

export function CompassNorth({ store, onDone }: { store: Store; onDone?: (deg: number) => void }) {
  const { on, setOn, heading, problem, start } = useCompass('Set north by number instead.');
  if (!mayHaveCompass()) return null;

  const set = () => {
    if (heading === null) return;
    const deg = northFromHeading(heading);
    store.apply(updateGarden((g) => ({ ...g, northRotationDeg: deg })));
    setOn(false);
    onDone?.(deg);
  };

  if (!on)
    return (
      <div class="compass-north">
        <button type="button" class="btn" onClick={start}>
          Use your phone’s compass
        </button>
        {problem && <p class="muted small">{problem}</p>}
      </div>
    );

  return (
    <div class="compass-north compass-live" role="status">
      <p>Lay your phone flat, with its top edge pointing the same way as the top of your plan.</p>
      <p class="compass-reading">{heading === null ? 'Finding north…' : `The top of your plan faces ${compassPoint(heading)} (${Math.round(heading)}°).`}</p>
      {problem && <p class="muted small">{problem}</p>}
      <div class="button-row">
        <button type="button" class="btn btn-primary" disabled={heading === null} onClick={set}>
          Set north
        </button>
        <button type="button" class="btn" onClick={() => setOn(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Which way a window faces, from the phone laid flat on the sill with its top edge pointing out of the window. */
export function CompassFacing({ onSet }: { onSet: (f: Facing) => void }) {
  const { on, setOn, heading, problem, start } = useCompass('Choose the way it faces from the list instead.');
  if (!mayHaveCompass()) return null;

  if (!on)
    return (
      <div class="compass-north">
        <button type="button" class="btn" onClick={start}>
          Use your phone’s compass
        </button>
        {problem && <p class="muted small">{problem}</p>}
      </div>
    );

  return (
    <div class="compass-north compass-live" role="status">
      <p>Lay your phone flat on the sill, with its top edge pointing out of the window.</p>
      <p class="compass-reading">{heading === null ? 'Finding the way…' : `The window faces ${compassPoint(heading)} (${Math.round(heading)}°).`}</p>
      {problem && <p class="muted small">{problem}</p>}
      <div class="button-row">
        <button
          type="button"
          class="btn btn-primary"
          disabled={heading === null}
          onClick={() => {
            if (heading === null) return;
            onSet(compassPoint(heading) as Facing);
            setOn(false);
          }}
        >
          Set the way it faces
        </button>
        <button type="button" class="btn" onClick={() => setOn(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
