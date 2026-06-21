/** Combine multiple images into one PDF (pdf-lib). JPEG/PNG embed natively; other
 *  formats (WebP/GIF/BMP/AVIF) are decoded on a canvas and re-encoded to JPEG. */
import { PDFDocument, type PDFImage } from 'pdf-lib';
import { fitRect, resolvePageSize } from './page-sizes';
import { bytesToImageData } from '../codecs/canvas';
import { encodeJpeg } from '../codecs/jpeg';
import { throwIfAborted, type AbortLike } from '../util/errors';
import type { FitMode, ImagesToPdfResult, OnProgress, Orientation, PageSize } from '../types';

export interface ImagesToPdfParams {
  pageSize: PageSize;
  fit: FitMode;
  orientation: Orientation;
  margin: number;
  jpegWasmUrl: string;
}

export interface NamedImage {
  name: string;
  bytes: Uint8Array;
}

function isJpeg(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
function isPng(b: Uint8Array): boolean {
  return b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

export async function buildPdfFromImages(
  items: NamedImage[],
  params: ImagesToPdfParams,
  onProgress?: OnProgress,
  signal?: AbortLike,
): Promise<ImagesToPdfResult> {
  const out = await PDFDocument.create();
  const skipped: string[] = [];
  const total = items.length;
  const margin = Math.max(0, params.margin || 0);

  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);
    const { name, bytes } = items[i];
    try {
      let image: PDFImage;
      if (isJpeg(bytes)) {
        image = await out.embedJpg(bytes);
      } else if (isPng(bytes)) {
        image = await out.embedPng(bytes);
      } else {
        const imageData = await bytesToImageData(bytes, { fillWhite: true });
        const jpeg = await encodeJpeg(imageData, 90, params.jpegWasmUrl);
        image = await out.embedJpg(jpeg);
      }
      const imgW = image.width;
      const imgH = image.height;
      const { width: pw, height: ph } = resolvePageSize(params.pageSize, params.orientation, imgW, imgH);
      const page = out.addPage([pw, ph]);
      const boxW = Math.max(1, pw - margin * 2);
      const boxH = Math.max(1, ph - margin * 2);
      const rect =
        params.pageSize === 'fit'
          ? { x: 0, y: 0, width: boxW, height: boxH }
          : fitRect(imgW, imgH, boxW, boxH, params.fit);
      page.drawImage(image, {
        x: margin + rect.x,
        y: margin + rect.y,
        width: rect.width,
        height: rect.height,
      });
    } catch {
      skipped.push(name);
    }
    onProgress?.({ phase: 'assemble', done: i + 1, total, label: `画像を追加中… ${i + 1} / ${total}` });
  }

  const bytes = await out.save();
  return { bytes, pages: out.getPageCount(), skipped };
}
