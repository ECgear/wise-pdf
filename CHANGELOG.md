# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Compress PDF** with three levels (`low` / `recommended` / `maximum`). The
  `low` and `recommended` levels recompress and downsample embedded images while
  keeping selectable text; `maximum` rasterizes each page for the smallest size
  (text becomes part of the image — flagged in the result and the UI).
- **PDF → JPG**: export PDF pages as JPEG images at a chosen DPI; multi-page
  exports are bundled into a single ZIP.
- **Images → PDF**: combine multiple images (PNG / JPEG / WebP …) into one PDF
  with Fit / A4 / Letter page sizing.
- 100% in-browser engine (`@ecgear/wise-pdf`) running in a Web Worker, with a
  standalone demo UI. No file is ever uploaded; WASM codecs are served
  same-origin (no CDN).

### Fixed
- **`maximum` compression and `PDF → JPG` no longer crash on real-world PDFs**
  with `Cannot read properties of undefined (reading 'createElement')`. pdf.js
  rendering runs inside the Web Worker, where `document` does not exist, but its
  default canvas/filter factories and CSS `@font-face` loader all reach for it.
  The engine now renders headless: an `OffscreenCanvas` canvas factory, a no-op
  filter factory (matching pdf.js's `NodeFilterFactory`), and glyph-path text via
  `disableFontFace`. Trivial image-only PDFs never exercised those paths, which
  is why earlier tests passed; the e2e suite now covers a text + soft-mask PDF.
- **Compression never returns a file larger than the input.** The "never
  enlarge" guard now also covers `maximum`: rasterizing an already-compact
  text PDF can grow it, so when no level can shrink a PDF the engine returns the
  original (keeping its selectable text) with an explanatory note, instead of a
  larger, text-flattened result.
