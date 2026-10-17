// Whether a bed's crops go round in the rotation, and whether it's a fruit cage:
// two switches for a bed's settings, in the list and on the plan alike.

import { rotates } from '../planting/rotation';
import type { Feature, Garden, Plant } from '../model/types';

/** For beds and patches of soil: nothing for anything else. */
export function RotationSwitch({ garden, bed, plantOf, set }: { garden: Garden; bed: Feature; plantOf: (id: string) => Plant; set: (patch: Partial<Feature>) => void }) {
  if (!(bed.kind === 'bed' || (bed.kind === 'surface' && bed.material === 'soil'))) return null;
  const on = rotates(bed, garden, plantOf);
  return (
    <div class="rotation-switch">
      <label class="switch-row">
        <input type="checkbox" checked={on} onChange={(e) => set({ rotates: (e.currentTarget as HTMLInputElement).checked })} />
        <span>Its crops move round the beds each year</span>
      </label>
      <p class="muted small">Next year’s draft moves vegetables round the beds that do, so each crop follows the one before it. Leave it off for a border, herbs or fruit, which stay put.</p>
      {bed.kind === 'bed' && (
        <label class="switch-row">
          <input
            type="checkbox"
            checked={!!bed.fruitCage}
            onChange={(e) => {
              const cage = (e.currentTarget as HTMLInputElement).checked;
              // A cage keeps its fruit: out of the rotation unless you say otherwise.
              set(cage ? { fruitCage: true, rotates: false } : { fruitCage: false });
            }}
          />
          <span>It’s a fruit cage</span>
        </label>
      )}
    </div>
  );
}
