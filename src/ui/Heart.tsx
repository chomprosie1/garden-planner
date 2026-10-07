// The heart on a plant: tap it to put the plant on your Want to grow list,
// which brings its sowing jobs to Today when it's time.

import { onWishlist, toggleWishlist } from '../calendar/jobs';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { Icon } from './icons';

export function Heart({ store, garden, plant, label = false }: { store: Store; garden: Garden; plant: Plant; label?: boolean }) {
  const on = onWishlist(garden, plant.id);
  return (
    <button
      type="button"
      class={`heart${label ? ' btn' : ' icon-btn'}${on ? ' heart-on' : ''}`}
      aria-pressed={on}
      aria-label={label ? undefined : on ? `${plant.commonName}: on your Want to grow list` : `Want to grow ${plant.commonName}`}
      title={on ? 'On your Want to grow list' : 'Want to grow'}
      onClick={(e) => {
        e.stopPropagation();
        store.apply(updateGarden((g) => toggleWishlist(g, plant.id)));
      }}
    >
      <Icon name="heart" size={label ? 18 : 20} filled={on} />
      {label && (on ? 'Want to grow' : 'Want to grow it?')}
    </button>
  );
}
