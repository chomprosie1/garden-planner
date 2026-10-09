// Inspire me: three questions about an empty bed, pot or lawn (budget, when,
// time a week) and three ideas that would grow there, each with a picture, a
// rough cost, the work it takes, when it's ready and why it suits. Pick one and
// it's planted on the plan. The ideas change as you answer.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { featureLabel, placeLabel } from '../model/features';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Feature, Garden, Plant, Point } from '../model/types';
import {
  BUDGET_LABEL,
  BUDGETS,
  buyAs,
  costText,
  DEFAULT_ANSWERS,
  effortText,
  emptyPlaces,
  ideaWhen,
  inspire,
  nothingText,
  plantIdea,
  spotOf,
  TIME_LABEL,
  TIMES,
  WHEN_LABEL,
  WHENS,
  type Answers,
  type Idea,
} from '../planting/inspire';
import { isSoftGround, spacingStyle } from '../planting/place';
import { areaHours, hoursAt, type SunGrid } from '../sun/hours';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { usePlants } from './usePlants';
import { useSunHours } from './useSunHours';

/** June's sun at a point on a lawn, or over a whole bed. */
const hoursFrom = (grid: SunGrid) => (f: Feature, at: Point) => (f.kind === 'surface' ? hoursAt(grid, at) : areaHours(grid, f.footprint));

function Choice<T extends string | number>({ label, name, options, labels, value, set }: { label: string; name: string; options: readonly T[]; labels: Record<T, string>; value: T; set: (v: T) => void }) {
  return (
    <fieldset class="choice inspire-q">
      <legend>{label}</legend>
      <div class="choice-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o)} type="button" role="radio" name={name} class="chip" aria-checked={value === o} onClick={() => set(o)}>
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function IdeaCard({ idea, plantOf, today, onPick }: { idea: Idea; plantOf: (id: string) => Plant; today: string; onPick: () => void }) {
  const plants = idea.plants.map(plantOf);
  const what = idea.mix ? `${plants.length} crops` : idea.count === 1 ? 'one plant' : `${idea.count} ${plants[0]!.art?.form === 'bulb' ? 'bulbs' : 'plants'}`;
  return (
    <li class="inspire-idea">
      <div class="inspire-pics" aria-hidden="true">
        {plants.slice(0, 4).map((p) => (
          <PlantIcon key={p.id} plant={p} size={plants.length > 1 ? 30 : 52} />
        ))}
      </div>
      <div class="inspire-text">
        <h3>{idea.title}</h3>
        <p class="inspire-facts">
          <span>{costText(idea.cost)}</span>
          <span>{effortText(idea.minutes)}</span>
          <span>{ideaWhen(idea, plantOf, today)}</span>
        </p>
        <ul class="inspire-why">
          {idea.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <button type="button" class="btn btn-primary" onClick={onPick}>
          Plant this ({what})
        </button>
      </div>
    </li>
  );
}

/** The questions and ideas for one bed, pot or lawn. Planting an idea is one undo step. */
export function InspireDialog({ store, garden, featureId, close, onPlanted }: { store: Store; garden: Garden; featureId: string; close: () => void; onPlanted?: (f: Feature) => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const { plants, plantOf } = usePlants(store.get().userPlants, spacingStyle(garden));
  const today = todayIso();
  const grid = useSunHours(garden, 6, Number(today.slice(0, 4)), true);
  const feature = garden.features.find((f) => f.id === featureId) ?? null;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const spot = useMemo(() => (feature ? spotOf(garden, feature, plantOf, grid ? hoursFrom(grid) : null) : null), [garden, feature, plantOf, grid]);
  const ideas = useMemo(() => (spot && plants ? inspire(garden, spot, answers, { plants, plantOf, today }) : null), [spot, plants, answers, garden, plantOf, today]);
  const set = <K extends keyof Answers>(k: K) => (v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }));

  const pick = (idea: Idea) => {
    if (!feature) return;
    store.apply(
      updateGarden((g) => {
        const f = g.features.find((x) => x.id === feature.id);
        return f ? plantIdea(g, spotOf(g, f, plantOf, grid ? hoursFrom(grid) : null), idea, plantOf, today) : g;
      }),
    );
    const seeds = idea.plants.some((id) => buyAs(plantOf(id)) === 'packet' && !garden.wishlist.includes(id));
    app.notify(`${idea.title} planned for ${placeLabel(feature)}.${seeds ? ' Anything from seed is on your sowing list.' : ''}`, { undo: true });
    ref.current?.close();
    onPlanted?.(feature);
  };

  return (
    <dialog ref={ref} class="dialog inspire-dialog" aria-labelledby="inspire-title" onClose={close}>
      <div class="dialog-body">
        <div class="dialog-head">
          <h2 id="inspire-title" class="title">
            Ideas for {feature ? placeLabel(feature) : 'here'}
          </h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            ×
          </button>
        </div>
        {!feature ? (
          <p>That place isn’t on the plan any more.</p>
        ) : (
          <>
            <div class="inspire-qs">
              <Choice label="Budget" name="budget" options={BUDGETS} labels={BUDGET_LABEL} value={answers.budget} set={set('budget')} />
              <Choice label="When" name="when" options={WHENS} labels={WHEN_LABEL} value={answers.when} set={set('when')} />
              <Choice label="Time a week" name="time" options={TIMES} labels={TIME_LABEL} value={answers.time} set={set('time')} />
            </div>
            {ideas === null || grid === undefined ? (
              <p class="muted">Looking at the sun and the space…</p>
            ) : ideas.length === 0 ? (
              <p class="inspire-none">{nothingText(spot!, answers, today)}</p>
            ) : (
              <ul class="inspire-ideas">
                {ideas.map((i) => (
                  <IdeaCard key={i.id} idea={i} plantOf={plantOf} today={today} onPick={() => pick(i)} />
                ))}
              </ul>
            )}
            <p class="assumption">Costs are rough UK prices from autumn 2026: a packet of seed, or plants in small pots. The time a week is a guess from what each plant needs.</p>
          </>
        )}
      </div>
    </dialog>
  );
}

/** "Inspire me" for a bed or lawn on the plan: a button that opens the dialog. */
export function InspireButton({ store, garden, f, class: cls = 'btn' }: { store: Store; garden: Garden; f: Feature; class?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" class={cls} onClick={() => setOpen(true)}>
        Inspire me
      </button>
      {open && <InspireDialog store={store} garden={garden} featureId={f.id} close={() => setOpen(false)} />}
    </>
  );
}

/** On Today: the beds and pots standing empty, and the lawn, each a way into Inspire me. */
export function InspireCard({ store, garden }: { store: Store; garden: Garden }) {
  const app = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const empty = emptyPlaces(garden);
  const lawn = garden.features.find((f) => isSoftGround(f) && (f.material ?? 'lawn') === 'lawn');
  const places = [...empty.slice(0, 3), ...(lawn ? [lawn] : [])];
  if (!places.length) return null;
  return (
    <section class="card inspire-card">
      <div class="card-head">
        <h2>Room to grow</h2>
        {empty.length > 0 && <span class="muted small">{empty.length === 1 ? 'One place is empty' : `${empty.length} places are empty`}</span>}
      </div>
      <p class="small">Choose a place, say what you’d spend and how much time you have, and get three ideas that suit its sun.</p>
      <div class="choice-row">
        {places.map((f) => (
          <button key={f.id} type="button" class="chip" onClick={() => setOpen(f.id)}>
            {f.kind === 'surface' ? `Ideas for ${placeLabel(f)}` : featureLabel(f)}
          </button>
        ))}
      </div>
      {open && <InspireDialog store={store} garden={garden} featureId={open} close={() => setOpen(null)} onPlanted={(f) => app.showOnPlan({ type: 'feature', id: f.id })} />}
    </section>
  );
}
