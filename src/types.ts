/**
 * Public types for @ecgear/wise-pdf.
 *
 * The engine is 100% client-side. Heavy work runs in a Web Worker; the consumer
 * supplies the Worker instance and the same-origin WASM / pdf.js worker URLs
 * (the proven @jsquash injection pattern) so nothing is ever fetched from a CDN.
 */

export type WisePdfLevel = 'low' | 'recommended' | 'maximum';

export type ProgressPhase = 'parse' | 'decode' | 'encode' | 'assemble';

export interface ProgressEvent {
  phase: ProgressPhase;
  /** items completed so far (0..total) */
  done: number;
  total: number;
  /** 1-based page number, when the phase is per-page */
  page?: number;
  /** human-readable status line for the UI */
  label?: string;
}

export type OnProgress = (e: ProgressEvent) => void;

export type WisePdfErrorCode =
  | 'too-large'
  | 'encrypted'
  | 'corrupt'
  | 'unsupported'
  | 'oom'
  | 'cancelled'
  | 'internal';

/* ---------- Compress ---------- */

export interface CompressOptions {
  /** default: 'recommended' */
  level?: WisePdfLevel;
  onProgress?: OnProgress;
  signal?: AbortSignal;
}

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  newSize: number;
  /** newSize / originalSize (1 = no change) */
  ratio: number;
  /** false when the level rasterized pages (text is no longer selectable) */
  textPreserved: boolean;
  pages: number;
  /** human-readable notes, e.g. "2 JPEG2000 images were left unchanged" */
  notes: string[];
}

export interface EstimateResult {
  estimatedSize: number;
  confidence: 'low' | 'med' | 'high';
}

/* ---------- PDF -> JPG ---------- */

export interface PdfToJpgOptions {
  /** render resolution; default 150 */
  dpi?: number;
  /** mozjpeg quality 1..100; default 80 */
  quality?: number;
  /** 1-based page numbers; default all pages */
  pages?: number[];
  onProgress?: OnProgress;
  signal?: AbortSignal;
}

export interface JpgPage {
  page: number;
  blob: Blob;
  width: number;
  height: number;
}

/* ---------- Images -> PDF ---------- */

export type PageSize = 'a4' | 'letter' | 'fit';
export type FitMode = 'contain' | 'cover' | 'actual';
export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface ImagesToPdfOptions {
  /** 'fit' = each page matches its image's size; default 'fit' */
  pageSize?: PageSize;
  /** how the image is placed inside a fixed page; default 'contain' */
  fit?: FitMode;
  /** default 'auto' */
  orientation?: Orientation;
  /** page margin in points; default 0 */
  margin?: number;
  onProgress?: OnProgress;
  signal?: AbortSignal;
}

export interface ImagesToPdfResult {
  bytes: Uint8Array;
  pages: number;
  /** names/labels of inputs that could not be decoded and were skipped */
  skipped: string[];
}

/* ---------- Engine construction ---------- */

/** Same-origin asset URLs the consumer supplies (via their bundler's `?url`). */
export interface WisePdfAssets {
  /** @jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url */
  jpegWasmUrl: string;
  /** @jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url */
  oxipngWasmUrl: string;
  /** pdfjs-dist/build/pdf.worker.min.mjs?url */
  pdfWorkerUrl: string;
}

export interface CreateWisePdfOptions {
  /**
   * The Web Worker running the engine. The consumer must create it so its
   * bundler can detect and emit the worker chunk, e.g.:
   *   new Worker(new URL('@ecgear/wise-pdf/worker', import.meta.url), { type: 'module' })
   */
  worker: Worker;
  assets: WisePdfAssets;
}

export interface WisePdf {
  compressPdf(input: ArrayBuffer | Uint8Array | Blob, opts?: CompressOptions): Promise<CompressResult>;
  estimateCompression(input: ArrayBuffer | Uint8Array | Blob, level: WisePdfLevel): Promise<EstimateResult>;
  pdfToJpg(input: ArrayBuffer | Uint8Array | Blob, opts?: PdfToJpgOptions): Promise<JpgPage[]>;
  pdfToJpgZip(input: ArrayBuffer | Uint8Array | Blob, opts?: PdfToJpgOptions): Promise<Blob>;
  imagesToPdf(files: Array<File | Blob | ArrayBuffer>, opts?: ImagesToPdfOptions): Promise<ImagesToPdfResult>;
  /** terminate the worker and release resources */
  dispose(): void;
}
