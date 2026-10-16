// "Already in the ground", when it went in, and how far on it is: a tick, then
// the month and the stage, so its jobs, care and next year's draft go from
// there rather than from today, and an apple planted years ago isn't treated
// as planted this week.

import { inGroundDefault, inGroundStages, stageLabel } from '../lifecycle/stages';
import { todayIso } from '../model/ids';
import type { Plant, Stage } from '../model/types';
import { inGroundOptions, type InGroundAt } from '../planting/place';

/** When it's this month, the stage was reached today; earlier, not known. */
function at(plant: Plant | null, date: string, today: string, stage?: Stage): InGroundAt {
  const s = stage ?? (plant ? inGroundDefault(plant, date, today) : 'transplanted');
  return date === today ? { date, stage: s, reached: today } : { date, stage: s };
}

/** value: null while it's only planned; when it went in and its stage once ticked. */
export function InGround({ plant, value, set, label = 'Already in the ground', small = false }: { plant: Plant | null; value: InGroundAt | null; set: (v: InGroundAt | null) => void; label?: string; small?: boolean }) {
  const today = todayIso();
  const options = inGroundOptions(today);
  const stages = plant ? inGroundStages(plant) : [];
  return (
    <div class="in-ground">
      <label class={`check${small ? ' small' : ''}`}>
        <input type="checkbox" checked={value !== null} onChange={(e) => set((e.currentTarget as HTMLInputElement).checked ? at(plant, today, today) : null)} />
        {label}
      </label>
      {value !== null && (
        <>
          <label class={`field-inline${small ? ' small' : ''}`}>
            It went in
            <select value={value.date} onChange={(e) => set(at(plant, (e.currentTarget as HTMLSelectElement).value, today))}>
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
              <select value={stages.includes(value.stage) ? value.stage : stages[0]} onChange={(e) => set(at(plant, value.date, today, (e.currentTarget as HTMLSelectElement).value as Stage))}>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(plant, s)}
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
