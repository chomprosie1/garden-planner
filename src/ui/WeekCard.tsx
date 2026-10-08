// Today: the week ahead as cards to swipe through, each with the plant's
// picture at that stage, what to do (or look out for), and when. Things to do
// first. Next week waits at the end of the row.

import { useMemo } from 'preact/hooks';
import { dayWords, upcoming, upcomingVerb, weekWindows, type Upcoming } from '../calendar/week';
import { featureLabel } from '../model/features';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';

/** Cards before "and N more". */
const SHOWN = 8;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Tile({ u, garden, plantOf, today }: { u: Upcoming; garden: Garden; plantOf: (id: string) => Plant; today: string }) {
  const app = useApp();
  const plant = plantOf(u.plantId);
  const bed = garden.features.find((f) => f.id === u.featureId);
  // The picture at the stage it's reaching; sowing shows the seedling it'll become.
  const stage = u.stage === 'sown' ? 'germinated' : u.stage === 'cleared' ? 'harvesting' : u.stage;
  return (
    <li class={`week-tile ${u.todo ? 'week-tile-todo' : 'week-tile-look'}`}>
      <button type="button" class="week-tile-btn" onClick={() => app.showOnPlan({ type: 'planting', id: u.plantingIds[0]! })} aria-label={`${upcomingVerb(u)}: ${plant.commonName}${bed ? ` in ${featureLabel(bed)}` : ''}, ${dayWords(u.date, today)}. Show on the plan`}>
        <span class="week-tile-when">{capital(dayWords(u.date, today))}</span>
        <PlantIcon plant={plant} size={64} stage={stage} class="week-tile-art" />
        <span class="week-tile-verb">{upcomingVerb(u)}</span>
        <span class="week-tile-what">
          {plant.commonName}
          {u.batch ? ` (${u.batch})` : ''}
          {bed ? <span class="week-tile-where"> · {featureLabel(bed)}</span> : null}
        </span>
      </button>
    </li>
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
  const todo = thisWeek.filter((u) => u.todo).length;
  return (
    <section class="week-section" aria-labelledby="week-title">
      <div class="section-head">
        <h2 id="week-title">This week</h2>
        <span class="muted small">{todo ? `${todo} to do` : thisWeek.length ? 'things to look out for' : ''}</span>
      </div>
      {thisWeek.length === 0 && <p class="muted">Nothing new expected this week. A good time to weed and water.</p>}
      <ul class="week-cards" aria-label="This week, swipe for more">
        {thisWeek.slice(0, SHOWN).map((u) => (
          <Tile key={u.key} u={u} garden={garden} plantOf={plantOf} today={today} />
        ))}
        {thisWeek.length > SHOWN && (
          <li class="week-tile week-tile-more">
            <span class="week-tile-verb">And {thisWeek.length - SHOWN} more</span>
            <span class="muted small">Every planting’s next step is on the plan’s timeline.</span>
          </li>
        )}
        {nextWeek.length > 0 && (
          <li class="week-tile week-tile-next">
            <span class="week-tile-when">Next week</span>
            <ul class="week-next-list">
              {nextWeek.slice(0, 5).map((u) => (
                <li key={u.key}>
                  <PlantIcon plant={plantOf(u.plantId)} size={22} />
                  <span>
                    {upcomingVerb(u)}: {plantOf(u.plantId).commonName.toLowerCase()}
                  </span>
                </li>
              ))}
              {nextWeek.length > 5 && <li class="muted small">and {nextWeek.length - 5} more</li>}
            </ul>
          </li>
        )}
      </ul>
      <p class="muted small week-basis">{weather ? 'From this year’s weather and the forecast.' : 'From the usual warmth here.'}</p>
    </section>
  );
}
