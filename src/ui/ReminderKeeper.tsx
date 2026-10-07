// Keeps the reminders' note up to date as the garden changes: where it is, what
// a frost could hurt, and the jobs for the next few weeks. Renders nothing.

import { useEffect } from 'preact/hooks';
import { weekNudges } from '../calendar/week';
import { frostWatchList } from '../lifecycle/frostWatch';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { spacingStyle } from '../planting/place';
import { saveSnapshot, snapshot } from '../storage/reminders';
import { usePlants } from './usePlants';
import { useWeatherNow } from './useWeather';

export function ReminderKeeper({ garden, userPlants, frost, weekly }: { garden: Garden; userPlants: Plant[]; frost: boolean; weekly: boolean }) {
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const { weather } = useWeatherNow();
  useEffect(() => {
    if (!plants) return;
    // A moment after the last change, so editing the plan doesn't rewrite it every keystroke.
    const t = setTimeout(() => {
      const s = snapshot(frost, garden.latitude, garden.longitude, frost ? frostWatchList(garden, plantOf) : [], weekly ? weekNudges(garden, plantOf, todayIso(), 5, weather) : null);
      void saveSnapshot(s).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [garden, plants, frost, weekly, weather]);
  return null;
}
