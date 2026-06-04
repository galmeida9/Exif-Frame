import type Photo from './Photo';

/**
 * Reference size for the normalized layout coordinate system. Themes author all
 * of their padding / font / offset values against this 4096-based space (mirrors
 * the original mobile app, where Safari capped canvases at 4096).
 */
export const MAX_SIZE = 4096;

/** Never produce a canvas whose longest side exceeds this (memory safety). */
const MAX_OUTPUT = 16384;

export interface SandboxOptions {
  backgroundColor: string;
  padding: { top: number; bottom: number; left: number; right: number };
  /** "free" for free-form (image dictates ratio + padding) or "W:H" e.g. "1:1", "3:2". */
  targetRatio: string;
  /** When true, keep entire image visible (letterbox into the ratio) instead of cropping to fill. */
  notCroppedMode: boolean;
}

/**
 * Per-canvas layout metadata. Themes draw in a NORMALIZED coordinate space
 * (width × height below) while the actual device backing store is `scale`×
 * larger so the output keeps the photo's native resolution. Every theme must
 * read `width`/`height` from here (via {@link getLayout}) rather than using
 * `canvas.width` / `canvas.height`, which are in device pixels.
 */
export interface SandboxLayout {
  /** Normalized canvas width (the coordinate space themes draw in). */
  width: number;
  /** Normalized canvas height. */
  height: number;
  /** Device pixels per normalized unit. `canvas.width === round(width * scale)`. */
  scale: number;
}

const layoutByCanvas = new WeakMap<HTMLCanvasElement, SandboxLayout>();

/**
 * Returns the normalized drawing dimensions + scale for a canvas produced by
 * {@link sandbox}. Themes use `const { width: W, height: H } = getLayout(canvas)`
 * and then position everything against W / H exactly as the original 4096-space
 * code did.
 */
export function getLayout(canvas: HTMLCanvasElement): SandboxLayout {
  const meta = layoutByCanvas.get(canvas);
  if (meta) return meta;
  // Fallback for canvases not produced by sandbox(): treat device pixels as
  // normalized (scale = 1).
  return { width: canvas.width, height: canvas.height, scale: 1 };
}

/**
 * Image-only render scale used by themes (e.g. CINEMASCOPE) that build their
 * own canvas without padding. Maps the photo's longest side onto MAX_SIZE so
 * the device backing store keeps native resolution.
 */
export function renderScale(image: { width: number; height: number }): number {
  const longest = Math.max(image.width, image.height);
  if (!Number.isFinite(longest) || longest <= 0) return 1;
  const scale = longest / MAX_SIZE;
  return clampScale(scale);
}

function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_OUTPUT / MAX_SIZE, Math.max(0.05, scale));
}

/**
 * Build the base canvas: ratio-aware container with the image drawn inside
 * the requested padding. All themes start by calling this and then paint
 * text/decorations on top (in the same normalized coordinate system).
 *
 * Ported from jeonghyeon-net/exif-frame web/src/core/drawing/sandbox.ts. The
 * desktop adaptation preserves the original NORMALIZED layout (so text / logo
 * proportions are identical to the mobile app) but renders the device backing
 * store at the photo's native resolution via a uniform `ctx.scale()`, so the
 * exported image is full-resolution instead of being clamped to 4096.
 */
export default function sandbox(photo: Photo, options: SandboxOptions): HTMLCanvasElement {
  const { image } = photo;
  const { backgroundColor, padding, targetRatio, notCroppedMode } = options;
  const { top, bottom, left, right } = padding;
  const canvas = document.createElement('canvas');

  // Installs the device backing store + scale transform for a given normalized
  // size, records the layout for getLayout(), and returns a ready context.
  // NOTE: assigning canvas.width/height resets context state, so the transform
  // MUST be (re)applied here, after sizing.
  const setup = (normWidth: number, normHeight: number, scale: number): CanvasRenderingContext2D => {
    canvas.width = Math.max(1, Math.round(normWidth * scale));
    canvas.height = Math.max(1, Math.round(normHeight * scale));
    layoutByCanvas.set(canvas, { width: normWidth, height: normHeight, scale });
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, normWidth, normHeight);
    return ctx;
  };

  if (targetRatio === 'free') {
    // Normalized layout is identical to the original mobile app: the image is
    // fitted within (MAX_SIZE − padding) on its long axis, padding is added
    // around it. We then pick a scale so the IMAGE renders at native pixels,
    // which makes text/logo sizes (authored in this space) match the original
    // proportions exactly while the export stays full-resolution.
    let imageWidthNorm: number;
    let imageHeightNorm: number;
    if (image.width > image.height) {
      imageWidthNorm = MAX_SIZE - left - right;
      imageHeightNorm = (image.height / image.width) * imageWidthNorm;
    } else {
      imageHeightNorm = MAX_SIZE - top - bottom;
      imageWidthNorm = (image.width / image.height) * imageHeightNorm;
    }

    // Guard against degenerate padding (>= MAX_SIZE) that would zero/inverse the
    // image box — fall back to a tiny positive size.
    imageWidthNorm = Math.max(1, imageWidthNorm);
    imageHeightNorm = Math.max(1, imageHeightNorm);

    // Scale that maps the normalized image box back to native device pixels.
    const scale = clampScale(
      image.width > image.height ? image.width / imageWidthNorm : image.height / imageHeightNorm
    );

    const ctx = setup(imageWidthNorm + left + right, imageHeightNorm + top + bottom, scale);
    ctx.drawImage(image, left, top, imageWidthNorm, imageHeightNorm);
    return canvas;
  }

  const ratio = targetRatio.split(':').map((value) => Number(value));
  if (ratio.length !== 2 || ratio[0] <= 0 || ratio[1] <= 0) {
    throw new Error('Invalid target ratio: ' + targetRatio);
  }

  let normWidth: number;
  let normHeight: number;
  if (ratio[0] > ratio[1]) {
    normWidth = MAX_SIZE;
    normHeight = (ratio[1] / ratio[0]) * MAX_SIZE;
  } else {
    normWidth = (ratio[0] / ratio[1]) * MAX_SIZE;
    normHeight = MAX_SIZE;
  }

  // Fixed-ratio modes keep their 4096-based normalized box; scale so the photo
  // is rendered near its native resolution.
  const scale = renderScale(image);
  const ctx = setup(normWidth, normHeight, scale);

  if (!notCroppedMode) {
    if (image.width > image.height) {
      const imageHeight = normHeight - top - bottom;
      const imageWidth = (image.width / image.height) * imageHeight;
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        (normWidth - imageWidth) / 2,
        top,
        imageWidth,
        imageHeight
      );
      ctx.fillRect(0, 0, left, normHeight);
      ctx.fillRect(normWidth - right, 0, right, normHeight);
    } else {
      const imageWidth = normWidth - left - right;
      const imageHeight = (image.height / image.width) * imageWidth;
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        left,
        (normHeight - imageHeight) / 2,
        imageWidth,
        imageHeight
      );
      ctx.fillRect(0, 0, normWidth, top);
      ctx.fillRect(0, normHeight - bottom, normWidth, bottom);
    }
  } else {
    // Letterbox: contain image within the ratio box.
    let imageWidth = normWidth - left - right;
    let imageHeight = normHeight - top - bottom;
    if (image.width / image.height > ratio[0] / ratio[1]) {
      imageHeight = (image.height / image.width) * imageWidth;
    } else {
      imageWidth = (image.width / image.height) * imageHeight;
    }
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      left + (normWidth - left - right - imageWidth) / 2,
      top + (normHeight - top - bottom - imageHeight) / 2,
      imageWidth,
      imageHeight
    );
  }

  return canvas;
}
