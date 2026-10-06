import { seasonFor } from '../content/seasons';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { useApp } from './appContext';
import { groupJobs, JOB_LABEL, toggleJob, type Job } from '../calendar/jobs';

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
function PlantJob({ job, done, onToggle }: { job: Job; done?: boolean; onToggle?: () => void }) {
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
  // Jump to the planting on the plan, or to the plant's card for something on your sowing list.
  const link = (
    <button
      type="button"
      class="job-link link-btn small"
      onClick={() => (first ? app.showOnPlan({ type: 'planting', id: first }) : app.openPlant(job.plantId))}
    >
      {first ? 'Show' : 'About'}
      <span class="visually-hidden"> {job.plant}</span>
    </button>
  );
  if (!onToggle)
    return (
      <span class="job-line">
        <span class="job job-preview">{text}</span>
        {link}
      </span>
    );
  return (
    <span class="job-line">
      <label class="job">
        <input type="checkbox" checked={done} onChange={onToggle} />
        {text}
      </label>
      {link}
    </span>
  );
}

/** Your jobs, grouped by what kind of job they are. Without a store they're a preview, with no ticks. */
export function PlantJobs({ jobs, garden, store, limit, plantOf }: { jobs: Job[]; garden: Garden; store?: Store; limit?: number; plantOf?: (id: string) => Plant }) {
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
                <PlantJob job={job} done={done.has(job.key)} {...(store ? { onToggle: () => store.apply(updateGarden((g) => toggleJob(g, job, todayIso(), plantOf))) } : {})} />
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
