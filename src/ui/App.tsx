import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import type { Target } from '../model/features';
import type { Store } from '../model/store';
import type { AppState } from '../model/types';
import { LOOKS } from '../theme/looks';
import type { PrefsStore, View } from '../theme/prefs';
import { AppContext, type AppActions } from './appContext';
import { usePrefs, useView } from './hooks';
import { Icon, type IconName } from './icons';
import { Onboarding } from './Onboarding';
import { Shortcuts } from './Shortcuts';
import { useAppState } from './useStore';
import { CheckPlants } from './views/CheckPlants';
import { Home } from './views/Home';
import { Month } from './views/Month';
import { Notes } from './views/Notes';
import { Plan, type PlanIntent } from './views/Plan';
import { Plants } from './views/Plants';
import { Settings } from './views/Settings';

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'plan', label: 'Plan', icon: 'plan' },
  { view: 'plants', label: 'Plants', icon: 'plants' },
  { view: 'month', label: 'Month', icon: 'month' },
];

/** Pages that sit under a tab rather than being one: they highlight their parent. */
const PARENT: Partial<Record<View, View>> = { notes: 'home', check: 'plants' };

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

interface Toast {
  text: string;
  /** The state just after the change; Undo only works while nothing else has changed since. */
  after: AppState | null;
}

export function App({ store, prefsStore }: { store: Store; prefsStore: PrefsStore }) {
  const { garden, userPlants } = useAppState(store);
  const prefs = usePrefs(prefsStore);
  const [view, go] = useView(prefsStore);
  const [previous, setPrevious] = useState<View>('home');
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [planIntent, setPlanIntent] = useState<PlanIntent | null>(null);
  const [plantCard, setPlantCard] = useState<string | null>(null);
  const [checkFrom, setCheckFrom] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);

  const navigate = (v: View) => {
    if ((v === 'settings' || v === 'check' || v === 'notes') && view !== v) setPrevious(view);
    go(v);
  };

  const actions: AppActions = useMemo(
    () => ({
      notify(text, opts) {
        clearTimeout(toastTimer.current);
        setToast({ text, after: opts?.undo ? store.get() : null });
        toastTimer.current = setTimeout(() => setToast(null), opts?.undo ? 8000 : 5000);
      },
      go: navigate,
      openPlant(id) {
        setPlantCard(id);
        navigate('plants');
      },
      showOnPlan(target: Target) {
        setPlanIntent({ kind: 'select', target });
        navigate('plan');
      },
      plantIt(id) {
        setPlanIntent({ kind: 'plant', id });
        navigate('plan');
      },
    }),
    [store, view],
  );

  // Keyboard: undo/redo everywhere, H for photos on the plan, ? for the list of shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) store.undo();
        else if (key === 'y' || (key === 'z' && e.shiftKey)) store.redo();
        else return;
        e.preventDefault();
      } else if (e.key === '?') {
        setShortcuts(true);
      } else if (key === 'h' && !e.altKey && view === 'plan') {
        const p = prefsStore.get();
        prefsStore.set({ focus: !(p.focus ?? LOOKS[p.look].focusByDefault) });
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [store, prefsStore, view]);

  // A short welcome the first time the app opens in a new month.
  useEffect(() => {
    const month = new Date().getMonth() + 1;
    const p = prefsStore.get();
    if (!p.onboarded || p.seenMonth === month) return;
    if (p.seenMonth !== null) actions.notify(`Welcome to ${seasonFor(month).name}. Your jobs for the month are on Home.`);
    prefsStore.set({ seenMonth: month });
  }, [prefsStore, prefs.onboarded]);

  if (!prefs.onboarded) return <Onboarding store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} go={navigate} />;

  const back = () => navigate(previous);
  const screen = (() => {
    switch (view) {
      case 'home':
        return <Home store={store} garden={garden} userPlants={userPlants} prefs={prefs} prefsStore={prefsStore} go={navigate} />;
      case 'plan':
        return (
          <Plan
            store={store}
            garden={garden}
            userPlants={userPlants}
            prefs={prefs}
            prefsStore={prefsStore}
            intent={planIntent}
            clearIntent={() => setPlanIntent(null)}
          />
        );
      case 'month':
        return <Month store={store} garden={garden} userPlants={userPlants} prefs={prefs} go={navigate} />;
      case 'plants':
        return (
          <Plants
            store={store}
            garden={garden}
            userPlants={userPlants}
            go={navigate}
            openId={plantCard}
            clearOpen={() => setPlantCard(null)}
            checkPlant={(id) => {
              setCheckFrom(id);
              navigate('check');
            }}
          />
        );
      case 'notes':
        return <Notes store={store} garden={garden} userPlants={userPlants} back={back} />;
      case 'check':
        return <CheckPlants store={store} userPlants={userPlants} startAt={checkFrom} back={back} />;
      case 'settings':
        return (
          <Settings
            store={store}
            garden={garden}
            prefs={prefs}
            prefsStore={prefsStore}
            back={back}
            go={navigate}
            showShortcuts={() => setShortcuts(true)}
          />
        );
    }
  })();

  const current = PARENT[view] ?? view;
  const canUndo = !!toast?.after && store.get() === toast.after;

  return (
    <AppContext.Provider value={actions}>
      <div class="app" data-view={view}>
        <nav class="rail" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.view}
              href={`#/${n.view}`}
              class="nav-item"
              aria-current={current === n.view ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.view);
              }}
            >
              <span class="nav-icon">
                <Icon name={n.icon} />
              </span>
              <span class="nav-label">{n.label}</span>
            </a>
          ))}
          <a
            href="#/settings"
            class="nav-item nav-settings"
            aria-current={view === 'settings' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate('settings');
            }}
          >
            <span class="nav-icon">
              <Icon name="settings" />
            </span>
            <span class="nav-label">Settings</span>
          </a>
        </nav>
        <div class="screen">{screen}</div>
        {toast && (
          <div class="toast" role="status">
            <span>{toast.text}</span>
            {canUndo && (
              <button
                type="button"
                class="toast-undo"
                onClick={() => {
                  store.undo();
                  setToast(null);
                }}
              >
                Undo
              </button>
            )}
            <button type="button" class="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
              ✕
            </button>
          </div>
        )}
        {shortcuts && <Shortcuts close={() => setShortcuts(false)} />}
      </div>
    </AppContext.Provider>
  );
}
