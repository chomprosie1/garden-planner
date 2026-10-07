// "Where are you growing?": pick a space, then its size, with a picture of
// what it'll make. Used on the first run, and from an empty plan.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { newGarden } from '../model/defaults';
import { makeSpace, metres, MAX_SPACE_MM, PLOTS, SPACES, spaceInfo, type Space } from '../model/spaces';
import { MiniPlan } from './MiniPlan';

export interface SpaceChoice {
  space: Space;
  /** Width and depth, mm. */
  w: number;
  d: number;
}

export const defaultChoice = (space: Space): SpaceChoice => ({ space, w: spaceInfo(space).size[0], d: spaceInfo(space).size[1] });

/** A size field in metres, kept as typed until it's a number that fits. */
function MetresField({ label, mm, min, onChange }: { label: string; mm: number; min: number; onChange: (mm: number) => void }) {
  const [text, setText] = useState(metres(mm));
  useEffect(() => {
    if (Math.round(Number(text) * 1000) !== mm) setText(metres(mm));
  }, [mm]);
  return (
    <label class="field">
      {label}
      <span class="input-unit">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={min / 1000}
          max={MAX_SPACE_MM / 1000}
          value={text}
          onInput={(e) => {
            const t = (e.currentTarget as HTMLInputElement).value;
            setText(t);
            const n = Math.round(Number(t) * 1000);
            if (t && Number.isFinite(n) && n >= min && n <= MAX_SPACE_MM) onChange(n);
          }}
        />
        <span>m</span>
      </span>
    </label>
  );
}

export function SpacePicker({ value, onChange }: { value: SpaceChoice | null; onChange: (c: SpaceChoice) => void }) {
  const previews = useMemo(() => Object.fromEntries(SPACES.map((s) => [s.id, makeSpace(newGarden(), s.id, s.size[0], s.size[1])])), []);
  const chosen = useMemo(() => (value ? makeSpace(newGarden(), value.space, value.w, value.d) : null), [value?.space, value?.w, value?.d]);
  const info = value ? spaceInfo(value.space) : null;
  const size = useRef<HTMLDivElement>(null);
  // On a phone the size is below the choices: bring it into view once a space is picked.
  useEffect(() => {
    if (value) size.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [value?.space]);
  const plot = value?.space === 'allotment' ? (Object.entries(PLOTS).find(([, [w, d]]) => w === value.w && d === value.d)?.[0] ?? 'other') : null;

  return (
    <div class="space-picker">
      <div class="space-options" role="radiogroup" aria-label="Where are you growing?">
        {SPACES.map((s) => (
          <label key={s.id} class="space-option">
            <input type="radio" name="space" checked={value?.space === s.id} onChange={() => onChange(defaultChoice(s.id))} />
            <span class="space-card">
              <MiniPlan garden={previews[s.id]!} width={72} height={56} pad={0.06} class="space-preview" />
              <span class="space-label">{s.label}</span>
              <span class="space-hint">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {value && info && chosen && (
        <div class="space-size" ref={size}>
          <div class="space-size-fields">
            {plot && (
              <div class="choice-row choice-small" role="radiogroup" aria-label="Plot">
                {(['full', 'half'] as const).map((p) => (
                  <label key={p} class="choice-option">
                    <input type="radio" name="plot" checked={plot === p} onChange={() => onChange({ ...value, w: PLOTS[p][0], d: PLOTS[p][1] })} />
                    <span>{p === 'full' ? 'Full plot' : 'Half plot'}</span>
                  </label>
                ))}
              </div>
            )}
            <div class="field-row">
              <MetresField label="Width" mm={value.w} min={info.min[0]} onChange={(w) => onChange({ ...value, w })} />
              <MetresField label="Depth" mm={value.d} min={info.min[1]} onChange={(d) => onChange({ ...value, d })} />
            </div>
            <p class="muted small">
              {+((value.w * value.d) / 1e6).toFixed(1)} m². Measure with a tape if you can; you can change it on the plan later.
            </p>
          </div>
          <MiniPlan garden={chosen} width={180} height={140} pad={0.04} class="space-result" />
        </div>
      )}
    </div>
  );
}

/** "Where are you growing?" over an empty plan. */
export function SpaceDialog({ make, close }: { make: (c: SpaceChoice) => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<SpaceChoice | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} class="dialog space-dialog" aria-labelledby="space-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="space-title" class="title">
          Where are you growing?
        </h2>
        <SpacePicker value={choice} onChange={setChoice} />
        <div class="button-row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!choice}
            onClick={() => {
              if (choice) make(choice);
              ref.current?.close();
            }}
          >
            Lay it out
          </button>
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
