/**
 * Pure helper for adaptive `maximum` rasterization. Kept free of heavy deps
 * (no pdf-lib / pdf.js) so it can be re-exported from the light main-thread
 * barrel and unit-tested without a browser.
 */

export interface RasterDpiOptions {
  /** aim for output ≈ ratio × input size when computing the next DPI (default 0.8) */
  ratio?: number;
  /** never go below this DPI — a readability / sanity floor (default 50) */
  minDpi?: number;
}

/**
 * Given the current render DPI and the byte size it produced, return the next
 * (lower) DPI to try so the rasterized PDF lands under `inputSize`.
 *
 * JPEG byte size scales roughly with pixel count (≈ DPI²), so we scale the DPI
 * by the square root of the desired size ratio. The result strictly decreases
 * and is clamped to `minDpi`. Intended to be called only while the current
 * output is still ≥ the input (i.e. rasterizing has not yet shrunk the file).
 */
export function targetRasterDpi(
  currentDpi: number,
  currentSize: number,
  inputSize: number,
  options: RasterDpiOptions = {},
): number {
  const ratio = options.ratio ?? 0.8;
  const minDpi = options.minDpi ?? 50;
  const factor = currentSize > 0 ? Math.sqrt((ratio * inputSize) / currentSize) : 1;
  const next = Math.floor(currentDpi * factor);
  // strictly decrease, but never below the floor
  return Math.max(minDpi, Math.min(next, currentDpi - 1));
}
