// Makes the app's icons (a sprout on garden green) for the browser tab, the
// home screen and the install prompt: public/icon.svg and PNGs in public/icons/.
// Run with: npm run icons

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..', 'public');

/** The sprout itself, on a 512 square. */
const SPROUT = `
  <path d="M256 404V262" stroke="#f4ecd8" stroke-width="30" stroke-linecap="round"/>
  <path d="M256 282c0-78 54-132 140-132 0 88-54 132-140 132z" fill="#f4ecd8"/>
  <path d="M256 318c0-64-44-108-118-108 0 72 44 108 118 108z" fill="#cfe2ad"/>
  <path d="M146 404h220" stroke="#c9a46e" stroke-width="26" stroke-linecap="round"/>`;

/** Rounded, for tabs and the iPhone home screen. */
const ROUNDED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#4a6b3a"/>${SPROUT}</svg>`;

/** Full bleed with the sprout in the middle 80%, for Android, which crops it to its own shape. */
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#4a6b3a"/><g transform="translate(51.2 51.2) scale(0.8)">${SPROUT}</g></svg>`;

mkdirSync(join(ROOT, 'icons'), { recursive: true });
writeFileSync(join(ROOT, 'icon.svg'), ROUNDED);
const png = (svg: string, size: number, name: string) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ROOT, 'icons', name));
await Promise.all([
  png(ROUNDED, 192, 'icon-192.png'),
  png(ROUNDED, 512, 'icon-512.png'),
  png(MASKABLE, 512, 'maskable-512.png'),
  png(ROUNDED, 180, 'apple-touch-icon.png'),
]);
console.log('Icons made in public/icons/');
