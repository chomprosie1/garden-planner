// Photos on notes: one shown from this device (tap it to see it big), and a
// pair of buttons to add one: take it with the camera, or choose one already taken.

import { useEffect, useRef, useState } from 'preact/hooks';
import { photoUrl, savePhoto } from '../storage/photos';
import { Icon } from './icons';

/** A kept photo. Tap it to see it full size. */
export function Photo({ id, alt, class: cls = '' }: { id: string; alt: string; class?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const big = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let live = true;
    photoUrl(id).then((u) => live && (u ? setUrl(u) : setMissing(true)));
    return () => {
      live = false;
    };
  }, [id]);
  if (missing) return <span class={`photo photo-missing ${cls}`}>Photo on another device</span>;
  if (!url) return <span class={`photo photo-loading ${cls}`} aria-hidden="true" />;
  return (
    <>
      <button type="button" class={`photo ${cls}`} onClick={() => big.current?.showModal()} aria-label={`See the photo bigger: ${alt}`}>
        <img src={url} alt={alt} loading="lazy" />
      </button>
      <dialog ref={big} class="photo-big" onClick={() => big.current?.close()} aria-label={alt}>
        <img src={url} alt={alt} />
      </dialog>
    </>
  );
}

/** Touch screens have a camera to hand; a computer only gets "Choose a photo". */
const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** "Take a photo" with the camera (touch screens), or "Choose a photo" already taken. Gives the kept photo's id. */
export function PhotoInput({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [canCapture] = useState(touch);
  const add = async (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      onChange(await savePhoto(file));
    } catch {
      setProblem('That photo couldn’t be added. Try another, or a JPEG.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="photo-input">
      {value ? (
        <div class="photo-chosen">
          <Photo id={value} alt="The photo you’re adding" class="photo-thumb" />
          <button type="button" class="link-btn small" onClick={() => onChange(null)}>
            Remove photo
          </button>
        </div>
      ) : busy ? (
        <p class="muted small">Adding the photo…</p>
      ) : (
        <div class="photo-buttons">
          {canCapture && (
            <button type="button" class="btn" onClick={() => camera.current?.click()}>
              <Icon name="camera" size={18} /> Take a photo
            </button>
          )}
          <button type="button" class="btn" onClick={() => library.current?.click()}>
            <Icon name="image" size={18} /> Choose a photo
          </button>
        </div>
      )}
      {problem && <p class="muted small">{problem}</p>}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={add} />
      <input ref={library} type="file" accept="image/*" hidden onChange={add} />
    </div>
  );
}
