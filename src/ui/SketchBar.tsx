// The sketch tool's options: pen, highlighter, arrow, words or eraser; a
// colour; the words to place; and showing, hiding or clearing the sketches.

import { planStyle, sketchColour } from '../canvas/render';
import { clearSketches, COLOUR_LABEL, SKETCH_LABEL, sketchesOf } from '../model/sketches';
import { updateGarden, type Store } from '../model/store';
import { SKETCH_COLOURS, SKETCH_KINDS, type Garden } from '../model/types';
import type { LookId, Mode } from '../theme/looks';
import type { Prefs, PrefsStore } from '../theme/prefs';
import { useApp } from './appContext';
import type { SketchPen } from './PlanCanvas';

interface Props {
  pen: SketchPen;
  setPen: (p: SketchPen) => void;
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  look: LookId;
  mode: Mode;
  /** Phones: a Done button, as there's no Esc key. */
  done?: () => void;
}

export function SketchBar({ pen, setPen, store, garden, prefs, prefsStore, look, mode, done }: Props) {
  const app = useApp();
  const style = planStyle(look, mode);
  const count = sketchesOf(garden).length;
  return (
    <div class={`sketch-bar ${done ? 'draw-bar' : 'mode-bar'}`} role="toolbar" aria-label="Sketch">
      <div class="sketch-group" role="radiogroup" aria-label="Draw with">
        {[...SKETCH_KINDS, 'eraser' as const].map((k) => (
          <button key={k} type="button" class="tool" role="radio" aria-checked={pen.kind === k} onClick={() => setPen({ ...pen, kind: k })}>
            {k === 'eraser' ? 'Eraser' : SKETCH_LABEL[k]}
          </button>
        ))}
      </div>
      {pen.kind !== 'eraser' && (
        <div class="sketch-group sketch-colours" role="radiogroup" aria-label="Colour">
          {SKETCH_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              class="sketch-colour"
              aria-checked={pen.colour === c}
              aria-label={COLOUR_LABEL[c]}
              title={COLOUR_LABEL[c]}
              style={{ background: sketchColour(c, style) }}
              onClick={() => setPen({ ...pen, colour: c })}
            />
          ))}
        </div>
      )}
      {pen.kind === 'text' && (
        <label class="sketch-text">
          <span class="visually-hidden">Words to place</span>
          <input value={pen.text} maxLength={60} placeholder="Type, then click the plan" onInput={(e) => setPen({ ...pen, text: (e.currentTarget as HTMLInputElement).value })} />
        </label>
      )}
      <div class="sketch-group sketch-actions">
        <button type="button" class="tool" aria-pressed={!prefs.sketches} onClick={() => prefsStore.set({ sketches: !prefs.sketches })}>
          {prefs.sketches ? 'Hide sketches' : 'Show sketches'}
        </button>
        {count > 0 && (
          <button
            type="button"
            class="tool"
            onClick={() => {
              store.apply(updateGarden(clearSketches));
              app.notify(`${count} ${count === 1 ? 'sketch' : 'sketches'} cleared.`, { undo: true });
            }}
          >
            Clear all
          </button>
        )}
        {done && (
          <button type="button" class="btn btn-primary" onClick={done}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
