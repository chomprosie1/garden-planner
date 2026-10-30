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

  // The menu opens below the button and leftwards from it. Nothing it's inside clips it, a sheet or the page: it stands
  // on the screen itself, above the button if it wouldn't fit below, and in from the edges.
  useLayoutEffect(() => {
    const el = list.current;
    const button = wrap.current?.querySelector('button');
    if (!open || !el || !button) return;
    const b = button.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(b.right - width, innerWidth - width - 8));
    const top = b.bottom + 4 + height <= innerHeight - 8 ? b.bottom + 4 : Math.max(8, b.top - 4 - height);
    Object.assign(el.style, { position: 'fixed', right: 'auto', left: `${left}px`, top: `${top}px` });
    // Something round it with a transform of its own moves what "fixed" means: measure, and put it right.
    const now = el.getBoundingClientRect();
    if (now.left !== left || now.top !== top) Object.assign(el.style, { left: `${2 * left - now.left}px`, top: `${2 * top - now.top}px` });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    // Standing on the screen, it would be left behind as the page moved.
    const scrolled = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('pointerdown', away);
    addEventListener('keydown', key);
    addEventListener('scroll', scrolled, true);
    // Focus the first item, for the keyboard.
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => {
      removeEventListener('pointerdown', away);
      removeEventListener('keydown', key);
      removeEventListener('scroll', scrolled, true);
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
