import { defineConfig } from 'vitest/config';

// Same suites as `npm test`, but against a real PostgreSQL (embedded, throwaway) through Prisma.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/pg-global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: { PG_TESTS: '1' },
  },
});
