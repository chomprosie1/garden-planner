import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import { LOOKS } from '../../theme/looks';
import type { Prefs, PrefsStore } from '../../theme/prefs';
import { Icon } from '../icons';
import { SeasonPhoto } from '../SeasonPhoto';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  now?: Date;
}

/** The to-scale plan. Drawing arrives in Stage 2; the workspace and its look are here now. */
export function Plan({ store, garden, prefs, prefsStore, now = new Date() }: Props) {
  const focus = prefs.focus ?? LOOKS[prefs.look].focusByDefault;
  const showPhoto = prefs.photos === 'full' && !focus;
  const photoMonth = prefs.photoMonth === 'auto' ? now.getMonth() + 1 : prefs.photoMonth;

  return (
    <div class={`plan ${focus ? 'plan-focus' : ''}`}>
      <header class="toolbar">
        <h1 class="toolbar-title">{garden.name}</h1>
        <div class="toolbar-actions">
          <button type="button" class="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!store.canUndo()} onClick={() => store.undo()}>
            <Icon name="undo" />
          </button>
          <button type="button" class="icon-btn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!store.canRedo()} onClick={() => store.redo()}>
            <Icon name="redo" />
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-pressed={focus}
            aria-label={focus ? 'Focus is on: photos hidden. Show photos' : 'Focus: hide photos'}
            title="Focus (F)"
            onClick={() => prefsStore.set({ focus: !focus })}
          >
            <Icon name="focus" />
          </button>
        </div>
      </header>

      <div class="plan-body">
        <main class="plan-stage">
          {showPhoto && <SeasonPhoto month={photoMonth} sizes="100vw" class="plan-margin-photo" credit={false} />}
          <div class="sheet">
            <div class="sheet-head">
              <span class="sheet-title">{garden.name}</span>
              <span class="north" aria-label="North">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 2 17 20 12 16 7 20z" fill="var(--decor)" />
                </svg>
                N
              </span>
            </div>
            <div class="sheet-paper">
              <div class="sheet-empty">
                <p class="sheet-empty-title">Your garden plan goes here</p>
                <p>Drawing the boundary, beds, paths and trees to scale arrives in Stage 2.</p>
              </div>
            </div>
          </div>
        </main>
        <aside class="inspector" aria-label="Details">
          <p class="muted">Select something on the plan to see and change its details.</p>
          <p class="assumption">Assumes flat ground.</p>
        </aside>
      </div>
    </div>
  );
}
