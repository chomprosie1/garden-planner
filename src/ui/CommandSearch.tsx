// Search everything, in a dialog: Ctrl+K anywhere, or the search button on the
// plan. Arrow keys move through the results and Enter does the highlighted one.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Garden, Plant } from '../model/types';
import { Icon, type IconName } from './icons';
import { PlantIcon } from './PlantIcon';
import { GROUPS, search, type Command, type Result } from './search';
import { usePlants } from './usePlants';

interface Props {
  garden: Garden;
  userPlants: Plant[];
  locked: boolean;
  run: (c: Command) => void;
  close: () => void;
}

const ICON: Record<Command['kind'], IconName> = {
  go: 'plan',
  plant: 'plus',
  about: 'info',
  sow: 'shed',
  show: 'locate',
  lens: 'sun',
  sticker: 'plus',
  tool: 'pencil',
  lock: 'lock',
  fit: 'fit',
  setup: 'home',
  shortcuts: 'keyboard',
};

export function CommandSearch({ garden, userPlants, locked, run, close }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { plants, plantOf } = usePlants(userPlants);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(query, { garden, plants, plantOf, locked }), [query, garden, plants, plantOf, locked]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => setActive(0), [query]);
  // Keep the highlighted result in view.
  useEffect(() => list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }), [active]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    ref.current?.close();
    run(r.command);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = results.length;
      if (n) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  };

  let index = 0;
  return (
    <dialog ref={ref} class="dialog command-search" aria-label="Search everything" onClose={close} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div class="command-input">
        <Icon name="search" size={18} />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={results.length ? `command-${active}` : undefined}
          aria-label="Search plants, your plan and actions"
          placeholder="Search plants, your plan and actions"
          value={query}
          autoFocus
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={onKey}
        />
        <kbd class="command-esc">Esc</kbd>
      </div>
      <div id="command-results" ref={list} class="command-results" role="listbox" aria-label="Results">
        {!query.trim() && <p class="command-group">Try “add tomato”, “go to the shed” or “show sun”</p>}
        {GROUPS.map((group) => {
          const rows = results.filter((r) => r.group === group);
          if (!rows.length) return null;
          return (
            <div key={group} role="group" aria-label={group}>
              {query.trim() && <p class="command-group">{group}</p>}
              {rows.map((r) => {
                const i = index++;
                return (
                  <div
                    key={r.key}
                    id={`command-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    class="command-row"
                    onClick={() => choose(r)}
                    onPointerMove={() => i !== active && setActive(i)}
                  >
                    <span class="command-icon">{r.plantId ? <PlantIcon plant={plantOf(r.plantId)} size={24} /> : <Icon name={ICON[r.command.kind]} size={18} />}</span>
                    <span class="command-label">{r.label}</span>
                    {r.detail && <span class="command-detail">{r.detail}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {query.trim() && !results.length && <p class="command-empty muted">Nothing matches “{query.trim()}”.</p>}
      </div>
    </dialog>
  );
}
