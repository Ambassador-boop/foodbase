import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest, scoped to the pure logic.
 *
 * These suites test functions, not pages and not the database: no test in this
 * batch opens a connection, reads an environment variable or calls Paystack.
 * Anything that needs Postgres is covered by the rollback scripts in /tests/sql,
 * which the owner runs by hand on a Neon branch.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // The suites are pure and fast; a slow one means a test reached the network.
    testTimeout: 5000,
    reporters: ['default'],
  },
});
