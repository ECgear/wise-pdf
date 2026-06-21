---
type: Playbook
title: wise pdf — Maintainer Guide
description: Build, test, release, and dependency-risk guidance for maintainers of the wise pdf package.
---

# wise pdf — Maintainer Guide

This document covers license posture, the build and release process, dependency risks, and where key configuration lives in the codebase.

---

## License posture

wise pdf is published under the **MIT License** (Copyright (c) 2026 ECgear). All runtime dependencies are permissively licensed:

| Dependency | License |
|---|---|
| pdf.js | Apache-2.0 |
| pdf-lib | MIT |
| @jsquash/jpeg (mozjpeg) | Apache-2.0 (wrapper) / BSD (codec) |
| @jsquash/oxipng (oxipng) | Apache-2.0 |
| fflate | MIT |

**AGPL engines were deliberately avoided.** MuPDF and Ghostscript — both AGPL — are common choices for PDF processing but would require wise pdf or any application bundling it to be released under AGPL as well. The current engine achieves its goals with the permissive stack above.

### Preflight GPL/AGPL scan

Before every `npm publish`, run:

```bash
node scripts/preflight.mjs
```

This script scans `node_modules` for any GPL or AGPL licensed packages and fails with a non-zero exit code if any are found (LGPL is permitted — it is safe when used as a dynamic/runtime dependency). The script also checks for secrets, dangerous filenames, and inadvertently included private files.

The same check runs automatically as a pre-push git hook (`core.hooksPath=.githooks`). Do not skip or bypass the hook when publishing.

---

## Build

The package uses **tsup** to compile TypeScript source into `dist/`.

```bash
npm run build
```

This produces:
- `dist/index.js` + `dist/index.d.ts` — the main entry point (`createWisePdf` and public types)
- `dist/worker.js` — the Web Worker entry point (referenced by consumers via `new URL('@ecgear/wise-pdf/worker', import.meta.url)`)

`package.json` `"files"` is set to `["dist"]` so that only compiled output ships in the npm package. Source files, test fixtures, the demo app, and development tooling are excluded from the published artifact.

---

## Testing

```bash
# Unit and logic tests (no browser required)
npm test
# Equivalent: node --test

# TypeScript type check (no emit)
npm run typecheck

# End-to-end tests (requires a browser; uses Playwright)
npm run test:e2e
```

Pure-logic tests (compression parameter math, ZIP output shape, page-sizing calculations) use Node's built-in `node:test` runner — no extra test framework dependency. E2E tests exercise the full WASM pipeline inside a real browser via Playwright.

CI runs all three checks on each push and pull request. Merging is blocked on a red CI status.

---

## Release process

wise pdf follows **SemVer** and **Keep a Changelog** (https://keepachangelog.com/).

1. Update `CHANGELOG.md` under `## [Unreleased]` with all changes since the last release. Move that block to a new `## [x.y.z] — YYYY-MM-DD` section.
2. Bump the version in `package.json`:
   ```bash
   npm version patch   # or minor / major
   ```
   This creates a git commit and tag automatically.
3. Push the commit and tag:
   ```bash
   git push && git push --tags
   ```
4. Run the preflight scan one final time and confirm it passes:
   ```bash
   node scripts/preflight.mjs
   ```
5. Publish to npm:
   ```bash
   npm publish --access public
   ```
6. Create a GitHub Release against the new tag, copying the relevant `CHANGELOG.md` section as the release body.

---

## Dependency risk: pdf-lib

pdf-lib is currently **unmaintained upstream** (the last commit to the original repository was in 2021). It remains the only mature MIT-licensed library capable of low-level PDF object manipulation in pure JavaScript without AGPL dependencies.

To contain this risk:

- pdf-lib is used in exactly two places:
  - `src/compress/recompress-images.ts` — in-place DCT stream replacement for `low`/`recommended` compression
  - `src/build/` — page construction for `imagesToPdf` and the `maximum` rasterization path
- The public API (`createWisePdf`, `compressPdf`, `pdfToJpg`, `imagesToPdf`) does not expose any pdf-lib types. Consumers cannot import from pdf-lib through wise pdf.

This isolation means that if pdf-lib must be replaced (a fork becomes canonical, or an alternative emerges), the change is confined to those two internal modules with no breaking change to the public API.

When evaluating replacements, the same preflight GPL/AGPL scan applies — the replacement must be permissively licensed.

---

## Where the compression level parameters live

The three compression levels (`low`, `recommended`, `maximum`) and their associated DPI caps and JPEG quality values are defined in a single file:

```
src/compress/levels.ts
```

This is the **single source of truth** for these values. Do not duplicate them elsewhere in the codebase. If a level's parameters need to change (e.g. to improve compression ratios or respond to quality feedback), edit only this file. Tests that verify compression output should import from this file rather than hardcoding expected values.

Current values for reference:

| Level | DPI cap | JPEG quality | Text preserved |
|---|---|---|---|
| `low` | 200 | 82 | Yes |
| `recommended` | 150 | 72 | Yes |
| `maximum` | 120 | 60 | No |

---

## Demo app

The repository includes a standalone Vite-based demo web app at the repo root (not published to npm). It serves as a manual integration test and as the basis for the hosted tool at https://make-good-life.com/tools/wisepdf (coming soon).

```bash
npm install
npm run dev   # Starts Vite dev server, typically at http://localhost:5173
```

The demo app is the primary way to verify that the full WASM pipeline works end-to-end after changes, before running `npm run test:e2e`.
