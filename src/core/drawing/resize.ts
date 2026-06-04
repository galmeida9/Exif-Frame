/**
 * Resize a canvas onto a fresh canvas at the given dimensions.
 */
export default function resize(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const resized = document.createElement('canvas');
  resized.width = Math.max(1, Math.round(width));
  resized.height = Math.max(1, Math.round(height));
  const ctx = resized.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, resized.width, resized.height);
  return resized;
}
