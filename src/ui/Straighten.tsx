// Straighten the trace photo: tap four corners of something rectangular in it,
// give its size, and the photo is redrawn as if from straight above, to scale,
// with that rectangle's near-left corner at the bottom left of the garden. The
// maths is in src/geometry/straighten.ts.

import { useEffect, useRef, useState } from 'preact/hooks';
import { bounds } from '../geometry/polygon';
import { goodCorners, project, straightenPlan, type StraightPlan } from '../geometry/straighten';
import type { Store } from '../model/store';
import type { Garden, Point } from '../model/types';
import { openTraceKey } from '../storage/gardens';
import { loadBlob, saveBlob } from '../storage/idb';
import { MetresField } from './SpacePicker';

const CORNER_WORDS = ['near left', 'near right', 'far right', 'far left'];

/** Redraws the photo through the plan, sampling between pixels so it stays smooth. */
function draw(img: HTMLImageElement, plan: StraightPlan): HTMLCanvasElement {
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sc = src.getContext('2d')!;
  sc.drawImage(img, 0, 0);
  const from = sc.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas');
  out.width = plan.width;
  out.height = plan.height;
  const oc = out.getContext('2d')!;
  const image = oc.createImageData(plan.width, plan.height);
  const to = image.data;
  const W = src.width;
  const H = src.height;
  for (let j = 0; j < plan.height; j++) {
    for (let i = 0; i < plan.width; i++) {
      const [x, y] = project(plan.toPhoto, [i + 0.5, j + 0.5]);
      const fx = x - 0.5;
      const fy = y - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue; // off the photo: left clear
      const dx = fx - x0;
      const dy = fy - y0;
      const k = (j * plan.width + i) * 4;
      const a = (y0 * W + x0) * 4;
      const b = a + 4;
      const c = a + W * 4;
      const d = c + 4;
      for (let ch = 0; ch < 4; ch++) to[k + ch] = (from[a + ch]! * (1 - dx) + from[b + ch]! * dx) * (1 - dy) + (from[c + ch]! * (1 - dx) + from[d + ch]! * dx) * dy;
    }
  }
  oc.putImageData(image, 0, 0);
  return out;
}

export function Straighten({ store, garden, close }: { store: Store; garden: Garden; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [w, setW] = useState(3000);
  const [d, setD] = useState(3000);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dl = ref.current;
    if (dl && !dl.open) dl.showModal();
    let made = '';
    loadBlob(openTraceKey())
      .then((blob) => {
        if (!blob) return setError('The photo couldn’t be found on this device. Choose it again.');
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => setError('The photo couldn’t be read. Choose it again.'));
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  /** A tap on the photo: the next corner, in the photo's own pixels. */
  const tap = (e: MouseEvent) => {
    const img = imgRef.current;
    if (!img || corners.length >= 4) return;
    const r = img.getBoundingClientRect();
    const p: Point = [((e.clientX - r.left) / r.width) * img.naturalWidth, ((e.clientY - r.top) / r.height) * img.naturalHeight];
    setCorners([...corners, p]);
    setError('');
  };

  const go = async (e: Event) => {
    e.preventDefault();
    const img = imgRef.current;
    if (!img || corners.length !== 4) return;
    if (!goodCorners(corners)) return setError('Those corners cross over. Start again, and go round the shape in turn.');
    const plan = straightenPlan(corners, w, d, { width: img.naturalWidth, height: img.naturalHeight });
    if (!plan) return setError('That shape can’t be straightened. Try four corners further apart.');
    setWorking(true);
    try {
      // Let the "Straightening…" show before the work starts.
      await new Promise((r) => setTimeout(r, 30));
      const canvas = draw(img, plan);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('no picture');
      await saveBlob(openTraceKey(), blob);
    } catch {
      setWorking(false);
      return setError('The photo couldn’t be straightened here: it may be too big for this device. Try a smaller copy of it.');
    }
    // The rectangle's near-left corner goes at the bottom left of the garden, or of the plan. The photo kept is the
    // straightened one, so this can't be undone (undo would put the old place with the new picture): history starts again.
    const b = bounds(garden.boundary);
    const [ox, oy] = b ? [b.minX, b.minY] : [0, 0];
    const state = store.get();
    store.replace({
      ...state,
      garden: {
        ...state.garden,
        trace: { x: Math.round(ox + plan.minX), y: Math.round(oy + plan.minY), widthMm: Math.round(plan.maxX - plan.minX), opacity: state.garden.trace?.opacity ?? 0.5, calibrated: true },
      },
    });
    ref.current?.close();
  };

  const next = corners.length < 4 ? CORNER_WORDS[corners.length] : null;
  return (
    <dialog ref={ref} class="dialog straighten-dialog" aria-labelledby="straighten-title" onClose={close} onCancel={(e) => working && e.preventDefault()}>
      <form class="dialog-body" onSubmit={go}>
        <h2 id="straighten-title" class="title">
          Straighten the photo
        </h2>
        <p class="muted small">
          A photo from a window is at an angle, so the far end looks squeezed. Pick something rectangular you can measure, such as the patio, a bed or the lawn, and
          mark its four corners in turn on the photo: near left, near right, far right, far left.
        </p>
        {url && (
          <div class="straighten-photo">
            <img ref={imgRef} src={url} alt="Your trace photo" onClick={tap} />
            {imgRef.current &&
              corners.map((p, i) => (
                <span
                  key={i}
                  class="straighten-corner"
                  style={{ left: `${(p[0] / imgRef.current!.naturalWidth) * 100}%`, top: `${(p[1] / imgRef.current!.naturalHeight) * 100}%` }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              ))}
          </div>
        )}
        <p role="status">
          {next ? (
            <>
              Next: the <strong>{next}</strong> corner.
            </>
          ) : (
            'All four corners are in. Now its size.'
          )}
          {corners.length > 0 && ' '}
          {corners.length > 0 && (
            <button type="button" class="link-btn" onClick={() => setCorners([])}>
              Start again
            </button>
          )}
        </p>
        <div class="field-row">
          <MetresField label="Width, near left to near right" mm={w} min={100} onChange={setW} />
          <MetresField label="Depth, near to far" mm={d} min={100} onChange={setD} />
        </div>
        {error && <p class="message">{error}</p>}
        <p class="muted small">It replaces the photo with the straightened one, set to scale, and can’t be undone. To start again from the photo as taken, choose it again.</p>
        <div class="button-row">
          <button type="submit" class="btn btn-primary" disabled={corners.length !== 4 || working}>
            {working ? 'Straightening…' : 'Straighten'}
          </button>
          <button type="button" class="btn" disabled={working} onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
