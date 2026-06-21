---
type: Reference
title: wise pdf — Engine Internals
description: Technical reference for the three processing operations, compression level parameters, WASM/worker injection model, and known limitations in wise pdf v0.1.
---

# wise pdf — Engine Internals

This document describes how the three core operations work internally, the parameters governing each compression level, the consumer-injection model for WASM and Worker URLs, and the honest limitations of the v0.1 engine.

---

## Operations

### 1. Images → PDF (`imagesToPdf`)

The engine iterates over the supplied image files in order. For each file:

- JPEG and JPEG-like inputs are embedded directly via **pdf-lib's `embedJpg`**.
- PNG inputs use **pdf-lib's `embedPng`**.
- All other formats (WebP, GIF, BMP, etc.) fall back to a **canvas path**: the image is decoded via `createImageBitmap`, drawn to an `OffscreenCanvas`, and exported as a PNG blob before embedding via `embedPng`.

Each embedded image is placed on its own page. Page sizing is determined by the `pageSize` option:

| `pageSize` | Behavior |
|---|---|
| `'fit'` | Page dimensions match the image dimensions exactly (1px = 1pt) |
| `'a4'` | Image is scaled to fit within 595 × 842 pt (A4), preserving aspect ratio |
| `'letter'` | Image is scaled to fit within 612 × 792 pt (US Letter), preserving aspect ratio |

Files that cannot be decoded (unsupported format, corrupt data) are silently recorded in the `skipped` return array rather than aborting the operation.

---

### 2. PDF → JPG (`pdfToJpg`, `pdfToJpgZip`)

Each page is processed sequentially:

1. **pdf.js** renders the page to an **`OffscreenCanvas`** at the requested DPI. The scale factor is `dpi / 72` (pdf.js uses 72 DPI as its internal unit).
2. The canvas bitmap is read back as raw pixel data via `getImageData`.
3. **mozjpeg** (compiled to WebAssembly via `@jsquash/jpeg`) re-encodes the pixels as a JPEG at quality 82.
4. The resulting `Blob` (type `image/jpeg`) is returned per page.

`pdfToJpgZip` passes all page blobs through **fflate** to produce a single `application/zip` blob, with filenames `page-001.jpg`, `page-002.jpg`, etc.

---

### 3. Compress PDF (`compressPdf`)

Compression behaviour differs substantially between the text-preserving levels and `maximum`.

#### `low` and `recommended` — in-place DCT image re-encode (text preserved)

The engine walks the PDF's cross-reference table using **pdf-lib** to find every image XObject. Only images with a **DCTDecode** (JPEG) filter are processed; all other filter types (FlateDecode/PNG, JPEG2000, CCITT, JBIG2) are left untouched.

For each eligible JPEG image object:

1. The raw DCT stream is decoded via **pdf-lib's** low-level stream API.
2. If the image's intrinsic pixel dimensions exceed the DPI cap for the chosen level, the image is **downsampled** via `OffscreenCanvas` / `createImageBitmap` before re-encoding.
3. **mozjpeg** re-encodes the (possibly downsampled) bitmap at the level's JPEG quality setting.
4. The compressed stream replaces the original stream bytes in the pdf-lib document object in-place. The PDF's text layer, fonts, vector graphics, and structure are not touched.

Because only pixel data inside image objects is modified, the output PDF retains selectable and searchable text.

#### `maximum` — full-page rasterization (text becomes part of the image)

Each page is rendered by **pdf.js** to an `OffscreenCanvas` at 120 DPI (the `maximum` DPI cap). The resulting bitmap is re-encoded by **mozjpeg** at quality 60. A new single-page PDF is constructed by **pdf-lib** containing only that JPEG image scaled to the original page dimensions. All pages are merged into one output document.

Because the entire page becomes a JPEG, text is no longer selectable or searchable in the output.

---

## Compression level parameters

| Level | DPI cap | JPEG quality | Text preserved | Notes |
|---|---|---|---|---|
| `low` | 200 dpi | 82 | Yes | Mild re-encode only; quality-first |
| `recommended` | 150 dpi | 72 | Yes | Default; balanced size/quality |
| `maximum` | 120 dpi | 60 | **No** | Full rasterization; smallest output |

These values are the single source of truth in the codebase at `src/compress/levels.ts`.

---

## Consumer-injection model for WASM and Worker URLs

wise pdf does not bundle WASM binaries or the pdf.js worker as inline assets. Instead, the consumer resolves them at build time using the bundler's `?url` suffix (the proven [@jsquash](https://github.com/nicolo-ribaudo/jSquash) pattern) and injects the resulting same-origin URLs at runtime:

```ts
import { createWisePdf } from '@ecgear/wise-pdf';
import jpegWasm   from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import oxipngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import pdfWorker  from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const wp = createWisePdf({
  worker: new Worker(new URL('@ecgear/wise-pdf/worker', import.meta.url), { type: 'module' }),
  assets: { jpegWasmUrl: jpegWasm, oxipngWasmUrl: oxipngWasm, pdfWorkerUrl: pdfWorker },
});
```

**Why this approach:**

- **CDN-free.** All WASM and script assets are served from the same origin as the application — no third-party CDN requests, no cross-origin WASM fetch complications.
- **Bundler-agnostic in principle.** Any bundler that supports `?url` and ES-module workers (Vite, Astro, Rollup + plugins, etc.) can supply the URLs. The library itself has no bundler dependency.
- **Correct WASM instantiation.** `WebAssembly.instantiateStreaming` requires the server to return the WASM file with `Content-Type: application/wasm`. Same-origin assets served by the dev server and production build both satisfy this; arbitrary CDN URLs may not.
- **Worker isolation.** The engine Web Worker is also injected by the consumer (`new Worker(new URL(...), { type: 'module' })`), keeping the worker path resolved by the consumer's bundler rather than hardcoded in the library.

All processing runs inside the injected Worker. The main thread communicates with it via a message protocol abstracted by `createWisePdf`. Calling `wp.dispose()` terminates the worker.

---

## Limitations

- Compression gains are most significant for image-heavy and scanned PDFs. Vector-only PDFs may shrink only modestly on `low`/`recommended`.
- In v0.1, `low` and `recommended` only re-encode **DCTDecode (JPEG)** image objects. FlateDecode (PNG), JPEG2000, CCITT, and JBIG2 image streams inside the PDF are not touched at those levels. Use `maximum` (with rasterization) to reduce the file size of PDFs that rely on those formats.
- `maximum` rasterizes every page: text and vector content are rendered to pixels and are no longer selectable or searchable in the output.
- HEIC image input is not bundled. Decoding is attempted via the browser's native `createImageBitmap`; support is browser-dependent and not guaranteed.
- Large PDFs on mobile devices can exceed browser memory limits, particularly during rasterization.
- pdf-lib is currently unmaintained upstream. Its use is isolated to `src/compress/recompress-images.ts` and `src/build/`, so the dependency can be swapped without changing the public API.
- Password-protected PDFs are not supported; the engine does not attempt decryption.
