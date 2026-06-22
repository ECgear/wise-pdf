/** pdf.js (pdfjs-dist) setup + page rendering, used inside the engine worker. */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

let workerConfigured = false;

/** Point pdf.js at the consumer-provided, same-origin worker bundle. */
export function configurePdfjs(pdfWorkerUrl: string): void {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

/**
 * pdf.js builds its default canvas/filter factories around `document`, which
 * does not exist in a Web Worker. Those defaults only bite on pages that need an
 * intermediate canvas (transparency groups, soft masks, tiling patterns, Type3
 * glyphs) or a soft-mask/blend filter — which is why a trivial image-only PDF
 * renders fine while a real text- or mask-heavy PDF throws
 * "Cannot read properties of undefined (reading 'createElement')".
 *
 * We hand pdf.js worker-safe replacements: OffscreenCanvas for scratch canvases,
 * and a no-op filter factory that mirrors pdf.js's own NodeFilterFactory.
 */
interface CanvasAndContext {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

class OffscreenCanvasFactory {
  #willReadFrequently: boolean;
  constructor(opts: { enableHWA?: boolean } = {}) {
    // mirror pdf.js: read-back canvases are faster without hardware acceleration
    this.#willReadFrequently = !opts.enableHWA;
  }
  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: this.#willReadFrequently });
    if (!context) throw new Error('OffscreenCanvas 2d context unavailable');
    return { canvas, context };
  }
  reset(cc: CanvasAndContext, width: number, height: number): void {
    if (!cc.canvas) throw new Error('Canvas is not specified');
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc: CanvasAndContext): void {
    if (cc.canvas) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    }
    cc.canvas = null;
    cc.context = null;
  }
}

/**
 * No-op filter factory (same behavior as pdf.js's NodeFilterFactory). SVG/CSS
 * filters can't be built without a document, so soft-mask/blend filter effects
 * are skipped rather than crashing the worker.
 */
class NoopFilterFactory {
  addFilter(): string {
    return 'none';
  }
  addHCMFilter(): string {
    return 'none';
  }
  addAlphaFilter(): string {
    return 'none';
  }
  addLuminosityFilter(): string {
    return 'none';
  }
  addHighlightHCMFilter(): string {
    return 'none';
  }
  destroy(): void {
    /* nothing to release */
  }
}

export async function loadDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
  const task = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    // We run inside a Web Worker (no `document`): draw glyphs as vector paths
    // instead of installing CSS @font-face, and skip system-font probing. Both
    // of those default paths reach for `document` and would otherwise throw.
    disableFontFace: true,
    useSystemFonts: false,
    // Worker-safe factories (see note above); the DOM-based defaults need `document`.
    CanvasFactory: OffscreenCanvasFactory,
    FilterFactory: NoopFilterFactory,
  });
  return task.promise;
}

export interface RenderedPage {
  imageData: ImageData;
  /** page size in PDF points (unscaled) */
  widthPt: number;
  heightPt: number;
}

/** Render one (1-based) page to ImageData at the given DPI. */
export async function renderPageToImageData(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  try {
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });
    const base = page.getViewport({ scale: 1 });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const imageData = ctx.getImageData(0, 0, width, height);
    return { imageData, widthPt: base.width, heightPt: base.height };
  } finally {
    page.cleanup();
  }
}
