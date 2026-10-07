import { useRef, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';
import { todayIso } from '../model/ids';
import type { PrefsStore } from '../theme/prefs';
import { downloadFile, parseFileText } from '../storage/file';
import { fromDataUrl, loadPhoto, photoIds, putPhoto, toDataUrl } from '../storage/photos';
import { Icon } from './icons';
import { estimateFrost, frostDates, inYear, short } from '../lifecycle/shed';
import { averagesAt, referenceAverages, seasonDays, stationNames, yearDegreeDays, yearSoFar } from '../climate/warmth';
import { ATTRIBUTION } from '../weather/openMeteo';
import { lastDay } from '../weather/weather';
import { usePrefs } from './hooks';
import { useWeatherNow } from './useWeather';
import { disableReminders, enableReminders, type ReminderStatus } from '../storage/reminders';
import { CompassNorth } from './CompassNorth';
import { PlaceSearch } from './PlaceSearch';

interface Props {
  store: Store;
  garden: Garden;
  prefsStore?: PrefsStore;
}

/** Downloads a backup file and remembers when, for the reminder on Home. With photos, it carries every photo on a note too. */
export async function backUp(store: Store, prefsStore?: PrefsStore, withPhotos = false) {
  let photos: Record<string, string> | undefined;
  if (withPhotos) {
    photos = {};
    for (const id of photoIds(store.get().garden)) {
      const blob = await loadPhoto(id).catch(() => undefined);
      if (blob) photos[id] = await toDataUrl(blob);
    }
  }
  downloadFile(store.get(), photos);
  prefsStore?.set({ lastBackup: todayIso() });
}

type Message = { kind: 'ok' | 'error'; lines: string[] } | null;

/** Your garden: its name and place, north, spacing, frosts and climate, and backups. Facts about the garden, not this device. */
export function GardenSettings({ store, garden, prefsStore }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const photoCount = photoIds(garden).size;

  const setNumber = (key: 'latitude' | 'longitude' | 'northRotationDeg', min: number, max: number) => (e: Event) => {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < min || value > max) return;
    store.apply(
      updateGarden((g) => {
        if (g[key] === value) return g;
        // A typed location is no longer the place you searched for.
        if (key === 'northRotationDeg') return { ...g, [key]: value };
        const { placeName: _old, ...rest } = g;
        return { ...rest, [key]: value };
      }),
    );
  };

  const importFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = parseFileText(await file.text());
    if (!result.ok) {
      setMessage({ kind: 'error', lines: ['That file could not be restored:', ...result.errors.slice(0, 8)] });
      return;
    }
    if (!confirm(`Replace "${garden.name}" with "${result.state.garden.name}" from the file? Download a backup first if you want to keep the current one.`))
      return;
    store.replace(result.state);
    // Photos in the backup go back on this device.
    let restored = 0;
    for (const [id, url] of Object.entries(result.photos ?? {})) {
      try {
        await putPhoto(id, await fromDataUrl(url));
        restored++;
      } catch {
        // a damaged photo is left out
      }
    }
    setMessage({ kind: 'ok', lines: [`Restored "${result.state.garden.name}" from the backup${restored ? `, with ${restored} ${restored === 1 ? 'photo' : 'photos'}` : ''}.`] });
  };

  return (
    <>
      <section class="card" aria-labelledby="about-garden">
        <h2 id="about-garden">About it</h2>
        <GardenNameField store={store} garden={garden} />
        <h3>Where it is</h3>
        <p>{placeText(garden)}</p>
        <PlaceSearch store={store} />
        <UseLocationButton store={store} onMessage={setMessage} />
        <p class="muted small">Its place times the sun and shade, the frosts and the seasons.</p>
        <details class="advanced">
          <summary>Exact location</summary>
          <div class="field-row">
            <label class="field">
              Latitude
              <input type="number" step="0.0001" min={-90} max={90} value={garden.latitude} onChange={setNumber('latitude', -90, 90)} />
            </label>
            <label class="field">
              Longitude
              <input type="number" step="0.0001" min={-180} max={180} value={garden.longitude} onChange={setNumber('longitude', -180, 180)} />
            </label>
          </div>
        </details>
        <h3>Which way is north</h3>
        <label class="field">
          Degrees clockwise from the top of your plan to north
          <input type="number" step="1" min={-360} max={360} value={garden.northRotationDeg} onChange={setNumber('northRotationDeg', -360, 360)} />
        </label>
        <CompassNorth store={store} />
        <p class="muted small">0 if the top of your plan faces north. On a phone, the compass can work it out for you.</p>
        <fieldset class="choice">
          <legend>How you space plants</legend>
          <div class="choice-row">
            {(
              [
                ['close', 'Close, in beds'],
                ['rows', 'Traditional rows'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} class="choice-option">
                <input
                  type="radio"
                  name="spacing"
                  checked={(garden.spacing ?? 'close') === value}
                  onChange={() => store.apply(updateGarden((g) => ({ ...g, spacing: value })))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p class="muted small">
            Close: plants an even distance apart each way, as most home gardeners grow in beds. Traditional rows: the wider spacing on seed packets, with paths
            between rows. Spacing checks and the number of plants in a row or block follow your choice.
          </p>
        </fieldset>
      </section>

      <section class="card" aria-labelledby="seasons">
        <h2 id="seasons">Seasons and weather</h2>
        <FrostDates store={store} garden={garden} />
        <Warmth garden={garden} prefsStore={prefsStore} />
        {prefsStore && <Reminders prefsStore={prefsStore} />}
      </section>

      <section class="card" aria-labelledby="backup">
        <h2 id="backup">Backups</h2>
        <p class="muted small">
          Your garden is saved automatically, but only in this browser on this device. Clearing your browsing data would delete it. Download a backup now and then
          to keep it safe, or to move it to another device.{photoCount > 0 ? ' Photos make a backup much bigger, so they’re only in one made with photos.' : ''}
        </p>
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={() => backUp(store, prefsStore)}>
            Download a backup
          </button>
          {photoCount > 0 && (
            <button type="button" class="btn" onClick={() => backUp(store, prefsStore, true)}>
              With photos ({photoCount})
            </button>
          )}
          <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
            Restore from a backup…
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
        {message && (
          <div class={`message ${message.kind}`} role="status">
            {message.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function GardenNameField({ store, garden }: Props) {
  return (
    <label class="field">
      Garden name
      <input
        value={garden.name}
        maxLength={60}
        onChange={(e) => {
          const name = (e.currentTarget as HTMLInputElement).value.trim();
          if (name) store.apply(updateGarden((g) => (g.name === name ? g : { ...g, name })));
        }}
      />
    </label>
  );
}

export function UseLocationButton({ store, onMessage }: { store: Store; onMessage: (m: Message) => void }) {
  const locate = () => {
    if (!('geolocation' in navigator)) {
      onMessage({ kind: 'error', lines: ['This browser cannot share its location. Type it in instead.'] });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const round = (n: number) => Math.round(n * 10000) / 10000;
        store.apply(
          updateGarden((g) => {
            const { placeName: _old, ...rest } = g;
            return { ...rest, latitude: round(coords.latitude), longitude: round(coords.longitude) };
          }),
        );
        onMessage({ kind: 'ok', lines: ['Location set from this device.'] });
      },
      () => onMessage({ kind: 'error', lines: ['Location was not shared. Type it in instead.'] }),
    );
  };
  return (
    <button type="button" class="btn" onClick={locate}>
      <Icon name="locate" size={18} /> Use this device's location
    </button>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A day and month, "MM-DD", as a month list and a day number. */
function MonthDayField({ label, value, onChange }: { label: string; value: string; onChange: (md: string) => void }) {
  const [m, d] = value.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(2027, m, 0)).getUTCDate();
  const set = (month: number, day: number) => onChange(`${String(month).padStart(2, '0')}-${String(Math.min(day, new Date(Date.UTC(2027, month, 0)).getUTCDate())).padStart(2, '0')}`);
  return (
    <fieldset class="month-day">
      <legend>{label}</legend>
      <div class="field-row">
        <label class="field">
          <span class="visually-hidden">Day</span>
          <input type="number" min={1} max={days} value={d} onChange={(e) => set(m, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))} />
        </label>
        <label class="field">
          <span class="visually-hidden">Month</span>
          <select value={m} onChange={(e) => set(Number((e.currentTarget as HTMLSelectElement).value), d)}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

/** Average last and first frosts: estimated from the latitude until you set your own. They time hardening off and winter jobs. */
function FrostDates({ store, garden }: { store: Store; garden: Garden }) {
  const f = frostDates(garden);
  const est = estimateFrost(garden.latitude);
  const set = (patch: Partial<Pick<Garden, 'lastFrost' | 'firstFrost'>>) => store.apply(updateGarden((g) => ({ ...g, lastFrost: g.lastFrost ?? f.lastFrost, firstFrost: g.firstFrost ?? f.firstFrost, ...patch })));
  return (
    <div class="frost-dates">
      <h3>Frosts</h3>
      <div class="field-row">
        <MonthDayField label="Last frost in spring" value={f.lastFrost} onChange={(lastFrost) => set({ lastFrost })} />
        <MonthDayField label="First frost in autumn" value={f.firstFrost} onChange={(firstFrost) => set({ firstFrost })} />
      </div>
      <p class="muted small">
        {f.estimated
          ? 'Estimated from your location. Local weather records or neighbours will know better: frost pockets and coastal gardens can be weeks either side.'
          : 'Your own dates.'}{' '}
        They decide when Seedlings suggests hardening off and planting out tender plants, and when to protect plants for winter.
        {!f.estimated && (
          <>
            {' '}
            <button
              type="button"
              class="link-btn"
              onClick={() =>
                store.apply(
                  updateGarden((g) => {
                    const { lastFrost: _l, firstFrost: _f, ...rest } = g;
                    return rest;
                  }),
                )
              }
            >
              Use the estimate ({short(inYear(est.lastFrost, 2027))} and {short(inYear(est.firstFrost, 2027))})
            </button>
          </>
        )}
      </p>
    </div>
  );
}

const one = (n: number) => `${Math.round(n * 10) / 10} °C`;
const listed = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]!);

/** The usual warmth here, from UK climate averages: what times growth on the plan's year. */
function Warmth({ garden, prefsStore }: { garden: Garden; prefsStore?: PrefsStore }) {
  const av = averagesAt(garden.latitude, garden.longitude);
  const dd = yearDegreeDays(av);
  const ref = yearDegreeDays(referenceAverages());
  const diff = Math.round(((dd - ref) / ref) * 100);
  const compared = Math.abs(diff) < 3 ? 'About as warm as the middle of England' : `About ${Math.abs(diff)}% ${diff > 0 ? 'warmer' : 'cooler'} for growing than the middle of England`;
  return (
    <div class="warmth">
      <h3>Your climate</h3>
      <dl class="facts">
        <dt>July days</dt>
        <dd>{one(av.tmax[6]!)}</dd>
        <dt>January nights</dt>
        <dd>{one(av.tmin[0]!)}</dd>
        <dt>Growing season</dt>
        <dd>{seasonDays(av)} days above 5 °C</dd>
        <dt>Compared</dt>
        <dd>{compared}</dd>
      </dl>
      <p class="muted small">
        Averages for 1991–2020 from the weather stations nearest you: {listed(stationNames(av))}
        {av.nearestKm > 150 ? `, the nearest ${av.nearestKm} km away, so take them as rough` : ''}. They time how fast crops grow on the plan's year:
        sooner where it's warmer, later where it's cooler, and sooner still under glass. A sheltered garden, a city or a hillside can differ by a degree or two,
        and any year can be warmer or colder.
      </p>
      {prefsStore && <WeatherSwitch garden={garden} prefsStore={prefsStore} />}
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** This year's weather from Open-Meteo: off until you turn it on, as it sends the garden's rough location. */
function WeatherSwitch({ garden, prefsStore }: { garden: Garden; prefsStore: PrefsStore }) {
  const prefs = usePrefs(prefsStore);
  const { weather, status, refresh } = useWeatherNow();
  const today = todayIso();
  const soFar = weather ? yearSoFar(weather, averagesAt(garden.latitude, garden.longitude), today) : null;
  const pct = soFar && soFar.usual > 0 ? Math.round(((soFar.actual - soFar.usual) / soFar.usual) * 100) : null;
  return (
    <div class="weather-switch">
      <label class="check-row">
        <input type="checkbox" checked={prefs.weather} onChange={(e) => prefsStore.set({ weather: (e.currentTarget as HTMLInputElement).checked })} />
        <span>Use this year’s weather and the forecast</span>
      </label>
      <p class="muted small">
        Crops are timed by the real weather so far and the next fortnight’s forecast, Home warns you of frost, and Show: water on the plan knows when it’s rained. The
        weather comes from Open-Meteo, free for personal use. Only your garden’s location, rounded to about a kilometre, is sent, and the weather is kept on
        this device.
      </p>
      {prefs.weather && (
        <p class="small" role="status">
          {status === 'loading'
            ? 'Getting the weather…'
            : status === 'error' && !weather
              ? 'Couldn’t get the weather just now, so crops are timed by the usual for your area.'
              : weather
                ? `Updated ${weather.fetchedAt.slice(0, 10) === today ? `at ${time(weather.fetchedAt)} today` : `on ${short(weather.fetchedAt.slice(0, 10))}`}, with the forecast to ${short(lastDay(weather))}.`
                : 'No weather yet.'}{' '}
          {pct !== null && `This year so far: ${Math.abs(pct) < 3 ? 'about as warm as usual' : `about ${Math.abs(pct)}% ${pct > 0 ? 'warmer' : 'cooler'} than usual`} since 1 January.`}{' '}
          {status !== 'loading' && (
            <button type="button" class="link-btn" onClick={refresh}>
              Update now
            </button>
          )}
          <span class="muted"> {ATTRIBUTION}.</span>
        </p>
      )}
    </div>
  );
}

/** "Near Leeds", from the nearest weather station; or a prompt, if it's still the middle of England a new garden starts at. */
export function placeText(g: Garden): string {
  if (g.placeName) return `${g.placeName}.`;
  if (g.latitude === 52.5 && g.longitude === -1.5) return 'Not set yet: for now, the middle of England.';
  const av = averagesAt(g.latitude, g.longitude);
  if (av.nearestKm > 150) return 'Set from your location.';
  return `Near ${av.stations[0]!.name.replace(/ (.*)$/, '')}.`;
}

const REMINDER_TEXT: Record<ReminderStatus, string> = {
  background: 'On: this device will remind you, even with the app closed.',
  'open-only': 'On, but this browser only lets the app check when it’s open, and Today shows frost and this week’s jobs then. For reminders with the app closed, install it on an Android phone.',
  blocked: 'Notifications are blocked for this site. Allow them in the browser’s settings, then try again.',
  unsupported: 'This browser can’t show notifications. Today shows frost and this week’s jobs when you open the app.',
};

type ReminderKey = 'reminders' | 'weeklyNudge';

/** Frost warnings and the week's jobs with the app closed, where the browser allows: it checks now and then in the background. */
function Reminders({ prefsStore }: { prefsStore: PrefsStore }) {
  const prefs = usePrefs(prefsStore);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const toggle = (key: ReminderKey) => async (e: Event) => {
    const on = (e.currentTarget as HTMLInputElement).checked;
    if (!on) {
      prefsStore.set({ [key]: false });
      setStatus(null);
      // Stop checking once neither is wanted.
      if (!prefs[key === 'reminders' ? 'weeklyNudge' : 'reminders']) await disableReminders().catch(() => undefined);
      return;
    }
    const result = await enableReminders().catch((): ReminderStatus => 'unsupported');
    setStatus(result);
    prefsStore.set({ [key]: result === 'background' || result === 'open-only' });
  };
  return (
    <div class="weather-switch">
      <h3>Reminders</h3>
      <label class="check-row">
        <input type="checkbox" checked={prefs.reminders} onChange={toggle('reminders')} />
        <span>Frost warnings</span>
      </label>
      <p class="muted small">
        When a frost could hurt your tender plants or seedlings. To check, the app sends your garden’s location, rounded to about a kilometre, to Open-Meteo now
        and then.
      </p>
      <label class="check-row">
        <input type="checkbox" checked={prefs.weeklyNudge} onChange={toggle('weeklyNudge')} />
        <span>This week’s jobs, on Mondays</span>
      </label>
      <p class="muted small">What there is to sow, harden off or plant out that week. Nothing is sent anywhere for this.</p>
      {status && (
        <p class="small" role="status">
          {REMINDER_TEXT[status]}
        </p>
      )}
    </div>
  );
}
