/**
 * Release the memory held by a canvas (browsers don't always GC large
 * canvases promptly).
 */
export default function free(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
