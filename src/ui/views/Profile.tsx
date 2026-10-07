import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import type { PrefsStore } from '../../theme/prefs';
import { GardenSettings } from '../GardenSettings';
import { Icon } from '../icons';

interface Props {
  store: Store;
  garden: Garden;
  prefsStore: PrefsStore;
  back: () => void;
}

/** Your garden: facts about the garden itself, opened from its name. Settings keeps what belongs to this device. */
export function Profile({ store, garden, prefsStore, back }: Props) {
  return (
    <div class="page profile-page">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">{garden.name}</h1>
      </header>
      <p class="muted">Your garden: where it is, its seasons, and keeping it safe.</p>
      <GardenSettings store={store} garden={garden} prefsStore={prefsStore} />
    </div>
  );
}
