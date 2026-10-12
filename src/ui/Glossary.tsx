// Garden words, explained where they're used: in a job's how-to, a job's
// heading and a plant's page, a glossary word has a dotted underline, and
// tapping it opens its two plain lines. "All garden words" is the whole list
// in Help.

import { useEffect, useRef, useState } from 'preact/hooks';
import { glossed, type GardenWord } from '../content/glossary';
import { useApp } from './appContext';

/** Text with its garden words tappable. */
export function GlossText({ text }: { text: string }) {
  const [open, setOpen] = useState<GardenWord | null>(null);
  return (
    <>
      {glossed(text).map((s, i) =>
        s.word ? (
          <button key={i} type="button" class="gloss" aria-haspopup="dialog" title={`What’s ${s.word.term.toLowerCase()}?`} onClick={(e) => (e.stopPropagation(), setOpen(s.word!))}>
            {s.text}
          </button>
        ) : (
          s.text
        ),
      )}
      {open && <WordDialog word={open} close={() => setOpen(null)} />}
    </>
  );
}

/** One garden word's two lines, in a small dialog. */
export function WordDialog({ word, close }: { word: GardenWord; close: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} class="dialog word-dialog" aria-labelledby="word-title" onClose={close} onClick={(e) => (e.stopPropagation(), e.target === ref.current && ref.current?.close())}>
      <div class="dialog-body">
        <header class="dialog-head">
          <h2 id="word-title">{word.term}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            ✕
          </button>
        </header>
        <p>{word.text}</p>
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={() => ref.current?.close()}>
            Got it
          </button>
          <button
            type="button"
            class="btn btn-quiet"
            onClick={() => {
              ref.current?.close();
              app.openHelp('words');
            }}
          >
            All garden words
          </button>
        </div>
      </div>
    </dialog>
  );
}
