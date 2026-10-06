// Fonts are self-hosted (all Open Font License) and loaded per look, so a
// visitor only downloads the fonts of the look they use.

import type { LookId } from './looks';

const loaders: Record<LookId, () => Promise<unknown>> = {
  cottage: () =>
    Promise.all([
      import('@fontsource/libre-baskerville/400.css'),
      import('@fontsource/libre-baskerville/400-italic.css'),
      import('@fontsource/libre-baskerville/700.css'),
      import('@fontsource/source-sans-3/400.css'),
      import('@fontsource/source-sans-3/600.css'),
      import('@fontsource/source-sans-3/700.css'),
      import('@fontsource/caveat/700.css'),
    ]),
  heritage: () =>
    Promise.all([
      import('@fontsource/playfair-display/400.css'),
      import('@fontsource/playfair-display/400-italic.css'),
      import('@fontsource/playfair-display/600.css'),
      import('@fontsource/eb-garamond/400.css'),
      import('@fontsource/eb-garamond/400-italic.css'),
      import('@fontsource/eb-garamond/500.css'),
      import('@fontsource/eb-garamond/600.css'),
    ]),
  allotment: () =>
    Promise.all([
      import('@fontsource/zilla-slab/500.css'),
      import('@fontsource/zilla-slab/500-italic.css'),
      import('@fontsource/zilla-slab/600.css'),
      import('@fontsource/zilla-slab/700.css'),
      import('@fontsource/work-sans/400.css'),
      import('@fontsource/work-sans/500.css'),
      import('@fontsource/work-sans/600.css'),
      import('@fontsource/stardos-stencil/700.css'),
    ]),
  modern: () =>
    Promise.all([
      import('@fontsource/manrope/500.css'),
      import('@fontsource/manrope/600.css'),
      import('@fontsource/manrope/700.css'),
      import('@fontsource/manrope/800.css'),
    ]),
  minimal: () => Promise.resolve(), // system fonts only
};

const loaded = new Map<LookId, Promise<unknown>>();

export function loadLookFonts(id: LookId): Promise<unknown> {
  let p = loaded.get(id);
  if (!p) {
    p = loaders[id]().catch(() => undefined); // a missing font falls back to the next in the stack
    loaded.set(id, p);
  }
  return p;
}

/** Fonts and their licences, for the Credits page. */
export const FONT_CREDITS = [
  { name: 'Libre Baskerville', author: 'Impallari Type', licence: 'SIL Open Font License 1.1' },
  { name: 'Source Sans 3', author: 'Paul D. Hunt, Adobe', licence: 'SIL Open Font License 1.1' },
  { name: 'Caveat', author: 'Impallari Type', licence: 'SIL Open Font License 1.1' },
  { name: 'Playfair Display', author: 'Claus Eggers Sørensen', licence: 'SIL Open Font License 1.1' },
  { name: 'EB Garamond', author: 'Georg Duffner, Octavio Pardo', licence: 'SIL Open Font License 1.1' },
  { name: 'Zilla Slab', author: 'Typotheque for Mozilla', licence: 'SIL Open Font License 1.1' },
  { name: 'Work Sans', author: 'Wei Huang', licence: 'SIL Open Font License 1.1' },
  { name: 'Stardos Stencil', author: 'Vernon Adams', licence: 'SIL Open Font License 1.1' },
  { name: 'Manrope', author: 'Mikhail Sharanda', licence: 'SIL Open Font License 1.1' },
];
