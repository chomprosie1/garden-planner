import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import type { Target } from '../model/features';
import type { Store } from '../model/store';
import type { AppState } from '../model/types';
import { LOOKS } from '../theme/looks';
import type { PrefsStore, View } from '../theme/prefs';
import { AppContext, type AppActions } from './appContext';
import { CommandSearch } from './CommandSearch';
import { hashFor, usePrefs, useView } from './hooks';
import { Icon, type IconName } from './icons';
import { Onboarding } from './Onboarding';
import { gardenCount } from './gardenActions';
import type { Command } from './search';
import { Shortcuts } from './Shortcuts';
import { useAppState } from './useStore';
import { useWeatherFeed, WeatherContext } from './useWeather';
import { CheckPlants } from './views/CheckPlants';
import { Home } from './views/Home';
import { Month } from './views/Month';
import { Notes } from './views/Notes';
import { Plan, type PlanIntent } from './views/Plan';
import { Plants } from './views/Plants';
import { Settings } from './views/Settings';
import { Shed } from './views/Shed';
import { WhatsNew } from './views/WhatsNew';
import { Profile } from './views/Profile';
import { WrappedHost } from './WrappedHost';
import { ReminderKeeper } from './ReminderKeeper';

/** The four tabs: what's to do, the garden itself, seedlings in the shed, and plants to grow. */
const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Today', icon: 'home' },
  { view: 'plan', label: 'Garden', icon: 'plan' },
  { view: 'shed', label: 'Seedlings', icon: 'shed' },
  { view: 'plants', label: 'Plants', icon: 'plants' },
];

/** Pages that sit under a tab rather than being one: they highlight their parent. */
const PARENT: Partial<Record<View, View>> = { notes: 'home', check: 'plants', month: 'home', new: 'home', profile: 'home' };

/** Pages you go into and come back from. */
const SUB_PAGES: View[] = ['settings', 'check', 'notes', 'month', 'new', 'profile'];

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
  const [searching, setSearching] = useState(false);
  const [shedSow, setShedSow] = useState<string | null>(null);
  const [wrapping, setWrapping] = useState(false);
  const weather = useWeatherFeed(garden, prefs.weather && prefs.onboarded);

  const navigate = (v: View) => {
    if (SUB_PAGES.includes(v) && view !== v) setPrevious(view);
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
      plantOutTray(trayId) {
        setPlanIntent({ kind: 'tray', trayId });
        navigate('plan');
      },
      sowInShed(plantId) {
        setShedSow(plantId ?? '');
        navigate('shed');
      },
      openSearch() {
        setSearching(true);
      },
      openWrapped() {
        setWrapping(true);
      },
      clearBeds() {
        setPlanIntent({ kind: 'clear' });
        navigate('plan');
      },
    }),
    [store, view],
  );

  // Keyboard: Ctrl+K to search, undo/redo everywhere, H for photos on the plan, ? for the list of shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(true);
        return;
      }
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

  // A second garden, or starting again, skips the welcome.
  if (!prefs.onboarded) return <Onboarding store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} go={navigate} again={gardenCount() > 1} />;

  const back = () => navigate(previous);

  /** Does what a search result says. Things for the plan go there as an intent. */
  const run = (c: Command) => {
    const toPlan = (intent: PlanIntent) => {
      setPlanIntent(intent);
      navigate('plan');
    };
    switch (c.kind) {
      case 'go':
        return navigate(c.view);
      case 'plant':
        return actions.plantIt(c.id);
      case 'about':
        return actions.openPlant(c.id);
      case 'sow':
        return actions.sowInShed(c.id);
      case 'show':
        return actions.showOnPlan(c.target);
      case 'lock':
        prefsStore.set({ layoutLocked: c.on });
        return actions.notify(c.on ? 'Layout locked: beds and paths stay put. Plants can still be moved.' : 'Layout unlocked: beds and paths can be moved and reshaped.');
      case 'shortcuts':
        return setShortcuts(true);
      case 'lens':
        return toPlan({ kind: 'lens', lens: c.lens });
      case 'sticker':
        return toPlan({ kind: 'sticker', id: c.id });
      case 'tool':
        return toPlan({ kind: 'tool', tool: c.tool });
      case 'fit':
        return toPlan({ kind: 'fit' });
      case 'setup':
        return toPlan({ kind: 'setup' });
      case 'share':
        return toPlan({ kind: 'share' });
      case '3d':
        return toPlan({ kind: '3d' });
      case 'wrapped':
        return setWrapping(true);
    }
  };
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
        return <Month store={store} garden={garden} userPlants={userPlants} prefs={prefs} go={navigate} back={back} />;
      case 'plants':
        return (
          <Plants
            store={store}
            garden={garden}
            userPlants={userPlants}
            go={navigate}
            openId={plantCard}
            clearOpen={() => setPlantCard(null)}
            editor={prefs.plantEditor}
            checkPlant={(id) => {
              setCheckFrom(id);
              navigate('check');
            }}
          />
        );
      case 'notes':
        return <Notes store={store} garden={garden} userPlants={userPlants} back={back} />;
      case 'shed':
        return <Shed store={store} garden={garden} userPlants={userPlants} sowPlantId={shedSow} clearSow={() => setShedSow(null)} />;
      case 'check':
        return <CheckPlants store={store} userPlants={userPlants} startAt={checkFrom} back={back} />;
      case 'new':
        return <WhatsNew prefs={prefs} prefsStore={prefsStore} back={back} go={navigate} />;
      case 'profile':
        return <Profile store={store} garden={garden} prefsStore={prefsStore} back={back} />;
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
      <WeatherContext.Provider value={weather}>
      <div class="app" data-view={view}>
        <nav class="rail" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.view}
              href={hashFor(n.view)}
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
            href={hashFor('settings')}
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
        {prefs.onboarded && <ReminderKeeper garden={garden} userPlants={userPlants} frost={prefs.reminders} weekly={prefs.weeklyNudge} uv={prefs.uvReminders} />}
        {wrapping && <WrappedHost garden={garden} userPlants={userPlants} close={() => setWrapping(false)} />}
        {searching && <CommandSearch garden={garden} userPlants={userPlants} locked={prefs.layoutLocked} run={run} close={() => setSearching(false)} />}
      </div>
      </WeatherContext.Provider>
    </AppContext.Provider>
  );
}
