import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // 重要功能要求 100% coverage
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      include: [
        'src/lib/**',        // slug, ipHash（純函式，100% 可達到）
        'src/middleware/validateImage.ts',  // magic bytes 驗證
      ],
      exclude: [
        'src/index.ts',      // Hono app entry（需 integration test）
        'src/routes/**',     // API routes（需 integration test）
        'src/queues/**',     // Queue consumers（需 integration test）
        'src/db/**',         // DB client（外部依賴）
        'src/types/**',
      ],
    },
  },
});
