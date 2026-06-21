import type { WisePdfLevel } from '../types';

export type CompressStrategy = 'recompress' | 'rasterize';

export interface LevelParams {
  /**
   * 'recompress' downsamples + re-encodes embedded images while keeping text
   * and vectors selectable. 'rasterize' renders each page to a single image
   * (smallest output, but text is no longer selectable).
   */
  strategy: CompressStrategy;
  /** images whose effective resolution exceeds this are downsampled to it (DPI) */
  dpiCap: number;
  /** mozjpeg quality used when (re-)encoding images, 1..100 */
  jpegQuality: number;
  /** whether selectable text survives this level */
  textPreserved: boolean;
}

/** Single source of truth for the three compression levels. */
export const LEVELS: Record<WisePdfLevel, LevelParams> = {
  low: { strategy: 'recompress', dpiCap: 200, jpegQuality: 82, textPreserved: true },
  recommended: { strategy: 'recompress', dpiCap: 150, jpegQuality: 72, textPreserved: true },
  maximum: { strategy: 'rasterize', dpiCap: 120, jpegQuality: 60, textPreserved: false },
};

export const DEFAULT_LEVEL: WisePdfLevel = 'recommended';

export function levelParams(level: WisePdfLevel | undefined): LevelParams {
  return LEVELS[level ?? DEFAULT_LEVEL] ?? LEVELS[DEFAULT_LEVEL];
}
