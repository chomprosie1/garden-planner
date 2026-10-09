// The app's version and the day it was built, put in by Vite (vite.config.ts) from package.json. The version goes
// up with each release: 0.release.fix.

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';

/** "Version 0.20.0 · 9 Oct 2026". */
export function versionText(version = APP_VERSION, built = BUILD_DATE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(built)) return `Version ${version}`;
  // Read and shown as the same calendar day, wherever the reader is.
  const day = new Date(`${built}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `Version ${version} · ${day}`;
}
