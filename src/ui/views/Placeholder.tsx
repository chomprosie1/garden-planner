import type { View } from '../../theme/prefs';
import { Icon } from '../icons';

interface Props {
  title: string;
  lines: string[];
  go: (v: View) => void;
}

/** A screen whose stage is still to come. */
export function Placeholder({ title, lines, go }: Props) {
  return (
    <div class="page">
      <header class="page-head">
        <h1 class="title">{title}</h1>
        <button type="button" class="icon-btn phone-only" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="settings" />
        </button>
      </header>
      <section class="card">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </section>
    </div>
  );
}
