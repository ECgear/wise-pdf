/**
 * Text-preserving compression: downsample + re-encode embedded JPEG (DCTDecode)
 * images in place via pdf-lib's low-level object model. Text, fonts and vectors
 * are never touched, so the output keeps selectable text.
 *
 * MVP scope: only DCTDecode images are recompressed. Other filters (FlateDecode,
 * JPX/JPEG2000, CCITT/JBIG2) are left untouched — the 'maximum' (rasterize) level
 * is the path for shrinking those. Every per-image step is guarded so a decode/
 * encode failure simply skips that image rather than corrupting the PDF.
 */
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { isRecompressibleJpeg, listImageStreams } from './pdf-images';
import { bytesToImageData } from '../codecs/canvas';
import { encodeJpeg } from '../codecs/jpeg';
import { throwIfAborted, type AbortLike } from '../util/errors';
import type { OnProgress } from '../types';

export interface RecompressParams {
  dpiCap: number;
  jpegQuality: number;
  jpegWasmUrl: string;
}

export interface RecompressResult {
  bytes: Uint8Array;
  pages: number;
  notes: string[];
}

export async function recompressImages(
  input: Uint8Array,
  params: RecompressParams,
  onProgress?: OnProgress,
  signal?: AbortLike,
): Promise<RecompressResult> {
  const doc = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: false });
  const all = listImageStreams(doc);
  const targets = all.filter(isRecompressibleJpeg);
  const skippedOther = all.length - targets.length;

  // Cap the longest image side at roughly (dpiCap × A4 long edge in inches).
  const maxSide = Math.round(params.dpiCap * 11.7);
  const total = targets.length;
  let replaced = 0;

  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);
    const info = targets[i];
    try {
      const original = info.stream.contents;
      const imageData = await bytesToImageData(original, { maxSide, fillWhite: true });
      const jpeg = await encodeJpeg(imageData, params.jpegQuality, params.jpegWasmUrl);
      if (jpeg.byteLength < original.length) {
        const dict = info.stream.dict;
        dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
        dict.set(PDFName.of('Width'), PDFNumber.of(imageData.width));
        dict.set(PDFName.of('Height'), PDFNumber.of(imageData.height));
        dict.set(PDFName.of('Length'), PDFNumber.of(jpeg.length));
        dict.delete(PDFName.of('DecodeParms'));
        dict.delete(PDFName.of('Decode'));
        doc.context.assign(info.ref, PDFRawStream.of(dict, jpeg));
        replaced++;
      }
    } catch {
      // leave this image untouched on any error — never corrupt the document
    }
    onProgress?.({ phase: 'encode', done: i + 1, total, label: `画像を再圧縮中… ${i + 1} / ${total}` });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  const notes: string[] = [];
  if (replaced) notes.push(`${replaced} 個の画像を再圧縮しました（文字はそのまま保持）`);
  if (skippedOther) notes.push(`${skippedOther} 個の画像はJPEG以外のため変更していません`);
  if (!replaced && !skippedOther) notes.push('再圧縮できる画像が見つかりませんでした（テキスト主体のPDFの可能性）');
  else if (!replaced) notes.push('すでに最適化済みのため画像は変更していません');
  return { bytes, pages: doc.getPageCount(), notes };
}
