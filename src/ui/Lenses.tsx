// Lenses over the plan: one at a time, each recolours the plan to show one
// thing (sun, shade). They replace the old Sun part of the plan.

import { Icon } from './icons';

export type Lens = 'none' | 'sun' | 'shade';

const LENSES: { id: Lens; label: string; short: string; hint: string }[] = [
  { id: 'none', label: 'Plan', short: 'Plan', hint: 'The plan on its own' },
  { id: 'sun', label: 'Sun hours', short: 'Sun', hint: 'Hours of direct sun each spot gets in a day' },
  { id: 'shade', label: 'Shade', short: 'Shade', hint: 'Shadows at a time of day (S)' },
];

export function LensBar({ lens, setLens, phone, warnings }: { lens: Lens; setLens: (l: Lens) => void; phone: boolean; warnings: number }) {
  return (
    <div class="lens-bar" role="radiogroup" aria-label="Show on the plan">
      {LENSES.map((l) => (
        <button key={l.id} type="button" role="radio" class="chip lens-chip" aria-checked={lens === l.id} title={l.hint} onClick={() => setLens(l.id)}>
          {l.id === 'sun' && <Icon name="sun" size={15} />}
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
