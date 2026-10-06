import { PHOTOS } from '../../content/photos';
import { SEASONS } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import { FONT_CREDITS } from '../../theme/fonts';
import type { Prefs, PrefsStore, View } from '../../theme/prefs';
import { GardenSettings } from '../GardenSettings';
import { Icon } from '../icons';
import { Choice, LookPicker } from '../LookPicker';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  back: () => void;
  go: (v: View) => void;
}

export function Settings({ store, garden, prefs, prefsStore, back }: Props) {
  return (
    <div class="page settings">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">Settings</h1>
      </header>

      <section class="card" aria-labelledby="appearance">
        <h2 id="appearance">Appearance</h2>
        <p class="muted small">These settings belong to this device, so each person sharing a garden file can have their own look.</p>
        <LookPicker prefs={prefs} prefsStore={prefsStore} />
        <Choice
          legend="Light or dark"
          name="mode"
          value={prefs.mode}
          options={[
            { value: 'auto', label: 'Match device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(mode) => prefsStore.set({ mode })}
        />
        <Choice
          legend="Seasonal photos"
          name="photos"
          value={prefs.photos}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'subtle', label: 'Subtle' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(photos) => prefsStore.set({ photos })}
        />
        <label class="field">
          Photo month
          <select
            value={prefs.photoMonth === 'auto' ? 'auto' : String(prefs.photoMonth)}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              prefsStore.set({ photoMonth: v === 'auto' ? 'auto' : Number(v) });
            }}
          >
            <option value="auto">Follow the calendar</option>
            {SEASONS.map((s) => (
              <option key={s.month} value={String(s.month)}>
                Always {s.name}
              </option>
            ))}
          </select>
        </label>
        <Choice
          legend="Text size"
          name="text"
          value={prefs.textSize}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={(textSize) => prefsStore.set({ textSize })}
        />
      </section>

      <GardenSettings store={store} garden={garden} />

      <section class="card" aria-labelledby="credits">
        <h2 id="credits">Credits</h2>
        <h3>Photos</h3>
        <ul class="plain-list credits-list">
          {PHOTOS.map((p) => (
            <li key={p.id}>
              {SEASONS[p.month - 1]!.name}:{' '}
              <a href={p.sourceUrl} target="_blank" rel="noopener">
                {p.title}
              </a>{' '}
              by {p.author},{' '}
              <a href={p.licenceUrl} target="_blank" rel="noopener license">
                {p.licence}
              </a>
              . {p.changes}
            </li>
          ))}
        </ul>
        <h3>Fonts</h3>
        <ul class="plain-list credits-list">
          {FONT_CREDITS.map((f) => (
            <li key={f.name}>
              {f.name} by {f.author}, {f.licence}
            </li>
          ))}
        </ul>
        <h3>Software</h3>
        <ul class="plain-list credits-list">
          <li>Preact, MIT licence</li>
        </ul>
      </section>

      <button type="button" class="btn btn-quiet" onClick={() => prefsStore.set({ onboarded: false })}>
        Show the welcome again
      </button>
    </div>
  );
}
