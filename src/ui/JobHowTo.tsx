// A job, opened: how to do it first (what you need, three or four steps, about
// how long), then this planting's own advice underneath, and Done. For
// someone who has never sown a row or planted a clove.

import { useEffect, useRef, useState } from 'preact/hooks';
import { jobLabel, type Job, type JobKind } from '../calendar/jobs';
import { howTo } from '../content/howto';
import type { Plant, SpacingStyle } from '../model/types';
import { startsAs } from '../planting/windows';
import { useApp } from './appContext';
import { GlossText } from './Glossary';

interface Props {
  job: Job;
  plantOf?: (id: string) => Plant;
  done: boolean;
  /** Ticks the job (done this way, when there's more than one), or unticks it. */
  toggle: (way?: JobKind) => void;
  /** A word about the feed shelf, for a feed job. */
  shelf?: string | null;
  /** The garden's spacing, for how far apart. */
  style?: SpacingStyle;
  close: () => void;
}

export function JobHowTo({ job, plantOf, done, toggle, shelf, close, style = 'close' }: Props) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const plant = job.plantId && plantOf ? plantOf(job.plantId) : null;
  const month = new Date().getMonth() + 1;
  // Two ways to do it: choose one, and its steps and Done go with it.
  const [wayKind, setWay] = useState<JobKind>(job.kind);
  const way = job.ways?.find((w) => w.kind === wayKind);
  const shown = way ? { ...job, kind: way.kind, ...(way.detail ? { detail: way.detail } : {}) } : job;
  const how = howTo(shown, plant ? startsAs(plant, month) : 'seed', plant?.art?.form === 'bulb', plant ? { plant, month, style } : undefined);
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

        {job.ways && !done && (
          <div class="choice-row choice-small howto-ways" role="radiogroup" aria-label="Which way">
            {job.ways.map((w) => (
              <label key={w.kind} class="choice-option">
                <input type="radio" name="howto-way" value={w.kind} checked={wayKind === w.kind} onChange={() => setWay(w.kind)} />
                <span>{w.label}</span>
              </label>
            ))}
          </div>
        )}
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
        {how.spacing && (
          <p class="howto-spacing">
            <strong>Spacing:</strong> {how.spacing}.
          </p>
        )}
        <p class="muted small howto-time">{how.time}.</p>

        {(shown.detail || shelf) && (
          <section class="howto-this">
            <h3>For {job.plantId ? `this ${job.plant.toLowerCase()}` : 'these'}</h3>
            {shown.detail && (
              <p>
                <GlossText text={shown.detail} />
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
              toggle(done ? undefined : wayKind);
              shut();
            }}
          >
            {done ? 'Not done after all' : way ? `Done: ${way.label.charAt(0).toLowerCase()}${way.label.slice(1)}` : 'Done'}
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
