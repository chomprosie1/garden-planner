// Things any screen can ask of the app: show a message (with Undo), or go to
// a plant card or a spot on the plan. Saves passing callbacks down every level.

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Target } from '../model/features';
import type { View } from '../theme/prefs';

export interface AppActions {
  /** A short message. With undo, it offers to undo the change that was just made. */
  notify(text: string, opts?: { undo?: boolean }): void;
  go(v: View): void;
  /** The Plants tab, open at this plant's card. */
  openPlant(id: string): void;
  /** The plan, with this selected and in view. */
  showOnPlan(target: Target): void;
  /** The plan, with the Plant tool ready to place this plant. */
  plantIt(id: string): void;
}

const noop = () => undefined;
export const AppContext = createContext<AppActions>({ notify: noop, go: noop, openPlant: noop, showOnPlan: noop, plantIt: noop });

export const useApp = () => useContext(AppContext);
