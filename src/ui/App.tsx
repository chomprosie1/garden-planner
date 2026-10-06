import { useEffect, useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import type { Store } from '../model/store';
import { LOOKS } from '../theme/looks';
import type { PrefsStore, View } from '../theme/prefs';
import { usePrefs, useView } from './hooks';
import { Icon, type IconName } from './icons';
import { Onboarding } from './Onboarding';
import { useAppState } from './useStore';
import { Home } from './views/Home';
import { Month } from './views/Month';
import { Placeholder } from './views/Placeholder';
import { Plan } from './views/Plan';
import { Settings } from './views/Settings';

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'plan', label: 'Plan', icon: 'plan' },
  { view: 'plants', label: 'Plants', icon: 'plants' },
  { view: 'month', label: 'Month', icon: 'month' },
  { view: 'notes', label: 'Notes', icon: 'notes' },
];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function App({ store, prefsStore }: { store: Store; prefsStore: PrefsStore }) {
  const { garden } = useAppState(store);
  const prefs = usePrefs(prefsStore);
  const [view, go] = useView(prefsStore);
  const [previous, setPrevious] = useState<View>('home');
  const [toast, setToast] = useState<string | null>(null);

  const navigate = (v: View) => {
    if (v === 'settings' && view !== 'settings') setPrevious(view);
    go(v);
  };

  // Keyboard: undo/redo everywhere, F for Focus on the plan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) store.undo();
        else if (key === 'y' || (key === 'z' && e.shiftKey)) store.redo();
        else return;
        e.preventDefault();
      } else if (key === 'f' && !e.altKey && view === 'plan') {
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
    if (p.seenMonth !== null) {
      const s = seasonFor(month);
      setToast(`Welcome to ${s.name}: ${s.jobs.length} jobs this month.`);
      setTimeout(() => setToast(null), 6000);
    }
    prefsStore.set({ seenMonth: month });
  }, [prefsStore, prefs.onboarded]);

  if (!prefs.onboarded) return <Onboarding store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} go={navigate} />;

  const screen = (() => {
    switch (view) {
      case 'home':
        return <Home store={store} garden={garden} prefs={prefs} go={navigate} />;
      case 'plan':
        return <Plan store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} />;
      case 'month':
        return <Month store={store} garden={garden} prefs={prefs} go={navigate} />;
      case 'plants':
        return (
          <Placeholder
            title="Plants"
            go={navigate}
            lines={[
              'The plant library arrives in Stage 3: search about 150 common UK plants, read what each needs, and add your own.',
            ]}
          />
        );
      case 'notes':
        return (
          <Placeholder
            title="Notes"
            go={navigate}
            lines={['Dated notes on any bed or plant arrive in Stage 4, so you remember what worked.']}
          />
        );
      case 'settings':
        return (
          <Settings
            store={store}
            garden={garden}
            prefs={prefs}
            prefsStore={prefsStore}
            back={() => navigate(previous)}
            go={navigate}
          />
        );
    }
  })();

  return (
    <div class="app" data-view={view}>
      <nav class="rail" aria-label="Main">
        {NAV.map((n) => (
          <a
            key={n.view}
            href={`#/${n.view}`}
            class="nav-item"
            aria-current={view === n.view ? 'page' : undefined}
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
          {toast}
        </div>
      )}
    </div>
  );
}
