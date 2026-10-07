// A planting's life at a glance: the stages it goes through, when it reached
// each, advice for where it is now, and the button to move it on.

import {
  currentStage,
  isNewSeason,
  markFailed,
  nextStage,
  pathFor,
  setSowing,
  setStage,
  STAGE_ACTION,
  STAGE_EXPLAIN,
  STAGE_LABEL,
  stageDate,
  stageTips,
  sowingOf,
  type LifeStage,
} from '../lifecycle/stages';
import { probableStage } from '../lifecycle/projection';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import { STAGES, type Garden, type Plant, type Planting, type Stage } from '../model/types';
import { useApp } from './appContext';
import { useWeatherNow } from './useWeather';
import { formatDate } from './NotesSection';

const order = (s: LifeStage) => (s === 'planned' ? -1 : s === 'cleared' ? 99 : STAGES.indexOf(s));

/** covered: under a greenhouse or cold frame, so there's no hardening off. */
export function StageStrip({ store, garden, pl, plant, canEdit, covered = false }: { store: Store; garden: Garden; pl: Planting; plant: Plant; canEdit: boolean; covered?: boolean }) {
  const app = useApp();
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const now = currentStage(pl);
  const path = pathFor(plant, pl, covered);
  const next = nextStage(plant, pl, covered);
  const tips = stageTips(plant, now, pl);
  const today = todayIso();
  // From the warmth it's had since it went in, by UK climate averages.
  const { weather } = useWeatherNow();
  const guess = probableStage(plant, pl, garden, today, weather);
  const moveTo = (s: Stage | 'planned', newSeason = false) => commit((g) => setStage(g, [pl.id], s, today, { newSeason }));
  const methods = new Set((plant.sowing ?? []).map((s) => (s.method === 'direct' ? 'direct' : 'indoors')));
  const canChooseSowing = now === 'planned' && methods.size > 1;
  const failable = now === 'sown' || now === 'germinated' || now === 'hardening';

  return (
    <div class="stage-panel">
      <ol class="stage-strip" aria-label="Stages">
        {path.map((s) => {
          const state = now === 'cleared' || order(s) < order(now) ? 'done' : s === now ? 'now' : 'todo';
          const date = state !== 'todo' ? stageDate(pl, s) : undefined;
          const name = s === 'transplanted' && sowingOf(plant, pl) === 'none' ? 'Planted' : STAGE_LABEL[s];
          return (
            <li key={s} class={`stage stage-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span class="stage-dot" aria-hidden="true" />
              <span class="stage-name">
                {name}
                {date && <span class="stage-date"> {formatDate(date)}</span>}
              </span>
            </li>
          );
        })}
        <li class="stage-names-break" aria-hidden="true" />
      </ol>

      {tips.length > 0 && (
        <ul class="stage-tips">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      {canEdit && guess && (
        <p class="stage-guess">
          Probably {STAGE_LABEL[guess].toLowerCase()} by now.{' '}
          <button type="button" class="link-btn" onClick={() => moveTo(guess)}>
            Yes, it is
          </button>
        </p>
      )}

      {canEdit && next && STAGE_EXPLAIN[next] && !canChooseSowing && <p class="muted small stage-explain">{STAGE_EXPLAIN[next]}</p>}
      {canEdit && now !== 'cleared' && (
        <div class="button-row stage-actions">
          {canChooseSowing ? (
            <>
              <button type="button" class="btn btn-primary" onClick={() => commit((g) => setStage(setSowing(g, [pl.id], 'indoors'), [pl.id], 'sown', today))}>
                Sown indoors
              </button>
              <button type="button" class="btn btn-primary" onClick={() => commit((g) => setStage(setSowing(g, [pl.id], 'direct'), [pl.id], 'sown', today))}>
                Sown outside
              </button>
            </>
          ) : (
            next && (
              <button type="button" class="btn btn-primary" onClick={() => moveTo(next, isNewSeason(plant, pl))}>
                {isNewSeason(plant, pl) ? 'Start a new season' : next === 'transplanted' && sowingOf(plant, pl) === 'none' ? 'Mark as planted' : STAGE_ACTION[next]}
              </button>
            )
          )}
          {failable && (
            <button
              type="button"
              class="btn"
              onClick={() => {
                commit((g) => markFailed(g, pl.id, plant.commonName, today));
                app.notify(`${plant.commonName} set back to planned, with a note in the journal.`, { undo: true });
              }}
            >
              Sowing failed
            </button>
          )}
          <label class="stage-correct">
            <span class="visually-hidden">Change the stage</span>
            <select
              value=""
              onChange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value as Stage | 'planned' | '';
                if (v) moveTo(v);
              }}
            >
              <option value="">Change stage…</option>
              <option value="planned" disabled={now === 'planned'}>
                {STAGE_LABEL.planned}
              </option>
              {path.map((s) => (
                <option key={s} value={s} disabled={s === now}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
