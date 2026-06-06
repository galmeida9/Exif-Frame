import type Photo from './Photo';
import type { Store } from '../../store';
import type { ThemeFunc, ThemeOptionInput } from './theme';
import type { ElementRegistry } from './elements';
import resize from './resize';
import { getLayout } from './sandbox';
import { applyTemplate } from '../../themes/_shared/applyTemplate';

/**
 * Pipeline runner: invoke the theme function, then apply post-effects
 * (extra user lines, fixed watermark, fixed image width) defined in the store.
 */
export default async function render(
  func: ThemeFunc,
  photo: Photo,
  options: ThemeOptionInput,
  store: Store,
  registry?: ElementRegistry
): Promise<HTMLCanvasElement> {
  // Belt-and-braces guarantee that any @font-face declarations (Barlow + the
  // optional display fonts) are decoded before the theme draws text. The
  // initial preload in loadFonts() should cover this, but new font weights
  // requested by individual themes may still trigger an async fetch.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  let canvas = func(photo, options, store, registry);

  // Draw extra user-added lines on top, in normalized space. Each is captured
  // by the registry (id `extra:<lineId>`) so it is draggable / hoverable, and
  // is positioned in the lower-center by default (the user then drags it).
  if (registry) {
    const extras = store.getExtraLines(registry.themeName);
    if (extras.length > 0) {
      const ctx = canvas.getContext('2d')!;
      const { width: W, height: H } = getLayout(canvas);
      ctx.textBaseline = 'middle';
      const gaps = extras.map((l) => l.fontSize * 1.4);
      const total = gaps.reduce((a, b) => a + b, 0);
      let cursorY = H / 2 - total / 2;
      for (let i = 0; i < extras.length; i++) {
        const line = extras[i];
        const y = cursorY + gaps[i] / 2;
        cursorY += gaps[i];
        const text = applyTemplate(line.template, photo, store, ' ');
        ctx.font = `normal ${line.fontWeight} ${line.fontSize}px ${line.fontFamily}`;
        ctx.fillStyle = line.color;
        ctx.textAlign = line.align;
        const x = line.align === 'left' ? W * 0.1 : line.align === 'right' ? W * 0.9 : W / 2;
        registry.text(ctx, `extra:${line.id}`, line.label || `Extra line ${i + 1}`, text, x, y);
      }
    }
  }

  if (store.fixWatermark && store.watermark) {
    const ctx = canvas.getContext('2d')!;
    // The theme left a `ctx.scale()` transform installed so it could draw in
    // normalized space. Honour the same space here so the watermark lands
    // inside the canvas regardless of the photo's resolution.
    const { width: W, height: H } = getLayout(canvas);
    const fontSize = 100;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 5;
    ctx.font = `normal 500 ${fontSize}px Barlow`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(store.watermark, W - fontSize / 2, H - fontSize / 2);
    ctx.shadowBlur = 0;
  }

  if (store.fixImageWidth && store.imageWidth) {
    const cap = Math.min(store.imageWidth, 4096);
    if (canvas.width >= canvas.height) {
      const targetWidth = cap;
      const targetHeight = (targetWidth * canvas.height) / canvas.width;
      canvas = resize(canvas, targetWidth, targetHeight);
    } else {
      const targetHeight = cap; // The original has a 'naming bug' here — we preserve the behaviour.
      const targetWidth = (targetHeight * canvas.width) / canvas.height;
      canvas = resize(canvas, targetWidth, targetHeight);
    }
  }

  return canvas;
}
