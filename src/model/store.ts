// One store for the whole app. Every change goes through apply(), which keeps
// the previous state for undo. State is never mutated, so keeping old states
// is cheap: unchanged parts are shared between them.

import type { AppState } from './types';

export type Change = (state: AppState) => AppState;
type Listener = (state: AppState) => void;

export interface Store {
  get(): AppState;
  subscribe(listener: Listener): () => void;
  /** Apply a change. Returning the same state object means "no change". */
  apply(change: Change): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Replace everything, e.g. after an import. Clears undo history. */
  replace(state: AppState): void;
}

export function createStore(initial: AppState, historyLimit = 100): Store {
  let state = initial;
  const past: AppState[] = [];
  const future: AppState[] = [];
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l(state));

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply(change) {
      const next = change(state);
      if (next === state) return;
      past.push(state);
      if (past.length > historyLimit) past.shift();
      future.length = 0;
      state = next;
      emit();
    },
    undo() {
      const prev = past.pop();
      if (!prev) return;
      future.push(state);
      state = prev;
      emit();
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(state);
      state = next;
      emit();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    replace(next) {
      past.length = 0;
      future.length = 0;
      state = next;
      emit();
    },
  };
}

/** Helper for changes that only touch the garden. */
export const updateGarden =
  (fn: (g: AppState['garden']) => AppState['garden']): Change =>
  (s) => {
    const garden = fn(s.garden);
    return garden === s.garden ? s : { ...s, garden };
  };
