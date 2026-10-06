import { useEffect, useMemo, useState } from 'preact/hooks';
import { allPlants, blankPlant, copyAsUserPlant, deleteUserPlant, emptyFilter, filterPlants, loadLibrary, saveUserPlant, type PlantFilter } from '../../library/library';
import type { Store } from '../../model/store';
import { LIGHT_LEVELS, PLANT_CATEGORIES, type Plant } from '../../model/types';
import type { View } from '../../theme/prefs';
import { formatLength } from '../../canvas/viewport';
import { useIsPhone } from '../hooks';
import { Icon } from '../icons';
import { CATEGORY_LABEL, LIGHT_LABEL, PlantCard } from '../PlantCard';
import { PlantForm } from '../PlantForm';

interface Props {
  store: Store;
  userPlants: Plant[];
  go: (v: View) => void;
  /** Opens the plan with this plant ready to place. */
  plantIt?: (id: string) => void;
  now?: Date;
}

type Panel = { kind: 'card'; id: string } | { kind: 'form'; plant: Plant } | null;

export function Plants({ store, userPlants, go, plantIt, now = new Date() }: Props) {
  const phone = useIsPhone();
  const month = now.getMonth() + 1;
  const [library, setLibrary] = useState<Plant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<PlantFilter>(emptyFilter);
  const [panel, setPanel] = useState<Panel>(null);

  useEffect(() => {
    loadLibrary().then(setLibrary, () => setFailed(true));
  }, []);

  const plants = useMemo(() => allPlants(library ?? [], userPlants), [library, userPlants]);
  const byId = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const results = useMemo(() => filterPlants(plants, filter), [plants, filter]);

  // On a wide screen, show the first result rather than an empty pane.
  const shown = panel ?? (!phone && results[0] ? { kind: 'card' as const, id: results[0].id } : null);
  const current = shown?.kind === 'card' ? byId.get(shown.id) : undefined;

  const save = (p: Plant) => {
    store.apply(saveUserPlant(p));
    setPanel({ kind: 'card', id: p.id });
  };
  const remove = (p: Plant) => {
    if (!confirm(`Delete "${p.commonName}"? You can undo this with Ctrl+Z.`)) return;
    store.apply(deleteUserPlant(p.id));
    setPanel(null);
  };

  const list = (
    <div class="plants-list-pane">
      <header class="page-head">
        <h1 class="title">Plants</h1>
        <button type="button" class="icon-btn phone-only" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="settings" />
        </button>
      </header>
      <label class="field search">
        <span class="visually-hidden">Search plants</span>
        <input type="search" placeholder="Search by name, e.g. bean or Allium" value={filter.query} onInput={(e) => setFilter({ ...filter, query: (e.currentTarget as HTMLInputElement).value })} />
      </label>
      <div class="filters">
        <select aria-label="Kind of plant" value={filter.category} onChange={(e) => setFilter({ ...filter, category: (e.currentTarget as HTMLSelectElement).value as PlantFilter['category'] })}>
          <option value="all">All kinds</option>
          {PLANT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select aria-label="Light" value={filter.light} onChange={(e) => setFilter({ ...filter, light: (e.currentTarget as HTMLSelectElement).value as PlantFilter['light'] })}>
          <option value="all">Any light</option>
          {LIGHT_LEVELS.map((l) => (
            <option key={l} value={l}>
              {LIGHT_LABEL[l]}
            </option>
          ))}
        </select>
        <label class="check">
          <input type="checkbox" checked={filter.sowMonth !== null} onChange={(e) => setFilter({ ...filter, sowMonth: (e.currentTarget as HTMLInputElement).checked ? month : null })} />
          Sow or plant this month
        </label>
        <label class="check">
          <input type="checkbox" checked={filter.checkedOnly} onChange={(e) => setFilter({ ...filter, checkedOnly: (e.currentTarget as HTMLInputElement).checked })} />
          Checked notes only
        </label>
      </div>
      <button type="button" class="btn btn-primary" onClick={() => setPanel({ kind: 'form', plant: blankPlant() })}>
        Add your own plant
      </button>

      {failed && <p class="message">The plant library could not be loaded. Check your connection and reload.</p>}
      {!library && !failed && <p class="muted">Loading plants…</p>}
      {library && (
        <p class="muted small" aria-live="polite">
          {results.length} of {plants.length} plants
        </p>
      )}
      <ul class="plant-list">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" class="plant-row" aria-current={current?.id === p.id ? 'true' : undefined} onClick={() => setPanel({ kind: 'card', id: p.id })}>
              <span class="plant-row-main">
                <span class="plant-row-name">{p.commonName}</span>
                {p.latinName && <span class="latin small">{p.latinName}</span>}
              </span>
              <span class="plant-row-meta small muted">
                {LIGHT_LABEL[p.conditions.light]} · {formatLength(p.size.spacingMm)}
              </span>
              {p.userAdded ? <span class="badge badge-own">Yours</span> : !p.verified && <span class="dot-warn" title="Not yet checked" aria-label="Not yet checked" />}
            </button>
          </li>
        ))}
      </ul>
      {library && results.length === 0 && <p class="muted">No plants match. Try fewer words or clear a filter.</p>}
    </div>
  );

  const detail =
    shown?.kind === 'form' ? (
      <PlantForm key={shown.plant.id} initial={shown.plant} onSave={save} onCancel={() => setPanel(null)} />
    ) : current ? (
      <PlantCard
        key={current.id}
        plant={current}
        byId={byId}
        month={month}
        open={(id) => setPanel({ kind: 'card', id })}
        {...(plantIt ? { onPlant: () => plantIt(current.id) } : {})}
        {...(current.userAdded
          ? { onEdit: () => setPanel({ kind: 'form', plant: current }), onDelete: () => remove(current) }
          : { onCopy: () => setPanel({ kind: 'form', plant: copyAsUserPlant(current) }) })}
      />
    ) : null;

  if (phone)
    return (
      <div class="page plants-page">
        {panel && detail ? (
          <>
            <button type="button" class="btn btn-quiet back-link" onClick={() => setPanel(null)}>
              <Icon name="back" size={18} /> All plants
            </button>
            {detail}
          </>
        ) : (
          list
        )}
      </div>
    );

  return (
    <div class="plants-split">
      {list}
      <div class="plants-detail-pane">{detail}</div>
    </div>
  );
}
