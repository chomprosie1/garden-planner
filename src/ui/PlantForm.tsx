import { useState } from 'preact/hooks';
import { LIGHT_LEVELS, PLANT_CATEGORIES, SOWING_METHODS, WINTERING_TYPES, type Plant, type Sowing } from '../model/types';
import { validatePlant } from '../model/validate';
import { CATEGORY_LABEL, LIGHT_LABEL, METHOD_LABEL, WINTER_LABEL } from './PlantCard';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Twelve toggle buttons for choosing months. */
function MonthPicker({ label, months, onChange }: { label: string; months: number[]; onChange: (m: number[]) => void }) {
  const set = new Set(months);
  return (
    <fieldset class="month-picker">
      <legend>{label}</legend>
      <div class="month-picker-row">
        {MONTHS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={set.has(i + 1)}
            aria-label={name}
            title={name}
            onClick={() => {
              const next = new Set(set);
              if (next.has(i + 1)) next.delete(i + 1);
              else next.add(i + 1);
              onChange([...next].sort((a, b) => a - b));
            }}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const num = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() === '' || !Number.isFinite(n) ? undefined : Math.round(n);
};

interface Props {
  initial: Plant;
  onSave: (p: Plant) => void;
  onCancel: () => void;
}

/** Add or edit one of your own plants. Only name, kind, light and spacing are needed. */
export function PlantForm({ initial, onSave, onCancel }: Props) {
  const [p, setP] = useState<Plant>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const isNew = initial.commonName === '';
  const set = (patch: Partial<Plant>) => setP((x) => ({ ...x, ...patch }));
  const setCond = (patch: Partial<Plant['conditions']>) => setP((x) => ({ ...x, conditions: { ...x.conditions, ...patch } }));
  const setSize = (patch: Partial<Plant['size']>) => setP((x) => ({ ...x, size: { ...x.size, ...patch } }));
  const sowing = p.sowing ?? [];
  const setSowing = (list: Sowing[]) => set({ sowing: list.length ? list : undefined });

  const submit = (e: Event) => {
    e.preventDefault();
    // Drop empty optional parts so the saved plant stays tidy.
    const clean: Plant = {
      ...p,
      commonName: p.commonName.trim(),
      sowing: sowing.filter((s) => s.months.length > 0),
      lookOutFor: p.lookOutFor?.map((t) => t.trim()).filter(Boolean),
    };
    if (!clean.sowing?.length) delete clean.sowing;
    if (!clean.lookOutFor?.length) delete clean.lookOutFor;
    if (!clean.plantOutMonths?.length) delete clean.plantOutMonths;
    if (!clean.flowerMonths?.length) delete clean.flowerMonths;
    if (clean.cropping && clean.cropping.harvestMonths.length === 0 && !clean.cropping.notes) delete clean.cropping;
    const problems = validatePlant(clean).map((m) => m.replace(/^[^:]+: /, ''));
    if (!clean.commonName) problems.unshift('Give it a name.');
    setErrors(problems);
    if (problems.length === 0) onSave(clean);
  };

  return (
    <form class="plant-form" onSubmit={submit}>
      <h1 class="plant-name">{isNew ? 'Add your own plant' : `Edit ${initial.commonName}`}</h1>
      <p class="muted small">Only the first four are needed. Add the rest whenever you like.</p>

      <label class="field">
        Name
        <input value={p.commonName} required maxLength={60} placeholder="e.g. Grandad’s runner bean" onInput={(e) => set({ commonName: (e.currentTarget as HTMLInputElement).value })} />
      </label>
      <div class="field-row">
        <label class="field">
          Kind
          <select value={p.category} onChange={(e) => set({ category: (e.currentTarget as HTMLSelectElement).value as Plant['category'] })}>
            {PLANT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Light
          <select value={p.conditions.light} onChange={(e) => setCond({ light: (e.currentTarget as HTMLSelectElement).value as Plant['conditions']['light'] })}>
            {LIGHT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LIGHT_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label class="field">
        Space between plants (mm)
        <input type="number" min={10} required value={p.size.spacingMm} onInput={(e) => setSize({ spacingMm: num((e.currentTarget as HTMLInputElement).value) ?? 0 })} />
      </label>

      <details class="form-more">
        <summary>More about it</summary>
        <label class="field">
          Latin name
          <input value={p.latinName ?? ''} onInput={(e) => set({ latinName: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </label>
        <div class="field-row">
          <label class="field">
            Height (mm)
            <input type="number" min={0} value={p.size.heightMm ?? ''} onInput={(e) => setSize({ heightMm: num((e.currentTarget as HTMLInputElement).value) })} />
          </label>
          <label class="field">
            Spread (mm)
            <input type="number" min={0} value={p.size.spreadMm ?? ''} onInput={(e) => setSize({ spreadMm: num((e.currentTarget as HTMLInputElement).value) })} />
          </label>
          <label class="field">
            Between rows (mm)
            <input type="number" min={0} value={p.size.rowSpacingMm ?? ''} onInput={(e) => setSize({ rowSpacingMm: num((e.currentTarget as HTMLInputElement).value) })} />
          </label>
          <label class="field">
            Spacing each way in a bed (mm)
            <input type="number" min={0} value={p.size.closeSpacingMm ?? ''} onInput={(e) => setSize({ closeSpacingMm: num((e.currentTarget as HTMLInputElement).value) })} />
          </label>
          <label class="field">
            Hours of sun it needs
            <input type="number" min={0} max={16} value={p.conditions.minSunHours ?? ''} onInput={(e) => setCond({ minSunHours: num((e.currentTarget as HTMLInputElement).value) })} />
          </label>
        </div>
        <label class="field">
          Soil
          <input value={p.conditions.soil ?? ''} placeholder="e.g. Free-draining, fertile" onInput={(e) => setCond({ soil: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </label>
        <div class="field-row">
          <label class="field">
            Water
            <select value={p.conditions.moisture ?? ''} onChange={(e) => setCond({ moisture: ((e.currentTarget as HTMLSelectElement).value || undefined) as Plant['conditions']['moisture'] })}>
              <option value="">Not set</option>
              <option value="dry">Copes with dry soil</option>
              <option value="moderate">Moderate</option>
              <option value="moist">Keep moist</option>
            </select>
          </label>
          <label class="field">
            Hardiness
            <input value={p.conditions.hardiness ?? ''} placeholder="e.g. Hardy" onInput={(e) => setCond({ hardiness: (e.currentTarget as HTMLInputElement).value || undefined })} />
          </label>
        </div>
      </details>

      <details class="form-more">
        <summary>When to sow, plant out and harvest</summary>
        {sowing.map((s, i) => (
          <div key={i} class="sowing-row">
            <div class="field-row">
              <label class="field">
                How
                <select
                  value={s.method}
                  onChange={(e) => setSowing(sowing.map((x, k) => (k === i ? { ...x, method: (e.currentTarget as HTMLSelectElement).value as Sowing['method'] } : x)))}
                >
                  {SOWING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label class="field">
                Depth (mm)
                <input
                  type="number"
                  min={0}
                  value={s.depthMm ?? ''}
                  onInput={(e) => {
                    const depthMm = num((e.currentTarget as HTMLInputElement).value);
                    setSowing(sowing.map((x, k) => (k === i ? { ...x, depthMm } : x)));
                  }}
                />
              </label>
            </div>
            <MonthPicker label="Months" months={s.months} onChange={(months) => setSowing(sowing.map((x, k) => (k === i ? { ...x, months } : x)))} />
            <button type="button" class="btn-quiet btn" onClick={() => setSowing(sowing.filter((_, k) => k !== i))}>
              Remove this sowing
            </button>
          </div>
        ))}
        <button type="button" class="btn" onClick={() => setSowing([...sowing, { method: 'direct', months: [] }])}>
          Add a sowing time
        </button>
        <MonthPicker label="Plant out" months={p.plantOutMonths ?? []} onChange={(m) => set({ plantOutMonths: m })} />
        <MonthPicker label="In flower" months={p.flowerMonths ?? []} onChange={(m) => set({ flowerMonths: m })} />
        <MonthPicker
          label="Harvest"
          months={p.cropping?.harvestMonths ?? []}
          onChange={(harvestMonths) => set({ cropping: { ...(p.cropping ?? {}), harvestMonths } })}
        />
      </details>

      <details class="form-more">
        <summary>Things to look out for, and winter</summary>
        <label class="field">
          Look out for (one per line)
          <textarea rows={3} value={(p.lookOutFor ?? []).join('\n')} onInput={(e) => set({ lookOutFor: (e.currentTarget as HTMLTextAreaElement).value.split('\n') })} />
        </label>
        <label class="field">
          Winter
          <select
            value={p.wintering?.type ?? ''}
            onChange={(e) => {
              const type = (e.currentTarget as HTMLSelectElement).value as NonNullable<Plant['wintering']>['type'] | '';
              set({ wintering: type ? { ...(p.wintering ?? {}), type } : undefined });
            }}
          >
            <option value="">Not set</option>
            {WINTERING_TYPES.map((w) => (
              <option key={w} value={w}>
                {WINTER_LABEL[w]}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Where your notes come from
          <input value={p.source ?? ''} placeholder="e.g. Seed packet, RHS website" onInput={(e) => set({ source: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </label>
      </details>

      {errors.length > 0 && (
        <div class="message" role="alert">
          {errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          {isNew ? 'Add plant' : 'Save changes'}
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
