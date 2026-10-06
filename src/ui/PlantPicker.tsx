import { useMemo, useState } from 'preact/hooks';
import { formatLength } from '../canvas/viewport';
import { canSowIn, emptyFilter, filterPlants } from '../library/library';
import type { Plant } from '../model/types';
import { rowSpacingOf, spreadOf, type Layout } from '../planting/place';
import { PLANT_DRAG_TYPE } from './PlanCanvas';
import { PlantIcon } from './PlantIcon';

const LAYOUTS: { value: Layout; label: string; hint: string }[] = [
  { value: 'single', label: 'Single', hint: 'One plant where you click.' },
  { value: 'row', label: 'Row', hint: 'Click where the row starts and ends; plants go at their spacing.' },
  { value: 'block', label: 'Block', hint: 'Click two opposite corners; the block fills at the plant’s spacing.' },
];

interface Props {
  plants: Plant[] | null;
  plantId: string | null;
  setPlantId: (id: string) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  /** Already in the ground, rather than planned. */
  growing: boolean;
  setGrowing: (g: boolean) => void;
  month: number;
  /** Phones: no drag and drop, shorter hints. */
  phone?: boolean;
  /** The garden uses close spacing in beds, rather than rows. */
  close?: boolean;
}

/** Choose what to plant and how it's laid out. */
export function PlantPicker({ plants, plantId, setPlantId, layout, setLayout, growing, setGrowing, month, phone = false, close = true }: Props) {
  const [query, setQuery] = useState('');
  const [thisMonth, setThisMonth] = useState(false);
  const results = useMemo(
    () => filterPlants(plants ?? [], { ...emptyFilter, query, sowMonth: thisMonth ? month : null }),
    [plants, query, thisMonth, month],
  );
  const chosen = plants?.find((p) => p.id === plantId);

  return (
    <div class="inspector-body plant-picker">
      {!phone && (
        <div>
          <p class="eyebrow muted">Plant</p>
          <h2>{chosen ? chosen.commonName : 'Choose a plant'}</h2>
        </div>
      )}
      <fieldset class="choice">
        <legend>Lay out as</legend>
        <div class="choice-row">
          {LAYOUTS.map((l) => (
            <label key={l.value} class="choice-option">
              <input type="radio" name="layout" value={l.value} checked={layout === l.value} onChange={() => setLayout(l.value)} />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
        {!phone && <p class="muted small">{LAYOUTS.find((l) => l.value === layout)!.hint}</p>}
      </fieldset>

      <label class="check">
        <input type="checkbox" checked={growing} onChange={(e) => setGrowing((e.currentTarget as HTMLInputElement).checked)} />
        Already in the ground (not just planned)
      </label>

      {chosen && (
        <dl class="facts">
          {close && chosen.size.closeSpacingMm ? (
            <>
              <dt>Spacing</dt>
              <dd>{formatLength(chosen.size.spacingMm)} each way</dd>
            </>
          ) : (
            <>
              <dt>Spacing</dt>
              <dd>{formatLength(chosen.size.spacingMm)}</dd>
              <dt>Between rows</dt>
              <dd>{formatLength(rowSpacingOf(chosen))}</dd>
            </>
          )}
          <dt>Spread</dt>
          <dd>{formatLength(spreadOf(chosen))}</dd>
        </dl>
      )}

      <label class="field search">
        <span class="visually-hidden">Search plants</span>
        <input type="search" placeholder="Search, e.g. carrot" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="check">
        <input type="checkbox" checked={thisMonth} onChange={(e) => setThisMonth((e.currentTarget as HTMLInputElement).checked)} />
        Sow or plant this month
      </label>
      {!plants && <p class="muted">Loading plants…</p>}
      {!phone && plants && <p class="muted small">Pick a plant, then click in a bed. You can also drag a plant onto a bed.</p>}
      <p class="muted small">{close ? 'Spacing is for close planting in beds, as most home gardeners grow.' : 'Spacing is for traditional rows, as on seed packets.'} You can change this in Settings.</p>
      <ul class="pick-list" aria-label="Plants">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              class="pick"
              aria-pressed={p.id === plantId}
              draggable={!phone}
              onDragStart={(e) => {
                e.dataTransfer?.setData(PLANT_DRAG_TYPE, p.id);
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => setPlantId(p.id)}
            >
              <PlantIcon plant={p} size={28} />
              <span class="pick-name">{p.commonName}</span>
              <span class="small muted">
                {formatLength(p.size.spacingMm)}
                {canSowIn(p, month) ? ' · now' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {plants && results.length === 0 && <p class="muted">No plants match.</p>}
    </div>
  );
}
