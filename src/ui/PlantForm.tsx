import { useState } from 'preact/hooks';
import { LIGHT_LEVELS, PLANT_CATEGORIES, SOWING_METHODS, WINTERING_TYPES, type Plant, type Sowing } from '../model/types';
import { validatePlant } from '../model/validate';
import { ArtFields } from './ArtFields';
import { CATEGORY_LABEL, LIGHT_LABEL, METHOD_LABEL, WINTER_LABEL } from './PlantCard';
import { HelpLink } from './HelpLink';
import { copyAsUserPlant, getsNoJobs } from '../library/library';

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

/** Finds a plant by the name typed or picked from a list, ignoring case and spaces at the ends. */
const byName = (list: Plant[], name: string) => {
  const n = name.trim().toLowerCase();
  return n ? list.find((x) => x.commonName.toLowerCase() === n) : undefined;
};

/** A list of other plants, by name: "Grows well with", "Keep apart from". Typed or picked from the list, then added. */
function NeighbourList({ label, ids, others, listId, onChange }: { label: string; ids: string[]; others: Plant[]; listId: string; onChange: (ids: string[]) => void }) {
  const [typed, setTyped] = useState('');
  const [miss, setMiss] = useState(false);
  const nameOf = (id: string) => others.find((x) => x.id === id)?.commonName ?? id;
  const add = () => {
    const found = byName(others, typed);
    setMiss(!found);
    if (!found) return;
    if (!ids.includes(found.id)) onChange([...ids, found.id]);
    setTyped('');
  };
  return (
    <fieldset class="neighbour-list">
      <legend>{label}</legend>
      {ids.length > 0 && (
        <ul class="chip-list">
          {ids.map((id) => (
            <li key={id}>
              {nameOf(id)}{' '}
              <button type="button" class="link-btn" aria-label={`Take ${nameOf(id)} off`} onClick={() => onChange(ids.filter((x) => x !== id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="neighbour-add">
        <input
          list={listId}
          value={typed}
          aria-label={`${label}: a plant’s name`}
          placeholder="A plant’s name"
          onInput={(e) => {
            setTyped((e.currentTarget as HTMLInputElement).value);
            setMiss(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" class="btn" onClick={add}>
          Add
        </button>
      </div>
      {miss && <p class="small">There’s no plant called that. Pick one from the list as you type.</p>}
    </fieldset>
  );
}

interface Props {
  initial: Plant;
  onSave: (p: Plant) => void;
  onCancel: () => void;
  /** The app's own plants: one can be started from, and neighbours are picked from them. */
  others?: Plant[];
}

/** Add or edit one of your own plants. Only name, kind, light and spacing are needed. */
export function PlantForm({ initial, onSave, onCancel, others = [] }: Props) {
  const [p, setP] = useState<Plant>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [from, setFrom] = useState<{ typed: string; got?: Plant; miss?: boolean; kept?: boolean }>({ typed: '' });
  /** What the form held when it was opened or last started from a plant: picking one replaces it only if nothing but the name has changed since. */
  const [base, setBase] = useState<Plant>(initial);
  const isNew = initial.commonName === '';
  const library = others.filter((x) => !x.userAdded);
  /** Neighbours can be any plant, your own too, but not this one. */
  const neighbours = others.filter((x) => x.id !== p.id);
  const set = (patch: Partial<Plant>) => setP((x) => ({ ...x, ...patch }));
  const setCond = (patch: Partial<Plant['conditions']>) => setP((x) => ({ ...x, conditions: { ...x.conditions, ...patch } }));
  const setSize = (patch: Partial<Plant['size']>) => setP((x) => ({ ...x, size: { ...x.size, ...patch } }));
  const sowing = p.sowing ?? [];
  const setSowing = (list: Sowing[]) => set({ sowing: list.length ? list : undefined });
  const pests = p.pests ?? [];
  const setPests = (list: NonNullable<Plant['pests']>) => set({ pests: list.length ? list : undefined });
  const companions = p.companions ?? { good: [], avoid: [] };
  const setCompanions = (patch: Partial<NonNullable<Plant['companions']>>) => {
    const next = { ...companions, ...patch };
    set({ companions: next.good.length || next.avoid.length ? next : undefined });
  };

  /** Starts the form from a plant like it: everything copied, the name you've typed kept, and its care jobs followed. */
  const startFrom = (typed: string) => {
    const got = byName(library, typed);
    const asWas = (x: Plant) => JSON.stringify({ ...x, commonName: '' });
    // Anything filled in besides the name is kept, not copied over without a word.
    const kept = !!got && asWas(p) !== asWas(base);
    setFrom({ typed, got, miss: !!typed.trim() && !got, kept });
    if (!got || kept) return;
    const copy = { ...copyAsUserPlant(got, p.commonName.trim() || undefined), id: p.id };
    setP(copy);
    setBase(copy);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    // Drop empty optional parts so the saved plant stays tidy.
    const clean: Plant = {
      ...p,
      commonName: p.commonName.trim(),
      sowing: sowing.filter((s) => s.months.length > 0),
      lookOutFor: p.lookOutFor?.map((t) => t.trim()).filter(Boolean),
      pests: pests.map((x) => ({ name: x.name.trim(), signs: x.signs.trim(), control: x.control.trim() })).filter((x) => x.name || x.signs || x.control),
    };
    if (!clean.sowing?.length) delete clean.sowing;
    if (!clean.lookOutFor?.length) delete clean.lookOutFor;
    if (!clean.pests?.length) delete clean.pests;
    if (!clean.plantOutMonths?.length) delete clean.plantOutMonths;
    if (!clean.flowerMonths?.length) delete clean.flowerMonths;
    if (clean.cropping && clean.cropping.harvestMonths.length === 0 && !clean.cropping.notes) delete clean.cropping;
    if (clean.wintering) {
      const notes = clean.wintering.notes?.trim();
      clean.wintering = notes ? { ...clean.wintering, notes } : { type: clean.wintering.type };
    }
    const problems = validatePlant(clean).map((m) => m.replace(/^[^:]+: /, ''));
    if (!clean.commonName) problems.unshift('Give it a name.');
    if (clean.pests?.some((x) => !x.name)) problems.push('Give each pest or problem a name.');
    setErrors(problems);
    if (problems.length === 0) onSave(clean);
  };

  return (
    <form class="plant-form" onSubmit={submit}>
      <h1 class="plant-name">{isNew ? 'Add your own plant' : `Edit ${initial.commonName}`}</h1>
      <p class="muted small">
        Only a name, kind, light and spacing are needed. Add the rest whenever you like. <HelpLink topic="your-own-plant">More about your own plants</HelpLink>
      </p>

      {isNew && library.length > 0 && (
        <div class="field">
          <label for="start-from">Start from a plant like it (you don’t have to)</label>
          <input
            id="start-from"
            list="plant-names"
            value={from.typed}
            placeholder="e.g. Runner bean"
            onInput={(e) => setFrom({ typed: (e.currentTarget as HTMLInputElement).value })}
            onChange={(e) => startFrom((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => {
              // Enter picks the plant rather than sending the half-filled form.
              if (e.key === 'Enter') {
                e.preventDefault();
                startFrom((e.currentTarget as HTMLInputElement).value);
              }
            }}
          />
          <p class="small" role="status">
            {from.got && from.kept
              ? `You’ve filled things in already, so nothing was copied from ${from.got.commonName}. To start from it, cancel and add the plant again.`
              : from.got
              ? `Filled in from ${from.got.commonName}, and it gets the same care jobs. Change anything that’s different about yours.`
              : from.miss
                ? 'There’s no plant called that. Pick one from the list as you type.'
                : ''}
          </p>
        </div>
      )}
      {library.length > 0 && (
        <datalist id="plant-names">
          {library.map((x) => (
            <option key={x.id} value={x.commonName} />
          ))}
        </datalist>
      )}
      {neighbours.length > 0 && (
        <datalist id="neighbour-names">
          {neighbours.map((x) => (
            <option key={x.id} value={x.commonName} />
          ))}
        </datalist>
      )}

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
      {getsNoJobs(p) && (
        <p class="muted small">
          With no months to sow, plant out or harvest, it won’t get any jobs on Today. Add them under “When to sow, plant out and harvest”, or start from a plant like it.
        </p>
      )}

      <details class="form-more">
        <summary>Pests, neighbours and winter</summary>
        <label class="field">
          Look out for (one per line)
          <textarea rows={3} value={(p.lookOutFor ?? []).join('\n')} onInput={(e) => set({ lookOutFor: (e.currentTarget as HTMLTextAreaElement).value.split('\n') })} />
        </label>
        <fieldset class="pest-list">
          <legend>Pests and problems</legend>
          {pests.map((x, i) => {
            const edit = (patch: Partial<typeof x>) => setPests(pests.map((y, k) => (k === i ? { ...y, ...patch } : y)));
            return (
              <div key={i} class="sowing-row">
                <label class="field">
                  Name
                  <input value={x.name} maxLength={60} placeholder="e.g. Slugs" onInput={(e) => edit({ name: (e.currentTarget as HTMLInputElement).value })} />
                </label>
                <label class="field">
                  Signs
                  <input value={x.signs} placeholder="e.g. Holes in leaves, slime trails" onInput={(e) => edit({ signs: (e.currentTarget as HTMLInputElement).value })} />
                </label>
                <label class="field">
                  What to do
                  <input value={x.control} placeholder="e.g. Pick them off at dusk" onInput={(e) => edit({ control: (e.currentTarget as HTMLInputElement).value })} />
                </label>
                <button type="button" class="btn-quiet btn" onClick={() => setPests(pests.filter((_, k) => k !== i))}>
                  Remove this one
                </button>
              </div>
            );
          })}
          <button type="button" class="btn" onClick={() => setPests([...pests, { name: '', signs: '', control: '' }])}>
            Add a pest or problem
          </button>
        </fieldset>
        {neighbours.length > 0 && (
          <>
            <NeighbourList label="Grows well with" ids={companions.good} others={neighbours} listId="neighbour-names" onChange={(good) => setCompanions({ good })} />
            <NeighbourList label="Keep apart from" ids={companions.avoid} others={neighbours} listId="neighbour-names" onChange={(avoid) => setCompanions({ avoid })} />
          </>
        )}
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
        {p.wintering && (
          <label class="field">
            What to do in winter
            <textarea
              rows={2}
              value={p.wintering.notes ?? ''}
              placeholder="e.g. Mulch the crown in November"
              onInput={(e) => set({ wintering: { ...p.wintering!, notes: (e.currentTarget as HTMLTextAreaElement).value } })}
            />
          </label>
        )}
        <label class="field">
          Where your notes come from
          <input value={p.source ?? ''} placeholder="e.g. Seed packet, RHS website" onInput={(e) => set({ source: (e.currentTarget as HTMLInputElement).value || undefined })} />
        </label>
      </details>

      <details class="form-more">
        <summary>How it’s drawn on the plan</summary>
        <ArtFields plant={p} set={set} />
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
