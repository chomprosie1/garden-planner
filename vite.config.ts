import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Served from https://chomprosie1.github.io/garden-planner/
export default defineConfig({
  base: '/garden-planner/',
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
