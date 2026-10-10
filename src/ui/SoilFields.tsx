// Soil: the garden's in Your garden, and a bed's own in its panel. Plants
// whose cards say the soil doesn't suit them get a check, as light does.

import { useEffect, useState } from 'preact/hooks';
import { updateFeature } from '../model/features';
import { updateGarden, type Store } from '../model/store';
import { GROUND_SOILS, SOILS, type Feature, type Garden, type Soil } from '../model/types';
import { soilOf, SOIL_HINT, SOIL_LABEL } from '../planting/soil';

/** A pH box: empty for not known, otherwise 3.5 to 9, to one decimal place. */
function PhField({ value, set, label }: { value: number | undefined; set: (ph: number | undefined) => void; label: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <label class="field ph-field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={3.5}
        max={9}
        placeholder="Not tested"
        value={text}
        onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        onChange={(e) => {
          const raw = (e.currentTarget as HTMLInputElement).value.trim();
          const n = Number(raw);
          if (!raw) set(undefined);
          else if (Number.isFinite(n) && n >= 3.5 && n <= 9) set(Math.round(n * 10) / 10);
          else setText(value === undefined ? '' : String(value));
        }}
      />
    </label>
  );
}

/** The garden's soil, and its pH if tested. */
export function GardenSoil({ store, garden }: { store: Store; garden: Garden }) {
  const set = (patch: Partial<Garden>) =>
    store.apply(
      updateGarden((g) => {
        const next = { ...g, ...patch };
        if (next.soil === undefined) delete next.soil;
        if (next.soilPh === undefined) delete next.soilPh;
        return next;
      }),
    );
  return (
    <fieldset class="choice">
      <legend>Your soil</legend>
      <div class="happened-chips">
        <button type="button" class="chip" aria-pressed={!garden.soil} onClick={() => set({ soil: undefined })}>
          Not sure
        </button>
        {GROUND_SOILS.map((s) => (
          <button key={s} type="button" class="chip" aria-pressed={garden.soil === s} title={SOIL_HINT[s]} onClick={() => set({ soil: s })}>
            {SOIL_LABEL[s]}
          </button>
        ))}
      </div>
      <p class="muted small">{garden.soil ? SOIL_HINT[garden.soil] : 'Squeeze a damp handful: clay makes a sticky ball, sandy soil feels gritty and falls apart. Beds and pots can have their own soil.'}</p>
      <PhField label="pH, if you've tested it" value={garden.soilPh} set={(ph) => set({ soilPh: ph })} />
      <p class="muted small">Plants whose soil doesn't suit them are flagged in the plant checks, from what their cards say.</p>
    </fieldset>
  );
}

/** A bed's, pot's or lawn's own soil: the garden's (compost, for a pot or planter) unless you say otherwise. */
export function BedSoil({ store, garden, bed }: { store: Store; garden: Garden; bed: Feature }) {
  const set = (patch: Partial<Feature>) => store.apply(updateGarden((g) => updateFeature(g, bed.id, patch)));
  const usual = soilOf(garden, { ...bed, soil: undefined });
  const usualText = bed.kind === 'pot' || bed.kind === 'planter' ? 'Compost (the usual)' : `The garden’s${usual ? ` (${SOIL_LABEL[usual].toLowerCase()})` : ''}`;
  return (
    <>
      <div class="happened-chips" role="group" aria-label="Soil">
        <button type="button" class="chip" aria-pressed={!bed.soil} onClick={() => set({ soil: undefined })}>
          {usualText}
        </button>
        {SOILS.filter((s) => s !== usual || bed.soil === s).map((s: Soil) => (
          <button key={s} type="button" class="chip" aria-pressed={bed.soil === s} onClick={() => set({ soil: s })}>
            {SOIL_LABEL[s]}
          </button>
        ))}
      </div>
      <PhField label="pH, if you've tested it" value={bed.ph} set={(ph) => set({ ph })} />
    </>
  );
}
