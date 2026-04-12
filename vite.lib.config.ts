import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/webgpu/engine/index.ts'),
      name: 'WebGPUEngine',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist/engine',
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      external: ['fbx-parser'],
    },
  },
});
