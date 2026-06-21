/**
 * Engine Web Worker. The consumer instantiates this module as a worker:
 *   new Worker(new URL('@ecgear/wise-pdf/worker', import.meta.url), { type: 'module' })
 * and sends a 'configure' message (with the same-origin WASM / pdf.js worker URLs)
 * before any job. All heavy PDF/image work happens here, off the UI thread.
 */
import { PDFDocument } from 'pdf-lib';
import type { ProgressEvent, WisePdfAssets } from './types';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { compress } from './compress';
import { buildPdfFromImages } from './build/images-to-pdf';
import { listImageStreams, sumImageBytes } from './compress/pdf-images';
import { configurePdfjs, loadDocument, renderPageToImageData } from './render/pdfjs';
import { encodeJpeg } from './codecs/jpeg';
import { estimateCompressedSize } from './util/estimate';
import { toErrorInfo, WisePdfError } from './util/errors';

// Minimal dedicated-worker scope (avoids pulling the WebWorker lib, which would
// clash with DOM globals like `self`/`postMessage` during typecheck).
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (ev: MessageEvent<WorkerRequest>) => void): void;
}
const ctx = globalThis as unknown as WorkerScope;

let assets: WisePdfAssets | null = null;
const cancelled = new Set<number>();

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function progressFor(id: number) {
  return (e: ProgressEvent): void =>
    post({ type: 'progress', id, phase: e.phase, done: e.done, total: e.total, page: e.page, label: e.label });
}

function abortFor(id: number) {
  return {
    get aborted(): boolean {
      return cancelled.has(id);
    },
  };
}

ctx.addEventListener('message', async (ev: MessageEvent<WorkerRequest>): Promise<void> => {
  const msg = ev.data;
  if (!msg) return;

  if (msg.type === 'configure') {
    assets = msg.assets;
    configurePdfjs(assets.pdfWorkerUrl);
    return;
  }
  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }

  const id = msg.id;
  try {
    if (!assets) throw new WisePdfError('internal', 'engine not configured');
    const a = assets;

    switch (msg.type) {
      case 'compress': {
        const input = new Uint8Array(msg.buffer);
        const r = await compress(
          input,
          { level: msg.level, jpegWasmUrl: a.jpegWasmUrl },
          progressFor(id),
          abortFor(id),
        );
        const out = r.bytes.slice().buffer;
        post(
          {
            type: 'done:compress',
            id,
            out,
            originalSize: r.originalSize,
            newSize: r.newSize,
            textPreserved: r.textPreserved,
            pages: r.pages,
            notes: r.notes,
          },
          [out],
        );
        break;
      }

      case 'estimate': {
        const input = new Uint8Array(msg.buffer);
        const doc = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: false });
        const imageBytes = sumImageBytes(listImageStreams(doc));
        const est = estimateCompressedSize({ originalSize: input.byteLength, imageBytes, level: msg.level });
        post({ type: 'done:estimate', id, estimatedSize: est.estimatedSize, confidence: est.confidence });
        break;
      }

      case 'pdf2jpg': {
        const input = new Uint8Array(msg.buffer);
        const doc = await loadDocument(input);
        try {
          const numPages = doc.numPages;
          const wanted = (msg.pages && msg.pages.length
            ? msg.pages
            : Array.from({ length: numPages }, (_, i) => i + 1)
          ).filter((n) => n >= 1 && n <= numPages);
          const pages: Array<{ page: number; out: ArrayBuffer; mime: string; width: number; height: number }> = [];
          const transfers: Transferable[] = [];
          const onProgress = progressFor(id);
          for (let idx = 0; idx < wanted.length; idx++) {
            if (cancelled.has(id)) throw new WisePdfError('cancelled', 'cancelled');
            const n = wanted[idx];
            const { imageData } = await renderPageToImageData(doc, n, msg.dpi);
            const jpeg = await encodeJpeg(imageData, msg.quality, a.jpegWasmUrl);
            const ab = jpeg.slice().buffer;
            pages.push({ page: n, out: ab, mime: 'image/jpeg', width: imageData.width, height: imageData.height });
            transfers.push(ab);
            onProgress({ phase: 'encode', done: idx + 1, total: wanted.length, page: n, label: `ページ ${n} を画像化中…` });
          }
          post({ type: 'done:pdf2jpg', id, pages }, transfers);
        } finally {
          await doc.destroy();
        }
        break;
      }

      case 'img2pdf': {
        const items = msg.buffers.map((b, i) => ({
          name: msg.names[i] ?? `image-${i + 1}`,
          bytes: new Uint8Array(b),
        }));
        const o = msg.opts;
        const r = await buildPdfFromImages(
          items,
          {
            pageSize: o.pageSize ?? 'fit',
            fit: o.fit ?? 'contain',
            orientation: o.orientation ?? 'auto',
            margin: o.margin ?? 0,
            jpegWasmUrl: a.jpegWasmUrl,
          },
          progressFor(id),
          abortFor(id),
        );
        if (r.pages === 0) throw new WisePdfError('unsupported', '画像を1枚もPDFに追加できませんでした');
        const out = r.bytes.slice().buffer;
        post({ type: 'done:img2pdf', id, out, pages: r.pages, skipped: r.skipped }, [out]);
        break;
      }
    }
  } catch (err) {
    const { code, reason } = toErrorInfo(err);
    post({ type: 'error', id, code, reason });
  } finally {
    cancelled.delete(id);
  }
});
