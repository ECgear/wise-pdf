# wise pdf

ブラウザだけで動くPDFツール。ファイルは一切アップロードされません。 / A privacy-first PDF toolkit that runs entirely in your browser — nothing is ever uploaded.

[![CI](https://github.com/ECgear/wise-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/ECgear/wise-pdf/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![No Upload](https://img.shields.io/badge/privacy-no%20upload-brightgreen)](https://github.com/ECgear/wise-pdf)

English version is at the bottom of this page.

[日本語](#日本語) · [English](#english)

---

## 日本語

### wise pdf とは

wise pdf は、PDFの圧縮・変換をすべて**あなたのブラウザの中だけ**で行うツールです。

SmallpdfやAdobeのオンラインツールは、操作するファイルをいったんサーバーに送信します。wise pdf はそれをしません。処理はすべてWebAssembly（ブラウザ上で動く技術）によってあなたの端末内だけで完結します。**PDFの中身がインターネットに出ることは一切ありません。**

---

### できること

#### 1. PDF を圧縮する

PDF のファイルサイズを小さくします。3つの強度から選べます。

| 強度 | 説明 |
|---|---|
| **軽め（low）** | 少しだけ小さくする。画質を優先。文字は引き続き選択・検索できます |
| **おすすめ（recommended）** | サイズと画質のバランスが良い。デフォルト設定。文字は引き続き選択・検索できます |
| **最大（maximum）** | 最もファイルサイズを小さくする。ただし**ページ全体が画像化されるため、文字の選択・検索ができなくなります** |

参考：199 KB の画像中心のPDFが、「おすすめ」で約 64 KB、「最大」で約 59 KB に縮小された例があります。

> **注意：** 「軽め」と「おすすめ」は、PDF内に埋め込まれたJPEG画像を圧縮することでサイズを減らします。文字だけのPDFや、JPEG以外の画像を使ったPDFはあまり縮まないことがあります。

#### 2. PDF を JPG に変換する

PDFの各ページをJPEG画像として書き出します。解像度（100 / 150 / 220 DPI）を選べます。ページが複数ある場合は ZIP ファイルにまとめてダウンロードできます。

#### 3. 画像を PDF にまとめる

JPEG・PNG・WebP・GIFなど複数の画像ファイルを、1つのPDFにまとめます。ページサイズは「画像に合わせる」「A4」「レター」から選べます。

---

### 使ってみる

**ホスト済みツール（近日公開予定）**: [https://make-good-life.com/tools/wisepdf](https://make-good-life.com/tools/wisepdf)

**デモを手元で動かす（一度だけの準備）:**

① **Node.js を入れる**
   公式サイト [https://nodejs.org/](https://nodejs.org/) から「LTS」版をダウンロードしてインストール。完了後にターミナルで確認:
   ```
   node -v
   ```
   バージョン番号が表示されればOKです。

② **このリポジトリを取得する**
   ターミナルで以下を実行（Git がない場合は[ZIPダウンロード](https://github.com/ECgear/wise-pdf/archive/refs/heads/main.zip)でも可）:
   ```
   git clone https://github.com/ECgear/wise-pdf.git
   cd wise-pdf
   ```

③ **必要なファイルをインストールする**
   ```
   npm install
   ```

④ **デモを起動してブラウザで開く**
   ```
   npm run dev
   ```
   ターミナルに表示されるURL（通常 `http://localhost:5173`）をブラウザで開いてください。

> **ターミナルの開き方:** macOS は「アプリケーション → ユーティリティ → ターミナル」、Windows は「スタートメニュー → "cmd" で検索 → コマンドプロンプト」、Linux はアプリメニューの「端末」または `Ctrl+Alt+T`。

---

### 安全性について

- 選んだPDFファイルは、**あなたのブラウザの外に出ません**。インターネット経由でどこかのサーバーに送信されることはありません。
- 処理が終わったら、結果ファイルをダウンロードして保存してください。ブラウザを閉じるとデータは消えます。
- **元のファイルは変更されません。** 元データは常にそのままで、処理結果は別にダウンロードされます。大切なファイルは事前にバックアップしておくことをお勧めします。

---

### よくある質問

**Q: パスワードがかかったPDFは使えますか？**
A: 現時点では非対応です。先にパスワードを解除してからご利用ください。

**Q: 圧縮してもあまりサイズが変わりません**
A: 文字だけのPDFや、JPEG以外の形式の画像を使ったPDFはサイズが縮みにくいです。スキャンしたPDFや写真の入ったPDFで特に効果が出ます。

**Q: 「最大圧縮」を使ったらテキストが選択できなくなりました**
A: 「最大圧縮」ではページ全体を画像として処理するため、文字は画像の一部になります。文字の選択・検索が必要な場合は「軽め」か「おすすめ」をお使いください。

**Q: スマートフォンで使えますか？**
A: 対応ブラウザであれば使えますが、ページ数の多い大きなPDFはメモリ不足になる場合があります。

---

## English

[↑ 日本語](#日本語)

### What it is

wise pdf is a PDF compression and conversion toolkit that runs entirely in your browser. All processing is done locally via WebAssembly — **your files never leave your device**. This is a meaningful difference from services like Smallpdf or Adobe's online tools, which upload your document to a server for processing.

---

### Features

1. **Compress PDF** — three levels: `low` (mild compression, quality-first, text preserved), `recommended` (balanced, default, text preserved), `maximum` (smallest output; pages are fully rasterized, so text is no longer selectable or searchable).
2. **PDF → JPG** — export each page as a JPEG at 100, 150, or 220 DPI; multiple pages are bundled into a ZIP.
3. **Images → PDF** — combine JPEG, PNG, WebP, GIF and other images into a single PDF with Fit, A4, or Letter page sizing.

---

### Use the hosted tool

[https://make-good-life.com/tools/wisepdf](https://make-good-life.com/tools/wisepdf) — coming soon.

### Run the demo locally

```bash
git clone https://github.com/ECgear/wise-pdf.git
cd wise-pdf
npm install
npm run dev
# Opens at http://localhost:5173
```

Requires Node.js (LTS). A modern browser (Chrome, Firefox, Edge, Safari) is needed for WebAssembly and Web Worker support.

---

### Use as a library

Install the package and its peer dependencies:

```bash
npm install @ecgear/wise-pdf @jsquash/jpeg @jsquash/oxipng pdfjs-dist
```

**Peer requirements:** a bundler that supports the `?url` import suffix and ES-module workers (Vite, Astro, etc.) is required, because WASM and the pdf.js worker URL must be resolved at build time and injected by the consumer. This keeps the package CDN-free.

**Setup:**

```ts
import { createWisePdf } from '@ecgear/wise-pdf';
import jpegWasm   from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import oxipngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import pdfWorker  from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const wp = createWisePdf({
  worker: new Worker(new URL('@ecgear/wise-pdf/worker', import.meta.url), { type: 'module' }),
  assets: { jpegWasmUrl: jpegWasm, oxipngWasmUrl: oxipngWasm, pdfWorkerUrl: pdfWorker },
});
```

**API reference:**

```ts
// Compress a PDF file
const { bytes, originalSize, newSize, textPreserved, notes } =
  await wp.compressPdf(file, { level: 'recommended' });
// level: 'low' | 'recommended' | 'maximum'   default: 'recommended'
// returns: bytes (Uint8Array), sizes in bytes, textPreserved (bool), notes (string[])

// Export PDF pages as individual JPEGs
const pages = await wp.pdfToJpg(file, { dpi: 150 });
// dpi: 100 | 150 | 220   default: 150
// returns: Array<{ page: number, blob: Blob, width: number, height: number }>

// Export PDF pages as a ZIP of JPEGs
const zipBlob = await wp.pdfToJpgZip(file, { dpi: 150 });
// returns: Blob (application/zip)

// Combine images into a PDF
const { bytes, pages, skipped } =
  await wp.imagesToPdf(files, { pageSize: 'a4' });
// pageSize: 'fit' | 'a4' | 'letter'   default: 'fit'
// returns: bytes (Uint8Array), pages (number), skipped (string[] — unsupported files)

// Release the Web Worker when done
wp.dispose();
```

**Browser requirements:** Web Worker, OffscreenCanvas, `createImageBitmap`. All modern desktop and mobile browsers qualify; very old browsers do not.

---

### Limitations

- Compression gains are most significant for image-heavy and scanned PDFs. A clean vector-only PDF may shrink only modestly on `low`/`recommended`.
- In v0.1, the text-preserving levels (`low`, `recommended`) only re-encode embedded **JPEG (DCTDecode)** images. Other image formats inside the PDF (FlateDecode/PNG, JPEG2000, CCITT, JBIG2) are left untouched at those levels. Use `maximum` to compress those, accepting that text will be rasterized.
- `maximum` rasterizes every page: text is no longer selectable or searchable after compression.
- HEIC input is not bundled; support depends on whether the browser can decode it natively (best-effort only).
- Large PDFs on mobile devices can hit browser memory limits.
- pdf-lib is currently unmaintained upstream; its use is isolated internally so it can be replaced later without a breaking API change.
- Password-protected PDFs are not supported.

---

### How it works

PDF rendering uses **pdf.js** (Apache-2.0). PDF construction and low-level object manipulation use **pdf-lib** (MIT). JPEG re-encoding uses **mozjpeg** compiled to WebAssembly via **@jsquash/jpeg** (Apache-2.0 / BSD). PNG optimization uses **oxipng** via **@jsquash/oxipng** (Apache-2.0). ZIP bundling uses **fflate** (MIT).

All processing runs inside a **Web Worker** so it never blocks the UI. WASM binaries are resolved from the same origin via the consumer's bundler — no CDN calls, no external network requests.

---

### License

[MIT License](LICENSE) — Copyright (c) 2026 ECgear

---

### Credits

- [pdf.js](https://github.com/mozilla/pdf.js) — Mozilla Foundation, Apache-2.0
- [pdf-lib](https://github.com/Hopding/pdf-lib) — Andrew Dillon, MIT
- [mozjpeg / @jsquash/jpeg](https://github.com/jamsinclair/jSquash) — Apache-2.0 wrapper, BSD codec
- [oxipng / @jsquash/oxipng](https://github.com/jamsinclair/jSquash) — Apache-2.0
- [fflate](https://github.com/101arrowz/fflate) — MIT
