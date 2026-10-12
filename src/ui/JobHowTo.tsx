// A job, opened: how to do it first (what you need, three or four steps, about
// how long), then this planting's own advice underneath, and Done. For
// someone who has never sown a row or planted a clove.

import { useEffect, useRef } from 'preact/hooks';
import { jobLabel, type Job } from '../calendar/jobs';
import { howTo } from '../content/howto';
import type { Plant } from '../model/types';
import { startsAs } from '../planting/windows';
import { useApp } from './appContext';
import { GlossText } from './Glossary';

interface Props {
  job: Job;
  plantOf?: (id: string) => Plant;
  done: boolean;
  /** Ticks the job, or unticks it. */
  toggle: () => void;
  /** A word about the feed shelf, for a feed job. */
  shelf?: string | null;
  close: () => void;
}

export function JobHowTo({ job, plantOf, done, toggle, shelf, close }: Props) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const plant = job.plantId && plantOf ? plantOf(job.plantId) : null;
  const month = new Date().getMonth() + 1;
  const how = howTo(job, plant ? startsAs(plant, month) : 'seed', plant?.art?.form === 'bulb');
  const first = job.plantingIds[0];
  const shut = () => ref.current?.close();
  return (
    <dialog ref={ref} class="dialog howto-dialog" aria-labelledby="howto-title" onClose={close} onClick={(e) => e.target === ref.current && shut()}>
      <div class="dialog-body">
        <header class="dialog-head">
          <div>
            <p class="eyebrow">
              <GlossText text={jobLabel(job)} />
            </p>
            <h2 id="howto-title">
              {job.plant} <span class="muted howto-where">{job.where}</span>
            </h2>
          </div>
          <button type="button" class="icon-btn" aria-label="Close" onClick={shut}>
            ✕
          </button>
        </header>

        <h3>What you need</h3>
        <ul class="howto-need">
          {how.need.map((n) => (
            <li key={n}>
              <GlossText text={n} />
            </li>
          ))}
        </ul>
        <h3>How</h3>
        <ol class="howto-steps">
          {how.steps.map((s) => (
            <li key={s}>
              <GlossText text={s} />
            </li>
          ))}
        </ol>
        <p class="muted small howto-time">{how.time}.</p>

        {(job.detail || shelf) && (
          <section class="howto-this">
            <h3>For {job.plantId ? `this ${job.plant.toLowerCase()}` : 'these'}</h3>
            {job.detail && (
              <p>
                <GlossText text={job.detail} />
              </p>
            )}
            {shelf && <p class="small">{shelf}</p>}
          </section>
        )}

        <div class="button-row">
          <button
            type="button"
            class={`btn ${done ? '' : 'btn-primary'}`}
            onClick={() => {
              toggle();
              shut();
            }}
          >
            {done ? 'Not done after all' : 'Done'}
          </button>
          {(first || plant) && (
            <button
              type="button"
              class="btn"
              onClick={() => {
                shut();
                if (first) app.showOnPlan({ type: 'planting', id: first });
                else if (job.featureId) app.showOnPlan({ type: 'feature', id: job.featureId });
                else if (plant) app.openPlant(plant.id);
              }}
            >
              {first || job.featureId ? 'Show in the garden' : `About ${job.plant.toLowerCase()}`}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
