import { useEffect, useMemo, useState } from 'preact/hooks';
import { blankPlant, copyAsUserPlant, deleteUserPlant, emptyFilter, filterPlants, saveUserPlant, type PlantFilter } from '../../library/library';
import { featureLabel } from '../../model/features';
import { currentStage, STAGE_LABEL } from '../../lifecycle/stages';
import { useApp } from '../appContext';
import { usePlants } from '../usePlants';
import type { Store } from '../../model/store';
import { LIGHT_LEVELS, PLANT_CATEGORIES, type Garden, type Plant } from '../../model/types';
import { onWishlist, toggleWishlist } from '../../calendar/jobs';
import { updateGarden } from '../../model/store';
import type { View } from '../../theme/prefs';
import { formatLength } from '../../canvas/viewport';
import { useIsPhone } from '../hooks';
import { Icon } from '../icons';
import { CATEGORY_LABEL, LIGHT_LABEL, PlantCard } from '../PlantCard';
import { PlantForm } from '../PlantForm';
import { PlantIcon } from '../PlantIcon';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  go: (v: View) => void;
  /** A card to open, e.g. from a planting's "About this plant". */
  openId?: string | null;
  clearOpen?: () => void;
  /** Opens the plant check at this plant. */
  checkPlant?: (id: string) => void;
  now?: Date;
}

type Panel = { kind: 'card'; id: string } | { kind: 'form'; plant: Plant } | null;

export function Plants({ store, garden, userPlants, go, openId = null, clearOpen, checkPlant, now = new Date() }: Props) {
  const app = useApp();
  const phone = useIsPhone();
  const month = now.getMonth() + 1;
  const [filter, setFilter] = useState<PlantFilter>(emptyFilter);
  const [panel, setPanel] = useState<Panel>(null);

  const { plants: loaded, library } = usePlants(userPlants);
  const failed = library !== null && library.length === 0;
  const plants = loaded ?? [];

  // Another screen asked for a plant's card.
  useEffect(() => {
    if (!openId) return;
    setPanel({ kind: 'card', id: openId });
    clearOpen?.();
  }, [openId]);
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
    store.apply(deleteUserPlant(p.id));
    setPanel(null);
    app.notify(`"${p.commonName}" deleted.`, { undo: true });
  };
  /** Where a plant is growing on the plan: "Veg bed", "Bed two". */
  const whereGrowing = (id: string) =>
    garden.plantings
      .filter((pl) => pl.plantId === id && !pl.removedOn)
      .map((pl) => {
        const bed = garden.features.find((f) => f.id === pl.featureId);
        return { id: pl.id, label: `${bed ? featureLabel(bed) : 'a bed'} (${STAGE_LABEL[currentStage(pl)].toLowerCase()})` };
      });

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
          Checked plants only
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
              <PlantIcon plant={p} size={34} />
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
        onPlant={() => app.plantIt(current.id)}
        where={whereGrowing(current.id)}
        onShow={(plantingId) => app.showOnPlan({ type: 'planting', id: plantingId })}
        {...(checkPlant && !current.userAdded && !current.verified ? { onCheck: () => checkPlant(current.id) } : {})}
        sowing={{ listed: onWishlist(garden, current.id), toggle: () => store.apply(updateGarden((g) => toggleWishlist(g, current.id))) }}
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
