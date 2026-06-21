/** createImageBitmap + OffscreenCanvas helpers (run inside the engine worker). */

export interface DecodeOptions {
  /** if the longest side exceeds this many pixels, downsample to it */
  maxSide?: number;
  /** flood the canvas white first (use before JPEG encode — JPEG has no alpha) */
  fillWhite?: boolean;
}

/** Decode encoded image bytes (any browser-supported format) to ImageData. */
export async function bytesToImageData(
  bytes: Uint8Array | ArrayBuffer,
  opts: DecodeOptions = {},
): Promise<ImageData> {
  const blob = new Blob([bytes as BlobPart]);
  const bitmap = await createImageBitmap(blob);
  try {
    return bitmapToImageData(bitmap, opts);
  } finally {
    bitmap.close();
  }
}

export function bitmapToImageData(bitmap: ImageBitmap, opts: DecodeOptions = {}): ImageData {
  let w = bitmap.width;
  let h = bitmap.height;
  const { maxSide, fillWhite } = opts;
  if (maxSide && Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  if (fillWhite) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
