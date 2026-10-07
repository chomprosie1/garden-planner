// Starter kits to choose from, each with a picture of the space planted up.
// "Just the space" leaves the beds empty for you to fill.

import { useMemo } from 'preact/hooks';
import { newGarden } from '../model/defaults';
import { makeSpace, spaceInfo, type Space } from '../model/spaces';
import type { Plant } from '../model/types';
import { applyKit, type Kit } from '../planting/kits';
import { MiniPlan } from './MiniPlan';

/** A kit planted in its space at the usual size, for its picture. */
function preview(kit: Kit, plantOf: (id: string) => Plant): ReturnType<typeof newGarden> {
  const [w, d] = spaceInfo(kit.space).size;
  return applyKit(makeSpace(newGarden(), kit.space, w, d), kit, plantOf, '2027-03-01');
}

export function KitPicker({ kits, value, onChange, plantOf }: { kits: Kit[]; value: Kit | null; onChange: (k: Kit | null) => void; plantOf: (id: string) => Plant }) {
  const pictures = useMemo(() => new Map(kits.map((k) => [k.id, preview(k, plantOf)])), [kits, plantOf]);
  const space: Space | undefined = kits[0]?.space;
  return (
    <div class="kit-picker" role="radiogroup" aria-label="Starter kits">
      {kits.map((k) => (
        <label key={k.id} class="kit-option">
          <input type="radio" name="kit" checked={value?.id === k.id} onChange={() => onChange(k)} />
          <span class="kit-card">
            <MiniPlan garden={pictures.get(k.id)!} width={96} height={72} pad={0.04} class="kit-preview" plantOf={plantOf} />
            <span class="kit-text">
              <span class="kit-title">{k.title}</span>
              <span class="kit-blurb">{k.blurb}</span>
            </span>
          </span>
        </label>
      ))}
      {space && (
        <label class="kit-option">
          <input type="radio" name="kit" checked={value === null} onChange={() => onChange(null)} />
          <span class="kit-card kit-none">
            <span class="kit-text">
              <span class="kit-title">Just the space</span>
              <span class="kit-blurb">Empty beds and pots, for you to fill.</span>
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
