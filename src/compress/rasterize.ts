/**
 * Maximum compression: render each page to a JPEG and rebuild a one-image-per-page
 * PDF. Smallest output, but text is no longer selectable (it becomes part of the
 * image). For an already-compact text/vector PDF a single fixed DPI can produce a
 * *larger* file than the input, so we adaptively lower the DPI until the result is
 * smaller than the input (down to a floor). The UI warns about the text loss; the
 * result reports textPreserved = false.
 */
import { PDFDocument } from 'pdf-lib';
import { loadDocument, renderPageToImageData } from '../render/pdfjs';
import { encodeJpeg } from '../codecs/jpeg';
import { targetRasterDpi } from './raster-dpi';
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

const MIN_DPI = 50;
const TARGET_RATIO = 0.8;
const MAX_PASSES = 4;
const RASTERIZED_NOTE = '全ページを画像化しました（文字の選択・検索はできません）';

export async function rasterizePdf(
  input: Uint8Array,
  params: RasterizeParams,
  onProgress?: OnProgress,
  signal?: AbortLike,
): Promise<RasterizeResult> {
  // Capture before loadDocument: pdf.js transfers (detaches) the input buffer.
  const inputSize = input.byteLength;
  const src = await loadDocument(input);
  try {
    const total = src.numPages;

    const renderAllAtDpi = async (dpi: number, label: string): Promise<Uint8Array> => {
      const out = await PDFDocument.create();
      for (let n = 1; n <= total; n++) {
        throwIfAborted(signal);
        const { imageData, widthPt, heightPt } = await renderPageToImageData(src, n, dpi);
        const jpeg = await encodeJpeg(imageData, params.jpegQuality, params.jpegWasmUrl);
        const embedded = await out.embedJpg(jpeg);
        const page = out.addPage([widthPt, heightPt]);
        page.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
        onProgress?.({ phase: 'encode', done: n, total, page: n, label: `${label} ${n} / ${total}` });
      }
      return out.save();
    };

    let dpi = params.dpi;
    let bytes = await renderAllAtDpi(dpi, 'ページを変換中…');
    let reduced = false;

    // Compact text/vector PDFs can grow when rasterized. Step the DPI down until
    // the output is smaller than the input (or we hit the floor / pass budget),
    // so `maximum` always yields the smallest result instead of the original.
    for (let pass = 1; pass < MAX_PASSES && bytes.byteLength >= inputSize && dpi > MIN_DPI; pass++) {
      const next = targetRasterDpi(dpi, bytes.byteLength, inputSize, { ratio: TARGET_RATIO, minDpi: MIN_DPI });
      if (next >= dpi) break;
      dpi = next;
      reduced = true;
      bytes = await renderAllAtDpi(dpi, 'サイズ調整中…');
    }

    const notes = [RASTERIZED_NOTE];
    if (reduced) notes.push(`サイズ優先のため解像度を ${dpi}dpi に下げました`);
    return { bytes, pages: total, notes };
  } finally {
    await src.destroy();
  }
}
