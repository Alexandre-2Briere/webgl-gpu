import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lib': resolve(__dirname, 'src/lib'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@engine': resolve(__dirname, 'dist/engine/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/webgpu/engine/tests/**/*.test.ts'],
    setupFiles: ['src/webgpu/engine/tests/setup.ts'],
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'demo-webgpu': resolve(__dirname, 'demos/webgpu/index.html'),
      },
    },
  },
});
