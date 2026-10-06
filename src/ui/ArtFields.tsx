// Choosing how your own plant is drawn: its shape from above, its leaves,
// and the colours of its leaves, flowers and crop, with a live preview.

import { artFor } from '../art/plants';
import { BLOOMS, CROP_KINDS, LEAF_SHAPES, PLANT_FORMS, type Plant, type PlantArt } from '../model/types';
import { PlantIcon } from './PlantIcon';

const FORM_LABEL: Record<PlantArt['form'], string> = {
  rosette: 'Rosette (lettuce, cabbage)',
  clump: 'Clump of blades (onion, chives)',
  mound: 'Low mound (thyme, marigold)',
  upright: 'Upright (tomato, pepper)',
  climber: 'Climber on a cane (bean, pea)',
  sprawl: 'Sprawling (courgette, squash)',
  grass: 'Grassy or ferny (dill, asparagus)',
  bulb: 'Bulb (tulip, daffodil)',
  shrub: 'Bush (currant, rosemary)',
  tree: 'Tree',
};
const LEAF_LABEL: Record<PlantArt['leaf'], string> = { broad: 'Broad', lobed: 'Lobed', feathery: 'Feathery', strap: 'Long and thin', needle: 'Needles', round: 'Round' };
const BLOOM_LABEL: Record<NonNullable<PlantArt['bloom']>, string> = { daisy: 'Small flowers', big: 'One big bloom', cup: 'Cups', spike: 'Spikes', umbel: 'Round heads' };
const CROP_LABEL: Record<NonNullable<PlantArt['crop']>['kind'], string> = { fruit: 'Fruit', head: 'A head', pod: 'Pods', root: 'A root', stem: 'Stems' };

export function ArtFields({ plant, set }: { plant: Plant; set: (patch: Partial<Plant>) => void }) {
  const art = artFor(plant);
  const update = (patch: Partial<PlantArt>) => set({ art: { ...art, ...patch } });
  return (
    <div class="art-fields">
      <div class="art-preview">
        <PlantIcon plant={{ ...plant, art }} size={96} />
        <span class="muted small">As it looks on the plan when it’s at its best.</span>
      </div>
      <label class="field">
        Shape from above
        <select value={art.form} onChange={(e) => update({ form: (e.currentTarget as HTMLSelectElement).value as PlantArt['form'] })}>
          {PLANT_FORMS.map((f) => (
            <option key={f} value={f}>
              {FORM_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <div class="field-row">
        <label class="field">
          Leaves
          <select value={art.leaf} onChange={(e) => update({ leaf: (e.currentTarget as HTMLSelectElement).value as PlantArt['leaf'] })}>
            {LEAF_SHAPES.map((l) => (
              <option key={l} value={l}>
                {LEAF_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label class="field field-colour">
          Leaf colour
          <input type="color" value={art.foliage} onInput={(e) => update({ foliage: (e.currentTarget as HTMLInputElement).value })} />
        </label>
      </div>
      <div class="field-row">
        <label class="field">
          Flowers
          <select
            value={art.flower ? (art.bloom ?? 'daisy') : ''}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value as PlantArt['bloom'] | '';
              if (!v) {
                const { flower: _f, bloom: _b, ...rest } = art;
                set({ art: rest });
              } else update({ bloom: v, flower: art.flower ?? '#e070a0' });
            }}
          >
            <option value="">None shown</option>
            {BLOOMS.map((b) => (
              <option key={b} value={b}>
                {BLOOM_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
        {art.flower && (
          <label class="field field-colour">
            Flower colour
            <input type="color" value={art.flower} onInput={(e) => update({ flower: (e.currentTarget as HTMLInputElement).value })} />
          </label>
        )}
      </div>
      <div class="field-row">
        <label class="field">
          Crop
          <select
            value={art.crop?.kind ?? ''}
            onChange={(e) => {
              const kind = (e.currentTarget as HTMLSelectElement).value as NonNullable<PlantArt['crop']>['kind'] | '';
              if (!kind) {
                const { crop: _c, ...rest } = art;
                set({ art: rest });
              } else update({ crop: { kind, colour: art.crop?.colour ?? '#c8302a' } });
            }}
          >
            <option value="">None shown</option>
            {CROP_KINDS.map((k) => (
              <option key={k} value={k}>
                {CROP_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {art.crop && (
          <label class="field field-colour">
            Crop colour
            <input type="color" value={art.crop.colour} onInput={(e) => update({ crop: { ...art.crop!, colour: (e.currentTarget as HTMLInputElement).value } })} />
          </label>
        )}
      </div>
    </div>
  );
}
