// Today: what's coming up in the garden this week, and next week folded away.
// Things to do first, then things to look out for, each showing on the plan.

import { useMemo } from 'preact/hooks';
import { upcoming, upcomingText, weekWindows, type Upcoming } from '../calendar/week';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';

/** Lines shown before "and N more". */
const SHOWN = 6;

function Lines({ items, garden, plantOf, today }: { items: Upcoming[]; garden: Garden; plantOf: (id: string) => Plant; today: string }) {
  const app = useApp();
  return (
    <ul class="plain-list week-list">
      {items.slice(0, SHOWN).map((u) => (
        <li key={u.key} class={u.todo ? 'week-todo' : 'week-look'}>
          <PlantIcon plant={plantOf(u.plantId)} size={26} />
          <span>{upcomingText(u, garden, plantOf, today)}</span>
          <button type="button" class="link-btn small" onClick={() => app.showOnPlan({ type: 'planting', id: u.plantingIds[0]! })}>
            Show<span class="visually-hidden"> on the plan</span>
          </button>
        </li>
      ))}
      {items.length > SHOWN && <li class="muted small">and {items.length - SHOWN} more</li>}
    </ul>
  );
}

export function WeekCard({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const { weather } = useWeatherNow();
  const today = todayIso();
  const { thisWeek, nextWeek } = useMemo(() => {
    const w = weekWindows(today);
    const order = (list: Upcoming[]) => [...list.filter((u) => u.todo), ...list.filter((u) => !u.todo)];
    return { thisWeek: order(upcoming(garden, plantOf, today, ...w.thisWeek, weather)), nextWeek: order(upcoming(garden, plantOf, today, ...w.nextWeek, weather)) };
  }, [garden, plantOf, today, weather]);
  if (!thisWeek.length && !nextWeek.length) return null;
  return (
    <section class="card week-card" aria-labelledby="week-title">
      <div class="card-head">
        <h2 id="week-title">This week</h2>
        <span class="muted small">{weather ? 'by this year’s weather' : 'by the usual warmth here'}</span>
      </div>
      {thisWeek.length ? <Lines items={thisWeek} garden={garden} plantOf={plantOf} today={today} /> : <p class="muted">Nothing new expected this week: a good time to weed and water.</p>}
      {nextWeek.length > 0 && (
        <details class="week-next">
          <summary>Next week ({nextWeek.length})</summary>
          <Lines items={nextWeek} garden={garden} plantOf={plantOf} today={today} />
        </details>
      )}
    </section>
  );
}
