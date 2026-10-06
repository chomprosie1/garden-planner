import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../model/store';
import type { AppState } from '../model/types';

/** Re-renders the component whenever the store changes. */
export function useAppState(store: Store): AppState {
  const [state, setState] = useState(store.get());
  useEffect(() => {
    setState(store.get());
    return store.subscribe(setState);
  }, [store]);
  return state;
}
