import type { Finding } from '../planting/rules';
import { useApp } from './appContext';

interface Props {
  findings: Finding[];
  focus: string | null;
  setFocus: (id: string | null) => void;
  /** Called after a finding is picked, e.g. to show it on the plan. */
  onPick?: (f: Finding) => void;
}

/** Warnings first, then good neighbours. Picking one outlines its plants on the plan. */
export function FindingsList({ findings, focus, setFocus, onPick }: Props) {
  const app = useApp();
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
          {f.level === 'warn' && app.dismissCheck && (
            <button
              type="button"
              class="link-btn small finding-dismiss"
              onClick={() => {
                app.dismissCheck!(f.id);
                app.notify('Fine: that check won’t be raised again.', { undo: false });
              }}
            >
              I know, it’s fine
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
