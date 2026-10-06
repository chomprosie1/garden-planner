import { useMemo, useState } from 'preact/hooks';
import { formatLength } from '../../canvas/viewport';
import { checksStore } from '../../library/checks';
import { copyAsUserPlant, monthRanges, saveUserPlant } from '../../library/library';
import { todayIso } from '../../model/ids';
import type { Store } from '../../model/store';
import type { Plant } from '../../model/types';
import { useApp } from '../appContext';
import { Icon } from '../icons';
import { LIGHT_LABEL, METHOD_LABEL, WINTER_LABEL } from '../PlantCard';
import { PlantForm } from '../PlantForm';
import { useChecks, usePlants } from '../usePlants';

interface Props {
  store: Store;
  userPlants: Plant[];
  /** Start at this plant, e.g. from its card. */
  startAt: string | null;
  back: () => void;
}

/**
 * Checking the starter plants, one at a time: the facts that drive warnings and jobs, side by side with
 * where they came from. "Looks right" marks the plant as checked on this device.
 */
export function CheckPlants({ store, userPlants, startAt, back }: Props) {
  const app = useApp();
  const { library } = usePlants(userPlants);
  const checks = useChecks();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(startAt);
  const [editing, setEditing] = useState<Plant | null>(null);

  // The plants that ship with the app; your own don't need checking.
  const all = useMemo(() => (library ?? []).filter((p) => !p.userAdded), [library]);
  const original = (id: string) => all.find((p) => p.id === id);
  const todo = all.filter((p) => !p.verified && !skipped.includes(p.id));
  const done = all.filter((p) => !!checks[p.id] || p.verified).length;
  const plant = (current && original(current)) || todo[0] || null;
  const checkedHere = plant ? !!checks[plant.id] : false;

  const next = (after: string) => {
    const rest = todo.filter((p) => p.id !== after);
    setCurrent(rest[0]?.id ?? null);
  };

  if (editing)
    return (
      <div class="page check-page">
        <PlantForm
          initial={editing}
          onSave={(p) => {
            store.apply(saveUserPlant(p));
            app.notify(`Saved "${p.commonName}" as your own plant. The app will use your version from now on when you pick it.`);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );

  return (
    <div class="page check-page">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">Check the plants</h1>
      </header>
      <p class="muted">
        The starter plants are drafts. Compare each one with a trusted source, such as the RHS website, a seed packet or a good book, and say whether it looks right.
        Spacing, sowing times and neighbours drive the warnings and jobs, so they matter most.
      </p>
      {library === null ? (
        <p class="muted">Loading plants…</p>
      ) : (
        <>
          <div class="check-progress" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={done} aria-label="Plants checked">
            <div style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
          </div>
          <p class="small">
            <strong>
              {done} of {all.length}
            </strong>{' '}
            checked{skipped.length ? `, ${skipped.length} skipped for now` : ''}.
          </p>

          {!plant ? (
            <section class="card">
              <h2>{done === all.length ? 'All checked. Thank you!' : 'Nothing left for now'}</h2>
              <p class="muted">{done === all.length ? 'Every starter plant has been checked on this device.' : 'You skipped some. Come back to them any time.'}</p>
              {skipped.length > 0 && (
                <button type="button" class="btn" onClick={() => setSkipped([])}>
                  Go back to the skipped ones
                </button>
              )}
            </section>
          ) : (
            <section class="card check-card" aria-labelledby="check-name">
              <header>
                <h2 id="check-name">{plant.commonName}</h2>
                {plant.latinName && <p class="latin">{plant.latinName}</p>}
                {checkedHere && <p class="badge badge-ok">Checked {checks[plant.id]}</p>}
              </header>
              <dl class="check-facts">
                <dt>Spacing</dt>
                <dd>
                  {formatLength(plant.size.spacingMm)} apart{plant.size.rowSpacingMm ? `, rows ${formatLength(plant.size.rowSpacingMm)} apart` : ''}
                </dd>
                {plant.size.spreadMm || plant.size.heightMm ? (
                  <>
                    <dt>Size</dt>
                    <dd>
                      {[plant.size.heightMm && `${formatLength(plant.size.heightMm)} tall`, plant.size.spreadMm && `${formatLength(plant.size.spreadMm)} across`].filter(Boolean).join(', ')}
                    </dd>
                  </>
                ) : null}
                <dt>Light</dt>
                <dd>
                  {LIGHT_LABEL[plant.conditions.light]}
                  {plant.conditions.minSunHours ? `, at least ${plant.conditions.minSunHours} h of sun` : ''}
                </dd>
                {plant.sowing?.map((s, i) => (
                  <div key={i} class="check-row">
                    <dt>{METHOD_LABEL[s.method]}</dt>
                    <dd>
                      {monthRanges(s.months, true)}
                      {s.depthMm ? `, ${s.depthMm} mm deep` : ''}
                    </dd>
                  </div>
                ))}
                {plant.plantOutMonths?.length ? (
                  <>
                    <dt>Plant out</dt>
                    <dd>{monthRanges(plant.plantOutMonths, true)}</dd>
                  </>
                ) : null}
                {plant.flowerMonths?.length ? (
                  <>
                    <dt>In flower</dt>
                    <dd>{monthRanges(plant.flowerMonths, true)}</dd>
                  </>
                ) : null}
                {plant.cropping && (
                  <>
                    <dt>Harvest</dt>
                    <dd>{monthRanges(plant.cropping.harvestMonths, true)}</dd>
                  </>
                )}
                {plant.wintering && (
                  <>
                    <dt>Winter</dt>
                    <dd>{WINTER_LABEL[plant.wintering.type]}</dd>
                  </>
                )}
                {plant.companions && (plant.companions.good.length > 0 || plant.companions.avoid.length > 0) && (
                  <>
                    <dt>Neighbours</dt>
                    <dd>
                      {plant.companions.good.length > 0 && <>Good with {plant.companions.good.map((id) => original(id)?.commonName.toLowerCase() ?? id).join(', ')}. </>}
                      {plant.companions.avoid.length > 0 && <>Keep apart from {plant.companions.avoid.map((id) => original(id)?.commonName.toLowerCase() ?? id).join(', ')}.</>}
                    </dd>
                  </>
                )}
                <dt>Source</dt>
                <dd>{plant.source || 'No source recorded.'}</dd>
              </dl>
              <div class="button-row">
                {checkedHere ? (
                  <button
                    type="button"
                    class="btn"
                    onClick={() => {
                      checksStore.uncheck(plant.id);
                      app.notify(`${plant.commonName} is unchecked again.`);
                    }}
                  >
                    Undo my check
                  </button>
                ) : (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      checksStore.check(plant.id, todayIso());
                      next(plant.id);
                    }}
                  >
                    Looks right
                  </button>
                )}
                <button type="button" class="btn" onClick={() => setEditing(copyAsUserPlant(plant, `${plant.commonName} (my version)`))}>
                  Needs a change
                </button>
                {!checkedHere && (
                  <button
                    type="button"
                    class="btn btn-quiet"
                    onClick={() => {
                      setSkipped([...skipped, plant.id]);
                      next(plant.id);
                    }}
                  >
                    Skip for now
                  </button>
                )}
              </div>
              <p class="muted small">"Needs a change" makes your own corrected copy. Your checks are kept on this device.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
