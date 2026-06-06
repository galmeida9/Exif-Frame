import type Photo from '../../core/drawing/Photo';
import sandbox, { getLayout } from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption, ThemeOptionInput } from '../../core/drawing/theme';
import type { ElementRegistry } from '../../core/drawing/elements';
import type { Store } from '../../store';
import { applyTemplate } from '../_shared/applyTemplate';
import { findMakerLogo } from '../_shared/makerLogos';
import { placeText, placeImage } from '../_shared/place';
import { DEFAULT_CUSTOM_LINES_JSON, parseLines } from '../_shared/customLines';

const CUSTOM_OPTIONS: ThemeOption[] = [
  { id: 'BACKGROUND_COLOR', type: 'color', default: '#ffffff', description: '#ffffff is white, #000000 is black' },
  { id: 'PADDING_TOP', type: 'number', default: 100, description: 'px' },
  { id: 'PADDING_BOTTOM', type: 'number', default: 450, description: 'px' },
  { id: 'PADDING_LEFT', type: 'number', default: 100, description: 'px' },
  { id: 'PADDING_RIGHT', type: 'number', default: 100, description: 'px' },
  { id: 'SHOW_LOGO', type: 'boolean', default: false, description: 'show the camera maker logo' },
  { id: 'DARK_LOGO', type: 'boolean', default: true, description: 'use the dark (black) logo; off = white logo' },
  { id: 'LOGO_SIZE', type: 'range-slider', default: 140, min: 40, max: 600, step: 10, description: 'logo height in px' },
  { id: 'LINES', type: 'lines', default: DEFAULT_CUSTOM_LINES_JSON },
];

const CUSTOM_FUNC: ThemeFunc = (photo: Photo, input: ThemeOptionInput, store: Store, registry?: ElementRegistry) => {
  const BACKGROUND_COLOR = (input.get('BACKGROUND_COLOR') as string).trim();
  const PADDING_TOP = input.get('PADDING_TOP') as number;
  const PADDING_BOTTOM = input.get('PADDING_BOTTOM') as number;
  const PADDING_LEFT = input.get('PADDING_LEFT') as number;
  const PADDING_RIGHT = input.get('PADDING_RIGHT') as number;
  const SHOW_LOGO = input.get('SHOW_LOGO') as boolean;
  const DARK_LOGO = input.get('DARK_LOGO') as boolean;
  const LOGO_SIZE = input.get('LOGO_SIZE') as number;
  const lines = parseLines(input.get('LINES') as string);

  const canvas = sandbox(photo, {
    targetRatio: store.ratio,
    notCroppedMode: store.notCroppedMode,
    backgroundColor: BACKGROUND_COLOR,
    padding: { top: PADDING_TOP, right: PADDING_RIGHT, bottom: PADDING_BOTTOM, left: PADDING_LEFT },
  });

  const context = canvas.getContext('2d')!;
  const { width: W, height: H } = getLayout(canvas);

  context.textBaseline = 'middle';

  // Vertical layout: stack the lines centered within the bottom padding strip.
  const gaps = lines.map((l) => l.fontSize * 1.5);
  const totalHeight = gaps.reduce((a, b) => a + b, 0);
  const bottomCenter = H - PADDING_BOTTOM / 2;
  let cursorY = bottomCenter - totalHeight / 2;

  // Optional maker logo, centered above the text block.
  if (SHOW_LOGO) {
    const maker = store.overrideCameraMaker || photo.metadata.make;
    const model = store.overrideCameraModel || photo.metadata.model;
    // findMakerLogo's flag means "dark-background variant" (a WHITE logo). The
    // user-facing option is "DARK LOGO" (a dark/black logo), so invert it.
    const logo = findMakerLogo(maker, model, !DARK_LOGO);
    if (logo && logo.complete && logo.naturalWidth > 0) {
      const TARGET_LOGO_HEIGHT = LOGO_SIZE;
      const LOGO_WIDTH = (logo.width / logo.height) * TARGET_LOGO_HEIGHT;
      const logoX = W / 2 - LOGO_WIDTH / 2;
      const logoY = cursorY - TARGET_LOGO_HEIGHT - 30;
      placeImage(registry, context, 'logo', 'Maker logo', logo, logoX, logoY, LOGO_WIDTH, TARGET_LOGO_HEIGHT);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = cursorY + gaps[i] / 2;
    cursorY += gaps[i];

    const text = applyTemplate(line.template, photo, store, ' ');
    context.font = `normal ${line.fontWeight} ${line.fontSize}px ${line.fontFamily}`;
    context.fillStyle = line.color;
    context.textAlign = line.align;

    const x = line.align === 'left' ? PADDING_LEFT : line.align === 'right' ? W - PADDING_RIGHT : W / 2;
    placeText(registry, context, line.id, line.label || `Line ${i + 1}`, text, x, y);
  }

  return canvas;
};

export { CUSTOM_FUNC, CUSTOM_OPTIONS };
