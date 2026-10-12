// The top of Today: one list of jobs to tick. Now (due, or this week), then
// Later this month, then what to look out for this week, and the way to all
// the month's jobs. Without plants of your own, the month's general UK jobs.

import { useMemo } from 'preact/hooks';
import { groupJobs, type Job } from '../calendar/jobs';
import { jobTiming, upcoming, upcomingVerb, weekWindows } from '../calendar/week';
import { seasonFor } from '../content/seasons';
import { featureLabel } from '../model/features';
import { todayIso } from '../model/ids';
import type { Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { doneOf, JobList, jobsDoneCount, PlantJobs } from './Jobs';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';

/** Now's jobs before "and N more". */
const SHOWN = 8;
/** Things to look out for, at most. */
const LOOK_OUT = 4;

interface Props {
  store: Store;
  garden: Garden;
  /** Null while the plants load. */
  plantOf: ((id: string) => Plant) | null;
  /** The month's jobs for your own plants. */
  jobs: Job[];
  month: number;
  year: number;
  /** Just set up: pick out the first job to do. */
  startHere?: boolean;
}

export function TodayJobs({ store, garden, plantOf, jobs, month, year, startHere = false }: Props) {
  const app = useApp();
  const { weather } = useWeatherNow();
  const today = todayIso();
  const name = seasonFor(month).name;
  const timing = useMemo(() => (plantOf ? jobTiming(jobs, garden, plantOf, today, weather) : new Map<string, 'now' | 'later'>()), [jobs, garden, plantOf, today, weather]);
  const now = jobs.filter((j) => timing.get(j.key) !== 'later');
  const later = jobs.filter((j) => timing.get(j.key) === 'later');
  // Seedlings coming up, first flowers, ready to pick: not jobs, but worth a look this week.
  const lookOut = useMemo(() => (plantOf ? upcoming(garden, plantOf, today, ...weekWindows(today).thisWeek, weather).filter((u) => !u.todo) : []), [garden, plantOf, today, weather]);
  // The first job about something in the garden, as it's shown: what to do first.
  const first = startHere ? groupJobs(now.slice(0, SHOWN)).flatMap(([, list]) => list).find((j) => j.plantingIds.length > 0)?.key ?? null : null;
  const allLink = (
    <a
      href="#/month"
      onClick={(e) => {
        e.preventDefault();
        app.go('month');
      }}
    >
      All {name} jobs
    </a>
  );

  if (!jobs.length)
    return (
      <section class="card today-jobs" aria-labelledby="now-title">
        <div class="card-head">
          <h2 id="now-title">This month</h2>
          <span class="muted small">
            {jobsDoneCount(garden, month, year)} of {seasonFor(month).jobs.length} done
          </span>
        </div>
        <JobList store={store} garden={garden} month={month} year={year} limit={4} />
        <p class="card-foot">
          {allLink}
          <span class="muted small"> · general UK jobs until you add plants</span>
        </p>
      </section>
    );

  return (
    <section class="card today-jobs" aria-labelledby="now-title">
      <div class="card-head">
        <h2 id="now-title">Now</h2>
        <span class="muted small">
          {doneOf(garden, jobs)} of {jobs.length} done this month
        </span>
      </div>
      {now.length > 0 ? (
        <PlantJobs jobs={now.slice(0, SHOWN)} garden={garden} store={store} {...(plantOf ? { plantOf } : {})} startHere={first} />
      ) : (
        <p class="muted">Nothing that can’t wait. A good week to weed, water and look round.</p>
      )}
      {now.length > SHOWN && (
        <p class="muted small">
          And {now.length - SHOWN} more in {allLink}.
        </p>
      )}
      {later.length > 0 && (
        <>
          <h2 class="today-sub">Later this month</h2>
          <PlantJobs jobs={later} garden={garden} store={store} {...(plantOf ? { plantOf } : {})} />
        </>
      )}
      {lookOut.length > 0 && plantOf && (
        <>
          <h2 class="today-sub">To look out for this week</h2>
          <ul class="plain-list look-out">
            {lookOut.slice(0, LOOK_OUT).map((u) => {
              const bed = garden.features.find((f) => f.id === u.featureId);
              return (
                <li key={u.key}>
                  <PlantIcon plant={plantOf(u.plantId)} size={26} />
                  <span>
                    {upcomingVerb(u)}: {plantOf(u.plantId).commonName.toLowerCase()}
                    {bed ? <span class="muted"> · {featureLabel(bed)}</span> : null}
                  </span>
                </li>
              );
            })}
            {lookOut.length > LOOK_OUT && <li class="muted small">and {lookOut.length - LOOK_OUT} more</li>}
          </ul>
        </>
      )}
      <p class="card-foot">{allLink}</p>
    </section>
  );
}
