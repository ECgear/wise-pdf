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

export async function loadDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
  const task = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    // keep everything local; do not fetch standard fonts/cmaps from a CDN
    disableFontFace: false,
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
