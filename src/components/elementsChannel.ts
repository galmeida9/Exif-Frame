import type { CapturedElement } from '../core/drawing/elements';

/**
 * Publishes the list of draggable/styleable elements captured during the most
 * recent preview render, so the Options panel can show per-element style
 * controls. PreviewCanvas publishes after each render; OptionsPanel subscribes.
 */
type Listener = (elements: CapturedElement[]) => void;

let current: CapturedElement[] = [];
const listeners = new Set<Listener>();

export function publishElements(elements: CapturedElement[]): void {
  current = elements;
  for (const l of listeners) l(elements);
}

export function getPublishedElements(): CapturedElement[] {
  return current;
}

export function subscribeElements(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
