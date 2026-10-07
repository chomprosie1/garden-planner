// Lenses over the plan: one at a time, each recolours the plan to show one
// thing: sun, shade, what's in flower, what's ready to harvest, and what's
// thirsty, in the week chosen on the year scrubber. They replace the old Sun
// part of the plan.

import { FOCUS_STYLE, type FocusKind } from '../canvas/render';
import { Icon, type IconName } from './icons';

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

export function LensBar({ lens, setLens, phone, warnings }: { lens: Lens; setLens: (l: Lens) => void; phone: boolean; warnings: number }) {
  return (
    <div class="lens-bar" role="radiogroup" aria-label="Show on the plan">
      {LENSES.map((l) => (
        <button key={l.id} type="button" role="radio" class="chip lens-chip" aria-checked={lens === l.id} title={l.hint} onClick={() => setLens(l.id)}>
          {l.icon && <Icon name={l.icon} size={15} />}
          {isFocusLens(l.id) && <Ring kind={l.id} />}
          {phone ? l.short : l.label}
          {l.id === 'none' && warnings > 0 && (
            <span class="chip-count chip-warn" aria-label={`${warnings} ${warnings === 1 ? 'thing' : 'things'} to check`}>
              {warnings}
            </span>
          )}
        </button>
      ))}
    </div>
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

/** What a lens shows, under the plan: its ring, a count, and a word on what it's based on. */
export function LensLegend({ kind, count, guessed }: { kind: FocusKind; count: number; guessed: boolean }) {
  return (
    <p class="lens-legend" role="status">
      <Ring kind={kind} />
      <span>
        {LEGEND[kind](count)}
        {guessed ? ' Based on usual months.' : ''}
      </span>
    </p>
  );
}
