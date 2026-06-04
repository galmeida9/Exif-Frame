import { load as loadExif, type Tags } from 'exifreader';
import ExifMetadata from '../exif/ExifMetadata';
import { getOverrideExifMetadata } from '../exif/overrideExif';
import { useStore } from '../../store';
import thumbnail from './thumbnail';

/**
 * Domain object for a single photo loaded into the workspace.
 *
 * Carries:
 *   - the original File (so we can re-read pixels for export at any time)
 *   - parsed EXIF (which the user may also override globally)
 *   - an HTMLImageElement ready for canvas use
 *   - a small base64 thumbnail for the photo library list
 *
 * The metadata getters mirror the original Photo class: they respect the
 * global toggles for hiding maker/model/lens and the focal-length modes.
 */
export default class Photo {
  public id!: string;
  public file!: File;
  public metadata!: ExifMetadata;
  public image!: HTMLImageElement;
  public thumbnail!: string;
  public objectUrl!: string;

  private constructor() {}

  public static async create(file: File): Promise<Photo> {
    const photo = new Photo();
    photo.id = crypto.randomUUID();
    photo.file = file;

    let tags: Tags = {} as Tags;
    try {
      tags = (await loadExif(file)) as Tags;
    } catch {
      // Some files (PNG without EXIF, screenshots, …) just have nothing — that's fine.
    }
    photo.metadata = new ExifMetadata(tags);

    photo.objectUrl = URL.createObjectURL(file);
    photo.image = new Image();
    photo.image.src = photo.objectUrl;
    await new Promise<void>((resolve, reject) => {
      photo.image.onload = () => resolve();
      photo.image.onerror = () => reject(new Error('Could not decode image: ' + file.name));
    });

    photo.thumbnail = thumbnail(photo, 360, 270);
    return photo;
  }

  public dispose(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  // ----- presentation helpers (read from global store + overrides) -----

  private get override() {
    const state = useStore.getState();
    return getOverrideExifMetadata(state.overridableMetadata, state.overrideMetadataIndex);
  }

  public get make(): string {
    const state = useStore.getState();
    if (!state.showCameraMaker) return '';
    return this.override?.make || state.overrideCameraMaker || this.metadata.make || '';
  }

  public get model(): string {
    const state = useStore.getState();
    if (!state.showCameraModel) return '';
    return this.override?.model || state.overrideCameraModel || this.metadata.model || '';
  }

  public get lensModel(): string {
    const state = useStore.getState();
    if (!state.showLensModel) return '';
    return this.override?.lensModel || state.overrideLensModel || this.metadata.lensModel || '';
  }

  public get focalLength(): string {
    const state = useStore.getState();

    // Manual crop factor override always wins, regardless of any other toggle.
    if (state.focalLengthRatioMode) {
      const raw = parseFloat(
        (this.override?.focalLength || this.metadata.focalLength || '0').replace(' mm', '').replace('mm', '')
      );
      return (raw * state.focalLengthRatio).toFixed(0) + 'mm';
    }

    const rawCamera = this.override?.focalLength || this.metadata.focalLength || '';

    // User explicitly opted into the camera's raw focal length — return it as-is.
    if (state.useCameraFocalLength) {
      return rawCamera;
    }

    // Default: 35mm-equivalent.
    // Priority 1: user override of the 35mm-equivalent field.
    if (this.override?.focalLengthIn35mm) return this.override.focalLengthIn35mm;
    // Priority 2: manufacturer-reported 35mm-equivalent in the EXIF.
    if (this.metadata.focalLengthIn35mm) return this.metadata.focalLengthIn35mm;
    // Priority 3: derive from the sensor crop factor we computed from EXIF.
    const cropFactor = this.metadata.cropFactor;
    const rawNumber = parseFloat(rawCamera.replace(' mm', '').replace('mm', ''));
    if (cropFactor && Number.isFinite(rawNumber) && rawNumber > 0) {
      return (rawNumber * cropFactor).toFixed(0) + 'mm';
    }
    // Fallback: we couldn't determine a crop factor → show raw camera value.
    return rawCamera;
  }

  public get fNumber(): string {
    return this.override?.fNumber || this.metadata.fNumber || '';
  }

  public get iso(): string {
    return this.override?.iso || this.metadata.iso || '';
  }

  public get exposureTime(): string {
    return this.override?.exposureTime || this.metadata.exposureTime || '';
  }

  public get takenAt(): string {
    const raw = this.override?.takenAt || this.metadata.takenAt;
    if (!raw) return '';

    const takenAt = new Date(raw);
    if (Number.isNaN(takenAt.getTime())) return '';

    const state = useStore.getState();
    const pad = (n: number) => n.toString().padStart(2, '0');

    switch (state.dateNotation) {
      case '2001/01/01 01:01:01':
        return `${takenAt.getFullYear()}/${pad(takenAt.getMonth() + 1)}/${pad(takenAt.getDate())} ${pad(takenAt.getHours())}:${pad(takenAt.getMinutes())}:${pad(takenAt.getSeconds())}`;
      case '2001-01-01 01:01:01':
        return `${takenAt.getFullYear()}-${pad(takenAt.getMonth() + 1)}-${pad(takenAt.getDate())} ${pad(takenAt.getHours())}:${pad(takenAt.getMinutes())}:${pad(takenAt.getSeconds())}`;
      case '2001年01月01日 01時01分':
        return `${takenAt.getFullYear()}年${pad(takenAt.getMonth() + 1)}月${pad(takenAt.getDate())}日 ${pad(takenAt.getHours())}時${pad(takenAt.getMinutes())}分`;
      case '2001년 01월 01일 01시 01분':
        return `${takenAt.getFullYear()}년 ${pad(takenAt.getMonth() + 1)}월 ${pad(takenAt.getDate())}일 ${pad(takenAt.getHours())}시 ${pad(takenAt.getMinutes())}분`;
      case '2001/01/01':
        return `${takenAt.getFullYear()}/${pad(takenAt.getMonth() + 1)}/${pad(takenAt.getDate())}`;
      case '2001-01-01':
        return `${takenAt.getFullYear()}-${pad(takenAt.getMonth() + 1)}-${pad(takenAt.getDate())}`;
      case '2001年01月01日':
        return `${takenAt.getFullYear()}年${pad(takenAt.getMonth() + 1)}月${pad(takenAt.getDate())}日`;
      case '2001년 01월 01일':
        return `${takenAt.getFullYear()}년 ${pad(takenAt.getMonth() + 1)}월 ${pad(takenAt.getDate())}일`;
      case 'Jan 1, 2001':
        return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][takenAt.getMonth()]} ${pad(takenAt.getDate())}, ${takenAt.getFullYear()}`;
      default:
        return raw;
    }
  }
}
