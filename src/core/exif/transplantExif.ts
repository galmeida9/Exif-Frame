import piexif from 'piexifjs';

/**
 * Copy the EXIF metadata (including the original capture date) from a source
 * JPEG file into a freshly-encoded JPEG blob.
 *
 * The canvas export pipeline produces a brand-new JPEG with no metadata, so
 * exported photos otherwise lose their "date taken" and show today's date. When
 * the user enables "Maintain original EXIF" we read the source file's EXIF and
 * re-insert it into the exported bytes with piexifjs.
 *
 * Only works JPEG → JPEG. For any other source/target format (PNG, WebP, HEIC
 * source, …) the original bytes are returned unchanged.
 */
export async function transplantExif(
  sourceFile: File,
  exportedBytes: Uint8Array,
  targetMime: string
): Promise<Uint8Array> {
  if (targetMime !== 'image/jpeg') return exportedBytes;
  if (!/jpe?g$/i.test(sourceFile.type) && !/\.jpe?g$/i.test(sourceFile.name)) {
    return exportedBytes;
  }

  try {
    const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer());
    const sourceBinary = bytesToBinaryString(sourceBytes);
    // piexif.load throws if there is no EXIF segment — treat that as "nothing
    // to copy" and keep the exported bytes as-is.
    const exifObj = piexif.load(sourceBinary);
    if (!exifObj || isEmptyExif(exifObj)) return exportedBytes;

    const exifBytes = piexif.dump(exifObj);
    const exportedBinary = bytesToBinaryString(exportedBytes);
    const merged = piexif.insert(exifBytes, exportedBinary);
    return binaryStringToBytes(merged);
  } catch (err) {
    // Any failure (no EXIF, malformed segment, etc.) must not break the export.
    console.warn('[exif] could not transplant EXIF, exporting without it:', err);
    return exportedBytes;
  }
}

function isEmptyExif(exifObj: Record<string, unknown>): boolean {
  const groups = ['0th', 'Exif', 'GPS', 'Interop', '1st'] as const;
  return groups.every((g) => {
    const v = exifObj[g] as Record<string, unknown> | undefined;
    return !v || Object.keys(v).length === 0;
  });
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return s;
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}
