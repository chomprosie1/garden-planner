import { useRef, useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import { PICK_SIZES, type Garden, type PickSize, type Plant } from '../model/types';
import { PICK_LABEL } from '../planting/harvest';
import { useApp } from './appContext';
import { groupJobs, JOB_LABEL, logPick, toggleJob, type Job } from '../calendar/jobs';

/** How far a job is swiped to tick it, px. */
const SWIPE_PX = 72;

/** A little buzz, on phones that have one. */
export const buzz = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    // no vibration here
  }
};

/**
 * Swipe a job to the right to tick it (or untick it). The row follows your finger; past SWIPE_PX it ticks. Up and down
 * still scrolls the page, and a tap still reaches the tick box.
 */
export function useSwipeToTick(onTick: (() => void) | undefined) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  if (!onTick) return { props: {}, dx: 0 };
  const end = () => {
    if (dx > SWIPE_PX) {
      buzz();
      onTick();
    }
    start.current = null;
    setDx(0);
  };
  return {
    dx,
    props: {
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType === 'mouse') return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x;
        const y = e.clientY - s.y;
        // Mostly sideways: it's a swipe. Mostly up or down: let the page scroll.
        if (Math.abs(y) > Math.abs(x) && dx === 0) {
          start.current = null;
          return;
        }
        if (x > 8) setDx(Math.min(x, SWIPE_PX * 1.6));
      },
      onPointerUp: end,
      onPointerCancel: () => {
        start.current = null;
        setDx(0);
      },
    },
  };
}

/** A job row that can be swiped to tick. */
function SwipeRow({ onTick, children, class: cls = '' }: { onTick?: () => void; children: preact.ComponentChildren; class?: string }) {
  const { props, dx } = useSwipeToTick(onTick);
  return (
    <li class={`swipe-row ${cls} ${dx > SWIPE_PX ? 'swipe-ready' : ''}`} {...props}>
      {dx > 0 && (
        <span class="swipe-hint" aria-hidden="true">
          ✓
        </span>
      )}
      <div class="swipe-body" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        {children}
      </div>
    </li>
  );
}

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
          <SwipeRow key={key} onTick={() => toggle(key)}>
            <label class="job">
              <input type="checkbox" checked={done.has(key)} onChange={() => (buzz(), toggle(key))} />
              <span>{job}</span>
            </label>
          </SwipeRow>
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
          <input type="checkbox" checked={done} onChange={() => (buzz(), onToggle())} />
          {text}
        </label>
        {(shed || pick || link) && (
          <span class="job-actions">
            {shed}
            {pick}
            {link}
          </span>
        )}
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
              <SwipeRow key={job.key} {...(store ? { onTick: () => store.apply(updateGarden((g) => toggleJob(g, job, todayIso(), plantOf))) } : {})}>
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
              </SwipeRow>
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
