import type { OverridableMetadata } from '../../store';

/**
 * Returns the currently selected metadata-override preset, if any.
 * Accepts the live store value so we don't reach back into the store from
 * deep in the canvas pipeline.
 */
export function getOverrideExifMetadata(
  list: OverridableMetadata[],
  index: number | null
): OverridableMetadata | null {
  if (index === null || index === undefined) return null;
  if (index < 0 || index >= list.length) return null;
  return list[index] ?? null;
}
