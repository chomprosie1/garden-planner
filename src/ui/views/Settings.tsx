import { PHOTOS } from '../../content/photos';
import { SEASONS } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import { FONT_CREDITS } from '../../theme/fonts';
import type { Prefs, PrefsStore, View } from '../../theme/prefs';
import { usePlants } from '../usePlants';
import { Icon } from '../icons';
import { Choice, LookPicker } from '../LookPicker';
import { GardenSwitcher, StartAgainCard } from '../Gardens';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  back: () => void;
  go: (v: View) => void;
  showShortcuts: () => void;
}

export function Settings({ store, garden, prefs, prefsStore, back, go, showShortcuts }: Props) {
  const { library } = usePlants(store.get().userPlants);
  const starters = (library ?? []).filter((p) => !p.userAdded);
  const checked = starters.filter((p) => p.verified).length;
  return (
    <div class="page settings">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">Settings</h1>
      </header>

      <GardenSwitcher store={store} prefsStore={prefsStore} garden={garden} />

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
        <details class="advanced more-display">
          <summary>More display options</summary>
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
        <Choice
          legend="Soft shadows on the plan"
          name="depth"
          value={(prefs.depth ?? prefs.look !== 'minimal') ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) => prefsStore.set({ depth: v === 'on' })}
        />
        </details>
      </section>

      <section class="card" aria-labelledby="garden-link">
        <h2 id="garden-link">{garden.name}</h2>
        <p class="muted small">Where your garden is, which way is north, its frosts and climate, this year’s weather, and backups.</p>
        <button type="button" class="btn" onClick={() => go('profile')}>
          Your garden
        </button>
      </section>



      <section class="card" aria-labelledby="news">
        <h2 id="news">What’s new</h2>
        <p class="muted small">The latest changes to the app, in plain English.</p>
        <button type="button" class="btn" onClick={() => go('new')}>
          See what’s new
        </button>
      </section>

      <section class="card desktop-only" aria-labelledby="keys">
        <h2 id="keys">Keyboard</h2>
        <p class="muted small">Press ? at any time to see the shortcuts.</p>
        <button type="button" class="btn" onClick={showShortcuts}>
          Keyboard shortcuts
        </button>
      </section>

      <details class="card advanced credits-card">
        <summary>Credits: photos, fonts and software</summary>
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
          <li>
            <details>
              <summary>SunCalc by Volodymyr Agafonkin, BSD 2-Clause licence</summary>
              <p class="small licence-text">
                Copyright (c) 2026, Volodymyr Agafonkin. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are
                permitted provided that the following conditions are met: 1. Redistributions of source code must retain the above copyright notice, this list of
                conditions and the following disclaimer. 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
                following disclaimer in the documentation and/or other materials provided with the distribution. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS
                AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
                FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
                INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
                DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
                (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
              </p>
            </details>
          </li>
        </ul>
      </details>

      <details class="card advanced">
        <summary>Advanced</summary>
        <label class="check-row">
          <input type="checkbox" checked={prefs.plantEditor} onChange={(e) => prefsStore.set({ plantEditor: (e.currentTarget as HTMLInputElement).checked })} />
          <span>Plant editor: show the tools for checking plant notes against their sources</span>
        </label>
        {prefs.plantEditor && (
          <>
            <p class="muted small">
              The starter plants are drafts until checked against a trusted source. {library ? `${checked} of ${starters.length} checked on this device.` : ''}
            </p>
            <button type="button" class="btn" onClick={() => go('check')}>
              Check the plants
            </button>
          </>
        )}
        <p>
          <button type="button" class="btn btn-quiet" onClick={() => prefsStore.set({ onboarded: false })}>
            Show the welcome again
          </button>
        </p>
      </details>

      <StartAgainCard store={store} prefsStore={prefsStore} garden={garden} />
    </div>
  );
}
