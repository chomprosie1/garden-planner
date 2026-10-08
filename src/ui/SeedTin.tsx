// The seed tin, on the Seedlings page: your packets of seed, how many are left,
// whether they're still good, and a photo of the packet. Add one, change it,
// or sow from it.

import { useMemo, useState } from 'preact/hooks';
import { emptyFilter, filterPlants } from '../library/library';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant, SeedPacket } from '../model/types';
import { addPacket, makePacket, packetDetail, removePacket, seedsOf, seedState, updatePacket } from '../planting/seeds';
import { useApp } from './appContext';
import { Photo, PhotoInput } from './Photo';
import { PlantIcon } from './PlantIcon';

const STATE_TEXT = { good: '', soon: 'Sow it soon', old: 'Past its date: try a few on damp kitchen paper first' } as const;

interface FormValue {
  plantId: string;
  name: string;
  count: string;
  sowBy: string;
  price: string;
  photo: string | null;
}

const toForm = (p?: SeedPacket): FormValue => ({
  plantId: p?.plantId ?? '',
  name: p?.name ?? '',
  count: p?.count === undefined ? '' : String(p.count),
  sowBy: p?.sowBy ?? '',
  price: p?.price === undefined ? '' : String(p.price),
  photo: p?.photo ?? null,
});

/** The form's fields as a packet's, leaving out what's blank or doesn't read as a number. */
function fromForm(f: FormValue): Partial<SeedPacket> {
  const count = Number.parseInt(f.count, 10);
  const price = Number.parseFloat(f.price.replace('£', ''));
  return {
    name: f.name.trim() || undefined,
    count: Number.isFinite(count) && count >= 0 ? count : undefined,
    sowBy: /^\d{4}-\d{2}$/.test(f.sowBy) ? f.sowBy : undefined,
    price: Number.isFinite(price) && price >= 0 && price < 1000 ? Math.round(price * 100) / 100 : undefined,
    photo: f.photo ?? undefined,
  };
}

function PacketForm({ plants, initial, onSave, onCancel, title }: { plants: Plant[]; initial: FormValue; onSave: (f: FormValue) => void; onCancel: () => void; title: string }) {
  const [f, setF] = useState(initial);
  const [query, setQuery] = useState('');
  const set = (k: keyof FormValue) => (e: Event) => setF({ ...f, [k]: (e.currentTarget as HTMLInputElement).value });
  const chosen = plants.find((p) => p.id === f.plantId);
  const found = useMemo(() => (query.trim() ? filterPlants(plants, { ...emptyFilter, query }).filter((p) => p.category !== 'weed').slice(0, 8) : []), [plants, query]);
  return (
    <form
      class="card seed-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.plantId) onSave(f);
      }}
    >
      <h2>{title}</h2>
      {chosen ? (
        <p class="seed-chosen">
          <PlantIcon plant={chosen} size={28} />
          <strong>{chosen.commonName}</strong>
          <button type="button" class="link-btn small" onClick={() => setF({ ...f, plantId: '' })}>
            Change
          </button>
        </p>
      ) : (
        <div class="field">
          <label for="seed-plant">What’s in the packet?</label>
          <input id="seed-plant" type="search" value={query} placeholder="Tomato, sweet pea…" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} autocomplete="off" />
          {found.length > 0 && (
            <ul class="plain-list seed-found">
              {found.map((p) => (
                <li key={p.id}>
                  <button type="button" class="seed-found-btn" onClick={() => (setF({ ...f, plantId: p.id }), setQuery(''))}>
                    <PlantIcon plant={p} size={24} />
                    {p.commonName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div class="field">
        <label for="seed-name">Name on the packet</label>
        <input id="seed-name" type="text" value={f.name} maxLength={80} placeholder="Optional, such as ‘Sungold’" onInput={set('name')} />
      </div>
      <div class="seed-row">
        <div class="field">
          <label for="seed-count">Seeds left, roughly</label>
          <input id="seed-count" type="number" inputMode="numeric" min={0} value={f.count} onInput={set('count')} />
        </div>
        <div class="field">
          <label for="seed-price">Packet price, £</label>
          <input id="seed-price" type="number" inputMode="decimal" min={0} step="0.01" value={f.price} onInput={set('price')} />
        </div>
      </div>
      <div class="field">
        <label for="seed-sowby">Sow by</label>
        <input id="seed-sowby" type="month" value={f.sowBy} onInput={set('sowBy')} />
      </div>
      <PhotoInput value={f.photo} onChange={(photo) => setF({ ...f, photo })} />
      <div class="button-row">
        <button type="submit" class="btn btn-primary" disabled={!f.plantId}>
          Put it in the tin
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The seed tin: every packet, with a way to add, change, sow from or throw out each. */
export function SeedTin({ store, garden, plants, plantOf }: { store: Store; garden: Garden; plants: Plant[]; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const today = todayIso();
  const [editing, setEditing] = useState<string | null>(null);
  const commit = (fn: (g: Garden) => Garden) => store.apply(updateGarden(fn));
  const packets = [...seedsOf(garden)].sort((a, b) => plantOf(a.plantId).commonName.localeCompare(plantOf(b.plantId).commonName) || (a.name ?? '').localeCompare(b.name ?? ''));
  const current = packets.find((p) => p.id === editing);

  return (
    <>
      {editing !== null && (
        <PacketForm
          key={editing}
          title={current ? 'Change the packet' : 'Add a packet'}
          plants={plants}
          initial={toForm(current)}
          onCancel={() => setEditing(null)}
          onSave={(f) => {
            if (current) commit((g) => updatePacket(g, current.id, { plantId: f.plantId, ...fromForm(f) }));
            else commit((g) => addPacket(g, { ...makePacket(f.plantId, today), ...stripped(fromForm(f)) }));
            setEditing(null);
            app.notify(current ? 'Packet changed.' : 'In the seed tin.', { undo: true });
          }}
        />
      )}
      <section class="card seed-tin" aria-labelledby="seed-tin-title">
        <div class="section-head">
          <h2 id="seed-tin-title">The seed tin</h2>
          {editing === null && (
            <button type="button" class="btn" onClick={() => setEditing('')}>
              Add a packet
            </button>
          )}
        </div>
        {packets.length === 0 ? (
          <p class="muted">Your packets of seed, kept here: how many are left, when to sow them by, and a photo of the packet. Plants you have seed for are marked in Plants and on the plan.</p>
        ) : (
          <ul class="plain-list seed-list">
            {packets.map((k) => {
              const plant = plantOf(k.plantId);
              const state = seedState(k, today);
              const underCover = !!plant.sowing?.some((s) => s.method !== 'direct');
              return (
                <li key={k.id} class="seed-item">
                  {k.photo ? <Photo id={k.photo} alt={`The packet of ${plant.commonName.toLowerCase()}`} class="seed-photo" /> : <PlantIcon plant={plant} size={40} />}
                  <span class="seed-text">
                    <span>
                      <strong>{k.name || plant.commonName}</strong>
                      {k.name && <span class="muted small"> · {plant.commonName}</span>}
                    </span>
                    {packetDetail(k) && <span class="small muted">{packetDetail(k)}</span>}
                    {STATE_TEXT[state] && <span class={`small seed-state seed-${state}`}>{STATE_TEXT[state]}</span>}
                    <span class="seed-actions">
                      {underCover && k.count !== 0 && (
                        <button type="button" class="link-btn small" onClick={() => app.sowInShed(k.plantId)}>
                          Sow some
                        </button>
                      )}
                      <button type="button" class="link-btn small" onClick={() => setEditing(k.id)}>
                        Change
                      </button>
                      <button
                        type="button"
                        class="link-btn small"
                        onClick={() => {
                          commit((g) => removePacket(g, k.id));
                          app.notify(`${k.name || plant.commonName} out of the tin.`, { undo: true });
                        }}
                      >
                        Throw out
                      </button>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** Leaves out fields with no value, so a new packet saves only what was filled in. */
function stripped<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
