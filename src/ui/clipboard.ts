// The plan's clipboard: a planting copied, to paste in another bed or spot.
// Kept in memory only: it's never stored, and it's gone when the app closes.

import { useEffect, useState } from 'preact/hooks';
import type { Planting } from '../model/types';

let copied: Planting | null = null;
const listeners = new Set<(pl: Planting | null) => void>();

export const copiedPlanting = () => copied;

export function copyPlanting(pl: Planting): void {
  copied = pl;
  for (const f of listeners) f(pl);
}

/** The planting on the clipboard, kept up to date. */
export function useCopied(): Planting | null {
  const [value, setValue] = useState(copied);
  useEffect(() => {
    listeners.add(setValue);
    return () => void listeners.delete(setValue);
  }, []);
  return value;
}
