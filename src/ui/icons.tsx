// Line icons, drawn in currentColor so every look can colour them.

const PATHS = {
  heart: 'M12 20.5s-7.5-4.6-9.4-9.1C1.2 8 3.1 4.5 6.6 4.5c2.1 0 3.4 1.2 4.1 2.4l1.3 2 1.3-2c.7-1.2 2-2.4 4.1-2.4 3.5 0 5.4 3.5 4 6.9-1.9 4.5-9.4 9.1-9.4 9.1z',
  home: 'M3 19h18M6.5 19a5.5 5.5 0 0 1 11 0M12 7.5V5M6.2 10.2 4.6 8.6M17.8 10.2l1.6-1.6M3.5 14.5h1.8M18.7 14.5h1.8',
  plan: 'M3 15.5h18v4H3zM7 15.5c0-2.6.8-4.6 2.6-6M12 15.5c0-3.6 1-6 3.6-7.6M17 15.5c0-2-.6-3.3-1.8-4.4M9.6 9.5c-1.6-.2-2.6-1.2-2.8-2.8 1.6.1 2.6 1.1 2.8 2.8zM15.6 7.9c.1-1.8 1-2.9 2.8-3.3-.1 1.8-1 2.9-2.8 3.3z',
  plants: 'M5 19C5 10.5 10.5 5 19.5 4.5 19 13.5 13.5 19 5 19zM5 19l8.5-8.5M9.5 14.5h3.2M11.5 12.5V9.4',
  month: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M12 19v-5M12 16c-1.6-.1-2.6-1-2.8-2.6 1.6.1 2.6 1 2.8 2.6z',
  notes: 'M3 5.5c3-.9 6-.7 9 1.2 3-1.9 6-2.1 9-1.2v13c-3-.9-6-.7-9 1.2-3-1.9-6-2.1-9-1.2zM12 6.7v13.2',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4M12 17h.01',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  fit: 'M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5M8 8h8v8H8z',
  chevron: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  warn: 'M12 3 2 21h20zM12 10v5M12 18h.01',
  check: 'm5 12 5 5 9-10',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  'image-off': 'M3 3l18 18M21 15.5V6a2 2 0 0 0-2-2H8.5M3 6v12a2 2 0 0 0 2 2h13.5M3 16l5-5 4 4',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  shed: 'M6.5 13h11l-1.6 7.5H8.1zM12 13V8.5M12 9.5C12 7 10.2 5.4 7.2 5.2c.1 2.6 1.9 4.2 4.8 4.3zM12 11c0-2.2 1.6-3.7 4.6-3.8-.1 2.3-1.7 3.7-4.6 3.8z',
  locate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 1v4M12 19v4M1 12h4M19 12h4',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  unlock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  plus: 'M12 5v14M5 12h14',
  curve: 'M4 18C8 4 16 4 20 18',
  size: 'M4 9V4h5M20 15v5h-5M4 4l7 7M20 20l-7-7',
  pot: 'M5 8h14l-2 12H7zM4 5h16v3H4z',
  ground: 'M3 17c3-2 6-2 9 0s6 2 9 0M3 12c3-2 6-2 9 0s6 2 9 0',
  build: 'M3 11 12 4l9 7M5 10v10h14V10',
  pencil: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  close: 'M6 6l12 12M18 6 6 18',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  film: 'M4 5h16v14H4zM4 9h16M4 15h16M8 5v4M16 5v4M8 15v4M16 15v4',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  paste: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4',
} as const;

export type IconName = keyof typeof PATHS;

/** filled: drawn solid, as a heart that's on. */
export function Icon({ name, size = 22, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
