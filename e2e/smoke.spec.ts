import { expect, test } from '@playwright/test';

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
