/**
 * wise pdf — standalone demo controller.
 *
 * Creates the engine (consumer supplies the Worker + same-origin WASM/pdf.js URLs
 * via Vite's `?url`), and wires the three tabs. Nothing is uploaded.
 */
import { zipSync, type Zippable } from 'fflate';
import { createWisePdf, fmtBytes, savedPercent, WisePdfError } from '../../src/index';
import type { PageSize, WisePdfLevel } from '../../src/index';

import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import oxipngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const wp = createWisePdf({
  worker: new Worker(new URL('../../src/worker.ts', import.meta.url), { type: 'module' }),
  assets: { jpegWasmUrl: jpegWasm, oxipngWasmUrl: oxipngWasm, pdfWorkerUrl: pdfWorker },
});

// expose the engine in dev for quick console/automated checks
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).wisePdf = wp;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

function friendlyError(err: unknown): string {
  if (err instanceof WisePdfError) {
    switch (err.code) {
      case 'encrypted':
        return 'パスワード保護されたPDFには対応していません。';
      case 'corrupt':
        return 'PDFを読み込めませんでした。ファイルが壊れていないかご確認ください。';
      case 'too-large':
        return 'ファイルが大きすぎます。';
      case 'oom':
        return '処理中にメモリが不足しました。ページ数の少ないファイルでお試しください。';
      case 'unsupported':
        return '対応していない内容のため処理できませんでした。';
      case 'cancelled':
        return '処理を中止しました。';
      default:
        return `処理に失敗しました（${err.message}）。`;
    }
  }
  return `処理に失敗しました（${String(err)}）。`;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function setBusy(dropId: string, v: boolean): void {
  $(dropId)?.classList.toggle('is-busy', v);
}
function setStatus(id: string, text: string): void {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}
function showError(id: string, text: string): void {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
}
function clearError(id: string): void {
  const el = $(id);
  if (el) el.hidden = true;
}

interface DropOpts {
  dropId: string;
  inputId: string;
  pickId: string;
  onFiles: (files: File[]) => void;
}
function setupDropZone({ dropId, inputId, pickId, onFiles }: DropOpts): void {
  const drop = $(dropId);
  const input = $<HTMLInputElement>(inputId);
  const pick = $<HTMLButtonElement>(pickId);
  if (!drop || !input) return;

  pick?.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  drop.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    input.click();
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    if (input.files && input.files.length) {
      onFiles(Array.from(input.files));
      input.value = '';
    }
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    }),
  );
  ['dragleave', 'dragend', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && drop.contains((e as DragEvent).relatedTarget as Node)) return;
      drop.classList.remove('is-over');
    }),
  );
  drop.addEventListener('drop', (e) => {
    const files = Array.from((e as DragEvent).dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  });
}

/* ---------------- tabs ---------------- */
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) =>
      t.setAttribute('aria-selected', String(t === tab)),
    );
    document.querySelectorAll<HTMLElement>('.panel').forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });
  });
});

/* ---------------- compress ---------------- */
let compressLevel: WisePdfLevel = 'recommended';
let lastCompressBytes: Uint8Array | null = null;
let lastCompressName = 'compressed.pdf';

$('lvl-seg')
  ?.querySelectorAll<HTMLButtonElement>('[data-level]')
  .forEach((btn) => {
    btn.addEventListener('click', () => {
      compressLevel = (btn.dataset.level as WisePdfLevel) ?? 'recommended';
      $('lvl-seg')
        ?.querySelectorAll<HTMLButtonElement>('[data-level]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const warn = $('max-warn');
      if (warn) warn.hidden = compressLevel !== 'maximum';
    });
  });

async function runCompress(file: File): Promise<void> {
  clearError('c-error');
  const result = $('c-result');
  if (result) result.hidden = true;
  setBusy('c-drop', true);
  setStatus('c-status', '圧縮を準備中…');
  try {
    const r = await wp.compressPdf(file, {
      level: compressLevel,
      onProgress: (e) => setStatus('c-status', e.label ?? `処理中… ${e.done}/${e.total}`),
    });
    lastCompressBytes = r.bytes;
    lastCompressName = `${baseName(file.name)}-compressed.pdf`;
    const pct = savedPercent(r.originalSize, r.newSize);
    const notes = r.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
    const textNote = r.textPreserved
      ? ''
      : '<li>⚠ 文字は画像化されています（コピー・検索はできません）。</li>';
    if (result) {
      result.innerHTML = `
        <div class="result-head">圧縮しました（${r.pages}ページ）</div>
        <div class="sizes">
          <span class="before">${fmtBytes(r.originalSize)}</span>
          <span>→</span>
          <span class="after">${fmtBytes(r.newSize)}</span>
          <span class="pct ${pct > 0 ? 'good' : 'bad'}">${pct > 0 ? '−' + pct : '+' + -pct}%</span>
        </div>
        <ul class="notes">${notes}${textNote}</ul>
        <div class="dl-row"><button class="btn" id="c-dl">ダウンロード</button></div>`;
      result.hidden = false;
      $('c-dl')?.addEventListener('click', () => {
        if (lastCompressBytes) {
          downloadBlob(new Blob([lastCompressBytes as BlobPart], { type: 'application/pdf' }), lastCompressName);
        }
      });
    }
    if (lastCompressBytes) {
      downloadBlob(new Blob([lastCompressBytes as BlobPart], { type: 'application/pdf' }), lastCompressName);
    }
    setStatus('c-status', '');
  } catch (err) {
    showError('c-error', friendlyError(err));
    setStatus('c-status', '');
  } finally {
    setBusy('c-drop', false);
  }
}

setupDropZone({
  dropId: 'c-drop',
  inputId: 'c-file',
  pickId: 'c-pick',
  onFiles: (files) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      showError('c-error', 'PDFファイルを選んでください。');
      return;
    }
    void runCompress(pdf);
  },
});

/* ---------------- PDF -> JPG ---------------- */
let jpgDpi = 150;
$('dpi-seg')
  ?.querySelectorAll<HTMLButtonElement>('[data-dpi]')
  .forEach((btn) => {
    btn.addEventListener('click', () => {
      jpgDpi = Number(btn.dataset.dpi) || 150;
      $('dpi-seg')
        ?.querySelectorAll<HTMLButtonElement>('[data-dpi]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

async function runPdf2Jpg(file: File): Promise<void> {
  clearError('j-error');
  const result = $('j-result');
  if (result) result.hidden = true;
  setBusy('j-drop', true);
  setStatus('j-status', 'PDFを読み込み中…');
  try {
    const pages = await wp.pdfToJpg(file, {
      dpi: jpgDpi,
      quality: 82,
      onProgress: (e) => setStatus('j-status', e.label ?? `処理中… ${e.done}/${e.total}`),
    });
    // build a ZIP from the page blobs (already compressed -> store only)
    const entries: Zippable = {};
    const thumbs: string[] = [];
    for (const p of pages) {
      const buf = new Uint8Array(await p.blob.arrayBuffer());
      entries[`page-${String(p.page).padStart(3, '0')}.jpg`] = [buf, { level: 0 }];
      thumbs.push(URL.createObjectURL(p.blob));
    }
    const zip = zipSync(entries);
    const zipBlob = new Blob([zip as BlobPart], { type: 'application/zip' });
    if (result) {
      result.innerHTML = `
        <div class="result-head">${pages.length}ページをJPGに変換しました</div>
        <div class="thumbs">${thumbs.map((u) => `<img src="${u}" alt="" loading="lazy" />`).join('')}</div>
        <div class="dl-row"><button class="btn" id="j-dl">ZIPでダウンロード</button></div>`;
      result.hidden = false;
      $('j-dl')?.addEventListener('click', () =>
        downloadBlob(zipBlob, `${baseName(file.name)}-jpg.zip`),
      );
    }
    downloadBlob(zipBlob, `${baseName(file.name)}-jpg.zip`);
    setStatus('j-status', '');
  } catch (err) {
    showError('j-error', friendlyError(err));
    setStatus('j-status', '');
  } finally {
    setBusy('j-drop', false);
  }
}

setupDropZone({
  dropId: 'j-drop',
  inputId: 'j-file',
  pickId: 'j-pick',
  onFiles: (files) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      showError('j-error', 'PDFファイルを選んでください。');
      return;
    }
    void runPdf2Jpg(pdf);
  },
});

/* ---------------- images -> PDF ---------------- */
let imgPageSize: PageSize = 'fit';
$('size-seg')
  ?.querySelectorAll<HTMLButtonElement>('[data-size]')
  .forEach((btn) => {
    btn.addEventListener('click', () => {
      imgPageSize = (btn.dataset.size as PageSize) ?? 'fit';
      $('size-seg')
        ?.querySelectorAll<HTMLButtonElement>('[data-size]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

async function runImg2Pdf(files: File[]): Promise<void> {
  clearError('i-error');
  const result = $('i-result');
  if (result) result.hidden = true;
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (!images.length) {
    showError('i-error', '画像ファイルを選んでください。');
    return;
  }
  setBusy('i-drop', true);
  setStatus('i-status', '画像を読み込み中…');
  try {
    const r = await wp.imagesToPdf(images, {
      pageSize: imgPageSize,
      fit: 'contain',
      onProgress: (e) => setStatus('i-status', e.label ?? `処理中… ${e.done}/${e.total}`),
    });
    const name = `images-${images.length}p.pdf`;
    const skipped =
      r.skipped.length > 0
        ? `<ul class="notes"><li>${r.skipped.length}個の画像は読み込めずスキップしました。</li></ul>`
        : '';
    if (result) {
      result.innerHTML = `
        <div class="result-head">${r.pages}ページのPDFを作成しました</div>
        ${skipped}
        <div class="dl-row"><button class="btn" id="i-dl">ダウンロード</button></div>`;
      result.hidden = false;
      $('i-dl')?.addEventListener('click', () =>
        downloadBlob(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), name),
      );
    }
    downloadBlob(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), name);
    setStatus('i-status', '');
  } catch (err) {
    showError('i-error', friendlyError(err));
    setStatus('i-status', '');
  } finally {
    setBusy('i-drop', false);
  }
}

setupDropZone({
  dropId: 'i-drop',
  inputId: 'i-file',
  pickId: 'i-pick',
  onFiles: (files) => void runImg2Pdf(files),
});

/* ---------------- misc ---------------- */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') {
  ['c-error', 'j-error', 'i-error'].forEach((id) =>
    showError(id, 'このブラウザは必要な機能に対応していません。最新の Chrome / Edge / Safari / Firefox でお試しください。'),
  );
}
