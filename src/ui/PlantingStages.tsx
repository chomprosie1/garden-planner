// A planting's life in its panel: "What's happened?" to log the next thing in
// one tap (with a note if you like), advice for where it is now, the rail of
// stages with their dates and what's likely next, and a way to correct a mistake.

import { useState } from 'preact/hooks';
import { happenings, isPicking, likelyNext, recordHappening, type HappeningId } from '../lifecycle/happened';
import { formatWeight, PICK_LABEL } from '../planting/harvest';
import { probableStage, shortDate, type Step } from '../lifecycle/projection';
import { currentStage, pathFor, setStage, STAGE_EXPLAIN, STAGE_LABEL, stageDate, stageTips, sowingOf, type LifeStage } from '../lifecycle/stages';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import { PICK_SIZES, STAGES, type Garden, type Note, type PickSize, type Plant, type Planting, type Stage } from '../model/types';
import { useApp } from './appContext';
import { formatDate } from './NotesSection';
import { useWeatherNow } from './useWeather';
import { Photo, PhotoInput } from './Photo';

const order = (s: LifeStage) => (s === 'planned' ? -1 : s === 'cleared' ? 99 : STAGES.indexOf(s));

interface Props {
  store: Store;
  garden: Garden;
  pl: Planting;
  plant: Plant;
  /** Under a greenhouse or cold frame, so there's no hardening off. */
  covered?: boolean;
}

/** One button, then the things that could have happened: tap one, add a note if you like, and save. */
export function WhatsHappened({ store, garden, pl, plant, covered = false }: Props) {
  const app = useApp();
  const today = todayIso();
  const { weather } = useWeatherNow();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<HappeningId | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [size, setSize] = useState<PickSize | null>(null);
  const [grams, setGrams] = useState('');
  const options = happenings(plant, pl, covered);
  if (!options.length) return null;
  // What it's probably at by now, from the warmth it's had, or simply what comes next.
  const probable = probableStage(plant, pl, garden, today, weather);
  const likely = probable ?? likelyNext(plant, pl, covered);

  const save = () => {
    if (!chosen) return;
    const label = options.find((o) => o.id === chosen)!.label;
    const weighed = Number(grams);
    const pick = isPicking(chosen) && (size || weighed > 0) ? (weighed > 0 ? { grams: weighed } : { size: size! }) : undefined;
    store.apply(updateGarden((g) => recordHappening(g, pl, plant, chosen, date, note, { ...(photo ? { photo } : {}), ...(pick ? { pick } : {}) })));
    const extras = [pick && 'how much', note.trim() && 'your note', photo && 'the photo'].filter(Boolean);
    app.notify(`${plant.commonName}: ${label.toLowerCase()}${extras.length ? `, with ${extras.join(' and ')}` : ''}.`, { undo: true });
    setOpen(false);
    setChosen(null);
    setNote('');
    setPhoto(null);
    setSize(null);
    setGrams('');
    setDate(today);
  };

  if (!open)
    return (
      <div class="happened">
        {probable && (
          <p class="stage-guess">
            Probably {STAGE_LABEL[probable].toLowerCase()} by now.
          </p>
        )}
        <button type="button" class="btn btn-primary happened-btn" onClick={() => (setOpen(true), setChosen(likely && options.some((o) => o.id === likely) ? likely : null))}>
          {currentStage(pl) === 'planned' ? 'Sown or planted it?' : 'What’s happened?'}
        </button>
      </div>
    );

  const explain = chosen && chosen in STAGE_EXPLAIN ? STAGE_EXPLAIN[chosen as Stage] : null;
  return (
    <div class="happened happened-open" role="group" aria-label="What’s happened?">
      <div class="happened-chips" role="radiogroup" aria-label="What happened">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" class="chip" aria-checked={chosen === o.id} onClick={() => setChosen(o.id)}>
            {o.label}
            {o.id === likely && chosen !== o.id && <span class="happened-likely">likely</span>}
          </button>
        ))}
      </div>
      {explain && <p class="muted small">{explain}</p>}
      {isPicking(chosen) && (
        <fieldset class="pick-amount">
          <legend>How much? (if you like)</legend>
          <div class="happened-chips">
            {PICK_SIZES.map((s) => (
              <button key={s} type="button" class="chip" aria-pressed={size === s && !grams} onClick={() => (setSize(size === s ? null : s), setGrams(''))}>
                {PICK_LABEL[s]}
              </button>
            ))}
            <label class="pick-grams">
              <span class="visually-hidden">Weighed, in grams</span>
              <input type="number" inputMode="numeric" min={1} max={100000} placeholder="or grams" value={grams} onInput={(e) => setGrams((e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
        </fieldset>
      )}
      <div class="field-row">
        <label class="field">
          When
          <input type="date" value={date} max={today} onChange={(e) => setDate((e.currentTarget as HTMLInputElement).value || today)} />
        </label>
      </div>
      <label class="field">
        Note (if you like)
        <textarea rows={2} value={note} placeholder="How it looks, the variety, anything to remember" onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <PhotoInput value={photo} onChange={setPhoto} />
      <div class="button-row">
        <button type="button" class="btn btn-primary" disabled={!chosen} onClick={save}>
          Save
        </button>
        <button type="button" class="btn" onClick={() => (setOpen(false), setChosen(null), setPhoto(null))}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Advice for where it is now, and a line on what's next when that needs explaining. */
export function StageAdvice({ pl, plant, covered = false }: Omit<Props, 'store' | 'garden'>) {
  const now = currentStage(pl);
  const tips = stageTips(plant, now, pl);
  const next = pathFor(plant, pl, covered).find((s) => order(s) > order(now));
  const explain = next ? STAGE_EXPLAIN[next] : undefined;
  if (!tips.length && !explain) return null;
  return (
    <div class="stage-advice">
      {tips.length > 0 && (
        <ul class="stage-tips">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {explain && <p class="muted small stage-explain">{explain}</p>}
    </div>
  );
}

/** The stages it goes through, with the dates it reached them; what's likely next and when; its photos; and what it's given. */
export function StageRail({ pl, plant, covered = false, steps = [], photos = [] }: Omit<Props, 'store' | 'garden'> & { steps?: Step[]; photos?: Note[] }) {
  const picks = [...(pl.picks ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = picks.reduce((a, k) => a + k.grams, 0);
  const now = currentStage(pl);
  const path = pathFor(plant, pl, covered);
  const today = todayIso();
  const ahead = steps.filter((s) => s.guessed && s.date && s.date > today && s.stage !== 'planned').slice(0, 4);
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
      {ahead.length > 0 && (
        <>
          <h4 class="stage-ahead-title">Likely next</h4>
          <ul class="plain-list stage-ahead">
            {ahead.map((s) => (
              <li key={`${s.stage}${s.date}`}>
                <span>{s.stage === 'cleared' ? 'Finished' : STAGE_LABEL[s.stage]}</span>
                <span class="muted">about {shortDate(s.date!)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {photos.length > 0 && (
        <>
          <h4 class="stage-ahead-title">Photos</h4>
          <div class="photo-strip">
            {photos.map((n) => (
              <figure key={n.id}>
                <Photo id={n.photo!} alt={n.text || `${plant.commonName}, ${formatDate(n.date)}`} class="photo-thumb" />
                <figcaption class="small muted">{shortDate(n.date)}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {picks.length > 0 && (
        <>
          <h4 class="stage-ahead-title">Picked: {formatWeight(total)} in all</h4>
          <ul class="plain-list stage-ahead">
            {picks.slice(0, 8).map((k, i) => (
              <li key={`${k.date}${i}`}>
                <span>{k.size ? PICK_LABEL[k.size] : formatWeight(k.grams)}</span>
                <span class="muted">{shortDate(k.date)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** For a mistake: set the stage back or forward to any on its path. */
export function StageCorrect({ store, pl, plant, covered = false }: Omit<Props, 'garden'>) {
  const now = currentStage(pl);
  if (now === 'cleared') return null;
  const path = pathFor(plant, pl, covered);
  const today = todayIso();
  return (
    <label class="field stage-correct">
      Correct a mistake
      <select
        value=""
        onChange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value as Stage | 'planned' | '';
          if (v) store.apply(updateGarden((g) => setStage(g, [pl.id], v, today)));
        }}
      >
        <option value="">Set the stage to…</option>
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
  );
}
