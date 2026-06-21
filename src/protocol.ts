/** Web Worker message protocol (main thread <-> engine worker). Internal. */
import type {
  ImagesToPdfOptions,
  ProgressPhase,
  WisePdfAssets,
  WisePdfErrorCode,
  WisePdfLevel,
} from './types';

/* main -> worker */
export interface ConfigureMsg {
  type: 'configure';
  assets: WisePdfAssets;
}
export interface CompressReq {
  type: 'compress';
  id: number;
  buffer: ArrayBuffer;
  level: WisePdfLevel;
}
export interface EstimateReq {
  type: 'estimate';
  id: number;
  buffer: ArrayBuffer;
  level: WisePdfLevel;
}
export interface Pdf2JpgReq {
  type: 'pdf2jpg';
  id: number;
  buffer: ArrayBuffer;
  dpi: number;
  quality: number;
  pages?: number[];
}
export interface Img2PdfReq {
  type: 'img2pdf';
  id: number;
  buffers: ArrayBuffer[];
  names: string[];
  opts: ImagesToPdfOptions;
}
export interface CancelReq {
  type: 'cancel';
  id: number;
}
export type WorkerRequest =
  | ConfigureMsg
  | CompressReq
  | EstimateReq
  | Pdf2JpgReq
  | Img2PdfReq
  | CancelReq;

/* worker -> main */
export interface ProgressRes {
  type: 'progress';
  id: number;
  phase: ProgressPhase;
  done: number;
  total: number;
  page?: number;
  label?: string;
}
export interface CompressDoneRes {
  type: 'done:compress';
  id: number;
  out: ArrayBuffer;
  originalSize: number;
  newSize: number;
  textPreserved: boolean;
  pages: number;
  notes: string[];
}
export interface EstimateDoneRes {
  type: 'done:estimate';
  id: number;
  estimatedSize: number;
  confidence: 'low' | 'med' | 'high';
}
export interface Pdf2JpgDoneRes {
  type: 'done:pdf2jpg';
  id: number;
  pages: Array<{ page: number; out: ArrayBuffer; mime: string; width: number; height: number }>;
}
export interface Img2PdfDoneRes {
  type: 'done:img2pdf';
  id: number;
  out: ArrayBuffer;
  pages: number;
  skipped: string[];
}
export interface ErrorRes {
  type: 'error';
  id: number;
  reason: string;
  code: WisePdfErrorCode;
}
export type WorkerResponse =
  | ProgressRes
  | CompressDoneRes
  | EstimateDoneRes
  | Pdf2JpgDoneRes
  | Img2PdfDoneRes
  | ErrorRes;
