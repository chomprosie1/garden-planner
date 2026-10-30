// "Already in the ground", when it went in, and how far on it is: a tick, then
// the month and the stage, so its jobs, care and next year's draft go from
// there rather than from today, and an apple planted years ago isn't treated
// as planted this week.

import { inGroundStages, isCropping, stageLabel, stageNow } from '../lifecycle/stages';
import { todayIso } from '../model/ids';
import type { Plant, Stage } from '../model/types';
import { inGroundChoice, inGroundOptions, type InGroundAt } from '../planting/place';

/** value: null while it's only planned; when it went in and its stage once ticked. */
export function InGround({ plant, value, set, label = 'Already in the ground', small = false }: { plant: Plant | null; value: InGroundAt | null; set: (v: InGroundAt | null) => void; label?: string; small?: boolean }) {
  const today = todayIso();
  const options = inGroundOptions(today);
  const stages = plant ? inGroundStages(plant) : [];
  return (
    <div class="in-ground">
      <label class={`check${small ? ' small' : ''}`}>
        <input type="checkbox" checked={value !== null} onChange={(e) => set((e.currentTarget as HTMLInputElement).checked ? inGroundChoice(plant, today, today) : null)} />
        {label}
      </label>
      {value !== null && (
        <>
          <label class={`field-inline${small ? ' small' : ''}`}>
            It went in
            {/* A date changes the usual stage, but not flowering or harvesting if that's what you've said it's doing. */}
            <select value={value.date} onChange={(e) => set(inGroundChoice(plant, (e.currentTarget as HTMLSelectElement).value, today, isCropping(value.stage) ? (value.stage as Stage) : undefined))}>
              {options.map((o) => (
                <option key={o.date} value={o.date}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {plant && stages.length > 1 && (
            <label class={`field-inline${small ? ' small' : ''}`}>
              It’s now
              <select value={stages.includes(value.stage) ? value.stage : stages[0]} onChange={(e) => set(inGroundChoice(plant, value.date, today, (e.currentTarget as HTMLSelectElement).value as Stage))}>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s === 'vegetative' ? stageNow(plant, s, undefined, today) : stageLabel(plant, s)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}
