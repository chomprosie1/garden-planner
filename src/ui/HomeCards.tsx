// The cards on Home besides the month's jobs: getting started, the garden at a
// glance, the journal, and keeping your garden safe.

import { useEffect, useRef, useState } from 'preact/hooks';
import { planStyle, render } from '../canvas/render';
import { fit } from '../canvas/viewport';
import { gardenBounds } from '../model/features';
import { addNote, makeNote, newestFirst } from '../model/notes';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { checkGarden } from '../planting/rules';
import { saveStatus, type SaveStatus } from '../storage/local';
import { resolveMode } from '../theme/apply';
import type { Prefs, PrefsStore } from '../theme/prefs';
import { latestNews, unseenNews } from '../content/whatsNew';
import { momentFor } from '../calendar/moments';
import { todayIso } from '../model/ids';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';
import { useApp } from './appContext';
import { CompassNorth } from './CompassNorth';
import { PlaceSearch } from './PlaceSearch';
import { backUp, BackupButtons, KeptNote, UseLocationButton } from './GardenSettings';
import { Icon } from './icons';
import { NoteForm, NoteList, noteAbout } from './NotesSection';
import { backupDue, daysSinceBackup, setupSteps, type StepId } from './setup';

// ---------- Saved ----------

/** "Saved on this device", or a warning when the browser won't keep it. */
export function SaveIndicator() {
  const [status, setStatus] = useState<SaveStatus>(saveStatus.get());
  useEffect(() => saveStatus.subscribe(setStatus), []);
  if (status === 'failed')
    return (
      <p class="save-status save-failed" role="alert">
        Not saved: this browser isn’t keeping your changes. Download a backup to keep them.
      </p>
    );
  return (
    <p class="save-status" aria-live="polite">
      <Icon name="check" size={14} /> {status === 'saving' ? 'Saving…' : 'Saved on this device'}
    </p>
  );
}

// ---------- The garden's name ----------

/** The garden's name, which opens Your garden: its place, seasons and backups. */
export function GardenName({ name, class: cls = '' }: { name: string; class?: string }) {
  const app = useApp();
  return (
    <button type="button" class={`garden-name-btn ${cls}`} title="Your garden: location, frosts and backups" onClick={() => app.go('profile')}>
      {name}
      <Icon name="chevron" size={14} />
    </button>
  );
}

// ---------- A moment in the garden's year ----------

/** One warm line when something has just happened: the first frost, the first pick, midsummer. */
export function MomentCard({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const { weather } = useWeatherNow();
  const m = momentFor(garden, plantOf, todayIso(), weather);
  if (!m) return null;
  return (
    <section class={`card panel moment-card moment-${m.kind}`} aria-labelledby="moment-title">
      {m.plantId && <PlantIcon plant={plantOf(m.plantId)} size={56} stage="harvesting" class="moment-art" />}
      <div>
        <h2 id="moment-title" class="moment-title">
          {m.title}
        </h2>
        <p>{m.line}</p>
      </div>
    </section>
  );
}

// ---------- Getting started ----------

export function SetupCard({ store, garden, prefs, prefsStore }: { store: Store; garden: Garden; prefs: Prefs; prefsStore: PrefsStore }) {
  const app = useApp();
  const steps = setupSteps(garden, prefs);
  const done = steps.filter((s) => s.done).length;
  if (prefs.setupHidden || done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  const toPlan = () => app.go('plan');
  const action: Record<StepId, preact.JSX.Element> = {
    boundary: (
      <button type="button" class="btn btn-primary" onClick={toPlan}>
        Set up your space
      </button>
    ),
    bed: (
      <button type="button" class="btn btn-primary" onClick={toPlan}>
        Add a bed or pot
      </button>
    ),
    location: (
      <>
        <PlaceSearch store={store} onSet={(label) => app.notify(`Your garden is near ${label}.`)} />
        <UseLocationButton store={store} onMessage={(m) => m && app.notify(m.lines.join(' '))} />
      </>
    ),
    north: (
      <>
        <button type="button" class="btn btn-primary" onClick={toPlan}>
          Turn the north arrow
        </button>
        <button type="button" class="btn" onClick={() => prefsStore.set({ northChecked: true })}>
          North is the top of my plan
        </button>
        <CompassNorth store={store} onDone={() => prefsStore.set({ northChecked: true })} />
      </>
    ),
    plants: (
      <button type="button" class="btn btn-primary" onClick={toPlan}>
        Start planting
      </button>
    ),
    backup: (
      <button type="button" class="btn btn-primary" onClick={() => backUp(store, prefsStore)}>
        Download a backup
      </button>
    ),
  };
  return (
    <section class="card setup-card" aria-labelledby="setup-title">
      <div class="card-head">
        <h2 id="setup-title">Getting started</h2>
        <span class="muted small">
          {done} of {steps.length} done
        </span>
      </div>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Getting started">
        <div style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol class="setup-steps">
        {steps.map((s) => (
          <li key={s.id} class={s.done ? 'done' : s === next ? 'next' : ''}>
            <span class="setup-mark" aria-hidden="true">
              {s.done ? '✓' : ''}
            </span>
            <div>
              <p class="setup-title">
                {s.title}
                {s.done && <span class="visually-hidden"> (done)</span>}
              </p>
              {s === next && (
                <>
                  <p class="muted small">{s.why}</p>
                  <div class="button-row">{action[s.id]}</div>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" class="link-btn small" onClick={() => prefsStore.set({ setupHidden: true })}>
        Hide this list
      </button>
    </section>
  );
}

// ---------- The garden at a glance ----------

/** A small, still drawing of the plan, with plants and a warnings count. Tap to open the plan. */
export function GardenCard({ garden, prefs, plants, plantOf }: { garden: Garden; prefs: Prefs; plants: Plant[] | null; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const height = 200;
  const growing = garden.plantings.filter((p) => !p.removedOn).length;
  const warnings = plants ? checkGarden(garden, plantOf).filter((f) => f.level === 'warn').length : 0;
  const empty = garden.boundary.length === 0 && garden.features.length === 0;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || empty) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mode = resolveMode(prefs, matchMedia('(prefers-color-scheme: dark)').matches);
    render(ctx, {
      garden,
      view: fit(gardenBounds(garden), width, height, 14),
      width,
      height,
      style: planStyle(prefs.look, mode),
      selected: null,
      selectedVertex: null,
      hoverId: null,
      draft: null,
      trace: null,
      plantOf: plants ? plantOf : undefined,
      minimal: true,
    });
  }, [garden, width, prefs.look, prefs.mode, plants]);

  const summary = empty
    ? 'Nothing drawn yet. Open the plan and start with your garden’s boundary.'
    : [
        `${garden.features.length} ${garden.features.length === 1 ? 'thing' : 'things'} on the plan`,
        growing ? `${growing} ${growing === 1 ? 'planting' : 'plantings'}` : 'nothing planted yet',
      ].join(' · ');

  return (
    <a
      href="#/plan"
      class="card panel card-link garden-card"
      onClick={(e) => {
        e.preventDefault();
        app.go('plan');
      }}
    >
      {!empty && (
        <div ref={wrap} class="mini-plan-wrap" aria-hidden="true">
          <canvas ref={canvas} class="mini-plan-canvas" style={{ height: `${height}px` }} />
        </div>
      )}
      <span class="card-link-text">
        <strong>Your garden</strong>
        <span class="muted">{summary}</span>
        {warnings > 0 && (
          <span class="garden-warn">
            <span aria-hidden="true">!</span> {warnings} {warnings === 1 ? "thing" : "things"} to check in your planting
          </span>
        )}
      </span>
      <Icon name="chevron" />
    </a>
  );
}

// ---------- Journal ----------

export function JournalCard({ store, garden, plantOf }: { store: Store; garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const latest = newestFirst(garden.notes).slice(0, 3);
  return (
    <section class="card" aria-labelledby="journal-title">
      <div class="card-head">
        <h2 id="journal-title">Garden journal</h2>
        {garden.notes.length > 0 && (
          <a
            href="#/notes"
            class="small"
            onClick={(e) => {
              e.preventDefault();
              app.go('notes');
            }}
          >
            All notes ({garden.notes.length})
          </a>
        )}
      </div>
      {latest.length === 0 && !adding && <p class="muted">Jot down what you sowed, what worked and what didn’t, so next year is easier.</p>}
      <NoteList notes={latest} about={noteAbout(garden, (id) => plantOf(id).commonName)} onDelete={() => app.go('notes')} readOnly />
      {adding ? (
        <NoteForm
          label="Note about the whole garden"
          onAdd={(text, date, photo) => {
            store.apply(updateGarden((g) => addNote(g, makeNote(text, date, {}, photo))));
            setAdding(false);
            app.notify('Note added to your journal.');
          }}
        />
      ) : (
        <button type="button" class="btn" onClick={() => setAdding(true)}>
          Add a note or photo
        </button>
      )}
    </section>
  );
}

// ---------- What's new ----------

/** The newest change to the app, until you've read it or put it away. */
export function WhatsNewCard({ prefs, prefsStore }: { prefs: Prefs; prefsStore: PrefsStore }) {
  const app = useApp();
  const unseen = unseenNews(prefs.seenNews);
  if (!unseen.length) return null;
  const latest = unseen[0]!;
  const more = unseen.length - 1;
  return (
    <section class="card panel news-card" aria-labelledby="news-card-title">
      <div class="card-head">
        <h2 id="news-card-title">What’s new</h2>
        <span class="news-badge">New</span>
      </div>
      <p class="news-card-title">{latest.title}</p>
      <ul class="news-items">
        {latest.items.slice(0, 2).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div class="button-row">
        <button type="button" class="btn btn-primary" onClick={() => app.go('new')}>
          {more > 0 ? `See what’s new (${unseen.length} updates)` : 'See what’s new'}
        </button>
        <button type="button" class="btn btn-quiet" onClick={() => prefsStore.set({ seenNews: latestNews().id })}>
          Not now
        </button>
      </div>
    </section>
  );
}

// ---------- Keeping it safe ----------

export function BackupCard({ store, garden, prefs, prefsStore, now = new Date() }: { store: Store; garden: Garden; prefs: Prefs; prefsStore: PrefsStore; now?: Date }) {
  if (!backupDue(garden, prefs.lastBackup, now)) return null;
  const days = daysSinceBackup(prefs.lastBackup, now);
  return (
    <section class="card backup-card" aria-labelledby="backup-title">
      <h2 id="backup-title">Keep a copy</h2>
      <p class="muted">
        Your garden lives only in this browser. {days === null ? 'There’s no copy of it yet.' : `The last copy is ${days} days old.`} A copy keeps it safe, and moves it to another
        device.
      </p>
      <KeptNote kept={prefs.storageKept} />
      <div class="button-row">
        <BackupButtons store={store} prefsStore={prefsStore} />
      </div>
    </section>
  );
}
