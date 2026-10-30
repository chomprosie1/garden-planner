// The questions about a balcony: which way it faces, how much sun it gets, and
// whether rain and wind reach it. Asked in setup, and kept in Settings.

import type { Balcony, BalconySun, Facing } from '../model/types';
import { FACINGS } from '../model/types';
import { balconyLight, LIGHT_WORDS } from '../planting/balcony';
import { Choice } from './LookPicker';

const SUN: { value: BalconySun | ''; label: string }[] = [
  { value: 'most', label: 'Most of the day: 6 hours or more' },
  { value: 'half', label: 'About 3 to 5 hours' },
  { value: 'little', label: 'Under 3 hours' },
  { value: '', label: 'Not sure' },
];

/** The same with one answer changed, or taken away when it's cleared. */
function withAnswer<K extends keyof Balcony>(b: Balcony, key: K, v: Balcony[K] | undefined): Balcony {
  const { [key]: _old, ...rest } = b;
  return (v === undefined ? rest : { ...rest, [key]: v }) as Balcony;
}

export function BalconyFields({ value, onChange }: { value: Balcony; onChange: (b: Balcony) => void }) {
  const light = balconyLight(value);
  return (
    <div class="balcony-fields">
      <label class="field">
        Which way does it face?
        <select value={value.facing ?? ''} onChange={(e) => onChange(withAnswer(value, 'facing', ((e.currentTarget as HTMLSelectElement).value || undefined) as Facing | undefined))}>
          <option value="">Not sure</option>
          {FACINGS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <Choice legend="How much direct sun does it get in summer?" name="balcony-sun" value={value.sun ?? ''} options={SUN} onChange={(sun) => onChange(withAnswer(value, 'sun', sun || undefined))} />
      <label class="switch-row">
        <input type="checkbox" checked={!!value.roof} onChange={(e) => onChange(withAnswer(value, 'roof', (e.currentTarget as HTMLInputElement).checked || undefined))} />
        <span>A roof or balcony above, so rain doesn’t reach the pots</span>
      </label>
      <label class="switch-row">
        <input type="checkbox" checked={!!value.windy} onChange={(e) => onChange(withAnswer(value, 'windy', (e.currentTarget as HTMLInputElement).checked || undefined))} />
        <span>Windy, as balconies high up often are</span>
      </label>
      {light && <p class="muted small">So your pots are set to {LIGHT_WORDS[light]}, and what’s suggested for them will suit that. You can change any pot on its own.</p>}
    </div>
  );
}
