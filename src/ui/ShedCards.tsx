// The Potting Shed on other screens: a summary on Month, and on Home, what's
// ready to plant out.

import { plantingsIndoors, readyToPlantOut, setIndoorStage, trayNext, trayStage, traysOf } from '../lifecycle/shed';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { TrayArt } from './TrayArt';

/** Month: what's in the shed and what it needs. */
export function ShedSummary({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const today = todayIso();
  const trays = traysOf(garden);
  const indoors = plantingsIndoors(garden, plantOf);
  const needing = trays.filter((t) => trayNext(t, plantOf(t.plantId), garden, today).due);
  return (
    <section class="card shed-summary" aria-labelledby="shed-summary-head">
      <div class="card-head">
        <h2 id="shed-summary-head">Seedlings</h2>
        {trays.length + indoors.length > 0 && (
          <span class="muted small">
            {trays.length} {trays.length === 1 ? 'tray' : 'trays'}
            {indoors.length ? `, ${indoors.length} sown for the plan` : ''}
          </span>
        )}
      </div>
      {trays.length === 0 && indoors.length === 0 ? (
        <p class="muted">Seeds sown indoors, in trays and pots, live here until they’re ready for the garden.</p>
      ) : (
        <div class="shed-strip">
          {trays.slice(0, 6).map((t) => {
            const p = plantOf(t.plantId);
            return (
              <button key={t.id} type="button" class="shed-strip-tray" onClick={() => app.go('shed')}>
                <TrayArt tray={t} plant={p} stage={trayStage(t)} width={84} />
                <span class="small">{p.commonName}</span>
              </button>
            );
          })}
        </div>
      )}
      {needing.length > 0 && (
        <p class="small">
          <strong>{needing.length === 1 ? '1 tray needs' : `${needing.length} trays need`} you:</strong>{' '}
          {needing
            .slice(0, 3)
            .map((t) => {
              const text = trayNext(t, plantOf(t.plantId), garden, today).text.replace(/\.$/, '');
              return `${plantOf(t.plantId).commonName} (${text.charAt(0).toLowerCase()}${text.slice(1)})`;
            })
            .join('; ')}
        </p>
      )}
      <div class="button-row">
        <button type="button" class="btn" onClick={() => app.go('shed')}>
          Go to Seedlings
        </button>
        <button type="button" class="btn" onClick={() => app.sowInShed()}>
          Sow seeds
        </button>
      </div>
    </section>
  );
}

/** Home: plants ready to go in the garden, with a button to plant each out. Nothing when none are. */
export function ReadyCard({ store, garden, plantOf }: { store: Store; garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const today = todayIso();
  const ready = readyToPlantOut(garden, plantOf, today);
  if (!ready.length) return null;
  return (
    <section class="card panel shed-ready" aria-labelledby="ready-card-head">
      <h2 id="ready-card-head">Ready for the garden</h2>
      <ul class="plain-list">
        {ready.map((r) => {
          const p = plantOf(r.plantId);
          return (
            <li key={r.id} class="shed-ready-row">
              <PlantIcon plant={p} size={30} stage="transplanted" />
              <span>
                <strong>{p.commonName}</strong>
                {r.kind === 'tray' ? `: ${r.count} ${r.count === 1 ? 'plant' : 'plants'}` : ''} hardened off and ready to plant out.
              </span>
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => (r.kind === 'tray' ? app.plantOutTray(r.id) : store.apply(updateGarden((g) => setIndoorStage(g, r.id, 'transplanted', today))))}
              >
                {r.kind === 'tray' ? 'Plant out' : 'Planted out'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
