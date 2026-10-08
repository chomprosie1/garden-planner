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

/** Days worth jumping to: the longest and the shortest, the next of each from today. */
function jumps(today: CalendarDate): { label: string; date: CalendarDate }[] {
  const next = (month: number, day: number) => ({ year: iso(today) <= iso({ year: today.year, month, day }) ? today.year : today.year + 1, month, day });
  return [
    { label: 'Midsummer', date: next(6, 21) },
    { label: 'Midwinter', date: next(12, 21) },
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

/** The time of day for shade, or the key for sun hours. The day is the timeline's, under the plan. */
export function SunBar({ view, today, date, setDate, minutes, setMinutes, playing, setPlaying, day, sun, grid, spot, defaultLocation }: Props) {
  // Whole five-minute steps on the clock, from just before sunrise.
  const rise = Math.floor(toMinutes(day.sunrise, 0) / 5) * 5;
  const set = toMinutes(day.sunset, 24 * 60 - 1);
  const list = jumps(today);
  // What the drop-down shows: today, a jump, or a week chosen on the timeline below.
  const picked = iso(date) === iso(today) ? 'today' : (list.find((p) => iso(p.date) === iso(date))?.label ?? 'timeline');
  const legendMax = HOURS_STOPS[HOURS_STOPS.length - 1]![0];

  return (
    <section class="sun-bar" aria-label="Sun and shade">
      <div class="sun-row sun-jumps">
        <label class="lens-picker sun-day-picker">
          <span class="visually-hidden">Day</span>
          <select
            value={picked}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              if (v === 'today') setDate(today);
              else {
                const j = list.find((p) => p.label === v);
                if (j) setDate(j.date);
              }
            }}
          >
            <option value="today">Day: Today ({today.day} {MONTHS[today.month - 1]})</option>
            {list.map((p) => (
              <option key={p.label} value={p.label}>
                Day: {p.label} ({p.date.day} {MONTHS[p.date.month - 1]})
              </option>
            ))}
            {picked === 'timeline' && (
              <option value="timeline">
                Day: {date.day} {MONTHS[date.month - 1]}, from the timeline
              </option>
            )}
          </select>
        </label>
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
        {defaultLocation ? 'Using the middle of England: tap your garden’s name to say where it is, for exact times. ' : ''}
        Assumes flat ground.
      </p>
    </section>
  );
}
