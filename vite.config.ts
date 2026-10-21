/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  // One entry per page (PLAN.md: Chart, Cycles; Seasonality to come).
  build: { outDir: '../dist/web', emptyOutDir: true, rolldownOptions: { input: ['web/index.html', 'web/cycles.html'] } },
  test: { root: '.' },
});
