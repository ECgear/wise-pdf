import { defineConfig } from 'tsup';

// Engine ships as clean ESM. Runtime deps (pdfjs-dist, pdf-lib, @jsquash/*, fflate)
// are externalized by tsup (they live in package.json "dependencies"), so the
// consuming bundler (Vite/Astro) resolves them and their WASM. The engine itself
// contains NO `?url` imports — WASM/worker URLs are injected by the consumer
// (the proven @jsquash pattern), which keeps everything same-origin / CDN-free.
export default defineConfig({
  entry: { index: 'src/index.ts', worker: 'src/worker.ts' },
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
