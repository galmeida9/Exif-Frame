/**
 * Tiny pub/sub channel that links an Options-panel field to its rendered
 * element in the preview. When the user hovers a template/text input, the
 * OptionsPanel publishes the corresponding registry element id here; the
 * PreviewCanvas subscribes and draws the same highlight border it uses for
 * drag-hover — so the user can see which frame element an input controls.
 *
 * Kept outside React state on purpose: hovering shouldn't trigger component
 * re-renders, only a cheap canvas overlay repaint.
 */

type Listener = (elementId: string | null) => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function setHoveredElement(elementId: string | null): void {
  if (current === elementId) return;
  current = elementId;
  for (const l of listeners) l(elementId);
}

export function getHoveredElement(): string | null {
  return current;
}

export function subscribeHoveredElement(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
