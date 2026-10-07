// Photos on notes: one shown from this device (tap it to see it big), and a
// button to add one from the camera or the photo library.

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

/** "Add a photo": the camera or the photo library on a phone, a file on a computer. Gives the kept photo's id. */
export function PhotoInput({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div class="photo-input">
      {value ? (
        <div class="photo-chosen">
          <Photo id={value} alt="The photo you’re adding" class="photo-thumb" />
          <button type="button" class="link-btn small" onClick={() => onChange(null)}>
            Remove photo
          </button>
        </div>
      ) : (
        <button type="button" class="btn" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="image" size={18} /> {busy ? 'Adding…' : 'Add a photo'}
        </button>
      )}
      {problem && <p class="muted small">{problem}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = (e.currentTarget as HTMLInputElement).files?.[0];
          (e.currentTarget as HTMLInputElement).value = '';
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
        }}
      />
    </div>
  );
}
