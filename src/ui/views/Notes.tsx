import { useState } from 'preact/hooks';
import { featureLabel } from '../../model/features';
import { addNote, deleteNote, makeNote } from '../../model/notes';
import { updateGarden, type Store } from '../../model/store';
import type { Garden, Note, Plant } from '../../model/types';
import { isContainer } from '../../planting/place';
import { useApp } from '../appContext';
import { Icon } from '../icons';
import { NoteForm, NoteList, noteAbout } from '../NotesSection';
import { usePlants } from '../usePlants';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  back: () => void;
}

/** The garden journal: every dated note, newest first, with what each is about. */
export function Notes({ store, garden, userPlants, back }: Props) {
  const app = useApp();
  const [about, setAbout] = useState('');
  const [show, setShow] = useState('all');
  const { plantOf } = usePlants(userPlants);
  const describe = noteAbout(garden, (id) => plantOf(id).commonName);
  // Notes on a bed include notes on what grew in it.
  const bedOf = (n: Note) => n.featureId ?? garden.plantings.find((p) => p.id === n.plantingId)?.featureId;
  const shown = show === 'all' ? garden.notes : show === 'garden' ? garden.notes.filter((n) => !bedOf(n)) : garden.notes.filter((n) => bedOf(n) === show);
  const beds = garden.features.filter(isContainer);

  return (
    <div class="page notes-page">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">Garden journal</h1>
      </header>
      <section class="card">
        <label class="field">
          About
          <select value={about} onChange={(e) => setAbout((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">The whole garden</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                {featureLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <NoteForm label="Note" onAdd={(text, date) => store.apply(updateGarden((g) => addNote(g, makeNote(text, date, about ? { featureId: about } : {}))))} />
        <p class="muted small">You can also add notes to a bed or a planting from the plan.</p>
      </section>

      {garden.notes.length === 0 ? (
        <p class="muted">No notes yet. Jot down what you sowed, what worked and what didn't, so next year is easier.</p>
      ) : (
        <section class="notes-all">
          <label class="field notes-filter">
            Show
            <select value={show} onChange={(e) => setShow((e.currentTarget as HTMLSelectElement).value)}>
              <option value="all">All notes ({garden.notes.length})</option>
              <option value="garden">The whole garden</option>
              {beds.map((b) => (
                <option key={b.id} value={b.id}>
                  {featureLabel(b)}
                </option>
              ))}
            </select>
          </label>
          {shown.length === 0 && <p class="muted">No notes here yet.</p>}
          <NoteList
            notes={shown}
            about={describe}
            onDelete={(id) => {
              store.apply(updateGarden((g) => deleteNote(g, id)));
              app.notify('Note deleted.', { undo: true });
            }}
          />
        </section>
      )}
    </div>
  );
}
