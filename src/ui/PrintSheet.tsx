// The plan and the year on paper: a page over the app with its own Print button.
// In print, only this page comes out (see "@media print" in styles.css).

import { useEffect, useMemo } from 'preact/hooks';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { spacingStyle } from '../planting/place';
import { yearSheet } from '../share/export';
import { MiniPlan } from './MiniPlan';
import { usePlants } from './usePlants';
import { useWeatherNow } from './useWeather';

export function PrintSheet({ garden, userPlants, close }: { garden: Garden; userPlants: Plant[]; close: () => void }) {
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const { weather } = useWeatherNow();
  const today = todayIso();
  const beds = useMemo(() => (plants ? yearSheet(garden, plantOf, today, weather) : []), [garden, plants, plantOf, today, weather]);
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
      {beds.map((b) => (
        <section key={b.bed} class="print-bed">
          <h2>{b.bed}</h2>
          <ul class="plain-list">
            {b.rows.map((r) => (
              <li key={r.id}>
                <strong>{r.plant}</strong>
                {r.count > 1 ? ` × ${r.count}` : ''}: {r.stage}
                {r.dates.length > 0 && <span class="small"> · {r.dates.join(' · ')}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
