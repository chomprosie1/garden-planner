import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// The version, from package.json (0.release.fix), and the day it was built, shown on the loading screen and in Settings.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Served from https://chomprosie1.github.io/garden-planner/
export default defineConfig({
  base: '/garden-planner/',
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // The day here, not in UTC: a build just after midnight is dated that day.
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('en-CA')),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
