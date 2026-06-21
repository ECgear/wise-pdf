/** pdf-lib low-level helpers for finding/inspecting embedded image XObjects. */
import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFContext,
  type PDFDocument,
  type PDFObject,
} from 'pdf-lib';

const IMAGE = '/Image';
const DCT_DECODE = '/DCTDecode';

export interface ImageStreamInfo {
  ref: PDFRef;
  stream: PDFRawStream;
  width: number;
  height: number;
  filters: string[];
  /** colorspace as a name string when directly specified (e.g. '/DeviceRGB') */
  colorSpace: string | null;
  hasSMask: boolean;
  byteLength: number;
}

function resolve(ctx: PDFContext, v: PDFObject | undefined): PDFObject | undefined {
  return v instanceof PDFRef ? ctx.lookup(v) : v;
}

function numOf(ctx: PDFContext, dict: PDFDict, key: string): number | undefined {
  const r = resolve(ctx, dict.get(PDFName.of(key)));
  return r instanceof PDFNumber ? r.asNumber() : undefined;
}

function filterNames(ctx: PDFContext, dict: PDFDict): string[] {
  const f = resolve(ctx, dict.get(PDFName.of('Filter')));
  if (!f) return [];
  if (f instanceof PDFArray) {
    return f.asArray().map((x) => (resolve(ctx, x) ?? x).toString());
  }
  return [f.toString()];
}

function colorSpaceName(ctx: PDFContext, dict: PDFDict): string | null {
  const cs = resolve(ctx, dict.get(PDFName.of('ColorSpace')));
  if (cs instanceof PDFName) return cs.toString();
  return null; // arrays (Indexed/ICCBased/...) are not a plain name
}

export function isImageXObject(ctx: PDFContext, dict: PDFDict): boolean {
  const st = resolve(ctx, dict.get(PDFName.of('Subtype')));
  return st instanceof PDFName && st.toString() === IMAGE;
}

/** Enumerate every embedded image stream in the document. */
export function listImageStreams(doc: PDFDocument): ImageStreamInfo[] {
  const ctx = doc.context;
  const out: ImageStreamInfo[] = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (!isImageXObject(ctx, dict)) continue;
    out.push({
      ref,
      stream: obj,
      width: numOf(ctx, dict, 'Width') ?? 0,
      height: numOf(ctx, dict, 'Height') ?? 0,
      filters: filterNames(ctx, dict),
      colorSpace: colorSpaceName(ctx, dict),
      hasSMask: dict.get(PDFName.of('SMask')) !== undefined,
      byteLength: obj.contents.length,
    });
  }
  return out;
}

/** True when the image is a baseline/progressive JPEG (DCTDecode) we can safely re-encode. */
export function isRecompressibleJpeg(info: ImageStreamInfo): boolean {
  if (!info.filters.includes(DCT_DECODE)) return false;
  if (info.hasSMask) return false; // soft-masked images: leave untouched to avoid artifacts
  if (info.colorSpace === '/DeviceCMYK') return false; // browsers can't reliably decode CMYK JPEG
  return true;
}

export function sumImageBytes(infos: ImageStreamInfo[]): number {
  return infos.reduce((acc, i) => acc + i.byteLength, 0);
}
