import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        webgl: './src/webgl/index.html',
        webgpu: './src/webgpu/index.html',
        "webgpu/calculator": './src/webgpu/modules/calculator/index.html',
      },
    },
  },
  server: {
    headers: command === 'serve' ? {} : {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
  }
}))