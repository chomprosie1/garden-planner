import { useRef, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';
import { downloadFile, parseFileText } from '../storage/file';

interface Props {
  store: Store;
  garden: Garden;
}

/** Garden settings: location, north, and export / import. */
export function GardenPanel({ store, garden }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);

  const setNumber = (key: 'latitude' | 'longitude' | 'northRotationDeg', min: number, max: number) => (e: Event) => {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < min || value > max) return;
    store.apply(updateGarden((g) => (g[key] === value ? g : { ...g, [key]: value })));
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setMessage({ kind: 'error', lines: ['This browser cannot share its location. Type it in instead.'] });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const round = (n: number) => Math.round(n * 10000) / 10000;
        store.apply(updateGarden((g) => ({ ...g, latitude: round(coords.latitude), longitude: round(coords.longitude) })));
        setMessage({ kind: 'ok', lines: ['Location set from this device.'] });
      },
      () => setMessage({ kind: 'error', lines: ['Location was not shared. Type it in instead.'] }),
    );
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
    <div class="panel-body">
      <section>
        <h2>Location</h2>
        <p class="hint">Used for sun and shade. A few decimal places is plenty.</p>
        <div class="field-row">
          <label>
            Latitude
            <input type="number" step="0.0001" min={-90} max={90} value={garden.latitude} onChange={setNumber('latitude', -90, 90)} />
          </label>
          <label>
            Longitude
            <input type="number" step="0.0001" min={-180} max={180} value={garden.longitude} onChange={setNumber('longitude', -180, 180)} />
          </label>
        </div>
        <button type="button" class="secondary" onClick={useMyLocation}>
          Use this device's location
        </button>
      </section>

      <section>
        <h2>North</h2>
        <label>
          Rotation of true north from the top of the plan (degrees, clockwise)
          <input type="number" step="1" min={-360} max={360} value={garden.northRotationDeg} onChange={setNumber('northRotationDeg', -360, 360)} />
        </label>
        <p class="hint">Find true north from a map, not a compass: a compass points to magnetic north.</p>
      </section>

      <section>
        <h2>Backup</h2>
        <p class="hint">Your garden saves in this browser automatically. Export a copy to keep it safe or move it to another device.</p>
        <div class="button-row">
          <button type="button" onClick={() => downloadFile(store.get())}>
            Export garden
          </button>
          <button type="button" class="secondary" onClick={() => fileInput.current?.click()}>
            Import…
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
      </section>

      {message && (
        <div class={`message ${message.kind}`} role="status">
          {message.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <p class="assumption">Assumes flat ground. Sowing dates are UK averages; adjust for your area.</p>
    </div>
  );
}
