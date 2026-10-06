import { seasonFor } from '../content/seasons';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';

export const jobKey = (year: number, month: number, i: number) =>
  `general:${year}-${String(month).padStart(2, '0')}:${i}`;

interface Props {
  store: Store;
  garden: Garden;
  month: number;
  year: number;
  limit?: number;
}

/** The month's general jobs, with ticks saved in the garden so they travel with the export. */
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
