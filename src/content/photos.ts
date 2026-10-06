// Seasonal photos. Every entry is added by tools/add-photo.ts, which reads the
// licence from the source and refuses anything not on ALLOWED_LICENCES.
// tests/photos.test.ts checks this file and the image files on every build.

import manifest from './photos.json';

export const ALLOWED_LICENCES = ['Public domain', 'CC0', 'CC BY', 'CC BY-SA'] as const;

export interface SeasonPhoto {
  id: string;
  month: number;
  title: string;
  alt: string;
  author: string;
  licence: string; // e.g. "CC BY 2.0"
  licenceUrl: string;
  sourceUrl: string;
  /** Focal point as percentages, so crops keep the subject. */
  focus: [number, number];
  /** A colour taken from the photo: shown while it loads. */
  colour: string;
  widths: number[];
  changes: string; // what we did to it, for CC BY-SA
}

export const PHOTOS: SeasonPhoto[] = manifest as SeasonPhoto[];

export function photoForMonth(month: number): SeasonPhoto | undefined {
  return PHOTOS.find((p) => p.month === month);
}

/** Base family of a licence: "CC BY-SA 2.0" → "CC BY-SA". Matches tools/add-photo.ts. */
export function licenceFamily(licence: string): string {
  if (/^public domain/i.test(licence) || /^pd/i.test(licence)) return 'Public domain';
  if (/^cc0/i.test(licence)) return 'CC0';
  return licence.replace(/\s+\d+(\.\d+)?$/, '');
}

export function photoSrc(photo: SeasonPhoto, width: number, ext: 'avif' | 'webp'): string {
  return `${import.meta.env.BASE_URL}seasons/${photo.id}-${width}.${ext}`;
}

export function photoSrcSet(photo: SeasonPhoto, ext: 'avif' | 'webp'): string {
  return photo.widths.map((w) => `${photoSrc(photo, w, ext)} ${w}w`).join(', ');
}
