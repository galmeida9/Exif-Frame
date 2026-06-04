import { clamp } from '../clamp';

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ConvertOptions {
  type: ImageMimeType;
  /** 1-100 */
  quality: number;
}

/**
 * Encode a canvas to a Blob in the requested format.
 *
 * (Original web app used @jsquash/webp WASM for explicit WebP encoding —
 *  modern Chromium / Edge WebView2 supports `canvas.toBlob('image/webp')`
 *  natively, so we use that instead.)
 */
export function canvasToBlob(canvas: HTMLCanvasElement, options: ConvertOptions): Promise<Blob> {
  const q = clamp(options.quality, 1, 100) / 100;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode canvas as ' + options.type));
      },
      options.type,
      q
    );
  });
}
