/** Main-thread client: wraps the engine worker in a promise-based API. */
import type {
  CompressOptions,
  CompressResult,
  CreateWisePdfOptions,
  EstimateResult,
  ImagesToPdfOptions,
  ImagesToPdfResult,
  JpgPage,
  OnProgress,
  PdfToJpgOptions,
  WisePdf,
  WisePdfLevel,
} from './types';
import type {
  CompressDoneRes,
  EstimateDoneRes,
  Img2PdfDoneRes,
  Pdf2JpgDoneRes,
  WorkerRequest,
  WorkerResponse,
} from './protocol';
import { toUint8Array } from './util/bytes';
import { WisePdfError } from './util/errors';
import { zipStore } from './zip';

interface RequestOpts {
  onProgress?: OnProgress;
  signal?: AbortSignal;
}

export function createWisePdf(options: CreateWisePdfOptions): WisePdf {
  const { worker, assets } = options;
  worker.postMessage({ type: 'configure', assets } satisfies WorkerRequest);
  let seq = 0;

  function request<R extends WorkerResponse>(
    build: (id: number) => { req: WorkerRequest; transfer?: Transferable[] },
    opts?: RequestOpts,
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const id = ++seq;
      const onMessage = (ev: MessageEvent<WorkerResponse>) => {
        const d = ev.data;
        if (!d || (d as { id?: number }).id !== id) return;
        if (d.type === 'progress') {
          opts?.onProgress?.({ phase: d.phase, done: d.done, total: d.total, page: d.page, label: d.label });
          return;
        }
        cleanup();
        if (d.type === 'error') reject(new WisePdfError(d.code, d.reason));
        else resolve(d as R);
      };
      const onAbort = () => {
        try {
          worker.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
        } catch {
          /* worker may already be gone */
        }
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        opts?.signal?.removeEventListener('abort', onAbort);
      };
      worker.addEventListener('message', onMessage);
      if (opts?.signal) {
        if (opts.signal.aborted) onAbort();
        else opts.signal.addEventListener('abort', onAbort);
      }
      const { req, transfer } = build(id);
      worker.postMessage(req, transfer ?? []);
    });
  }

  // Copy input into a standalone ArrayBuffer so transferring it never neuters the caller's data.
  async function bufferOf(input: ArrayBuffer | Uint8Array | Blob): Promise<ArrayBuffer> {
    const u = await toUint8Array(input);
    return u.slice().buffer;
  }

  const api: WisePdf = {
    async compressPdf(input, opts: CompressOptions = {}): Promise<CompressResult> {
      const buffer = await bufferOf(input);
      const r = await request<CompressDoneRes>(
        (id) => ({ req: { type: 'compress', id, buffer, level: opts.level ?? 'recommended' }, transfer: [buffer] }),
        opts,
      );
      return {
        bytes: new Uint8Array(r.out),
        originalSize: r.originalSize,
        newSize: r.newSize,
        ratio: r.originalSize ? r.newSize / r.originalSize : 1,
        textPreserved: r.textPreserved,
        pages: r.pages,
        notes: r.notes,
      };
    },

    async estimateCompression(input, level: WisePdfLevel): Promise<EstimateResult> {
      const buffer = await bufferOf(input);
      const r = await request<EstimateDoneRes>((id) => ({
        req: { type: 'estimate', id, buffer, level },
        transfer: [buffer],
      }));
      return { estimatedSize: r.estimatedSize, confidence: r.confidence };
    },

    async pdfToJpg(input, opts: PdfToJpgOptions = {}): Promise<JpgPage[]> {
      const buffer = await bufferOf(input);
      const r = await request<Pdf2JpgDoneRes>(
        (id) => ({
          req: { type: 'pdf2jpg', id, buffer, dpi: opts.dpi ?? 150, quality: opts.quality ?? 80, pages: opts.pages },
          transfer: [buffer],
        }),
        opts,
      );
      return r.pages.map((p) => ({
        page: p.page,
        blob: new Blob([p.out], { type: p.mime }),
        width: p.width,
        height: p.height,
      }));
    },

    async pdfToJpgZip(input, opts: PdfToJpgOptions = {}): Promise<Blob> {
      const pages = await api.pdfToJpg(input, opts);
      const entries = await Promise.all(
        pages.map(async (p) => ({
          name: `page-${String(p.page).padStart(3, '0')}.jpg`,
          bytes: new Uint8Array(await p.blob.arrayBuffer()),
        })),
      );
      return new Blob([zipStore(entries) as BlobPart], { type: 'application/zip' });
    },

    async imagesToPdf(files, opts: ImagesToPdfOptions = {}): Promise<ImagesToPdfResult> {
      const named = await Promise.all(
        files.map(async (f, i) => {
          const u = await toUint8Array(f);
          const name = typeof File !== 'undefined' && f instanceof File && f.name ? f.name : `image-${i + 1}`;
          return { name, buffer: u.slice().buffer };
        }),
      );
      const buffers = named.map((n) => n.buffer);
      const names = named.map((n) => n.name);
      // only send serializable options across the worker boundary
      const sendOpts: ImagesToPdfOptions = {
        pageSize: opts.pageSize,
        fit: opts.fit,
        orientation: opts.orientation,
        margin: opts.margin,
      };
      const r = await request<Img2PdfDoneRes>(
        (id) => ({ req: { type: 'img2pdf', id, buffers, names, opts: sendOpts }, transfer: buffers }),
        opts,
      );
      return { bytes: new Uint8Array(r.out), pages: r.pages, skipped: r.skipped };
    },

    dispose(): void {
      worker.terminate();
    },
  };

  return api;
}
