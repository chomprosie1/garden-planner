// Lenses over the plan: one at a time, each recolours the plan to show one
// thing: sun, shade, what's in flower, what's ready to harvest, and what's
// thirsty, in the week chosen on the year scrubber. They replace the old Sun
// part of the plan.

import { FOCUS_STYLE, type FocusKind } from '../canvas/render';
import { Icon, type IconName } from './icons';
import { LENSES_IN, type PlanMode } from './planMode';

export type Lens = 'none' | 'sun' | 'shade' | FocusKind;

const LENSES: { id: Lens; label: string; short: string; hint: string; icon?: IconName }[] = [
  { id: 'none', label: 'Plan', short: 'Plan', hint: 'The plan on its own' },
  { id: 'sun', label: 'Sun hours', short: 'Sun', hint: 'Hours of direct sun each spot gets in a day', icon: 'sun' },
  { id: 'shade', label: 'Shade', short: 'Shade', hint: 'Shadows at a time of day (S)' },
  { id: 'flower', label: 'In flower', short: 'Flowers', hint: 'What’s in flower that week, for bees' },
  { id: 'harvest', label: 'Harvest', short: 'Harvest', hint: 'What’s ready to pick that week' },
  { id: 'water', label: 'Water', short: 'Water', hint: 'What’s likely to be thirsty that week' },
];

export const isFocusLens = (l: Lens): l is FocusKind => l === 'flower' || l === 'harvest' || l === 'water';

/** On a wide screen: a chip for each way of looking at the plan. Tap the one that's on to go back to the plan on its own. */
export function LensBar({ lens, setLens, mode = 'advanced' }: { lens: Lens; setLens: (l: Lens) => void; mode?: PlanMode }) {
  return (
    <div class="lens-bar" role="group" aria-label="Show on the plan">
      {LENSES.filter((l) => l.id !== 'none' && LENSES_IN[mode].includes(l.id)).map((l) => (
        <button key={l.id} type="button" class="chip lens-chip" aria-pressed={lens === l.id} title={l.hint} onClick={() => setLens(lens === l.id ? 'none' : l.id)}>
          {l.icon && <Icon name={l.icon} size={15} />}
          {isFocusLens(l.id) && <Ring kind={l.id} />}
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** On a phone: one "Show" picker, so the plan keeps the room. */
export function LensPicker({ lens, setLens, mode = 'advanced' }: { lens: Lens; setLens: (l: Lens) => void; mode?: PlanMode }) {
  return (
    <label class="lens-picker">
      <span class="visually-hidden">Show on the plan</span>
      <select value={lens} onChange={(e) => setLens((e.currentTarget as HTMLSelectElement).value as Lens)}>
        {LENSES.filter((l) => LENSES_IN[mode].includes(l.id)).map((l) => (
          <option key={l.id} value={l.id}>
            {l.id === 'none' ? 'Show: the plan' : `Show: ${l.label.toLowerCase()}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The ring a lens draws, as a key: its colour and its dash, so it doesn't rely on colour. */
function Ring({ kind }: { kind: FocusKind }) {
  const st = FOCUS_STYLE[kind];
  return (
    <svg class={`lens-ring lens-ring-${kind}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width={Math.min(2.5, st.width * 0.7)} stroke-dasharray={st.dash.length ? st.dash.map((d) => d * 0.6).join(' ') : undefined} stroke-linecap="round" />
    </svg>
  );
}

const LEGEND: Record<FocusKind, (n: number) => string> = {
  flower: (n) => (n ? `${n} ${n === 1 ? 'planting' : 'plantings'} in flower: food for bees and hoverflies.` : 'Nothing in flower this week.'),
  harvest: (n) => (n ? `${n} ${n === 1 ? 'planting' : 'plantings'} ready to pick.` : 'Nothing ready to pick this week.'),
  water: (n) => (n ? `${n} likely to be thirsty: pots and planters first, then young plants and those that like it moist. Check the soil before watering.` : 'Nothing likely to need watering this week.'),
};

/**
 * What a lens shows, under the plan: its ring, a count, and a word on what it's based on. live: this year's weather is
 * on; rain: rain in the three days to the day shown, when the weather covers it.
 */
export function LensLegend({ kind, count, guessed, live = false, rain = null }: { kind: FocusKind; count: number; guessed: boolean; live?: boolean; rain?: number | null }) {
  return (
    <p class="lens-legend" role="status">
      <Ring kind={kind} />
      <span>
        {LEGEND[kind](count)}
        {kind === 'water' && rain !== null ? ` ${rain >= 1 ? `${Math.round(rain)} mm of rain` : 'No rain to speak of'} in the three days to then.` : ''}
        {guessed ? (live ? ' Based on this year’s weather and the forecast.' : ' Based on the usual warmth here.') : ''}
      </span>
    </p>
  );
}
