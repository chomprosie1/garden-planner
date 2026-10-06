import { useEffect, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import { GardenPanel } from './GardenPanel';
import { useAppState } from './useStore';

const TABS = [
  { id: 'garden', label: 'Garden' },
  { id: 'plants', label: 'Plants' },
  { id: 'month', label: 'This month' },
  { id: 'notes', label: 'Notes' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const COMING: Record<Exclude<TabId, 'garden'>, string> = {
  plants: 'The plant library arrives in Stage 3: search, plant cards, and adding your own plants.',
  month: 'The this-month job list arrives in Stage 5, built from the plants in your beds.',
  notes: 'Dated notes on beds and plants arrive in Stage 4.',
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function App({ store }: { store: Store }) {
  const { garden } = useAppState(store);
  const [tab, setTab] = useState<TabId>('garden');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) store.undo();
      else if (key === 'y' || (key === 'z' && e.shiftKey)) store.redo();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [store]);

  const rename = (e: Event) => {
    const name = (e.currentTarget as HTMLInputElement).value.trim();
    if (name) store.apply(updateGarden((g) => (g.name === name ? g : { ...g, name })));
  };

  return (
    <div class="app">
      <header class="topbar">
        <input class="garden-name" aria-label="Garden name" value={garden.name} onChange={rename} />
        <div class="button-row">
          <button type="button" class="icon" onClick={() => store.undo()} disabled={!store.canUndo()} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" class="icon" onClick={() => store.redo()} disabled={!store.canRedo()} title="Redo (Ctrl+Y)">
            Redo
          </button>
        </div>
      </header>

      <main class="layout">
        <section class="canvas-area" aria-label="Garden plan">
          <div class="placeholder">
            <p class="placeholder-title">Your garden plan goes here</p>
            <p>Drawing the garden to scale arrives in Stage 2.</p>
          </div>
        </section>

        <aside class="panel">
          <nav class="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'garden' ? (
            <GardenPanel store={store} garden={garden} />
          ) : (
            <div class="panel-body">
              <p class="hint">{COMING[tab]}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
