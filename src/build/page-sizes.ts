import type { FitMode, Orientation, PageSize } from '../types';

export const PT_PER_INCH = 72;

/** Portrait dimensions in PDF points (1pt = 1/72 inch). */
export const PAGE_DIMENSIONS_PT: Record<'a4' | 'letter', readonly [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function applyOrientation(w: number, h: number, orientation: Orientation, imgW: number, imgH: number): [number, number] {
  let landscape: boolean;
  if (orientation === 'portrait') landscape = false;
  else if (orientation === 'landscape') landscape = true;
  else landscape = imgW > imgH; // auto: follow the image
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  return landscape ? [long, short] : [short, long];
}

/** Resolve the page box (in points) for one image. */
export function resolvePageSize(
  pageSize: PageSize,
  orientation: Orientation,
  imgWpx: number,
  imgHpx: number,
): { width: number; height: number } {
  if (pageSize === 'fit') {
    // page matches the image, mapping pixels 1:1 to points (96dpi-ish baseline)
    const landscape =
      orientation === 'landscape' || (orientation === 'auto' && imgWpx > imgHpx);
    const w = imgWpx;
    const h = imgHpx;
    if (orientation === 'portrait' && w > h) return { width: h, height: w };
    if (landscape && w < h) return { width: h, height: w };
    return { width: w, height: h };
  }
  const [pw, ph] = PAGE_DIMENSIONS_PT[pageSize];
  const [width, height] = applyOrientation(pw, ph, orientation, imgWpx, imgHpx);
  return { width, height };
}

/**
 * Place an image of (imgW x imgH) inside a content box of (boxW x boxH) given a
 * fit mode. Returns the draw rect (origin at bottom-left, PDF convention).
 */
export function fitRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  fit: FitMode,
): Rect {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) {
    return { x: 0, y: 0, width: Math.max(0, boxW), height: Math.max(0, boxH) };
  }
  let drawW: number;
  let drawH: number;
  if (fit === 'actual') {
    drawW = imgW;
    drawH = imgH;
  } else {
    const scale =
      fit === 'cover'
        ? Math.max(boxW / imgW, boxH / imgH)
        : Math.min(boxW / imgW, boxH / imgH); // 'contain'
    drawW = imgW * scale;
    drawH = imgH * scale;
  }
  return {
    x: (boxW - drawW) / 2,
    y: (boxH - drawH) / 2,
    width: drawW,
    height: drawH,
  };
}
