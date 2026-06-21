/**
 * Maximum compression: render each page to a JPEG and rebuild a one-image-per-page
 * PDF. Smallest output, but text is no longer selectable (it becomes part of the
 * image). The UI warns about this; the result reports textPreserved = false.
 */
import { PDFDocument } from 'pdf-lib';
import { loadDocument, renderPageToImageData } from '../render/pdfjs';
import { encodeJpeg } from '../codecs/jpeg';
import { throwIfAborted, type AbortLike } from '../util/errors';
import type { OnProgress } from '../types';

export interface RasterizeParams {
  dpi: number;
  jpegQuality: number;
  jpegWasmUrl: string;
}

export interface RasterizeResult {
  bytes: Uint8Array;
  pages: number;
  notes: string[];
}

export async function rasterizePdf(
  input: Uint8Array,
  params: RasterizeParams,
  onProgress?: OnProgress,
  signal?: AbortLike,
): Promise<RasterizeResult> {
  const src = await loadDocument(input);
  try {
    const out = await PDFDocument.create();
    const total = src.numPages;
    for (let n = 1; n <= total; n++) {
      throwIfAborted(signal);
      const { imageData, widthPt, heightPt } = await renderPageToImageData(src, n, params.dpi);
      const jpeg = await encodeJpeg(imageData, params.jpegQuality, params.jpegWasmUrl);
      const embedded = await out.embedJpg(jpeg);
      const page = out.addPage([widthPt, heightPt]);
      page.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
      onProgress?.({ phase: 'encode', done: n, total, page: n, label: `ページを変換中… ${n} / ${total}` });
    }
    const bytes = await out.save();
    return { bytes, pages: total, notes: ['全ページを画像化しました（文字の選択・検索はできません）'] };
  } finally {
    await src.destroy();
  }
}
