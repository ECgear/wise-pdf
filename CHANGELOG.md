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
