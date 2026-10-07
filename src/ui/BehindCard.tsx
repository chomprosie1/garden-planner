// Running behind, on Today and in a planting's details: what's late to reach
// its next stage, why it might be, and what to do about it.

import { behindText, runningBehind, snooze, type Behind } from '../lifecycle/behind';
import { shortDate } from '../lifecycle/projection';
import { markFailed } from '../lifecycle/stages';
import { placeLabel } from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';

/** At most this many on Today: the latest first. */
const SHOWN = 3;

/** Why it might be slow, folded away. */
export function Causes({ b }: { b: Behind }) {
  if (!b.causes.length) return null;
  return (
    <details class="behind-causes">
      <summary>Why might it be slow?</summary>
      <ul class="plain-list small">
        {b.causes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </details>
  );
}

/** What to do: it's moved on (see it on the plan, to say so), still waiting, or (for a sowing) it failed. */
export function BehindActions({ b, store, plant, onPlan }: { b: Behind; store: Store; plant: Plant; onPlan?: () => void }) {
  const app = useApp();
  const today = todayIso();
  const sowing = b.stage === 'sown' || b.stage === 'germinated';
  return (
    <div class="button-row behind-actions">
      {onPlan && (
        <button type="button" class="btn btn-primary" onClick={onPlan}>
          It’s moved on
        </button>
      )}
      <button
        type="button"
        class="btn"
        title="Not running behind again for two weeks"
        onClick={() => {
          store.apply(updateGarden((g) => snooze(g, b.plantingId, today)));
          app.notify(`${plant.commonName}: checking again in two weeks.`, { undo: true });
        }}
      >
        Still waiting
      </button>
      {sowing && (
        <button
          type="button"
          class="btn"
          onClick={() => {
            store.apply(updateGarden((g) => markFailed(g, b.plantingId, plant.commonName, today)));
            app.notify(`${plant.commonName}: sowing failed, noted in the journal. Ready to sow again.`, { undo: true });
          }}
        >
          Sowing failed
        </button>
      )}
    </div>
  );
}

/** Today: plantings running behind, with why and what to do. Nothing when all's on time. */
export function BehindCard({ store, garden, plantOf }: { store: Store; garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const { weather } = useWeatherNow();
  const late = runningBehind(garden, plantOf, todayIso(), weather);
  if (!late.length) return null;
  return (
    <section class="card behind-card" aria-labelledby="behind-card-head">
      <h2 id="behind-card-head">Running behind</h2>
      <ul class="plain-list">
        {late.slice(0, SHOWN).map((b) => {
          const p = plantOf(b.plantId);
          const bed = garden.features.find((f) => f.id === b.featureId);
          return (
            <li key={b.plantingId} class="behind-row">
              <div class="behind-head">
                <PlantIcon plant={p} size={30} />
                <span>
                  <strong>{p.commonName}</strong>
                  {bed ? ` in ${placeLabel(bed)}` : ''}. {behindText(b, shortDate)}
                </span>
              </div>
              <Causes b={b} />
              <BehindActions b={b} store={store} plant={p} onPlan={() => app.showOnPlan({ type: 'planting', id: b.plantingId })} />
            </li>
          );
        })}
      </ul>
      {late.length > SHOWN && <p class="muted small">And {late.length - SHOWN} more: you’ll find them on each planting.</p>}
    </section>
  );
}
