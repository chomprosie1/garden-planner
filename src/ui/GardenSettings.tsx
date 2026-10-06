import { useRef, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';
import { downloadFile, parseFileText } from '../storage/file';
import { Icon } from './icons';

interface Props {
  store: Store;
  garden: Garden;
}

type Message = { kind: 'ok' | 'error'; lines: string[] } | null;

/** Name, location and north, plus export and import. */
export function GardenSettings({ store, garden }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);

  const setNumber = (key: 'latitude' | 'longitude' | 'northRotationDeg', min: number, max: number) => (e: Event) => {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < min || value > max) return;
    store.apply(updateGarden((g) => (g[key] === value ? g : { ...g, [key]: value })));
  };

  const importFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = parseFileText(await file.text());
    if (!result.ok) {
      setMessage({ kind: 'error', lines: ['That file could not be imported:', ...result.errors.slice(0, 8)] });
      return;
    }
    if (!confirm(`Replace "${garden.name}" with "${result.state.garden.name}" from the file? Export first if you want to keep the current one.`))
      return;
    store.replace(result.state);
    setMessage({ kind: 'ok', lines: [`Imported "${result.state.garden.name}".`] });
  };

  return (
    <>
      <section class="card" aria-labelledby="your-garden">
        <h2 id="your-garden">Your garden</h2>
        <GardenNameField store={store} garden={garden} />
        <div class="field-row">
          <label class="field">
            Latitude
            <input type="number" step="0.0001" min={-90} max={90} value={garden.latitude} onChange={setNumber('latitude', -90, 90)} />
          </label>
          <label class="field">
            Longitude
            <input type="number" step="0.0001" min={-180} max={180} value={garden.longitude} onChange={setNumber('longitude', -180, 180)} />
          </label>
        </div>
        <UseLocationButton store={store} onMessage={setMessage} />
        <label class="field">
          North: degrees clockwise from the top of the plan
          <input type="number" step="1" min={-360} max={360} value={garden.northRotationDeg} onChange={setNumber('northRotationDeg', -360, 360)} />
        </label>
        <p class="muted small">Find true north from a map, not a compass: a compass points to magnetic north.</p>
      </section>

      <section class="card" aria-labelledby="backup">
        <h2 id="backup">Backup</h2>
        <p class="muted small">Your garden saves in this browser automatically. Export a copy to keep it safe or move it to another device.</p>
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={() => downloadFile(store.get())}>
            Export garden
          </button>
          <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
            Import…
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
        {message && (
          <div class={`message ${message.kind}`} role="status">
            {message.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function GardenNameField({ store, garden }: Props) {
  return (
    <label class="field">
      Garden name
      <input
        value={garden.name}
        maxLength={60}
        onChange={(e) => {
          const name = (e.currentTarget as HTMLInputElement).value.trim();
          if (name) store.apply(updateGarden((g) => (g.name === name ? g : { ...g, name })));
        }}
      />
    </label>
  );
}

export function UseLocationButton({ store, onMessage }: { store: Store; onMessage: (m: Message) => void }) {
  const locate = () => {
    if (!('geolocation' in navigator)) {
      onMessage({ kind: 'error', lines: ['This browser cannot share its location. Type it in instead.'] });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const round = (n: number) => Math.round(n * 10000) / 10000;
        store.apply(updateGarden((g) => ({ ...g, latitude: round(coords.latitude), longitude: round(coords.longitude) })));
        onMessage({ kind: 'ok', lines: ['Location set from this device.'] });
      },
      () => onMessage({ kind: 'error', lines: ['Location was not shared. Type it in instead.'] }),
    );
  };
  return (
    <button type="button" class="btn" onClick={locate}>
      <Icon name="locate" size={18} /> Use this device's location
    </button>
  );
}
