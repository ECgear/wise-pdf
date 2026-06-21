/**
 * @ecgear/wise-pdf — privacy-first, in-browser PDF toolkit.
 *
 * 100% client-side: compress PDFs (3 levels), export PDF pages to JPG, and combine
 * images into a PDF. No file is ever uploaded. The consumer supplies the Web Worker
 * and the same-origin WASM / pdf.js worker URLs (the @jsquash injection pattern):
 *
 *   import { createWisePdf } from '@ecgear/wise-pdf';
 *   import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
 *   import oxipngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
 *   import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
 *
 *   const wp = createWisePdf({
 *     worker: new Worker(new URL('@ecgear/wise-pdf/worker', import.meta.url), { type: 'module' }),
 *     assets: { jpegWasmUrl: jpegWasm, oxipngWasmUrl: oxipngWasm, pdfWorkerUrl: pdfWorker },
 *   });
 *   const { bytes } = await wp.compressPdf(file, { level: 'recommended' });
 */
export { createWisePdf } from './worker-client';

export { LEVELS, DEFAULT_LEVEL, levelParams } from './compress/levels';
export type { LevelParams, CompressStrategy } from './compress/levels';

export { WisePdfError } from './util/errors';
export { fmtBytes, savedPercent } from './util/bytes';

// Low-level, pure helpers — handy for building custom UIs (and unit-testable).
export { resolvePageSize, fitRect, PAGE_DIMENSIONS_PT, PT_PER_INCH } from './build/page-sizes';
export type { Rect } from './build/page-sizes';
export { estimateCompressedSize } from './util/estimate';
export type { EstimateInput } from './util/estimate';

export type {
  WisePdf,
  WisePdfLevel,
  WisePdfAssets,
  WisePdfErrorCode,
  CreateWisePdfOptions,
  CompressOptions,
  CompressResult,
  EstimateResult,
  PdfToJpgOptions,
  JpgPage,
  PageSize,
  FitMode,
  Orientation,
  ImagesToPdfOptions,
  ImagesToPdfResult,
  ProgressEvent,
  ProgressPhase,
  OnProgress,
} from './types';
