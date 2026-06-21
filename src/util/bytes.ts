/** Byte/size helpers (pure, environment-agnostic). */

export async function toUint8Array(input: ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new TypeError('Unsupported input: expected ArrayBuffer, Uint8Array, or Blob');
}

/** Copy a Uint8Array into a standalone ArrayBuffer. */
export function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Saved-percent, clamped for display. Positive = smaller. */
export function savedPercent(originalSize: number, newSize: number): number {
  if (!originalSize) return 0;
  return Math.round(((originalSize - newSize) / originalSize) * 100);
}
