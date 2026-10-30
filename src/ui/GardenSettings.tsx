import { useEffect, useRef, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import { featureLabel } from '../model/features';
import { nameListBeds, spreadOut } from '../model/listLayout';
import { setBalcony } from '../planting/balcony';
import { isListed } from '../planting/listPlant';
import { potsOnly } from '../planting/pots';
import { BalconyFields } from './BalconyFields';
import type { Garden } from '../model/types';
import { todayIso } from '../model/ids';
import type { PrefsStore } from '../theme/prefs';
import { backupFile, csvFile, downloadFile, parseFileText, saveToDevice, type ParseResult } from '../storage/file';
import { askToKeep, asksOutLoud } from '../storage/persist';
import { plantingsCsv } from '../share/export';
import { spacingStyle } from '../planting/place';
import { useApp } from './appContext';
import { gardenCount, lastCopy, noteCopy } from './gardenActions';
import { safetyText } from './setup';
import { usePlants } from './usePlants';
import { addGarden } from '../storage/gardens';
import { flushSave, saveStatus, type SaveStatus } from '../storage/local';
import { fromDataUrl, loadPhoto, photoIds, putPhoto, toDataUrl } from '../storage/photos';
import { Icon } from './icons';
import { isInstalled, isIosSafari } from './Install';
import { frostDates, frostEstimate, inYear, lastFrostText, short } from '../lifecycle/shed';
import { averagesAt, averagesHere, referenceAverages, seasonDays, stationNames, yearDegreeDays, yearSoFar } from '../climate/warmth';
import { ATTRIBUTION } from '../weather/openMeteo';
import { lastDay } from '../weather/weather';
import { usePrefs } from './hooks';
import { useWeatherNow } from './useWeather';
import { disableReminders, enableReminders, type ReminderStatus } from '../storage/reminders';
import { CompassNorth } from './CompassNorth';
import { PlaceSearch } from './PlaceSearch';
import { GlossText } from './Glossary';
import { GardenPh, GardenSoil } from './SoilFields';
import { HelpTitle } from './HelpLink';

interface Props {
  store: Store;
  garden: Garden;
  prefsStore?: PrefsStore;
}

/** Every photo on a note, as data, for a backup made with photos. */
async function gatherPhotos(store: Store): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  for (const id of photoIds(store.get().garden)) {
    const blob = await loadPhoto(id).catch(() => undefined);
    if (blob) photos[id] = await toDataUrl(blob);
  }
  return photos;
}

/** Downloads a backup file and remembers when, for the reminder on Home. With photos, it carries every photo on a note too. */
export async function backUp(store: Store, prefsStore?: PrefsStore, withPhotos = false) {
  downloadFile(store.get(), withPhotos ? await gatherPhotos(store) : undefined);
  if (prefsStore) noteCopy(prefsStore, todayIso());
}

let shareable: boolean | null = null;

/** Whether a phone or tablet can hand a backup to its share sheet (Save to Files, Drive, email). Worked out once. */
export const canShareBackup = () => {
  if (shareable === null) {
    try {
      shareable = matchMedia('(pointer: coarse)').matches && !!navigator.canShare?.({ files: [new File(['{}'], 'garden.json', { type: 'application/json' })] });
    } catch {
      shareable = false;
    }
  }
  return shareable;
};

/**
 * Hands a backup to the share sheet, to save to Files or send somewhere, and remembers it as a backup once shared.
 * Nothing waits before the share, so the tap still counts. If the share sheet refuses it, it downloads instead.
 */
export async function shareBackup(store: Store, prefsStore?: PrefsStore) {
  const file = backupFile(store.get());
  try {
    await navigator.share({ files: [file], title: store.get().garden.name });
    if (prefsStore) noteCopy(prefsStore, todayIso());
  } catch (e) {
    // Cancelled: nothing was saved, so the reminder stays. Anything else: download it after all.
    if ((e as Error).name === 'AbortError') return;
    downloadFile(store.get());
    if (prefsStore) noteCopy(prefsStore, todayIso());
  }
}

/**
 * Puts a checked backup into the app, as a new garden or in place of this one, with its photos back on this device.
 * The file is a copy of this garden as it now is, so its day is the last copy. How many photos came back.
 */
export async function restoreBackup(store: Store, prefsStore: PrefsStore | undefined, result: Extract<ParseResult, { ok: true }>, asNew: boolean): Promise<number> {
  // Your own plants are shared by every garden: the file's are added to yours, and yours win where both have one.
  const mine = store.get().userPlants;
  const userPlants = [...mine, ...result.state.userPlants.filter((p) => !mine.some((m) => m.id === p.id))];
  if (asNew) {
    flushSave();
    addGarden(result.state.garden, undefined, new Date(), true);
  }
  store.replace({ garden: result.state.garden, userPlants });
  let restored = 0;
  for (const [id, url] of Object.entries(result.photos ?? {})) {
    try {
      await putPhoto(id, await fromDataUrl(url));
      restored++;
    } catch {
      // a damaged photo is left out
    }
  }
  if (prefsStore && result.madeOn) noteCopy(prefsStore, result.madeOn);
  return restored;
}

/**
 * Whether the garden is safe here: what the browser said when asked to keep it, and on an iPhone in Safari (not on
 * the home screen), that Safari can clear it after weeks without a visit.
 */
export function KeptNote({ kept }: { kept: 'kept' | 'not-kept' | 'unknown' | null }) {
  if (isIosSafari() && !isInstalled())
    return (
      <p class="small">
        Safari can clear what a website keeps if it isn’t visited for a few weeks, and your garden with it. Put it on your home screen (Share, then Add to Home
        Screen) to keep it, and keep a copy too.
      </p>
    );
  if (kept === 'kept') return <p class="muted small">This browser has agreed to keep your garden, so it won’t clear it to make space.</p>;
  if (kept === 'not-kept') return <p class="small">This browser hasn’t promised to keep your garden if it runs short of space, so a copy matters more.</p>;
  return null;
}

/** The note, following the preferences, so it changes as soon as the browser answers. */
function LiveKeptNote({ prefsStore }: { prefsStore: PrefsStore }) {
  return <KeptNote kept={usePrefs(prefsStore).storageKept} />;
}

/** Where the garden is kept and how old its last copy is: the same line as on Today. */
function LiveSafety({ prefsStore }: { prefsStore: PrefsStore }) {
  const prefs = usePrefs(prefsStore);
  const [status, setStatus] = useState<SaveStatus>(saveStatus.get());
  useEffect(() => saveStatus.subscribe(setStatus), []);
  if (status === 'failed')
    return (
      <p class="save-failed" role="alert">
        Not saved: this browser isn’t keeping your changes. Keep a copy now.
      </p>
    );
  return <p>{safetyText(lastCopy(prefs))}</p>;
}

/** Firefox asks you out loud, so it's only asked when you choose to. */
function AskToKeep({ prefsStore, ask }: { prefsStore: PrefsStore; ask: () => void }) {
  if (usePrefs(prefsStore).storageKept === 'kept') return null;
  return (
    <p>
      <button type="button" class="link-btn" onClick={ask}>
        Ask this browser to keep your garden
      </button>
    </p>
  );
}

/** Download, and on a phone that can, the share sheet too (Save to Files, Drive, email). */
export function BackupButtons({ store, prefsStore, primary = true }: { store: Store; prefsStore?: PrefsStore; primary?: boolean }) {
  return (
    <>
      <button type="button" class={`btn ${primary ? 'btn-primary' : ''}`} onClick={() => backUp(store, prefsStore)}>
        Download a backup
      </button>
      {canShareBackup() && (
        <button type="button" class="btn" title="Save it to Files, or send it to yourself" onClick={() => shareBackup(store, prefsStore)}>
          Save or share a copy
        </button>
      )}
    </>
  );
}

type Message = { kind: 'ok' | 'error'; lines: string[] } | null;

/** The garden's part of Settings: its name and place, north, spacing, frosts and climate, reminders, and backups. */
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

  const app = useApp();
  const { plants, plantOf } = usePlants(store.get().userPlants, spacingStyle(garden));
  const askedToKeep = async () => {
    if (!prefsStore) return;
    const kept = await askToKeep();
    prefsStore.set({ storageKept: kept, storageAsked: todayIso() });
  };
  /** A backup read and checked, waiting for you to say whether it's a new garden or replaces this one. */
  const [opened, setOpened] = useState<Extract<ParseResult, { ok: true }> | null>(null);
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
    setMessage(null);
    setOpened(result);
  };
  const restore = async (result: Extract<ParseResult, { ok: true }>, asNew: boolean) => {
    setOpened(null);
    const restored = await restoreBackup(store, prefsStore, result, asNew);
    setMessage({ kind: 'ok', lines: [`${asNew ? 'Added' : 'Restored'} "${result.state.garden.name}" from the backup${restored ? `, with ${restored} ${restored === 1 ? 'photo' : 'photos'}` : ''}.${asNew ? ` It’s open now; ${garden.name} is kept, to switch back to in Settings.` : ''}`] });
  };

  return (
    <>
      <section class="card" aria-labelledby="about-garden">
        <h2 id="about-garden">Your garden</h2>
        <GardenNameField store={store} garden={garden} />
        <fieldset class="choice">
          <legend>How you keep track</legend>
          <div class="choice-row">
            {(
              [
                ['list', 'A list of beds'],
                ['plan', 'A plan'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} class="choice-option">
                <input
                  type="radio"
                  name="garden-view"
                  checked={(garden.view === 'list' ? 'list' : 'plan') === value}
                  onChange={() =>
                    store.apply(
                      updateGarden(({ view: _v, ...g }) => (value === 'list' ? nameListBeds({ ...g, view: 'list' }, isListed(g), featureLabel) : spreadOut(g, isListed(g)))),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p class="muted small">
            A list: your beds and pots, with their plants under each, and no plan to draw. A plan: the garden drawn to scale, with sun and shade. Switching keeps
            everything; beds added in a list are set out neatly on the plan, ready to arrange.
          </p>
        </fieldset>
        {/* Asked of a balcony in setup; here too for anywhere that's all pots, set up before it was asked. */}
        {potsOnly(garden) && (
          <>
            <h3>Your balcony or pots</h3>
            <BalconyFields value={garden.balcony ?? {}} onChange={(b) => store.apply(updateGarden((g) => setBalcony(g, b)))} />
          </>
        )}
        <h3>Where it is</h3>
        <p>{placeText(garden)}</p>
        <PlaceSearch store={store} />
        <UseLocationButton store={store} onMessage={setMessage} />
        <p class="muted small">Its place times the sun and shade, the frosts and the seasons.</p>
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
        {!potsOnly(garden) && <GardenSoil store={store} garden={garden} />}
        {/* Most people never need these: one row, for those who do. */}
        <details class="advanced">
          <summary>Advanced: north, climate, pH and exact location</summary>
          {garden.view !== 'list' && (
            <>
              <h3>Which way is north</h3>
              <CompassNorth store={store} />
              <label class="field">
                Degrees clockwise from the top of your plan to north
                <input type="number" step="1" min={-360} max={360} value={garden.northRotationDeg} onChange={setNumber('northRotationDeg', -360, 360)} />
              </label>
              <p class="muted small">0 if the top of your plan faces north. On a phone, the compass can work it out for you.</p>
            </>
          )}
          <Warmth garden={garden} />
          {!potsOnly(garden) && <GardenPh store={store} garden={garden} />}
          <h3>Exact location</h3>
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
      </section>

      <section class="card" aria-labelledby="seasons">
        <HelpTitle id="seasons" topic="climate">
          Seasons and weather
        </HelpTitle>
        <FrostDates store={store} garden={garden} />
        {prefsStore && <WeatherSwitch garden={garden} prefsStore={prefsStore} />}
      </section>

      {prefsStore && <Reminders prefsStore={prefsStore} pots={potsOnly(garden)} />}

      <section class="card" aria-labelledby="backup">
        <HelpTitle id="backup" topic="backups">
          Backups
        </HelpTitle>
        {prefsStore && <LiveSafety prefsStore={prefsStore} />}
        <p class="muted small">
          Clearing your browsing data would delete your garden, so keep a copy now and then. It’s also how you move to another device.
          {gardenCount() > 1 ? ' Each garden has its own copy: this one’s for the garden that’s open.' : ''}
          {photoCount > 0 ? ' Photos make a backup much bigger, so they’re only in one made with photos.' : ''}
        </p>
        {prefsStore && <LiveKeptNote prefsStore={prefsStore} />}
        {prefsStore && asksOutLoud() && <AskToKeep prefsStore={prefsStore} ask={askedToKeep} />}
        <div class="button-row">
          <BackupButtons store={store} prefsStore={prefsStore} />
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
        <h3>To read or print</h3>
        <p class="muted small">For you, not for restoring: only a backup brings a garden back.</p>
        <div class="button-row">
          <button type="button" class="btn" disabled={!plants} onClick={() => saveToDevice(csvFile(garden.name, plantingsCsv(garden, plantOf)))}>
            Spreadsheet of plantings
          </button>
          <button type="button" class="btn" onClick={() => app.printGarden()}>
            Print the plan and year
          </button>
        </div>
        {opened && (
          <div class="message ok restore-choice" role="status">
            <p>
              “{opened.state.garden.name}” is ready to open. Add it as another garden, or replace {garden.name} with it? Replacing can’t be undone.
            </p>
            <div class="button-row">
              <button type="button" class="btn btn-primary" onClick={() => restore(opened, true)}>
                Add as a new garden
              </button>
              <button type="button" class="btn" onClick={() => restore(opened, false)}>
                Replace {garden.name}
              </button>
              <button type="button" class="btn btn-quiet" onClick={() => setOpened(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
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
          <span class="visually-hidden">{label}: day</span>
          <input type="number" min={1} max={days} value={d} onChange={(e) => set(m, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))} />
        </label>
        <label class="field">
          <span class="visually-hidden">{label}: month</span>
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

/** Average last and first frosts: estimated until you set your own. They time sowing, planting out, hardening off and winter jobs. */
function FrostDates({ store, garden }: { store: Store; garden: Garden }) {
  const f = frostDates(garden);
  const est = frostEstimate(garden);
  // Only the date you changed is yours: your last frost sets your whole season, so it isn't pinned by changing the first.
  const set = (patch: Partial<Pick<Garden, 'lastFrost' | 'firstFrost'>>) => store.apply(updateGarden((g) => ({ ...g, ...patch })));
  const setHeight = (text: string) => {
    const m = Math.round(Number(text));
    // A height outside the UK is a slip: what you had stands.
    if (text.trim() && !(m >= 0 && m <= 1400)) return;
    store.apply(
      updateGarden((g) => {
        const { heightM: _old, ...rest } = g;
        return text.trim() ? { ...rest, heightM: m } : rest;
      }),
    );
  };
  return (
    <div class="frost-dates">
      <h3>Frosts</h3>
      <div class="field-row">
        <MonthDayField label="Last frost in spring" value={f.lastFrost} onChange={(lastFrost) => set({ lastFrost })} />
        <MonthDayField label="First frost in autumn" value={f.firstFrost} onChange={(firstFrost) => set({ firstFrost })} />
      </div>
      <div class="field-row">
        <label class="field">
          Height above sea level, in metres
          <input type="number" inputMode="numeric" min={0} max={1400} value={garden.heightM ?? ''} placeholder="Not set" onChange={(e) => setHeight((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <label class="check">
        <input type="checkbox" checked={!!garden.frostHollow} onChange={(e) => {
          const on = (e.currentTarget as HTMLInputElement).checked;
          store.apply(
            updateGarden((g) => {
              const { frostHollow: _old, ...rest } = g;
              return on ? { ...rest, frostHollow: true } : rest;
            }),
          );
        }} />
        In a frost hollow: low ground where cold air settles on still nights
      </label>
      <p class="muted small">
        {f.estimated
          ? 'Estimated from your location, height and any frost hollow. Local weather records or neighbours will know better: coastal gardens can be weeks either side.'
          : 'Your own dates.'}{' '}
        <GlossText text={`${lastFrostText(f.lastFrost)} A frost is as likely after a 50:50 date as before it, so tender plants are safest out two weeks later.`} /> The dates decide when to sow and
        plant, when the Shed suggests hardening off, and when to protect plants for winter. Move your last frost, and your sowing and planting dates move with it.
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
function Warmth({ garden }: { garden: Garden }) {
  const av = averagesHere(garden);
  const dd = yearDegreeDays(av);
  const ref = yearDegreeDays(referenceAverages());
  const diff = Math.round(((dd - ref) / ref) * 100);
  const compared = Math.abs(diff) < 3 ? 'About as warm as the middle of England' : `About ${Math.abs(diff)}% ${diff > 0 ? 'warmer' : 'cooler'} for growing than the middle of England`;
  return (
    <div class="warmth">
      <h3>Your climate</h3>
      <p>{compared}.</p>
      <details class="advanced">
        <summary>Your climate, in detail</summary>
        <dl class="facts">
          <dt>July days</dt>
          <dd>{one(av.tmax[6]!)}</dd>
          <dt>January nights</dt>
          <dd>{one(av.tmin[0]!)}</dd>
          <dt>Growing season</dt>
          <dd>About {Math.round(seasonDays(av) / 5) * 5} days above 5 °C</dd>
        </dl>
        <p class="muted small">
          Averages for 1991–2020 from the weather stations nearest you: {listed(stationNames(av))}
          {av.nearestKm > 150 ? `, the nearest ${av.nearestKm} km away, so take them as rough` : ''}
          {garden.heightM !== undefined || garden.frostHollow ? ', corrected for your height and frost hollow, as far as you’ve said' : ''}. They time how fast crops grow on the plan's year:
          sooner where it's warmer, later where it's cooler, and sooner still under glass. A sheltered garden or a city can differ by a degree or two, and any year can be
          warmer or colder.
        </p>
      </details>
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** This year's weather from Open-Meteo: off until you turn it on, as it sends the garden's rough location. */
function WeatherSwitch({ garden, prefsStore }: { garden: Garden; prefsStore: PrefsStore }) {
  const prefs = usePrefs(prefsStore);
  const { weather, status, refresh } = useWeatherNow();
  const today = todayIso();
  const soFar = weather ? yearSoFar(weather, averagesHere(garden), today) : null;
  const pct = soFar && soFar.usual > 0 ? Math.round(((soFar.actual - soFar.usual) / soFar.usual) * 100) : null;
  return (
    <div class="weather-switch">
      <label class="switch-row">
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

type ReminderKey = 'reminders' | 'weeklyNudge' | 'uvReminders';
const REMINDER_KEYS: ReminderKey[] = ['reminders', 'weeklyNudge', 'uvReminders'];

/** Turning reminders on asks the browser; turning the last one off stops the checks. With what the browser said. */
export function useReminders(prefsStore: PrefsStore) {
  const prefs = usePrefs(prefsStore);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const toggle = (key: ReminderKey) => async (e: Event) => {
    const on = (e.currentTarget as HTMLInputElement).checked;
    if (!on) {
      prefsStore.set({ [key]: false });
      setStatus(null);
      // Stop checking once neither is wanted.
      if (!REMINDER_KEYS.some((k) => k !== key && prefs[k])) await disableReminders().catch(() => undefined);
      return;
    }
    const result = await enableReminders().catch((): ReminderStatus => 'unsupported');
    setStatus(result);
    prefsStore.set({ [key]: result === 'background' || result === 'open-only' });
  };
  return { prefs, status, toggle, statusText: status ? REMINDER_TEXT[status] : null };
}

/** Frost warnings and the week's jobs with the app closed, where the browser allows: it checks now and then in the background. Sun cream is in Settings → More. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Reminders({ prefsStore, pots }: { prefsStore: PrefsStore; pots: boolean }) {
  const { prefs, status, toggle } = useReminders(prefsStore);
  return (
    <section class="card weather-switch" aria-labelledby="reminders">
      <HelpTitle id="reminders" topic="reminders">
        Reminders
      </HelpTitle>
      <label class="switch-row">
        <input type="checkbox" checked={prefs.reminders} onChange={toggle('reminders')} />
        <span>Frost warnings</span>
      </label>
      <p class="muted small">
        When a frost could hurt your tender plants or seedlings. To check, the app sends your garden’s location, rounded to about a kilometre, to Open-Meteo now
        and then.
      </p>
      <label class="switch-row">
        <input type="checkbox" checked={prefs.weeklyNudge} onChange={toggle('weeklyNudge')} />
        <span>This week’s jobs, once a week</span>
      </label>
      <label class="field">
        The day for it
        <select value={String(prefs.reminderDay)} onChange={(e) => prefsStore.set({ reminderDay: Number((e.currentTarget as HTMLSelectElement).value) })}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <option key={d} value={String(d)}>
              {WEEKDAYS[d]}
            </option>
          ))}
        </select>
      </label>
      <p class="muted small">What there is to sow, harden off or plant out that week. Nothing is sent anywhere for this.</p>
      {/* A balcony has no beds to weed. */}
      {!pots && (
        <>
          <label class="switch-row">
            <input type="checkbox" checked={prefs.weeding} onChange={(e) => prefsStore.set({ weeding: (e.currentTarget as HTMLInputElement).checked })} />
            <span>Weeding reminders</span>
          </label>
          <p class="muted small">A “Weed the beds” job each month from March to October, with what to do that month. Weeds you’ve marked on the plan get their own jobs either way.</p>
        </>
      )}
      <label class="switch-row">
        <input type="checkbox" checked={prefs.feeding} onChange={(e) => prefsStore.set({ feeding: (e.currentTarget as HTMLInputElement).checked })} />
        <span>Feeding reminders</span>
      </label>
      <p class="muted small">A “Feed” job when a plant wants feeding, and what to dig in before planting, from each plant’s notes.</p>
      {status && (
        <p class="small" role="status">
          {REMINDER_TEXT[status]}
        </p>
      )}
    </section>
  );
}
