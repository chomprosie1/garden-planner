import { useMemo, useState } from 'preact/hooks';
import { jobsFor, toggleWishlist } from '../../calendar/jobs';
import { seasonFor } from '../../content/seasons';
import { updateGarden, type Store } from '../../model/store';
import type { Garden, Plant } from '../../model/types';
import type { Prefs, View } from '../../theme/prefs';
import { Icon } from '../icons';
import { doneOf, JobList, PlantJobs } from '../Jobs';
import { SeasonPhoto } from '../SeasonPhoto';
import { usePlants } from '../usePlants';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  go: (v: View) => void;
  now?: Date;
}

export function Month({ store, garden, userPlants, prefs, go, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const next = (month % 12) + 1;
  const nextYear = next === 1 ? year + 1 : year;
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const { plants, plantOf } = usePlants(userPlants);
  const jobs = useMemo(() => (plants ? jobsFor(garden, plantOf, month, year) : []), [garden, plantOf, plants, month, year]);
  const comingUp = useMemo(() => (plants ? jobsFor(garden, plantOf, next, nextYear) : []), [garden, plantOf, plants, next, nextYear]);
  const hasPlants = garden.plantings.some((p) => !p.removedOn) || garden.wishlist.length > 0;

  return (
    <div class="page month-page">
      {prefs.photos !== 'off' && <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="page-band" />}
      <header class="page-head">
        <h1 class="title">{season.name}</h1>
        <button type="button" class="icon-btn phone-only" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="settings" />
        </button>
      </header>
      <p class="month-line">{season.line}</p>

      <section class="card">
        <div class="card-head">
          <h2>Your jobs this month</h2>
          {jobs.length > 0 && (
            <span class="muted small">
              {doneOf(garden, jobs)} of {jobs.length} done
            </span>
          )}
        </div>
        {!plants ? (
          <p class="muted">Loading your plants…</p>
        ) : jobs.length > 0 ? (
          <PlantJobs jobs={jobs} garden={garden} store={store} />
        ) : hasPlants ? (
          <p class="muted">Nothing to do for your plants this month.</p>
        ) : (
          <p class="muted">
            Put plants in your beds on the{' '}
            <a
              href="#/plan"
              onClick={(e) => {
                e.preventDefault();
                go('plan');
              }}
            >
              plan
            </a>
            , or add them to your sowing list below, and their sowing, planting and harvest jobs appear here.
          </p>
        )}
        {hasPlants && <p class="muted small">Harvest and winter jobs start once a planting has a sowing date. Ticking its sowing job sets the date, or you can set it on the plan.</p>}
      </section>

      <section class="card">
        <h2>Around the garden</h2>
        <JobList store={store} garden={garden} month={month} year={year} />
      </section>

      <section class="card">
        <h2>Coming up in {seasonFor(next).name}</h2>
        {comingUp.length > 0 && <PlantJobs jobs={comingUp} garden={garden} />}
        <h3 class="job-kind">Around the garden</h3>
        <ul class="plain-list">
          {seasonFor(next).jobs.map((j) => (
            <li key={j}>{j}</li>
          ))}
        </ul>
      </section>

      <SowingList store={store} garden={garden} plants={plants} plantOf={plantOf} />

      <p class="assumption">Dates are UK averages; adjust for your area. A cold spring or a sheltered plot can shift them by weeks.</p>
    </div>
  );
}

/** Plants you mean to grow but haven't put on the plan yet. */
function SowingList({ store, garden, plants, plantOf }: { store: Store; garden: Garden; plants: Plant[] | null; plantOf: (id: string) => Plant }) {
  const [pick, setPick] = useState('');
  const toggle = (id: string) => store.apply(updateGarden((g) => toggleWishlist(g, id)));
  const listed = [...new Set(garden.wishlist)].map(plantOf).sort((a, b) => a.commonName.localeCompare(b.commonName));
  const options = (plants ?? []).filter((p) => !garden.wishlist.includes(p.id));
  return (
    <section class="card">
      <h2>Your sowing list</h2>
      <p class="muted small">Plants you mean to grow this year but haven't put in a bed yet. Their sowing jobs show above.</p>
      {listed.length > 0 && (
        <ul class="sowing-list">
          {listed.map((p) => (
            <li key={p.id}>
              <span>{p.commonName}</span>
              <button type="button" class="link-btn small" onClick={() => toggle(p.id)}>
                Remove<span class="visually-hidden"> {p.commonName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        class="sowing-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (pick) toggle(pick);
          setPick('');
        }}
      >
        <label class="field">
          Add a plant
          <select value={pick} onChange={(e) => setPick((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">Choose…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.commonName}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" class="btn" disabled={!pick}>
          Add
        </button>
      </form>
    </section>
  );
}
