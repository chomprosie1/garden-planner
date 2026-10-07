import { useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import { PICK_SIZES, type Garden, type PickSize, type Plant } from '../model/types';
import { PICK_LABEL } from '../planting/harvest';
import { useApp } from './appContext';
import { groupJobs, JOB_LABEL, logPick, toggleJob, type Job } from '../calendar/jobs';

export const jobKey = (year: number, month: number, i: number) =>
  `general:${year}-${String(month).padStart(2, '0')}:${i}`;

interface Props {
  store: Store;
  garden: Garden;
  month: number;
  year: number;
  limit?: number;
}

/** The month's general UK jobs, with ticks saved in the garden so they travel with the export. */
export function JobList({ store, garden, month, year, limit }: Props) {
  const jobs = seasonFor(month).jobs.slice(0, limit);
  const done = new Set(garden.jobsDone.map((j) => j.key));

  const toggle = (key: string) =>
    store.apply(
      updateGarden((g) => ({
        ...g,
        jobsDone: done.has(key) ? g.jobsDone.filter((j) => j.key !== key) : [...g.jobsDone, { key, date: todayIso() }],
      })),
    );

  return (
    <ul class="jobs">
      {jobs.map((job, i) => {
        const key = jobKey(year, month, i);
        return (
          <li key={key}>
            <label class="job">
              <input type="checkbox" checked={done.has(key)} onChange={() => toggle(key)} />
              <span>{job}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function jobsDoneCount(garden: Garden, month: number, year: number): number {
  const prefix = `general:${year}-${String(month).padStart(2, '0')}:`;
  return garden.jobsDone.filter((j) => j.key.startsWith(prefix)).length;
}

// ---------- Jobs for your own plants ----------

/** One job: "Carrot in Veg bed (2 rows)", with any advice underneath. */
function PlantJob({ job, done, onToggle, onPick }: { job: Job; done?: boolean; onToggle?: () => void; onPick?: (size: PickSize) => void }) {
  const [picking, setPicking] = useState(false);
  const text = (
    <span class="job-text">
      <span>
        <strong>{job.plant}</strong> {job.where}
      </span>
      {job.detail && <span class="job-detail small muted">{job.detail}</span>}
    </span>
  );
  const app = useApp();
  const first = job.plantingIds[0];
  // Jump to the planting on the plan, or to the plant's card for something on your sowing list. "Weed the beds" has neither.
  const link = !first && !job.plantId ? null : (
    <button
      type="button"
      class="job-link link-btn small"
      onClick={() => (first ? app.showOnPlan({ type: 'planting', id: first }) : app.openPlant(job.plantId))}
    >
      {first ? 'Show' : 'About'}
      <span class="visually-hidden"> {job.plant}</span>
    </button>
  );
  // Sowing-list plants sown under cover can go straight into a tray in the shed.
  const shed =
    job.kind === 'sow-indoors' && !first && onToggle ? (
      <button type="button" class="job-link link-btn small" onClick={() => app.sowInShed(job.plantId)}>
        Sow in the shed
      </button>
    ) : null;
  if (!onToggle)
    return (
      <span class="job-line">
        <span class="job job-preview">{text}</span>
        {link}
      </span>
    );
  // A harvest job can log how much was picked, in a tap.
  const pick = onPick ? (
    <button type="button" class="job-link link-btn small" aria-expanded={picking} onClick={() => setPicking(!picking)}>
      Picked some?
    </button>
  ) : null;
  return (
    <>
      <span class="job-line">
        <label class="job">
          <input type="checkbox" checked={done} onChange={onToggle} />
          {text}
        </label>
        {shed}
        {pick}
        {link}
      </span>
      {picking && onPick && (
        <span class="happened-chips job-pick" role="group" aria-label={`How much ${job.plant.toLowerCase()} did you pick?`}>
          {PICK_SIZES.map((size) => (
            <button key={size} type="button" class="chip" onClick={() => (onPick(size), setPicking(false))}>
              {PICK_LABEL[size]}
            </button>
          ))}
        </span>
      )}
    </>
  );
}

/** Your jobs, grouped by what kind of job they are. Without a store they're a preview, with no ticks. */
export function PlantJobs({ jobs, garden, store, limit, plantOf }: { jobs: Job[]; garden: Garden; store?: Store; limit?: number; plantOf?: (id: string) => Plant }) {
  const app = useApp();
  const done = new Set(garden.jobsDone.map((j) => j.key));
  const shown = limit ? jobs.slice(0, limit) : jobs;
  return (
    <div class="job-groups">
      {groupJobs(shown).map(([kind, list]) => (
        <section key={kind} class="job-group">
          <h3 class="job-kind">{JOB_LABEL[kind]}</h3>
          <ul class="jobs">
            {list.map((job) => (
              <li key={job.key}>
                <PlantJob
                  job={job}
                  done={done.has(job.key)}
                  {...(store ? { onToggle: () => store.apply(updateGarden((g) => toggleJob(g, job, todayIso(), plantOf))) } : {})}
                  {...(store && job.kind === 'harvest' && job.plantingIds.length
                    ? {
                        onPick: (size: PickSize) => {
                          store.apply(updateGarden((g) => logPick(g, job, todayIso(), size, plantOf)));
                          app.notify(`${job.plant}: ${PICK_LABEL[size].toLowerCase()} picked.`, { undo: true });
                        },
                      }
                    : {})}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** How many of these jobs are ticked. */
export const doneOf = (garden: Garden, jobs: Job[]) => {
  const done = new Set(garden.jobsDone.map((j) => j.key));
  return jobs.filter((j) => done.has(j.key)).length;
};
