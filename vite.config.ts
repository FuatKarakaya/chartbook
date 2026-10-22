/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  // One entry per page (PLAN.md: Chart, Cycles, Seasonality, DCA).
  build: { outDir: '../dist/web', emptyOutDir: true, rolldownOptions: { input: ['web/index.html', 'web/cycles.html', 'web/seasonality.html', 'web/dca.html'] } },
  test: { root: '.' },
});
