import type Photo from './Photo';
import free from './free';

/**
 * Generate a small centered-crop thumbnail of a photo, encoded as a base64
 * JPEG data URL. Used for the photo library list.
 */
export default function thumbnail(photo: Photo, targetWidth: number, targetHeight: number): string {
  const originalAspectRatio = photo.image.width / photo.image.height;
  const targetAspectRatio = targetWidth / targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  if (originalAspectRatio > targetAspectRatio) {
    const drawWidth = photo.image.height * targetAspectRatio;
    const drawX = (photo.image.width - drawWidth) / 2;
    ctx.drawImage(photo.image, drawX, 0, drawWidth, photo.image.height, 0, 0, targetWidth, targetHeight);
  } else {
    const drawHeight = photo.image.width / targetAspectRatio;
    const drawY = (photo.image.height - drawHeight) / 2;
    ctx.drawImage(photo.image, 0, drawY, photo.image.width, drawHeight, 0, 0, targetWidth, targetHeight);
  }

  const data = canvas.toDataURL('image/jpeg', 0.85);
  free(canvas);
  return data;
}
