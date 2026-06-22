import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * A real *embedded* TrueType font is what reproduces the original worker crash:
 * with an embedded font present, pdf.js runs its font loader, which (before the
 * fix) called `document.createElement` from inside the Worker. We borrow
 * Liberation Sans — already shipped by pdfjs-dist — so nothing binary is
 * committed to this repo. (Non-embedded base-14 fonts do NOT trigger it.)
 */
const require_ = createRequire(import.meta.url);
const EMBEDDED_TTF = join(
  dirname(require_.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
  'LiberationSans-Regular.ttf',
);

/** A small RGBA (alpha-channel) PNG, so the embedded image also carries a soft mask. */
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Build a multi-page PDF with an embedded font and a soft-masked image, entirely
 * in Node (no committed binary fixture). The embedded font drives pdf.js's font
 * loader and the alpha image its soft-mask compositing — the worker-render paths
 * that reach for `document` and used to crash. Returns plain bytes for transport.
 */
async function buildTextPdf(pages: number): Promise<number[]> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(EMBEDDED_TTF));
  const png = await doc.embedPng(Buffer.from(TRANSPARENT_PNG_B64, 'base64'));
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`wise pdf worker-render regression — page ${p} of ${pages}.`, {
      x: 48,
      y: 780,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.12),
    });
    page.drawText('The quick brown fox jumps over the lazy dog. 0123456789.', {
      x: 48,
      y: 740,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    page.drawImage(png, { x: 48, y: 360, width: 320, height: 320, opacity: 0.5 });
  }
  return Array.from(await doc.save());
}

/** Drives the real engine in a real browser: images -> PDF -> compress / PDF -> JPG. */
test('all three features run in-browser end to end', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    interface Wp {
      imagesToPdf(
        files: File[],
        o?: Record<string, unknown>,
      ): Promise<{ bytes: Uint8Array; pages: number; skipped: string[] }>;
      compressPdf(
        b: Blob,
        o?: Record<string, unknown>,
      ): Promise<{ originalSize: number; newSize: number; textPreserved: boolean; pages: number }>;
      pdfToJpg(
        b: Blob,
        o?: Record<string, unknown>,
      ): Promise<Array<{ blob: Blob; width: number; height: number }>>;
    }
    const getEngine = async (): Promise<Wp> => {
      for (let i = 0; i < 80; i++) {
        const w = (window as unknown as { wisePdf?: Wp }).wisePdf;
        if (w) return w;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error('engine not exposed on window');
    };

    const wp = await getEngine();

    // build a detailed JPEG so recompression has something to shrink
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 700;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 900, 700);
    g.addColorStop(0, '#33aa88');
    g.addColorStop(1, '#ffccee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 900, 700);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 7) % 360},70%,${40 + (i % 30)}%)`;
      ctx.fillRect((i * 53) % 900, (i * 97) % 700, 24, 24);
    }
    const jpgBlob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.96));
    const jpgFile = new File([jpgBlob], 'test.jpg', { type: 'image/jpeg' });

    const made = await wp.imagesToPdf([jpgFile], { pageSize: 'a4', fit: 'contain' });
    const pdf = new Blob([made.bytes as BlobPart], { type: 'application/pdf' });
    const head = new TextDecoder().decode(made.bytes.slice(0, 5));

    const rec = await wp.compressPdf(pdf, { level: 'recommended' });
    const max = await wp.compressPdf(pdf, { level: 'maximum' });
    const jpgs = await wp.pdfToJpg(pdf, { dpi: 100, quality: 80 });

    return {
      head,
      pages: made.pages,
      skipped: made.skipped.length,
      recTextPreserved: rec.textPreserved,
      recSmaller: rec.newSize < rec.originalSize,
      maxTextPreserved: max.textPreserved,
      maxSmaller: max.newSize < max.originalSize,
      jpgCount: jpgs.length,
      jpgType: jpgs[0]?.blob.type,
      jpgWidth: jpgs[0]?.width ?? 0,
    };
  });

  expect(result.head).toBe('%PDF-');
  expect(result.pages).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.recTextPreserved).toBe(true);
  expect(result.recSmaller).toBe(true);
  expect(result.maxTextPreserved).toBe(false);
  expect(result.maxSmaller).toBe(true);
  expect(result.jpgCount).toBe(1);
  expect(result.jpgType).toBe('image/jpeg');
  expect(result.jpgWidth).toBeGreaterThan(0);
});

/**
 * Regression for the worker "Cannot read properties of undefined (reading
 * 'createElement')" crash: a real text + soft-mask PDF (not the trivial
 * image-only fixture above) must rasterize and convert to JPG without touching
 * `document` from inside the Web Worker.
 */
test('text & soft-mask PDF renders in the worker (regression: createElement)', async ({ page }) => {
  await page.goto('/');
  const pdfBytes = await buildTextPdf(3);

  const result = await page.evaluate(async (bytes) => {
    interface Wp {
      compressPdf(
        b: Blob,
        o?: Record<string, unknown>,
      ): Promise<{ originalSize: number; newSize: number; textPreserved: boolean; pages: number }>;
      pdfToJpg(
        b: Blob,
        o?: Record<string, unknown>,
      ): Promise<Array<{ blob: Blob; width: number; height: number }>>;
    }
    const getEngine = async (): Promise<Wp> => {
      for (let i = 0; i < 80; i++) {
        const w = (window as unknown as { wisePdf?: Wp }).wisePdf;
        if (w) return w;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error('engine not exposed on window');
    };

    const wp = await getEngine();
    const pdf = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });

    // Both of these threw inside the worker before the fix.
    const max = await wp.compressPdf(pdf, { level: 'maximum' });
    const jpgs = await wp.pdfToJpg(pdf, { dpi: 120, quality: 75 });

    return {
      maxPages: max.pages,
      maxTextPreserved: max.textPreserved,
      maxHasBytes: max.newSize > 0,
      jpgCount: jpgs.length,
      jpgType: jpgs[0]?.blob.type,
      jpgWidth: jpgs[0]?.width ?? 0,
      jpgHeight: jpgs[0]?.height ?? 0,
    };
  }, pdfBytes);

  expect(result.maxPages).toBe(3);
  // textPreserved is intentionally not asserted: the "never enlarge" guard may
  // return the original (text kept) when rasterizing wouldn't shrink this PDF.
  expect(result.maxHasBytes).toBe(true);
  expect(result.jpgCount).toBe(3);
  expect(result.jpgType).toBe('image/jpeg');
  expect(result.jpgWidth).toBeGreaterThan(0);
  expect(result.jpgHeight).toBeGreaterThan(0);
});
