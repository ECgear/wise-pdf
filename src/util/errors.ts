import type { WisePdfErrorCode } from '../types';

export class WisePdfError extends Error {
  code: WisePdfErrorCode;
  constructor(code: WisePdfErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'WisePdfError';
    this.code = code;
  }
}

/** Map an arbitrary thrown value to a stable error code + reason string. */
export function toErrorInfo(err: unknown): { code: WisePdfErrorCode; reason: string } {
  if (err instanceof WisePdfError) return { code: err.code, reason: err.message };
  const msg = err instanceof Error ? err.message : String(err);
  const low = msg.toLowerCase();
  if (low.includes('password') || low.includes('encrypted')) return { code: 'encrypted', reason: msg };
  if (low.includes('too-large') || low.includes('too large')) return { code: 'too-large', reason: msg };
  if (low.includes('invalid pdf') || low.includes('corrupt') || low.includes('xref')) {
    return { code: 'corrupt', reason: msg };
  }
  if (low.includes('memory') || low.includes('allocation')) return { code: 'oom', reason: msg };
  if (low.includes('abort') || low.includes('cancel')) return { code: 'cancelled', reason: msg };
  return { code: 'internal', reason: msg };
}

/** Minimal abort interface — satisfied by AbortSignal and by the worker's id-based checker. */
export interface AbortLike {
  readonly aborted: boolean;
}

export function throwIfAborted(signal?: AbortLike): void {
  if (signal?.aborted) throw new WisePdfError('cancelled', 'operation was cancelled');
}
