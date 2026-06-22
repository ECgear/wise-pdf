/** Compression orchestrator: pick the strategy for the chosen level and run it. */
import { levelParams } from './levels';
import { recompressImages } from './recompress-images';
import { rasterizePdf } from './rasterize';
import type { AbortLike } from '../util/errors';
import type { OnProgress, WisePdfLevel } from '../types';

export interface CompressParams {
  level: WisePdfLevel;
  jpegWasmUrl: string;
}

export interface CompressOutput {
  bytes: Uint8Array;
  originalSize: number;
  newSize: number;
  textPreserved: boolean;
  pages: number;
  notes: string[];
}

export async function compress(
  input: Uint8Array,
  params: CompressParams,
  onProgress?: OnProgress,
  signal?: AbortLike,
): Promise<CompressOutput> {
  const lp = levelParams(params.level);
  const originalSize = input.byteLength;
  // The rasterize path hands `input` to pdf.js, which transfers (and detaches)
  // its ArrayBuffer. Keep an intact copy for the "never enlarge" fallback below.
  // recompress (pdf-lib) copies internally and leaves `input` usable.
  const original = lp.strategy === 'rasterize' ? input.slice() : input;

  const result =
    lp.strategy === 'rasterize'
      ? await rasterizePdf(
          input,
          { dpi: lp.dpiCap, jpegQuality: lp.jpegQuality, jpegWasmUrl: params.jpegWasmUrl },
          onProgress,
          signal,
        )
      : await recompressImages(
          input,
          { dpiCap: lp.dpiCap, jpegQuality: lp.jpegQuality, jpegWasmUrl: params.jpegWasmUrl },
          onProgress,
          signal,
        );

  let bytes = result.bytes;
  let textPreserved = lp.textPreserved;
  const notes = [...result.notes];

  // Never hand back something larger than the input. This matters most on
  // `maximum`, where rasterizing an already-compact text PDF can *grow* it —
  // returning the original also keeps its selectable text and vector content.
  if (bytes.byteLength >= originalSize) {
    bytes = original;
    textPreserved = true;
    // Drop notes about the discarded (larger) result — e.g. the rasterize note
    // would wrongly claim the text was flattened when we kept the original.
    notes.length = 0;
    notes.push('元のPDFより小さくできなかったため、そのまま返しました');
  }

  return {
    bytes,
    originalSize,
    newSize: bytes.byteLength,
    textPreserved,
    pages: result.pages,
    notes,
  };
}
