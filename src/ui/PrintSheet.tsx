// The plan and the year on paper: a page over the app with its own Print button.
// In print, only this page comes out (see "@media print" in styles.css).

import { useEffect, useMemo } from 'preact/hooks';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { spacingStyle } from '../planting/place';
import { cropLines, yearSheet } from '../share/export';
import { MiniPlan } from './MiniPlan';
import { usePlants } from './usePlants';
import { useWeatherNow } from './useWeather';

export function PrintSheet({ garden, userPlants, close }: { garden: Garden; userPlants: Plant[]; close: () => void }) {
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const { weather } = useWeatherNow();
  const today = todayIso();
  const beds = useMemo(() => (plants ? cropLines(yearSheet(garden, plantOf, today, weather), today) : []), [garden, plants, plantOf, today, weather]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  return (
    <div class="print-sheet" role="dialog" aria-label="Print the plan and the year">
      <div class="button-row print-actions">
        <button type="button" class="btn btn-primary" onClick={() => print()}>
          Print
        </button>
        <button type="button" class="btn" onClick={close}>
          Close
        </button>
      </div>
      <h1 class="title">{garden.name}</h1>
      <p class="muted small">Printed {today.split('-').reverse().join('/')}. Dates with “about” are expected, not recorded.</p>
      {garden.view !== 'list' && plants && <MiniPlan garden={garden} width={680} height={460} pad={0.04} plantOf={plantOf} class="print-plan" />}
      {!plants && <p class="muted">Loading your plants…</p>}
      {plants && beds.length === 0 && <p>Nothing’s planted yet, so there’s no year to print.</p>}
      {beds.length > 0 && (
        <section class="print-bed">
          <h2>The year ahead</h2>
          <ul class="plain-list">
            {beds.map((c) => (
              <li key={c.plantId}>
                <strong>{c.plant}</strong>: {c.beds.join(', ')}
                {c.dates.length > 0 && <span class="small"> · {c.dates.join(' · ')}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
