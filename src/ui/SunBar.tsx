import { HOURS_STOPS } from '../canvas/render';
import type { SunGrid } from '../sun/hours';
import { formatClock, type Day, type Sun } from '../sun/position';
import { Icon } from './icons';

export type SunView = 'shadows' | 'hours';
export interface CalendarDate {
  year: number;
  month: number; // 1 to 12
  day: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** "the south-west" for a bearing of 225°. */
export const compassWord = (bearing: number) => COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]!;

const iso = (d: CalendarDate) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const toMinutes = (at: Date | null, fallback: number) => {
  if (!at) return fallback;
  const [h, m] = formatClock(at).split(':').map(Number);
  return h! * 60 + m!;
};
export const clockText = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Days worth looking at: the longest and shortest, and the two in between. */
function presets(today: CalendarDate): { label: string; date: CalendarDate }[] {
  const y = today.year;
  return [
    { label: 'Today', date: today },
    { label: 'Midsummer (21 June)', date: { year: y, month: 6, day: 21 } },
    { label: 'Autumn equinox (22 Sept)', date: { year: y, month: 9, day: 22 } },
    { label: 'Midwinter (21 Dec)', date: { year: y, month: 12, day: 21 } },
    { label: 'Spring equinox (20 March)', date: { year: y, month: 3, day: 20 } },
  ];
}

interface Props {
  /** Shadows or sun hours: the lens chips above the plan choose. */
  view: SunView;
  today: CalendarDate;
  date: CalendarDate;
  setDate: (d: CalendarDate) => void;
  minutes: number;
  setMinutes: (m: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  day: Day;
  sun: Sun | null;
  /** undefined while sun hours are being worked out. */
  grid: SunGrid | null | undefined;
  /** Phones: the sun hours where the plan was last tapped. */
  spot?: string | null;
  defaultLocation: boolean;
}

/** Date and time controls for the sun and shade lenses. */
export function SunBar({ view, today, date, setDate, minutes, setMinutes, playing, setPlaying, day, sun, grid, spot, defaultLocation }: Props) {
  // Whole five-minute steps on the clock, from just before sunrise.
  const rise = Math.floor(toMinutes(day.sunrise, 0) / 5) * 5;
  const set = toMinutes(day.sunset, 24 * 60 - 1);
  const list = presets(today);
  const preset = list.findIndex((p) => iso(p.date) === iso(date));
  const legendMax = HOURS_STOPS[HOURS_STOPS.length - 1]![0];

  return (
    <section class="sun-bar" aria-label="Sun and shade">
      <div class="sun-row">
        <select
          class="sun-preset"
          aria-label="Day"
          value={preset >= 0 ? String(preset) : ''}
          onChange={(e) => {
            const i = Number((e.currentTarget as HTMLSelectElement).value);
            const p = list[i];
            if (p) setDate(p.date);
          }}
        >
          {preset < 0 && <option value="">Chosen day</option>}
          {list.map((p, i) => (
            <option key={p.label} value={String(i)}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          class="sun-date"
          aria-label="Date"
          value={iso(date)}
          onChange={(e) => {
            const [y, m, d] = (e.currentTarget as HTMLInputElement).value.split('-').map(Number);
            if (y && m && d) setDate({ year: y, month: m, day: d });
          }}
        />
      </div>

      {view === 'shadows' ? (
        <div class="sun-row">
          <button type="button" class="icon-btn" aria-label={playing ? 'Pause' : 'Play the day'} aria-pressed={playing} onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <label class="sun-time">
            <span class="visually-hidden">Time of day</span>
            <input type="range" min={rise} max={set} step={5} value={Math.min(set, Math.max(rise, minutes))} onInput={(e) => setMinutes(Number((e.currentTarget as HTMLInputElement).value))} />
          </label>
          <p class="sun-readout" aria-live="polite">
            <strong>{clockText(minutes)}</strong>{' '}
            {sun && sun.altitude > 0 ? (
              <span class="muted">
                · sun {Math.round(sun.altitude)}° up in the {compassWord(sun.azimuth)}
              </span>
            ) : (
              <span class="muted">· the sun is down</span>
            )}
          </p>
        </div>
      ) : (
        <div class="sun-row sun-legend-row">
          <div class="sun-legend" aria-hidden="true">
            <span class="sun-legend-bar" style={{ background: `linear-gradient(to right, ${HOURS_STOPS.map(([h, c]) => `${c} ${(h / legendMax) * 100}%`).join(', ')})` }} />
            <span class="sun-legend-ticks">
              {HOURS_STOPS.map(([h]) => (
                <span key={h} style={{ left: `${(h / legendMax) * 100}%` }}>
                  {h === legendMax ? `${h}+ h` : h}
                </span>
              ))}
            </span>
          </div>
          <p class="sun-readout">
            {grid === undefined ? (
              <span class="muted">Working out the sun…</span>
            ) : spot ? (
              <strong>{spot}</strong>
            ) : (
              <span class="muted">
                Hours of direct sun on 15 {MONTHS[date.month - 1]}. Shade under 3 h, part shade 3–6 h, full sun 6 h or more. Tap or point at the plan for a spot.
              </span>
            )}
          </p>
        </div>
      )}
      <p class="sun-note small muted">
        {day.sunrise && day.sunset ? `Sunrise ${formatClock(day.sunrise)}, sunset ${formatClock(day.sunset)} (UK time). ` : ''}
        {defaultLocation ? 'Using the middle of England: set your location in Settings for exact times. ' : ''}
        Assumes flat ground.
      </p>
    </section>
  );
}
