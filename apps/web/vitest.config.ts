import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // chains.ts 是純函式，用 node；reports/favorites 需要 localStorage，用 jsdom
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      include: [
        'lib/chains.ts',
        'lib/reports.ts',
        'lib/favorites.ts',
      ],
      exclude: [
        'lib/api.ts',
        'lib/mock-data.ts',
        'lib/maplibre.ts',
        'lib/image.ts',
        'lib/flags.ts',
      ],
    },
  },
});
