import type { Tags } from 'exifreader';

/** Full-frame "35mm film" reference width in millimeters. */
const FULL_FRAME_WIDTH_MM = 36;

/**
 * Parsed EXIF metadata in human-presentable form.
 * Ported from jeonghyeon-net/exif-frame web/src/core/exif-metadata/exif-metadata.ts
 * with minor adaptations to be more defensive against missing fields.
 */
export default class ExifMetadata {
  public make: string | undefined;
  public model: string | undefined;
  public lensModel: string | undefined;
  public focalLength: string | undefined;
  public focalLengthIn35mm: string | undefined;
  /**
   * Crop factor (= 36mm / sensorWidthMm). Computed from either the EXIF
   * manufacturer-supplied 35mm-equivalent focal length (most accurate, when
   * present) or from FocalPlaneXResolution + PixelXDimension (fallback). May
   * be undefined when neither path yields a result.
   */
  public cropFactor: number | undefined;
  public fNumber: string | undefined;
  public iso: string | undefined;
  public exposureTime: string | undefined;
  public thumbnail: string | undefined;
  public takenAt: string | undefined;

  constructor(metadata: Tags) {
    this.make = metadata?.Make?.description;
    this.model = metadata?.Model?.description;
    this.lensModel = this.model
      ? metadata?.LensModel?.description?.replace(this.model, '')?.trim()
      : metadata?.LensModel?.description;
    this.focalLength = metadata?.FocalLength?.description?.replace(' mm', 'mm');

    const focal35Raw =
      (metadata as Tags & { FocalLengthIn35mmFilm?: { value?: unknown } })?.FocalLengthIn35mmFilm?.value;
    const uprightFocal = (metadata as Tags & { UprightFocalLength35mm?: { value?: string } })?.UprightFocalLength35mm
      ?.value;

    if (focal35Raw !== undefined && focal35Raw !== null && focal35Raw !== '') {
      this.focalLengthIn35mm = `${focal35Raw}mm`;
    } else if (uprightFocal) {
      this.focalLengthIn35mm = uprightFocal.includes('.')
        ? `${uprightFocal.split('.').shift()}mm`
        : `${uprightFocal}mm`;
    }

    this.cropFactor = computeCropFactor(metadata, this.focalLength, this.focalLengthIn35mm);

    this.fNumber = metadata?.FNumber?.description?.substring(0, 5)?.replace('f/', 'F');
    this.iso = metadata?.ISOSpeedRatings?.value
      ? 'ISO' + metadata?.ISOSpeedRatings?.value?.toString()
      : undefined;
    this.exposureTime = metadata?.ExposureTime?.description
      ? metadata?.ExposureTime?.description + 's'
      : undefined;

    const thumb = (metadata as Tags & { Thumbnail?: { base64?: string } })?.Thumbnail?.base64;
    this.thumbnail = thumb ? 'data:image/jpg;base64,' + thumb : undefined;

    if (metadata?.DateTimeOriginal?.description) {
      // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD HH:MM:SS"
      const parts = metadata.DateTimeOriginal.description.split(' ');
      if (parts.length === 2) {
        const yyyymmdd = parts[0].split(':').join('-');
        const hhmmss = parts[1];
        this.takenAt = `${yyyymmdd} ${hhmmss}`;
      }
    }
  }
}

function parseMm(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value.replace(/\s*mm$/i, '').trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Derive a sensor crop factor (relative to full-frame 36mm).
 *
 * 1. If both FocalLength and FocalLengthIn35mmFilm are known, the ratio
 *    between them IS the crop factor — manufacturer-supplied, most accurate.
 * 2. Otherwise try to compute the physical sensor width from
 *    FocalPlaneXResolution + PixelXDimension (or ExifImageWidth) +
 *    FocalPlaneResolutionUnit and divide 36mm by it.
 * 3. Return undefined if neither path yields a sane value.
 */
function computeCropFactor(
  metadata: Tags,
  focalLengthStr: string | undefined,
  focalLength35mmStr: string | undefined
): number | undefined {
  const focal = parseMm(focalLengthStr);
  const focal35 = parseMm(focalLength35mmStr);
  if (focal && focal35) {
    const ratio = focal35 / focal;
    if (ratio > 0.1 && ratio < 20) return ratio;
  }

  const fpxRes = (metadata as Tags & { FocalPlaneXResolution?: { value?: [number, number]; computed?: number | null } })
    ?.FocalPlaneXResolution;
  const fpUnitTag = (metadata as Tags & { FocalPlaneResolutionUnit?: { value?: number } })?.FocalPlaneResolutionUnit;
  const pixelXTag =
    (metadata as Tags & { PixelXDimension?: { value?: number } })?.PixelXDimension ??
    (metadata as Tags & { ExifImageWidth?: { value?: number } })?.ExifImageWidth;

  if (!fpxRes || !pixelXTag) return undefined;

  let fpxValue: number | undefined;
  if (typeof fpxRes.computed === 'number' && fpxRes.computed > 0) {
    fpxValue = fpxRes.computed;
  } else if (Array.isArray(fpxRes.value) && fpxRes.value.length === 2 && fpxRes.value[1] !== 0) {
    fpxValue = fpxRes.value[0] / fpxRes.value[1];
  }
  if (!fpxValue || fpxValue <= 0) return undefined;

  const pixelX = typeof pixelXTag.value === 'number' ? pixelXTag.value : undefined;
  if (!pixelX || pixelX <= 0) return undefined;

  // Default to inch (unit=2) when missing — that's what EXIF spec says.
  const unit = fpUnitTag?.value ?? 2;
  let unitToMm: number;
  switch (unit) {
    case 2:
      unitToMm = 25.4;
      break;
    case 3:
      unitToMm = 10;
      break;
    case 4:
      unitToMm = 1;
      break;
    case 5:
      unitToMm = 0.001;
      break;
    default:
      return undefined;
  }

  const sensorWidthMm = (pixelX / fpxValue) * unitToMm;
  if (!Number.isFinite(sensorWidthMm) || sensorWidthMm <= 0) return undefined;

  const cropFactor = FULL_FRAME_WIDTH_MM / sensorWidthMm;
  // Sanity clamp: real sensors range from ~0.5× (medium format) to ~6× (1/2.3" compacts).
  if (cropFactor < 0.3 || cropFactor > 10) return undefined;
  return cropFactor;
}
