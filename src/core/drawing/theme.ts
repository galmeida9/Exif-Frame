import type Photo from './Photo';
import type { Store } from '../../store';
import type { ElementRegistry } from './elements';

/**
 * Signature implemented by every theme. Receives the photo, the theme's
 * own per-option map, the global store snapshot (read-only), and an optional
 * element registry used to capture draggable elements (text lines, logos,
 * dividers). Themes that support repositioning route their labeled draws
 * through the registry; others ignore it.
 */
export type ThemeFunc = (
  photo: Photo,
  options: ThemeOptionInput,
  store: Store,
  registry?: ElementRegistry
) => HTMLCanvasElement;

export type ThemeOptionInput = Map<string, AcceptInputType>;

export type AcceptInputType = string | number | boolean;

/** UI metadata describing one configurable knob of a theme. */
export type ThemeOption =
  | { id: string; type: 'string'; default: string; description?: string; elementId?: string }
  | { id: string; type: 'number'; default: number; description?: string; elementId?: string }
  | { id: string; type: 'boolean'; default: boolean; description?: string }
  | { id: string; type: 'color'; default: string; description?: string }
  | { id: string; type: 'select'; options: string[]; default: string; description?: string }
  | {
      id: string;
      type: 'range-slider';
      default: number;
      min: number;
      max: number;
      step: number;
      description?: string;
    };

export interface ThemeDescriptor {
  name: string;
  func: ThemeFunc;
  options: ThemeOption[];
}
