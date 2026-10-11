// "More plants (still being checked)": the plants beyond the core 150, folded
// under the main list until the data track reaches them.

import type { ComponentChildren } from 'preact';
import { MORE_PLANTS } from '../library/order';

export function MorePlants({ count, children }: { count: number; children: ComponentChildren }) {
  return (
    <details class="more-plants">
      <summary>
        {MORE_PLANTS} <span class="chip-count">{count}</span>
      </summary>
      <p class="muted small">Their sowing months, spacing and the rest are drafts. The plants above are checked against the RHS and seed packets first; these come later.</p>
      {children}
    </details>
  );
}
