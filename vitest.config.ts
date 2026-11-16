import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep jsdom/AG Grid test runs within the memory budget of developer machines and CI.
  test: { maxWorkers: 1 },
});
