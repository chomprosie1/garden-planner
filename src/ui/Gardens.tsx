// Your gardens, at the top of Settings: switch between them, add a new one,
// rename or delete one, and bring back one you cleared or deleted. And a
// careful way to start again or delete everything: the gentler choices first,
// what goes, what to keep, a copy to save, and a button you hold to confirm.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { KEEP_ALL, KEEP_DAYS, whatGoes, type Keep } from '../model/fresh';
import type { Store } from '../model/store';
import type { Garden } from '../model/types';
import { downloadFile } from '../storage/file';
import { daysLeft, listGardens, peekGarden, renameGarden, type GardenEntry } from '../storage/gardens';
import { photoIds } from '../storage/photos';
import type { PrefsStore } from '../theme/prefs';
import { useApp } from './appContext';
import { backUp } from './GardenSettings';
import { bringBack, deleteEverything, deleteGardenFor30Days, makeNewGarden, startAgain, switchGarden } from './gardenActions';
import { MiniPlan } from './MiniPlan';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Opened today", "Opened 3 days ago", "Opened on 2 March". */
function openedText(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Opened today';
  if (days === 1) return 'Opened yesterday';
  if (days < 14) return `Opened ${days} days ago`;
  return `Opened on ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

/** The gardens kept, read again whenever the open garden or its name changes. */
function useGardens(garden: Garden) {
  const [tick, setTick] = useState(0);
  const list = useMemo(() => listGardens(), [garden.name, tick]);
  return { ...list, refresh: () => setTick((n) => n + 1) };
}

export function GardenSwitcher({ store, prefsStore, garden }: { store: Store; prefsStore: PrefsStore; garden: Garden }) {
  const app = useApp();
  const { gardens, hidden, open, refresh } = useGardens(garden);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<GardenEntry | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const other = (e: GardenEntry) => (e.id === open ? garden : peekGarden(e.id));

  return (
    <section class="card gardens" aria-labelledby="gardens-head">
      <h2 id="gardens-head">Your gardens</h2>
      <ul class="garden-list">
        {gardens.map((e) => {
          const g = other(e);
          const isOpen = e.id === open;
          return (
            <li key={e.id} class={`garden-row ${isOpen ? 'is-open' : ''}`}>
              {g ? <MiniPlan garden={g} width={64} height={52} pad={0.08} class="garden-thumb" /> : <span class="garden-thumb garden-thumb-missing" aria-hidden="true" />}
              <span class="garden-row-text">
                {renaming === e.id ? (
                  <form
                    class="garden-rename"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const name = String(new FormData(ev.currentTarget as HTMLFormElement).get('name') ?? '').trim();
                      if (name) {
                        if (isOpen) store.apply((s) => ({ ...s, garden: { ...s.garden, name } }));
                        else renameGarden(e.id, name);
                      }
                      setRenaming(null);
                      refresh();
                    }}
                  >
                    <label class="visually-hidden" for={`rename-${e.id}`}>
                      Name
                    </label>
                    <input id={`rename-${e.id}`} name="name" defaultValue={e.name} maxLength={60} autoFocus />
                    <button type="submit" class="btn btn-small">
                      Save
                    </button>
                  </form>
                ) : (
                  <strong>{isOpen ? garden.name : e.name}</strong>
                )}
                <span class="muted small">{isOpen ? 'Open now' : openedText(e.openedAt)}</span>
              </span>
              <span class="garden-row-actions">
                {!isOpen && (
                  <button
                    type="button"
                    class="btn btn-small btn-primary"
                    onClick={() => {
                      if (switchGarden(store, e.id)) {
                        app.notify(`${e.name} is open.`);
                        refresh();
                      } else app.notify(`${e.name} couldn’t be opened.`);
                    }}
                  >
                    Open
                  </button>
                )}
                <button type="button" class="link-btn small" onClick={() => setRenaming(renaming === e.id ? null : e.id)}>
                  Rename
                </button>
                <button type="button" class="link-btn small" onClick={() => setDeleting(e)}>
                  Delete…
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn" onClick={() => setAdding(true)}>
        New garden
      </button>
      {hidden.length > 0 && (
        <div class="garden-hidden">
          <h3>Bring back a garden</h3>
          <ul class="plain-list">
            {hidden.map((e) => (
              <li key={e.id} class="garden-hidden-row">
                <span>
                  <strong>{e.name}</strong>{' '}
                  <span class="muted small">
                    cleared or deleted; kept for {plural(daysLeft(e), 'more day')}
                  </span>
                </span>
                <button
                  type="button"
                  class="btn btn-small"
                  onClick={() => {
                    if (bringBack(store, e.id)) app.notify(`${e.name} is back, and open.`);
                    refresh();
                  }}
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {adding && <NewGardenDialog store={store} prefsStore={prefsStore} garden={garden} close={() => setAdding(false)} />}
      {deleting && (
        <CarefulDialog
          mode="delete"
          entry={deleting}
          store={store}
          prefsStore={prefsStore}
          garden={garden}
          close={() => {
            setDeleting(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

/** A dialog, shown as soon as it's made. */
function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return ref;
}

export function NewGardenDialog({ store, prefsStore, garden, close }: { store: Store; prefsStore: PrefsStore; garden: Garden; close: () => void }) {
  const ref = useModal();
  const [name, setName] = useState('');
  const [samePlace, setSamePlace] = useState(true);
  const somewhere = !(garden.latitude === 52.5 && garden.longitude === -1.5);
  return (
    <dialog ref={ref} class="dialog" aria-labelledby="new-garden-title" onClose={close}>
      <form
        class="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          ref.current?.close();
          makeNewGarden(store, prefsStore, name || 'My garden', samePlace && somewhere);
        }}
      >
        <h2 id="new-garden-title" class="title">
          New garden
        </h2>
        <p class="muted small">{garden.name} is kept as it is. Switch between them at the top of Settings.</p>
        <label class="field">
          Name
          <input value={name} maxLength={60} placeholder="The allotment" autoFocus onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {somewhere && (
          <label class="clear-option">
            <input type="checkbox" checked={samePlace} onChange={(e) => setSamePlace((e.currentTarget as HTMLInputElement).checked)} />
            <span>In the same place as {garden.name}, with its frost dates</span>
          </label>
        )}
        <div class="button-row">
          <button type="submit" class="btn btn-primary">
            Set it up
          </button>
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

const HOLD_MS = 2000;

/** A button you hold for two seconds: hard to press by accident, and it works on a phone. Space or Enter, held, too. */
export function HoldButton({ label, onDone, danger = true }: { label: string; onDone: () => void; danger?: boolean }) {
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = () => {
    if (timer.current) return;
    setHeld(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setHeld(false);
      onDone();
    }, HOLD_MS);
  };
  const stop = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setHeld(false);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      class={`btn hold-btn ${danger ? 'btn-danger' : 'btn-primary'} ${held ? 'is-held' : ''}`}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as Record<string, string>}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span class="hold-fill" aria-hidden="true" />
      <span class="hold-label">{held ? 'Keep holding…' : label}</span>
    </button>
  );
}

type Mode = 'start' | 'delete' | 'everything';
type Step = 'gentler' | 'goes' | 'copy' | 'confirm';

/**
 * Start again (this garden, emptied), delete a garden, or delete everything, step by step. Start again and delete keep
 * the garden hidden for 30 days to bring back; deleting everything doesn't, and says so.
 */
export function CarefulDialog({ mode, entry = null, store, prefsStore, garden, close }: { mode: Mode; entry?: GardenEntry | null; store: Store; prefsStore: PrefsStore; garden: Garden; close: () => void }) {
  const app = useApp();
  const ref = useModal();
  const { open, gardens, hidden } = listGardens();
  const target = mode === 'delete' && entry && entry.id !== open ? peekGarden(entry.id) : garden;
  const steps: Step[] = mode === 'start' ? ['gentler', 'goes', 'copy', 'confirm'] : ['goes', 'copy', 'confirm'];
  const [at, setAt] = useState(0);
  const step = steps[at]!;
  const [keep, setKeep] = useState<Keep>(KEEP_ALL);
  const [adding, setAdding] = useState(false);
  const goes = target ? whatGoes(target) : null;
  const ownPlants = store.get().userPlants.length;
  const name = target?.name ?? entry?.name ?? 'this garden';
  const all = gardens.length + hidden.length;
  const next = () => setAt(at + 1);
  const shut = () => ref.current?.close();

  const title = mode === 'start' ? `Start ${name} again` : mode === 'delete' ? `Delete ${name}` : 'Delete everything';
  const saveCopies = async () => {
    if (mode === 'everything') {
      // Each garden as its own file.
      for (const e of [...gardens, ...hidden]) {
        const g = e.id === open ? garden : peekGarden(e.id);
        if (g) downloadFile({ garden: g, userPlants: store.get().userPlants });
        await new Promise((r) => setTimeout(r, 400));
      }
    } else if (target === garden) await backUp(store, prefsStore, photoIds(garden).size > 0);
    else if (target) downloadFile({ garden: target, userPlants: store.get().userPlants });
    next();
  };
  const done = async () => {
    if (mode === 'everything') return void (await deleteEverything());
    shut();
    if (mode === 'start') {
      startAgain(store, prefsStore, keep);
      return;
    }
    if (entry) deleteGardenFor30Days(store, prefsStore, entry.id);
    app.notify(`${name} deleted. You can bring it back from Settings for ${KEEP_DAYS} days.`);
  };

  return (
    <dialog ref={ref} class="dialog careful-dialog" aria-labelledby="careful-title" onClose={close}>
      <div class="dialog-body">
        <p class="eyebrow">
          Step {at + 1} of {steps.length}
        </p>
        <h2 id="careful-title" class="title">
          {title}
        </h2>

        {step === 'gentler' && (
          <>
            <p>Before you start again, would one of these do?</p>
            <ul class="plain-list careful-choices">
              <li>
                <button
                  type="button"
                  class="btn"
                  onClick={() => {
                    shut();
                    app.clearBeds();
                  }}
                >
                  Clear the beds
                </button>
                <span class="muted small">Keeps the layout: beds, paths and pots stay, and what grew is kept in their history.</span>
              </li>
              <li>
                <button type="button" class="btn" onClick={() => setAdding(true)}>
                  Start a new garden
                </button>
                <span class="muted small">Keeps {name} as it is, to switch back to.</span>
              </li>
            </ul>
            <div class="button-row">
              <button type="button" class="btn btn-primary" onClick={next}>
                No, start again
              </button>
              <button type="button" class="btn" onClick={shut}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'goes' && (
          <>
            {mode === 'everything' ? (
              <p>
                Every garden ({all}), your own plants{ownPlants ? ` (${ownPlants})` : ''}, every photo, and your settings go from this browser. Use this when you’re
                handing the device on.
              </p>
            ) : goes && !goes.beds && !goes.plantings && !goes.notes && !goes.jobs ? (
              <p>{name} is empty: nothing’s on it yet.</p>
            ) : goes ? (
              <>
                <p>What goes from {name}:</p>
                <ul class="careful-goes">
                  {goes.beds > 0 && <li>the plan: {plural(goes.beds, 'bed, path or other thing', 'beds, paths and other things')}</li>}
                  {goes.plantings > 0 && (
                    <li>
                      {plural(goes.plantings, 'planting')}
                      {goes.picks ? `, with ${plural(goes.picks, 'pick')} logged` : ''}
                    </li>
                  )}
                  {goes.notes > 0 && (
                    <li>
                      {plural(goes.notes, 'note')} in the journal{goes.photos ? `, with ${plural(goes.photos, 'photo')}` : ''}
                    </li>
                  )}
                  {goes.jobs > 0 && <li>{plural(goes.jobs, 'job')} ticked off</li>}
                </ul>
              </>
            ) : (
              <p>{name} can’t be read, so it will simply be deleted.</p>
            )}
            {mode === 'start' && (
              <fieldset class="clear-group">
                <legend>Keep</legend>
                {(
                  [
                    ['ownPlants', ownPlants ? `Your own plants (${ownPlants}), shared by all your gardens` : 'Your own plants'],
                    ['wishlist', garden.wishlist.length ? `Your list of plants to grow (${garden.wishlist.length})` : 'Your list of plants to grow'],
                    ['place', 'Where it is, and your frost dates'],
                    ['look', 'Your look'],
                  ] as [keyof Keep, string][]
                ).map(([k, label]) => (
                  <label key={k} class="clear-option">
                    <input type="checkbox" checked={keep[k]} onChange={(e) => setKeep({ ...keep, [k]: (e.currentTarget as HTMLInputElement).checked })} />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div class="button-row">
              <button type="button" class="btn btn-primary" onClick={next}>
                Next
              </button>
              <button type="button" class="btn" onClick={shut}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'copy' && (
          <>
            <p>
              Save a copy first? {mode === 'everything' ? 'Each garden downloads as its own file' : `${name} downloads as a file`}, to open again on any device from Your
              garden.
            </p>
            <div class="button-row">
              <button type="button" class="btn btn-primary" onClick={saveCopies}>
                {mode === 'everything' && all > 1 ? `Download ${all} copies` : 'Download a copy'}
              </button>
              <button type="button" class="btn btn-quiet" onClick={next}>
                Skip
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p>
              {mode === 'everything'
                ? 'There’s no way back from this: everything is deleted from this browser straight away.'
                : mode === 'start'
                  ? `${name} starts again, empty. The garden as it is now is kept, hidden, for ${KEEP_DAYS} days: bring it back from Settings if you change your mind.`
                  : `${name} is kept, hidden, for ${KEEP_DAYS} days: bring it back from Settings if you change your mind.`}
            </p>
            <div class="button-row">
              <HoldButton label={mode === 'start' ? 'Hold to start again' : mode === 'delete' ? 'Hold to delete' : 'Hold to delete everything'} onDone={done} />
              <button type="button" class="btn" onClick={shut}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
      {adding && (
        <NewGardenDialog
          store={store}
          prefsStore={prefsStore}
          garden={garden}
          close={() => {
            setAdding(false);
            shut();
          }}
        />
      )}
    </dialog>
  );
}

/** At the bottom of Settings, away from everything else. */
export function StartAgainCard({ store, prefsStore, garden }: { store: Store; prefsStore: PrefsStore; garden: Garden }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <section class="card start-again" aria-labelledby="start-again-head">
      <h2 id="start-again-head">Start again</h2>
      <p class="muted small">
        Empty {garden.name} and set it up afresh, or delete everything this app keeps in this browser. Either way, you’re asked carefully first.
      </p>
      <div class="button-row">
        <button type="button" class="btn" onClick={() => setMode('start')}>
          Start again…
        </button>
        <button type="button" class="btn btn-quiet" onClick={() => setMode('everything')}>
          Delete everything…
        </button>
      </div>
      {mode && <CarefulDialog mode={mode} store={store} prefsStore={prefsStore} garden={garden} close={() => setMode(null)} />}
    </section>
  );
}
