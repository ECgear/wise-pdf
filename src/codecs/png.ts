/** Lossless PNG output via oxipng (@jsquash/oxipng). WASM URL injected by consumer. */
import optimise, { init } from '@jsquash/oxipng/optimise';

type LooseInit = (...args: unknown[]) => Promise<unknown>;

let ready: Promise<unknown> | null = null;

export function initOxipng(wasmUrl: string): Promise<unknown> {
  if (!ready) ready = (init as LooseInit)(wasmUrl);
  return ready;
}

/** Encode ImageData to optimized (lossless) PNG bytes. */
export async function encodePng(image: ImageData, wasmUrl: string, level = 3): Promise<Uint8Array> {
  await initOxipng(wasmUrl);
  const buf = await optimise(image, { level });
  return new Uint8Array(buf);
}
