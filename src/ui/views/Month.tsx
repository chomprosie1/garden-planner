import { useMemo, useState } from 'preact/hooks';
import { draftYear } from '../../planting/rotation';
import { shoppingList } from '../../planting/shopping';
import { NextYearDialog } from '../NextYear';
import { ShoppingDialog } from '../Shopping';
import { jobsFor } from '../../calendar/jobs';
import { seasonFor } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden, Plant } from '../../model/types';
import type { Prefs, View } from '../../theme/prefs';
import { Icon } from '../icons';
import { doneOf, JobList, PlantJobs } from '../Jobs';
import { SeasonPhoto } from '../SeasonPhoto';
import { ShedSummary } from '../ShedCards';
import { usePlants } from '../usePlants';
import { useWeatherNow } from '../useWeather';
import { todayIso } from '../../model/ids';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  go: (v: View) => void;
  back: () => void;
  now?: Date;
}

export function Month({ store, garden, userPlants, prefs, go, back, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const next = (month % 12) + 1;
  const nextYear = next === 1 ? year + 1 : year;
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const { plants, plantOf } = usePlants(userPlants);
  const { weather } = useWeatherNow();
  const today = todayIso(now);
  const opts = { weeding: prefs.weeding, feeding: prefs.feeding, today, weather };
  const jobs = useMemo(() => (plants ? jobsFor(garden, plantOf, month, year, opts) : []), [garden, plantOf, plants, month, year, prefs.weeding, prefs.feeding, today, weather]);
  const comingUp = useMemo(() => (plants ? jobsFor(garden, plantOf, next, nextYear, opts) : []), [garden, plantOf, plants, next, nextYear, prefs.weeding, prefs.feeding, today, weather]);
  const hasPlants = garden.plantings.some((p) => !p.removedOn) || garden.wishlist.length > 0;
  const [shopping, setShopping] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const toBuy = useMemo(() => (plants ? shoppingList(garden, plantOf, today, { feeding: prefs.feeding }).filter((i) => !i.bought).length : 0), [garden, plantOf, plants, today, prefs.feeding]);

  return (
    <div class="page month-page">
      {prefs.photos !== 'off' && <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="page-band" />}
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">{season.name}</h1>
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
          <PlantJobs jobs={jobs} garden={garden} store={store} plantOf={plantOf} />
        ) : hasPlants ? (
          <p class="muted">Nothing to do for your plants this month.</p>
        ) : (
          <p class="muted">
            Put plants in your beds on the{' '}
            <a
              href="#/garden"
              onClick={(e) => {
                e.preventDefault();
                go('plan');
              }}
            >
              plan
            </a>
            , or tap the heart on plants you want to grow, and their sowing, planting and harvest jobs appear here.
          </p>
        )}
        {hasPlants && <p class="muted small">Harvest and winter jobs start once a planting has a sowing date. Ticking its sowing job sets the date, or you can set it on the plan.</p>}
      </section>

      {plants && hasPlants && (
        <section class="card plan-ahead">
          <h2>Planning ahead</h2>
          <div class="plan-ahead-row">
            <span>
              <strong>Shopping list</strong>
              <span class="muted small"> · {toBuy ? `${toBuy} to buy` : 'nothing to buy'}</span>
            </span>
            <button type="button" class="btn btn-small" onClick={() => setShopping(true)}>
              Open
            </button>
          </div>
          {garden.plantings.length > 0 && (
            <div class="plan-ahead-row">
              <span>
                <strong>Next year</strong>
                <span class="muted small"> · {draftYear(today)}, with the crops rotated</span>
              </span>
              <button type="button" class="btn btn-small" onClick={() => setDrafting(true)}>
                Draft it
              </button>
            </div>
          )}
        </section>
      )}
      {shopping && plants && <ShoppingDialog garden={garden} store={store} plantOf={plantOf} feeding={prefs.feeding} close={() => setShopping(false)} />}
      {drafting && plants && <NextYearDialog garden={garden} store={store} plantOf={plantOf} close={() => setDrafting(false)} />}

      {plants && <ShedSummary garden={garden} plantOf={plantOf} />}

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


      <p class="assumption">Dates are UK averages; adjust for your area. A cold spring or a sheltered plot can shift them by weeks.</p>
    </div>
  );
}
