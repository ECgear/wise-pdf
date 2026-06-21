import type { EstimateResult, WisePdfLevel } from '../types';

export interface EstimateInput {
  originalSize: number;
  /** total bytes of recompressible embedded images detected in the PDF */
  imageBytes: number;
  level: WisePdfLevel;
}

/**
 * Rough output-size estimate. Pure + deterministic so it is unit-testable.
 *
 * For 'recompress' levels, only the image portion shrinks (by a per-level
 * factor); the non-image remainder (text/vectors/structure) is kept. For
 * 'maximum' (rasterize) the whole document is replaced by page images, so we
 * estimate from the original size with a flat factor.
 */
export function estimateCompressedSize(input: EstimateInput): EstimateResult {
  const { originalSize, level } = input;
  const imageBytes = Math.max(0, Math.min(input.imageBytes, originalSize));
  const nonImage = Math.max(0, originalSize - imageBytes);

  // per-level shrink factor applied to the image portion (recompress levels)
  const imageFactor: Record<WisePdfLevel, number> = { low: 0.7, recommended: 0.5, maximum: 0.4 };

  let estimatedSize: number;
  let confidence: EstimateResult['confidence'];

  if (level === 'maximum') {
    // rasterization replaces everything; ratio is hard to predict precisely
    estimatedSize = Math.round(originalSize * 0.35);
    confidence = 'low';
  } else {
    estimatedSize = Math.round(nonImage + imageBytes * imageFactor[level]);
    const imageShare = originalSize ? imageBytes / originalSize : 0;
    confidence = imageShare > 0.6 ? 'high' : imageShare > 0.25 ? 'med' : 'low';
  }

  // never claim it grows; floor at a small fraction to avoid absurd values
  estimatedSize = Math.max(Math.min(estimatedSize, originalSize), Math.round(originalSize * 0.05));
  return { estimatedSize, confidence };
}
