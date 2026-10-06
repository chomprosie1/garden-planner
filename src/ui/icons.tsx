// Line icons, drawn in currentColor so every look can colour them.

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  plan: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M9 9v12',
  plants: 'M5 20c0-8 6-15 15-15 0 9-6 15-14 15M5 20l8-8',
  month: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  notes: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
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
  shed: 'M3 10 12 4l9 6v10H3zM9 20v-6h6v6M7 12h2M15 12h2',
  locate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 1v4M12 19v4M1 12h4M19 12h4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
