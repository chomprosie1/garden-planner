// Starter kits to choose from, each with a picture of the space planted up.
// "Just the space" leaves the beds empty for you to fill. Kits are sized for a
// first garden; "Make it bigger" fills the beds.

import { useMemo } from 'preact/hooks';
import { newGarden } from '../model/defaults';
import { makeSpace, spaceInfo, type Space } from '../model/spaces';
import type { Plant } from '../model/types';
import { applyKit, type Kit } from '../planting/kits';
import { MiniPlan } from './MiniPlan';
import { spaceOf, type SpaceChoice } from './SpacePicker';

/** A kit planted in the space you chose, at your size, for its picture; at the usual size if you haven't said. */
function preview(kit: Kit, plantOf: (id: string) => Plant, full: boolean, choice?: SpaceChoice): ReturnType<typeof newGarden> {
  const [w, d] = spaceInfo(kit.space).size;
  const space = choice?.space === kit.space ? spaceOf(choice) : makeSpace(newGarden(), kit.space, w, d);
  return applyKit(space, kit, plantOf, '2027-03-01', full);
}

interface Props {
  kits: Kit[];
  value: Kit | null;
  onChange: (k: Kit | null) => void;
  plantOf: (id: string) => Plant;
  /** Fill the beds, rather than the first-garden size. */
  bigger: boolean;
  setBigger: (on: boolean) => void;
  /** The space as you've set it out, so each kit is pictured at your size. */
  choice?: SpaceChoice;
}

export function KitPicker({ kits, value, onChange, plantOf, bigger, setBigger, choice }: Props) {
  const pictures = useMemo(() => new Map(kits.map((k) => [k.id, preview(k, plantOf, bigger, choice)])), [kits, plantOf, bigger, choice?.space, choice?.w, choice?.d, choice?.sideReturn?.width, choice?.sideReturn?.length, choice?.sideReturn?.onRight, choice?.border]);
  const space: Space | undefined = kits[0]?.space;
  return (
    <>
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
      {value && (
        <label class="kit-bigger">
          <input type="checkbox" checked={bigger} onChange={(e) => setBigger((e.currentTarget as HTMLInputElement).checked)} />
          <span>
            Make it bigger
            <span class="muted small"> · Kits are sized for a first garden: tens of bulbs, not hundreds. This fills the beds.</span>
          </span>
        </label>
      )}
    </>
  );
}
