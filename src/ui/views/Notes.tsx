import { useState } from 'preact/hooks';
import { featureLabel } from '../../model/features';
import { addNote, deleteNote, makeNote } from '../../model/notes';
import { updateGarden, type Store } from '../../model/store';
import type { Garden, Note, Plant } from '../../model/types';
import type { View } from '../../theme/prefs';
import { Icon } from '../icons';
import { NoteForm, NoteList } from '../NotesSection';
import { usePlants } from '../usePlants';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  go: (v: View) => void;
}

/** Every dated note, newest first, with what each is about. */
export function Notes({ store, garden, userPlants, go }: Props) {
  const [about, setAbout] = useState('');
  const [show, setShow] = useState('all');
  const { plantOf } = usePlants(userPlants);
  const plantName = (id: string) => plantOf(id).commonName;

  const bedName = (id: string) => {
    const f = garden.features.find((x) => x.id === id);
    return f ? featureLabel(f) : 'a deleted bed';
  };
  const describe = (n: Note): string => {
    if (n.plantingId) {
      const p = garden.plantings.find((x) => x.id === n.plantingId);
      return p ? `${plantName(p.plantId)} in ${bedName(p.featureId)}` : 'A planting';
    }
    if (n.featureId) return bedName(n.featureId);
    return 'The whole garden';
  };
  // Notes on a bed include notes on what grew in it.
  const bedOf = (n: Note) => n.featureId ?? garden.plantings.find((p) => p.id === n.plantingId)?.featureId;
  const shown = show === 'all' ? garden.notes : show === 'garden' ? garden.notes.filter((n) => !bedOf(n)) : garden.notes.filter((n) => bedOf(n) === show);
  const beds = garden.features.filter((f) => f.kind === 'bed' || f.kind === 'greenhouse');

  return (
    <div class="page notes-page">
      <header class="page-head">
        <h1 class="title">Notes</h1>
        <button type="button" class="icon-btn phone-only" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="settings" />
        </button>
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
          <NoteList notes={shown} about={describe} onDelete={(id) => store.apply(updateGarden((g) => deleteNote(g, id)))} />
        </section>
      )}
    </div>
  );
}
