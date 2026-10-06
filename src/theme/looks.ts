// The five looks. Each has light and dark colours for the app and for the
// plan, its fonts, and how it treats the seasonal photos. Colours here are
// checked for contrast by tests/contrast.test.ts.

export const LOOK_IDS = ['cottage', 'heritage', 'allotment', 'modern', 'minimal'] as const;
export type LookId = (typeof LOOK_IDS)[number];
export type Mode = 'light' | 'dark';

export interface UiPalette {
  bg: string;
  surface: string;
  surface2: string; // subtle fills: hover, selected rows
  text: string;
  muted: string;
  border: string;
  accent: string; // primary buttons
  accentText: string;
  link: string;
  selectedBg: string; // the current nav item
  selectedText: string;
  chrome: string; // top bar and tab bar
  chromeText: string;
  chromeMuted: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
  decor: string; // rules and flourishes, never text
}

export interface PlanPalette {
  paper: string;
  lawn: string;
  lawnAlt: string;
  path: string;
  patio: string;
  bedFill: string;
  bedStroke: string;
  building: string;
  buildingStroke: string;
  glass: string;
  glassStroke: string;
  water: string;
  canopy: string;
  canopyStroke: string;
  fence: string;
  label: string;
  selection: string;
}

export interface Look {
  id: LookId;
  name: string;
  summary: string;
  fonts: { display: string; body: string; plan: string };
  title: { italic: boolean; smallCaps: boolean; uppercase: boolean; weight: number; tracking: string };
  shape: { radius: string; radiusCard: string; shadow: string; shadowDark: string };
  /** How Home presents the month's photo. */
  home: 'hero' | 'framed' | 'packet' | 'sheet' | 'band';
  photo: { filter: string; marginOpacity: number; marginBlur: number };
  /** Whether Focus (photos hidden in Plan) starts on. */
  focusByDefault: boolean;
  plan: {
    bedRadiusMm: number;
    pattern: 'stipple' | 'hatch' | 'stripes' | 'flat' | 'line';
    labels: 'hand' | 'serif' | 'sign' | 'pill' | 'caps';
  };
  light: { ui: UiPalette; plan: PlanPalette };
  dark: { ui: UiPalette; plan: PlanPalette };
}

const SYSTEM = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const LOOKS: Record<LookId, Look> = {
  cottage: {
    id: 'cottage',
    name: 'Cottage',
    summary: 'Soft and homely, like a well-thumbed garden book.',
    fonts: {
      display: "'Libre Baskerville', Georgia, serif",
      body: "'Source Sans 3', " + SYSTEM,
      plan: "'Caveat', 'Segoe Print', cursive",
    },
    title: { italic: true, smallCaps: false, uppercase: false, weight: 400, tracking: '0' },
    shape: {
      radius: '10px',
      radiusCard: '18px',
      shadow: '0 18px 40px rgba(60,48,30,.18)',
      shadowDark: '0 18px 40px rgba(0,0,0,.5)',
    },
    home: 'hero',
    photo: { filter: 'sepia(.18) saturate(1.05)', marginOpacity: 0.55, marginBlur: 7 },
    focusByDefault: false,
    plan: { bedRadiusMm: 220, pattern: 'stipple', labels: 'hand' },
    light: {
      ui: {
        bg: '#f6f1e4', surface: '#fffaf0', surface2: '#f1eadb', text: '#2f3a2c', muted: '#5f6a58',
        border: '#e2d8c3', accent: '#5d7a4d', accentText: '#fffaf0', link: '#4f6b40',
        selectedBg: '#e4ebd8', selectedText: '#3a5130', chrome: '#fffaf0', chromeText: '#2f3a2c',
        chromeMuted: '#5f6a58', warnBg: '#f8ead9', warnBorder: '#e4c3a0', warnText: '#6b3a17', decor: '#b5643c',
      },
      plan: {
        paper: '#fbf6ea', lawn: '#cfdcb8', lawnAlt: '#b9cb9d', path: '#e6dccb', patio: '#ddd3c0',
        bedFill: '#9c7457', bedStroke: '#6e4f3a', building: '#c9b38f', buildingStroke: '#7c6648',
        glass: '#e3ece1', glassStroke: '#7f9a86', water: '#4f6d7a', canopy: 'rgba(125,154,94,.5)',
        canopyStroke: '#5d7a4d', fence: '#7c6648', label: '#3c3427', selection: '#b5643c',
      },
    },
    dark: {
      ui: {
        bg: '#1b1f19', surface: '#232920', surface2: '#2b3227', text: '#ece6d6', muted: '#b3ad9c',
        border: '#343c30', accent: '#a9c98f', accentText: '#172012', link: '#b9d6a0',
        selectedBg: '#33402c', selectedText: '#d6e9c6', chrome: '#232920', chromeText: '#ece6d6',
        chromeMuted: '#b3ad9c', warnBg: '#3a2a1c', warnBorder: '#6b4a2c', warnText: '#f2c9a2', decor: '#e0946a',
      },
      plan: {
        paper: '#20251e', lawn: '#2c3727', lawnAlt: '#364330', path: '#3a372f', patio: '#34302a',
        bedFill: '#4f3a2d', bedStroke: '#7d5d45', building: '#5c4e3c', buildingStroke: '#8a7458',
        glass: '#2c3a35', glassStroke: '#6f8f86', water: '#3f6170', canopy: 'rgba(111,143,85,.35)',
        canopyStroke: '#8fb075', fence: '#8a7458', label: '#ece6d6', selection: '#e0946a',
      },
    },
  },

  heritage: {
    id: 'heritage',
    name: 'Heritage',
    summary: 'A Victorian walled garden, drawn like an estate survey.',
    fonts: {
      display: "'Playfair Display', Georgia, serif",
      body: "'EB Garamond', Georgia, serif",
      plan: "'Playfair Display', Georgia, serif",
    },
    title: { italic: false, smallCaps: true, uppercase: false, weight: 400, tracking: '.1em' },
    shape: {
      radius: '3px',
      radiusCard: '2px',
      shadow: '0 16px 36px rgba(40,36,20,.22)',
      shadowDark: '0 16px 36px rgba(0,0,0,.5)',
    },
    home: 'framed',
    photo: { filter: 'sepia(.38) saturate(.85) contrast(.96)', marginOpacity: 0.28, marginBlur: 3 },
    focusByDefault: false,
    plan: { bedRadiusMm: 0, pattern: 'hatch', labels: 'serif' },
    light: {
      ui: {
        bg: '#f1e8d2', surface: '#f8f1de', surface2: '#e6dcc0', text: '#2a2a1f', muted: '#5e5642',
        border: '#b9ab88', accent: '#1f3d2b', accentText: '#f8f1de', link: '#1f3d2b',
        selectedBg: '#e6dcc0', selectedText: '#1f3d2b', chrome: '#1f3d2b', chromeText: '#f1e8d2',
        chromeMuted: '#d8cfb4', warnBg: '#f6e3d9', warnBorder: '#8c3b2a', warnText: '#6e2c1f', decor: '#a8823a',
      },
      plan: {
        paper: '#f8f1de', lawn: '#ecebd3', lawnAlt: '#8f9670', path: '#f3efdf', patio: '#efe6cf',
        bedFill: '#e8dcc0', bedStroke: '#2a2a1f', building: '#e8dcc0', buildingStroke: '#2a2a1f',
        glass: '#f3efdf', glassStroke: '#2a2a1f', water: '#f3efdf', canopy: 'rgba(76,90,60,.25)',
        canopyStroke: '#2a2a1f', fence: '#2a2a1f', label: '#2a2a1f', selection: '#8c3b2a',
      },
    },
    dark: {
      ui: {
        bg: '#13201a', surface: '#1a2a22', surface2: '#22342a', text: '#eadfc2', muted: '#bfb393',
        border: '#3a4a3f', accent: '#c9a65a', accentText: '#13201a', link: '#d9bd7c',
        selectedBg: '#22342a', selectedText: '#eadfc2', chrome: '#0e1813', chromeText: '#eadfc2',
        chromeMuted: '#a99e80', warnBg: '#2a1b16', warnBorder: '#e08a72', warnText: '#f0b6a6', decor: '#c9a65a',
      },
      plan: {
        paper: '#18261e', lawn: '#1f3127', lawnAlt: '#6f8466', path: '#22342a', patio: '#23332a',
        bedFill: '#2a3a2e', bedStroke: '#eadfc2', building: '#2a3a2e', buildingStroke: '#eadfc2',
        glass: '#1e2d26', glassStroke: '#eadfc2', water: '#1e2d26', canopy: 'rgba(143,167,125,.25)',
        canopyStroke: '#eadfc2', fence: '#eadfc2', label: '#eadfc2', selection: '#e08a72',
      },
    },
  },

  allotment: {
    id: 'allotment',
    name: 'Allotment',
    summary: 'An old seed packet and enamel plot signs. Practical and well used.',
    fonts: {
      display: "'Zilla Slab', Georgia, serif",
      body: "'Work Sans', " + SYSTEM,
      plan: "'Stardos Stencil', 'Zilla Slab', serif",
    },
    title: { italic: false, smallCaps: false, uppercase: true, weight: 600, tracking: '.06em' },
    shape: {
      radius: '6px',
      radiusCard: '4px',
      shadow: '0 10px 24px rgba(60,45,20,.22)',
      shadowDark: '0 10px 24px rgba(0,0,0,.45)',
    },
    home: 'packet',
    photo: { filter: 'saturate(.9) sepia(.12)', marginOpacity: 0.45, marginBlur: 6 },
    focusByDefault: false,
    plan: { bedRadiusMm: 40, pattern: 'stripes', labels: 'sign' },
    light: {
      ui: {
        bg: '#e9dcc1', surface: '#f6efe0', surface2: '#efe4cc', text: '#2a251e', muted: '#5c5142',
        border: '#cdbd9c', accent: '#2b5753', accentText: '#f6efe0', link: '#2b5753',
        selectedBg: '#2b5753', selectedText: '#f6efe0', chrome: '#f6efe0', chromeText: '#2a251e',
        chromeMuted: '#5c5142', warnBg: '#f3e2d6', warnBorder: '#e3c2b2', warnText: '#5e2419', decor: '#8e3626',
      },
      plan: {
        paper: '#f6efe0', lawn: '#b3bf8f', lawnAlt: '#aab786', path: '#c7ad86', patio: '#d9cbb0',
        bedFill: '#7a5640', bedStroke: '#4f3828', building: '#6f8a85', buildingStroke: '#3f514e',
        glass: '#e6ece4', glassStroke: '#7a8c86', water: '#6f8a85', canopy: 'rgba(125,143,90,.45)',
        canopyStroke: '#5b6b40', fence: '#5b4a36', label: '#3a2e22', selection: '#8e3626',
      },
    },
    dark: {
      ui: {
        bg: '#1e1a15', surface: '#2a241d', surface2: '#352e25', text: '#efe4cc', muted: '#bfb197',
        border: '#4a3f31', accent: '#5f9f96', accentText: '#10201d', link: '#8fcfc4',
        selectedBg: '#5f9f96', selectedText: '#10201d', chrome: '#2a241d', chromeText: '#efe4cc',
        chromeMuted: '#bfb197', warnBg: '#3d2620', warnBorder: '#6e3a2c', warnText: '#f3cfc3', decor: '#e39a83',
      },
      plan: {
        paper: '#2a241d', lawn: '#2e3524', lawnAlt: '#2a3121', path: '#4a3e2e', patio: '#3a3226',
        bedFill: '#4a3426', bedStroke: '#7a5a44', building: '#3f5552', buildingStroke: '#6f8a85',
        glass: '#26302c', glassStroke: '#6f8a85', water: '#3f5552', canopy: 'rgba(111,128,80,.35)',
        canopyStroke: '#8fa067', fence: '#8a7458', label: '#efe4cc', selection: '#e39a83',
      },
    },
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    summary: 'Clean and contemporary, with the photo front and centre.',
    fonts: {
      display: "'Manrope', " + SYSTEM,
      body: "'Manrope', " + SYSTEM,
      plan: "'Manrope', " + SYSTEM,
    },
    title: { italic: false, smallCaps: false, uppercase: false, weight: 800, tracking: '-.03em' },
    shape: {
      radius: '12px',
      radiusCard: '22px',
      shadow: '0 24px 60px rgba(10,20,15,.2)',
      shadowDark: '0 24px 60px rgba(0,0,0,.55)',
    },
    home: 'sheet',
    photo: { filter: 'none', marginOpacity: 0.9, marginBlur: 22 },
    focusByDefault: false,
    plan: { bedRadiusMm: 160, pattern: 'flat', labels: 'pill' },
    light: {
      ui: {
        bg: '#f3f5f2', surface: '#ffffff', surface2: '#f1f3f0', text: '#16181a', muted: '#5d6560',
        border: '#e3e7e3', accent: '#16181a', accentText: '#ffffff', link: '#187a42',
        selectedBg: '#16181a', selectedText: '#ffffff', chrome: '#ffffff', chromeText: '#16181a',
        chromeMuted: '#5d6560', warnBg: '#fff4e5', warnBorder: '#ffe0b2', warnText: '#7a3d00', decor: '#2fb36b',
      },
      plan: {
        paper: '#ffffff', lawn: '#e2efdf', lawnAlt: '#d6e8d2', path: '#f3f4f1', patio: '#eceeea',
        bedFill: '#ffffff', bedStroke: '#2fb36b', building: '#d9dde0', buildingStroke: '#c3c9cd',
        glass: '#dcebf7', glassStroke: '#9cc0dd', water: '#7aa6c6', canopy: 'rgba(47,179,107,.2)',
        canopyStroke: 'rgba(47,179,107,.2)', fence: '#b8c2bb', label: '#16181a', selection: '#187a42',
      },
    },
    dark: {
      ui: {
        bg: '#111413', surface: '#181c1a', surface2: '#1f2421', text: '#f1f4f2', muted: '#9aa39e',
        border: '#2a302d', accent: '#4fd18a', accentText: '#08130d', link: '#6fe0a1',
        selectedBg: '#f1f4f2', selectedText: '#111413', chrome: '#111413', chromeText: '#f1f4f2',
        chromeMuted: '#9aa39e', warnBg: '#2e2210', warnBorder: '#4a3615', warnText: '#ffd9a3', decor: '#4fd18a',
      },
      plan: {
        paper: '#181c1a', lawn: '#1c2a20', lawnAlt: '#213126', path: '#262b28', patio: '#202422',
        bedFill: '#151917', bedStroke: '#4fd18a', building: '#2c3230', buildingStroke: '#3a423e',
        glass: '#1c2a36', glassStroke: '#4a7394', water: '#3b6a8a', canopy: 'rgba(79,209,138,.14)',
        canopyStroke: 'rgba(79,209,138,.14)', fence: '#3a423e', label: '#f1f4f2', selection: '#a6f0c6',
      },
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    summary: 'Calm and focused. The plan first, photos kept small.',
    fonts: { display: SYSTEM, body: SYSTEM, plan: MONO },
    title: { italic: false, smallCaps: false, uppercase: false, weight: 600, tracking: '-.02em' },
    shape: {
      radius: '8px',
      radiusCard: '12px',
      shadow: 'none',
      shadowDark: 'none',
    },
    home: 'band',
    photo: { filter: 'saturate(.85)', marginOpacity: 0, marginBlur: 0 },
    focusByDefault: true,
    plan: { bedRadiusMm: 0, pattern: 'line', labels: 'caps' },
    light: {
      ui: {
        bg: '#ffffff', surface: '#ffffff', surface2: '#f0f0ee', text: '#16181a', muted: '#5c605e',
        border: '#e3e3e0', accent: '#16181a', accentText: '#ffffff', link: '#1f6b43',
        selectedBg: '#f0f0ee', selectedText: '#16181a', chrome: '#ffffff', chromeText: '#16181a',
        chromeMuted: '#5c605e', warnBg: '#fff8ef', warnBorder: '#e6c9a3', warnText: '#6b3a10', decor: '#1f6b43',
      },
      plan: {
        paper: '#ffffff', lawn: '#ffffff', lawnAlt: '#f6f6f4', path: '#ffffff', patio: '#ffffff',
        bedFill: '#ffffff', bedStroke: '#3b3d3c', building: '#ffffff', buildingStroke: '#3b3d3c',
        glass: '#ffffff', glassStroke: '#3b3d3c', water: '#ffffff', canopy: 'rgba(0,0,0,0)',
        canopyStroke: '#3b3d3c', fence: '#3b3d3c', label: '#5c605e', selection: '#1f6b43',
      },
    },
    dark: {
      ui: {
        bg: '#141515', surface: '#1b1c1c', surface2: '#2a2c2b', text: '#e8eae9', muted: '#9a9e9c',
        border: '#2f3130', accent: '#e8eae9', accentText: '#141515', link: '#7fd4a5',
        selectedBg: '#2a2c2b', selectedText: '#e8eae9', chrome: '#141515', chromeText: '#e8eae9',
        chromeMuted: '#9a9e9c', warnBg: '#221a10', warnBorder: '#5c4526', warnText: '#f0c98f', decor: '#6cc795',
      },
      plan: {
        paper: '#181919', lawn: '#181919', lawnAlt: '#101111', path: '#181919', patio: '#181919',
        bedFill: '#181919', bedStroke: '#c9ccca', building: '#181919', buildingStroke: '#c9ccca',
        glass: '#181919', glassStroke: '#c9ccca', water: '#181919', canopy: 'rgba(0,0,0,0)',
        canopyStroke: '#c9ccca', fence: '#c9ccca', label: '#a3a7a5', selection: '#6cc795',
      },
    },
  },
};

/** CSS custom properties for a look in a mode, applied to <html> or a preview card. */
export function themeVars(look: Look, mode: Mode): Record<string, string> {
  const { ui, plan } = look[mode];
  const vars: Record<string, string> = {
    '--font-display': look.fonts.display,
    '--font-body': look.fonts.body,
    '--font-plan': look.fonts.plan,
    '--title-style': look.title.italic ? 'italic' : 'normal',
    '--title-variant': look.title.smallCaps ? 'small-caps' : 'normal',
    '--title-transform': look.title.uppercase ? 'uppercase' : 'none',
    '--title-weight': String(look.title.weight),
    '--title-tracking': look.title.tracking,
    '--radius': look.shape.radius,
    '--radius-card': look.shape.radiusCard,
    '--shadow': mode === 'dark' ? look.shape.shadowDark : look.shape.shadow,
    '--photo-filter': mode === 'dark' ? `${look.photo.filter === 'none' ? '' : look.photo.filter} brightness(.82)`.trim() : look.photo.filter,
    '--photo-margin-opacity': String(look.photo.marginOpacity),
    '--photo-margin-blur': `${look.photo.marginBlur}px`,
  };
  for (const [k, v] of Object.entries(ui)) vars[`--${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(plan)) vars[`--plan-${kebab(k)}`] = v;
  return vars;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
