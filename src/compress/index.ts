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
  const notes = [...result.notes];

  // On the text-preserving levels, never hand back something larger than the input.
  if (lp.strategy === 'recompress' && bytes.byteLength >= originalSize) {
    bytes = input;
    notes.push('元のPDFの方が小さいため、そのまま返しました');
  }

  return {
    bytes,
    originalSize,
    newSize: bytes.byteLength,
    textPreserved: lp.textPreserved,
    pages: result.pages,
    notes,
  };
}
