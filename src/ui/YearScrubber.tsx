// The year under the plan: weeks from a year ago to a year ahead, with today
// marked. Drag it, or press play for a ten-second year; the plan redraws for
// the week.

import { useEffect, useRef } from 'preact/hooks';
import { addDays, daysBetween } from '../lifecycle/shed';
import { shortDate } from '../lifecycle/projection';
import { Icon } from './icons';

export const WEEKS = 52;
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weeks from today to a day, a year either side at most. */
export const weeksFrom = (today: string, date: string) => Math.max(-WEEKS, Math.min(WEEKS, Math.round(daysBetween(today, date) / 7)));

interface Props {
  today: string;
  date: string;
  setDate: (iso: string) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  phone: boolean;
  /** Share a picture of the week, or a timelapse of the year. */
  share: () => void;
}

export function YearScrubber({ today, date, setDate, playing, setPlaying, phone, share }: Props) {
  const week = weeksFrom(today, date);
  const at = useRef(week);
  at.current = week;

  useEffect(() => {
    if (!playing) return;
    // With reduced motion, the year moves in bigger, slower steps.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = reduced ? 4 : 1;
    if (at.current >= WEEKS) setDate(addDays(today, -WEEKS * 7));
    const t = setInterval(() => {
      const next = Math.min(WEEKS, at.current + step);
      setDate(addDays(today, next * 7));
      if (next >= WEEKS) setPlaying(false);
    }, reduced ? 800 : Math.round(10000 / WEEKS));
    return () => clearInterval(t);
  }, [playing, today]);

  // Where each month starts along the track.
  const ticks: { pos: number; label: string; year?: number }[] = [];
  for (let w = -WEEKS; w <= WEEKS; w++) {
    const d = addDays(today, w * 7);
    const prev = addDays(today, (w - 1) * 7);
    if (w === -WEEKS || d.slice(5, 7) !== prev.slice(5, 7)) {
      const m = Number(d.slice(5, 7));
      // January is marked with its year instead.
      const year = Number(d.slice(0, 4));
      const label = m === 1 ? (phone ? `’${String(year).slice(2)}` : String(year)) : phone ? MONTHS[m - 1]! : MONTH_NAMES[m - 1]!;
      ticks.push({ pos: ((w + WEEKS) / (2 * WEEKS)) * 100, label, ...(m === 1 ? { year } : {}) });
    }
  }
  const label = week === 0 ? 'This week' : `${phone ? '' : 'Week of '}${shortDate(date)} ${date.slice(0, 4)}`;
  const when = week === 0 ? '' : week < 0 ? `${-week} ${week === -1 ? 'week' : 'weeks'} ago` : `in ${week} ${week === 1 ? 'week' : 'weeks'}`;

  return (
    <section class="year-scrubber" aria-label="The garden through the year">
      <button type="button" class="icon-btn year-play" aria-label={playing ? 'Pause' : 'Play the year'} aria-pressed={playing} onClick={() => setPlaying(!playing)}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <div class="year-track">
        <div class="year-head">
          <strong>{label}</strong>
          {when && <span class="muted small year-when">{when}</span>}
          {week !== 0 && (
            <button type="button" class="link-btn year-today" onClick={() => setDate(today)}>
              {phone ? 'Today' : 'Back to today'}
            </button>
          )}
        </div>
        <div class="year-range">
          <span class="year-now" style={{ left: '50%' }} aria-hidden="true" />
          <input
            type="range"
            min={-WEEKS}
            max={WEEKS}
            step={1}
            value={week}
            aria-label="Week"
            aria-valuetext={week === 0 ? 'This week' : `${label}, ${when}`}
            onInput={(e) => {
              setPlaying(false);
              setDate(addDays(today, Number((e.currentTarget as HTMLInputElement).value) * 7));
            }}
          />
        </div>
        <div class="year-months" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t.pos} style={{ left: `${t.pos}%` }} class={t.year ? 'year-new' : ''}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <button type="button" class="icon-btn year-share" aria-label="Share a picture of this week" title="Share a picture, or a timelapse of the year" onClick={share}>
        <Icon name="share" size={18} />
      </button>
    </section>
  );
}
