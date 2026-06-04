/**
 * Thin wrappers that route a theme's labeled draws through the per-render
 * {@link ElementRegistry} when one is provided (preview / export with the
 * draggable-layout feature), and fall back to plain canvas drawing otherwise.
 *
 * Themes call these instead of `ctx.fillText` / `ctx.drawImage` / manual line
 * strokes for any element the user should be able to reposition.
 */
import type { ElementRegistry } from '../../core/drawing/elements';

export function placeText(
  registry: ElementRegistry | undefined,
  ctx: CanvasRenderingContext2D,
  id: string,
  label: string,
  text: string,
  x: number,
  y: number
): void {
  if (registry) {
    registry.text(ctx, id, label, text, x, y);
  } else {
    ctx.fillText(text, x, y);
  }
}

export function placeImage(
  registry: ElementRegistry | undefined,
  ctx: CanvasRenderingContext2D,
  id: string,
  label: string,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (registry) {
    registry.image(ctx, id, label, img, x, y, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

export function placeDivider(
  registry: ElementRegistry | undefined,
  ctx: CanvasRenderingContext2D,
  id: string,
  label: string,
  x: number,
  y1: number,
  y2: number,
  strokeStyle: string,
  lineWidth: number
): void {
  if (registry) {
    registry.divider(ctx, id, label, x, y1, y2, strokeStyle, lineWidth);
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}
