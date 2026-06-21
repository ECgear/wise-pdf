import { defineConfig } from 'vite';

// Standalone demo build (also deployable to GitHub Pages). Mirrors the make-good-life
// Astro/Vite setup: ES-module workers and jSquash/pdfjs WASM excluded from the dev
// pre-bundler (esbuild can't pre-bundle the `?url` WASM assets).
export default defineConfig({
  root: 'demo',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/oxipng', 'pdfjs-dist'],
  },
});
