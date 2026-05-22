import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lab: resolve(__dirname, 'llm-lab.html'),
        toolkit: resolve(__dirname, 'enhanced-toolkit.html'),
      },
    },
  },
});
