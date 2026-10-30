// The garden's "things to check", the same for every screen that shows them:
// Today, the Garden list and the plan. June's sun counts for a plan wherever it's
// asked, so Today doesn't say fewer than the plan does.

import { useMemo } from 'preact/hooks';
import type { Garden, Plant } from '../model/types';
import { isList } from '../planting/listPlant';
import { checkGarden, type Finding } from '../planting/rules';
import { stillToCheck, useApp } from './appContext';
import { useSunHours } from './useSunHours';

/** Off the plan the sun is only for a count, so it waits until the screen's been read: `wait`, ms. */
export function useChecks(garden: Garden, plantOf: (id: string) => Plant, plants: Plant[] | null | undefined, wait = 1500): Finding[] {
  const app = useApp();
  const plan = !isList(garden) && garden.plantings.some((p) => !p.removedOn);
  const june = useSunHours(garden, 6, new Date().getFullYear(), plan && !!plants, wait);
  // Checks wait for the library, so plants never show as "unknown" for a moment.
  return useMemo(() => (plants ? stillToCheck(checkGarden(garden, plantOf, plan ? (june ?? null) : null), app.dismissedChecks) : []), [garden, plantOf, plants, plan, june, app.dismissedChecks]);
}
