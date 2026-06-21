/** mozjpeg (via @jsquash/jpeg) JPEG encoder. WASM URL is injected by the consumer. */
import encode, { init } from '@jsquash/jpeg/encode';

// jSquash init signatures differ slightly across codecs/versions; keep the call
// loose so we mirror the proven runtime usage without fighting the d.ts.
type LooseInit = (...args: unknown[]) => Promise<unknown>;

let ready: Promise<unknown> | null = null;

export function initJpeg(wasmUrl: string): Promise<unknown> {
  if (!ready) {
    ready = (init as LooseInit)({
      locateFile: (path: string) => (path === 'mozjpeg_enc.wasm' ? wasmUrl : path),
    });
  }
  return ready;
}

/** Encode ImageData to JPEG bytes at the given quality (1..100). */
export async function encodeJpeg(image: ImageData, quality: number, wasmUrl: string): Promise<Uint8Array> {
  await initJpeg(wasmUrl);
  const buf = await encode(image, { quality });
  return new Uint8Array(buf);
}
