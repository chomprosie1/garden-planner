import { useState } from 'preact/hooks';
import { todayIso } from '../model/ids';
import { addNote, deleteNote, makeNote, newestFirst } from '../model/notes';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Note } from '../model/types';

/** "6 Oct 2026" from "2026-10-06". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A small form for a dated note. */
export function NoteForm({ onAdd, label = 'Add a note' }: { onAdd: (text: string, date: string) => void; label?: string }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayIso());
  return (
    <form
      class="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text, date || todayIso());
        setText('');
      }}
    >
      <label class="field">
        {label}
        <textarea rows={2} maxLength={2000} value={text} placeholder="e.g. Netted against carrot fly" onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
      </label>
      <div class="note-form-row">
        <label class="field">
          Date
          <input type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <button type="submit" class="btn" disabled={!text.trim()}>
          Add note
        </button>
      </div>
    </form>
  );
}

export function NoteList({ notes, onDelete, about }: { notes: Note[]; onDelete: (id: string) => void; about?: (n: Note) => string | null }) {
  if (notes.length === 0) return null;
  return (
    <ul class="note-list">
      {newestFirst(notes).map((n) => {
        const what = about?.(n);
        return (
          <li key={n.id} class="note">
            <p class="note-meta small muted">
              <time dateTime={n.date}>{formatDate(n.date)}</time>
              {what && <span> · {what}</span>}
            </p>
            <p class="note-text">{n.text}</p>
            <button type="button" class="link-btn small" onClick={() => onDelete(n.id)}>
              Delete note
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Notes on one bed or one planting, with a form to add one. */
export function NotesSection({ store, garden, on }: { store: Store; garden: Garden; on: { featureId: string } | { plantingId: string } }) {
  const notes = garden.notes.filter((n) => ('featureId' in on ? n.featureId === on.featureId && !n.plantingId : n.plantingId === on.plantingId));
  return (
    <section class="inspector-section">
      <h3>Notes</h3>
      <NoteList notes={notes} onDelete={(id) => store.apply(updateGarden((g) => deleteNote(g, id)))} />
      <NoteForm onAdd={(text, date) => store.apply(updateGarden((g) => addNote(g, makeNote(text, date, on))))} />
    </section>
  );
}
