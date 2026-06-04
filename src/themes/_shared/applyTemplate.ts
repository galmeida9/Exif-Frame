/**
 * Shared template applier used by themes that expose TEMPLATE1/TEMPLATE2
 * style strings. Tokens: {MAKER} {BODY} {LENS} {ISO} {MM} {F} {SEC} {TAKEN_AT}.
 *
 * The trailing-brace split mirrors the original mobile/web app exactly so
 * empty tokens collapse cleanly when joined by the divider.
 */
import type Photo from '../../core/drawing/Photo';
import type { Store } from '../../store';

export function applyTemplate(template: string, photo: Photo, store: Store, divider = ' '): string {
  return template
    .split('}')
    .map((part) => `${part}}`)
    .map((part) =>
      part
        .replace(/{MAKER}/g, photo.make)
        .replace(/{BODY}/g, photo.model || '')
        .replace(/{LENS}/g, photo.lensModel || '')
        .replace(/{ISO}/g, store.disableExposureMeter ? '' : photo.iso || '')
        .replace(/{MM}/g, store.disableExposureMeter ? '' : photo.focalLength || '')
        .replace(/{F}/g, store.disableExposureMeter ? '' : photo.fNumber || '')
        .replace(/{SEC}/g, store.disableExposureMeter ? '' : photo.exposureTime || '')
        .replace(/{TAKEN_AT}/g, photo.takenAt || '')
        .replace(/}/g, '')
    )
    .filter(Boolean)
    .join(divider);
}
