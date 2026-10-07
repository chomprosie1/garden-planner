// Tabs inside a details panel, so it shows one thing at a time instead of a
// long stack. The tab you last chose is remembered for panels of the same kind.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface PanelTab {
  id: string;
  label: string;
  body: ComponentChildren;
}

const chosen = new Map<string, string>();

export function PanelTabs({ id, tabs }: { id: string; tabs: PanelTab[] }) {
  const [current, setCurrent] = useState(() => (tabs.some((t) => t.id === chosen.get(id)) ? chosen.get(id)! : tabs[0]!.id));
  const pick = (t: string) => {
    chosen.set(id, t);
    setCurrent(t);
  };
  const shown = tabs.find((t) => t.id === current) ?? tabs[0]!;
  return (
    <div class="panel-tabs">
      <div class="panel-tab-row" role="tablist" aria-label="Details">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${id}-${t.id}`}
            aria-selected={t.id === shown.id}
            aria-controls={`panel-${id}`}
            tabIndex={t.id === shown.id ? 0 : -1}
            onClick={() => pick(t.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === shown.id);
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = tabs[(i + step + tabs.length) % tabs.length]!;
              pick(next.id);
              (e.currentTarget.parentElement?.querySelector(`#tab-${id}-${next.id}`) as HTMLElement | null)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div class="panel-tab-body" role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}-${shown.id}`}>
        {shown.body}
      </div>
    </div>
  );
}
