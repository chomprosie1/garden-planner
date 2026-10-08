// Photos on notes: shrunk on the device and kept in this browser (IndexedDB),
// never in the garden's JSON. A backup can carry them if you ask.

import type { Garden } from '../model/types';
import { newId } from '../model/ids';
import { blobsInUse } from './gardens';
import { blobKeys, deleteBlob, loadBlob, saveBlob } from './idb';

const PREFIX = 'photo:';
/** The longest side a photo is kept at, and its JPEG quality: sharp on a phone, about 200–400 KB. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** A photo, shrunk to fit MAX_SIDE, as a JPEG. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * k);
  const h = Math.round(bitmap.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be read.'))), 'image/jpeg', QUALITY));
}

/** Keeps a photo and gives its id. */
export async function savePhoto(file: Blob): Promise<string> {
  const id = newId('ph');
  await saveBlob(PREFIX + id, await shrinkPhoto(file));
  return id;
}

const urls = new Map<string, string>();

/** A URL to show a photo, or null if it isn't on this device. Made once per photo. */
export async function photoUrl(id: string): Promise<string | null> {
  const hit = urls.get(id);
  if (hit) return hit;
  const blob = await loadBlob(PREFIX + id).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export const loadPhoto = (id: string) => loadBlob(PREFIX + id);
export const putPhoto = (id: string, blob: Blob) => saveBlob(PREFIX + id, blob);

/** The photos the garden uses: on its notes, and of the seed packets in its tin. */
export const photoIds = (g: Garden): Set<string> => new Set([...g.notes.flatMap((n) => (n.photo ? [n.photo] : [])), ...(g.seeds ?? []).flatMap((p) => (p.photo ? [p.photo] : []))]);

/** Which kept blobs no garden uses: photos no note has, and trace photos of gardens that are gone. */
export function unusedBlobs(keys: string[], used: { photos: Set<string>; traces: Set<string> }): string[] {
  return keys.filter((k) => (k.startsWith(PREFIX) ? !used.photos.has(k.slice(PREFIX.length)) : (k === 'trace' || k.startsWith('trace:')) && !used.traces.has(k)));
}

/**
 * Deletes kept photos no note in any garden uses any more, and trace photos of gardens deleted for good. Run when the
 * app opens, so undo still works while it's open. Gardens hidden to bring back keep theirs.
 */
export async function tidyBlobs(): Promise<number> {
  const used = blobsInUse();
  if (!used) return 0;
  const keys = unusedBlobs(await blobKeys().catch(() => [] as string[]), used);
  await Promise.all(keys.map((k) => deleteBlob(k).catch(() => undefined)));
  return keys.length;
}

/** A photo as a data URL, for a backup. */
export const toDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** A data URL back to a picture. */
export async function fromDataUrl(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}
