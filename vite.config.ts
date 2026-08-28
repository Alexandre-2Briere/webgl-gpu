import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['engine/tests/**/*.test.ts'],
    setupFiles: ['engine/tests/setup.ts'],
  },
});
