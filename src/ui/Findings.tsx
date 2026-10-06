import type { Finding } from '../planting/rules';

interface Props {
  findings: Finding[];
  focus: string | null;
  setFocus: (id: string | null) => void;
  /** Called after a finding is picked, e.g. to show it on the plan. */
  onPick?: (f: Finding) => void;
}

/** Warnings first, then good neighbours. Picking one outlines its plants on the plan. */
export function FindingsList({ findings, focus, setFocus, onPick }: Props) {
  if (findings.length === 0) return null;
  return (
    <ul class="findings">
      {findings.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            class={`finding finding-${f.level}`}
            aria-pressed={focus === f.id}
            onClick={() => {
              const on = focus !== f.id;
              setFocus(on ? f.id : null);
              if (on) onPick?.(f);
            }}
          >
            <span class="finding-icon" aria-hidden="true">
              {f.level === 'warn' ? '!' : '✓'}
            </span>
            <span>
              <span class="visually-hidden">{f.level === 'warn' ? 'Warning: ' : 'Good: '}</span>
              {f.message}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
