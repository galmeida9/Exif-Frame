import type Photo from '../../core/drawing/Photo';
import sandbox, { getLayout } from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption, ThemeOptionInput } from '../../core/drawing/theme';
import type { ElementRegistry } from '../../core/drawing/elements';
import { placeText, placeImage, placeDivider } from '../_shared/place';
import type { Store } from '../../store';
import { applyTemplate } from '../_shared/applyTemplate';
import { findMakerLogo } from '../_shared/makerLogos';

const STRAP_OPTIONS: ThemeOption[] = [
  { id: 'ARTIST', type: 'string', default: '', description: 'your name' },
  { id: 'DARK_MODE', type: 'boolean', default: false, description: 'enable to use dark mode' },
  { id: 'SECONDARY_TEXT_FONT_WEIGHT', type: 'range-slider', min: 100, max: 900, step: 100, default: 300, description: '100 - 900' },
  { id: 'PADDING_TOP', type: 'number', default: 0, description: 'px' },
  { id: 'PADDING_BOTTOM', type: 'number', default: 300, description: 'px (≥300 recommended for text strip)' },
  { id: 'PADDING_LEFT', type: 'number', default: 0, description: 'px' },
  { id: 'PADDING_RIGHT', type: 'number', default: 0, description: 'px' },
  { id: 'TEMPLATE1', type: 'string', default: '{ISO}{MM}{F}{SEC}' },
  { id: 'TEMPLATE2', type: 'string', default: '{MAKER}{BODY}' },
  { id: 'TEMPLATE3', type: 'string', default: '{TAKEN_AT}' },
  { id: 'TEMPLATE4', type: 'string', default: '{LENS}' },
];

const STRAP_FUNC: ThemeFunc = (photo: Photo, input: ThemeOptionInput, store: Store, registry?: ElementRegistry) => {
  const ARTIST = (input.get('ARTIST') as string).trim();
  const DARK_MODE = input.get('DARK_MODE') as boolean;
  const SECONDARY_TEXT_FONT_WEIGHT = input.get('SECONDARY_TEXT_FONT_WEIGHT') as number;
  const PADDING_TOP = input.get('PADDING_TOP') as number;
  const PADDING_BOTTOM = input.get('PADDING_BOTTOM') as number;
  const PADDING_LEFT = input.get('PADDING_LEFT') as number;
  const PADDING_RIGHT = input.get('PADDING_RIGHT') as number;
  const TEMPLATE1 = (input.get('TEMPLATE1') as string).trim();
  const TEMPLATE2 = (input.get('TEMPLATE2') as string).trim();
  const TEMPLATE3 = (input.get('TEMPLATE3') as string).trim();
  const TEMPLATE4 = (input.get('TEMPLATE4') as string).trim();
  const FONT_SIZE = 70;
  const BACKGROUND_COLOR = DARK_MODE ? '#000000' : '#ffffff';
  const PRIMARY_TEXT_COLOR = DARK_MODE ? '#ffffff' : '#000000';
  const SECONDARY_TEXT_COLOR = DARK_MODE ? '#888888' : '#333333';

  const text1 = applyTemplate(TEMPLATE1, photo, store, ' ');
  const text2 = applyTemplate(TEMPLATE2, photo, store, ' ');
  const text3 = applyTemplate(TEMPLATE3, photo, store, ' ');
  const text4 = applyTemplate(TEMPLATE4, photo, store, ' ');

  const canvas = sandbox(photo, {
    targetRatio: store.ratio,
    notCroppedMode: store.notCroppedMode,
    backgroundColor: BACKGROUND_COLOR,
    padding: { top: PADDING_TOP, right: PADDING_RIGHT, bottom: PADDING_BOTTOM, left: PADDING_LEFT },
  });
  const context = canvas.getContext('2d')!;
  const { width: W, height: H } = getLayout(canvas);
  context.textBaseline = 'middle';

  // ---- LEFT side ----
  context.textAlign = 'left';

  context.font = `normal 500 ${FONT_SIZE}px Barlow`;
  context.fillStyle = PRIMARY_TEXT_COLOR;
  if (!store.disableExposureMeter) {
    placeText(registry, context, 'exif', 'Exposure', text1, FONT_SIZE, H - PADDING_BOTTOM / 2 - FONT_SIZE / 2);
  }

  context.font = `normal ${SECONDARY_TEXT_FONT_WEIGHT} ${FONT_SIZE}px Barlow`;
  context.fillStyle = SECONDARY_TEXT_COLOR;
  if (ARTIST) {
    placeText(registry, context, 'subLeft', 'Artist / date', `Shot by © ${ARTIST}`, FONT_SIZE, H - PADDING_BOTTOM / 2 + FONT_SIZE / 2);
  } else {
    placeText(registry, context, 'subLeft', 'Artist / date', text3, FONT_SIZE, H - PADDING_BOTTOM / 2 + FONT_SIZE / 2);
  }

  // ---- RIGHT side ----
  context.textAlign = 'right';

  context.fillStyle = PRIMARY_TEXT_COLOR;
  context.font = `normal 500 ${FONT_SIZE}px Barlow`;
  const topWidth = context.measureText(text2).width;
  placeText(registry, context, 'camera', 'Camera', text2, W - FONT_SIZE, H - PADDING_BOTTOM / 2 - FONT_SIZE / 2);

  context.fillStyle = SECONDARY_TEXT_COLOR;
  context.font = `normal ${SECONDARY_TEXT_FONT_WEIGHT} ${FONT_SIZE}px Barlow`;
  const bottomWidth = context.measureText(text4).width;
  placeText(registry, context, 'lens', 'Lens', text4, W - FONT_SIZE, H - PADDING_BOTTOM / 2 + FONT_SIZE / 2);

  // divider line between logo and right text
  context.fillStyle = SECONDARY_TEXT_COLOR;
  placeDivider(
    registry,
    context,
    'divider',
    'Divider',
    W - Math.max(topWidth, bottomWidth) - FONT_SIZE * 2,
    H - PADDING_BOTTOM / 2 - FONT_SIZE,
    H - PADDING_BOTTOM / 2 + FONT_SIZE,
    SECONDARY_TEXT_COLOR,
    2
  );

  // ---- Brand logo ----
  const maker = store.overrideCameraMaker || photo.metadata.make;
  const model = store.overrideCameraModel || photo.metadata.model;
  const logo = findMakerLogo(maker, model, DARK_MODE);

  if (logo && logo.complete && logo.naturalWidth > 0) {
    let TARGET_LOGO_HEIGHT = FONT_SIZE * 2;
    const TARGET_LOGO_WIDTH = 400;
    let LOGO_WIDTH = (logo.width / logo.height) * TARGET_LOGO_HEIGHT;
    if (LOGO_WIDTH > TARGET_LOGO_WIDTH) {
      LOGO_WIDTH = TARGET_LOGO_WIDTH;
      TARGET_LOGO_HEIGHT = (logo.height / logo.width) * TARGET_LOGO_WIDTH;
    }
    placeImage(
      registry,
      context,
      'logo',
      'Logo',
      logo,
      W - Math.max(topWidth, bottomWidth) - FONT_SIZE * 2 - FONT_SIZE - LOGO_WIDTH,
      H - PADDING_BOTTOM / 2 - TARGET_LOGO_HEIGHT / 2,
      LOGO_WIDTH,
      TARGET_LOGO_HEIGHT
    );
  }

  return canvas;
};

export { STRAP_FUNC, STRAP_OPTIONS };
