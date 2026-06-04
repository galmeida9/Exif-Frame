import type Photo from '../../core/drawing/Photo';
import { MAX_SIZE, renderScale } from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption } from '../../core/drawing/theme';

const CINEMASCOPE_OPTIONS: ThemeOption[] = [];

const CINEMASCOPE_FUNC: ThemeFunc = (photo: Photo) => {
  const canvas = document.createElement('canvas');
  const scale = renderScale(photo.image);

  // Normalized (4096-space) dimensions; device backing store is scaled up so
  // the output retains the photo's native resolution.
  const normWidth = MAX_SIZE;
  const normHeight = MAX_SIZE * (1 / 2.35) * 1.311875;
  canvas.width = Math.max(1, Math.round(normWidth * scale));
  canvas.height = Math.max(1, Math.round(normHeight * scale));

  const letterbox = (normHeight - MAX_SIZE * (1 / 2.35)) / 2;
  const ratio = photo.image.height / photo.image.width;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, normWidth, normHeight);
  ctx.drawImage(
    photo.image,
    0,
    0,
    photo.image.width,
    photo.image.height,
    0,
    -(normWidth * ratio - normHeight) / 2,
    normWidth,
    normWidth * ratio
  );
  ctx.fillRect(0, 0, normWidth, letterbox);
  ctx.fillRect(0, normHeight - letterbox, normWidth, letterbox);

  return canvas;
};

export { CINEMASCOPE_FUNC, CINEMASCOPE_OPTIONS };
