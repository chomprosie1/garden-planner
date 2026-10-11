// "Already in the ground", and when it went in: a tick, then the month, so its
// jobs, care and next year's draft go from then rather than from today.

import { todayIso } from '../model/ids';
import { inGroundOptions } from '../planting/place';

/** value: null while it's only planned; the day it went in (ISO) once ticked. */
export function InGround({ value, set, label = 'Already in the ground', small = false }: { value: string | null; set: (v: string | null) => void; label?: string; small?: boolean }) {
  const today = todayIso();
  const options = inGroundOptions(today);
  return (
    <div class="in-ground">
      <label class={`check${small ? ' small' : ''}`}>
        <input type="checkbox" checked={value !== null} onChange={(e) => set((e.currentTarget as HTMLInputElement).checked ? today : null)} />
        {label}
      </label>
      {value !== null && (
        <label class={`field-inline${small ? ' small' : ''}`}>
          It went in
          <select value={value} onChange={(e) => set((e.currentTarget as HTMLSelectElement).value)}>
            {options.map((o) => (
              <option key={o.date} value={o.date}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
