// A "⋯" button that opens a short menu: the actions you need now and then,
// kept out of the way of the ones you use all the time.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './icons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  /** A shortcut to show beside it, on a keyboard. */
  keys?: string;
}

export function MoreMenu({ items, label = 'More' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // The menu opens leftwards from the button; where the button sits near the left edge (a phone's second toolbar row), nudge it back on screen.
  useLayoutEffect(() => {
    const el = list.current;
    if (!open || !el) return;
    el.style.transform = '';
    const left = el.getBoundingClientRect().left;
    if (left < 8) el.style.transform = `translateX(${8 - left}px)`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', key);
    // Focus the first item, for the keyboard.
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => {
      removeEventListener('pointerdown', away);
      removeEventListener('keydown', key);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div class="more-menu" ref={wrap}>
      <button type="button" class="icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <div ref={list} class="more-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              <span>{item.label}</span>
              {item.keys && <kbd class="desktop-only">{item.keys}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
