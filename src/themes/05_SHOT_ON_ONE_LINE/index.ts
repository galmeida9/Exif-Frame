import type Photo from '../../core/drawing/Photo';
import sandbox, { getLayout } from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption, ThemeOptionInput } from '../../core/drawing/theme';
import type { ElementRegistry } from '../../core/drawing/elements';
import { placeText } from '../_shared/place';
import type { Store } from '../../store';

const SHOT_ON_ONE_LINE_OPTIONS: ThemeOption[] = [
  { id: 'BACKGROUND_COLOR', type: 'color', default: '#ffffff', description: '#ffffff is white, #000000 is black' },
  { id: 'TEXT_COLOR', type: 'color', default: '#000000', description: '#ffffff is white, #000000 is black' },
  { id: 'PADDING_TOP', type: 'number', default: 0, description: 'px' },
  { id: 'PADDING_BOTTOM', type: 'number', default: 200, description: 'px (≥200 recommended for text line)' },
  { id: 'PADDING_LEFT', type: 'number', default: 0, description: 'px' },
  { id: 'PADDING_RIGHT', type: 'number', default: 0, description: 'px' },
];

const SHOT_ON_ONE_LINE_FUNC: ThemeFunc = (photo: Photo, input: ThemeOptionInput, store: Store, registry?: ElementRegistry) => {
  const BACKGROUND_COLOR = (input.get('BACKGROUND_COLOR') as string).trim();
  const TEXT_COLOR = input.get('TEXT_COLOR') as string;
  const PADDING_TOP = input.get('PADDING_TOP') as number;
  const PADDING_BOTTOM = input.get('PADDING_BOTTOM') as number;
  const PADDING_LEFT = input.get('PADDING_LEFT') as number;
  const PADDING_RIGHT = input.get('PADDING_RIGHT') as number;
  const FONT_SIZE = 70;

  const canvas = sandbox(photo, {
    targetRatio: store.ratio,
    notCroppedMode: store.notCroppedMode,
    backgroundColor: BACKGROUND_COLOR,
    padding: { top: PADDING_TOP, right: PADDING_RIGHT, bottom: PADDING_BOTTOM, left: PADDING_LEFT },
  });

  const { width: W, height: H } = getLayout(canvas);

  const context = canvas.getContext('2d')!;
  context.fillStyle = TEXT_COLOR;
  context.textBaseline = 'middle';
  context.font = `normal 100 ${FONT_SIZE}px Barlow`;
  context.textAlign = 'right';

  if (!store.disableExposureMeter) {
    placeText(
      registry,
      context,
      'exif',
      'Exposure',
      [`${photo.iso}`, `${photo.focalLength}`, `${photo.fNumber}`, `${photo.exposureTime}`]
        .filter(Boolean)
        .map((v) => v.trim())
        .join('  '),
      W - FONT_SIZE,
      H - PADDING_BOTTOM / 2
    );
  }

  context.textAlign = 'left';
  context.font = `normal 100 ${FONT_SIZE}px Barlow`;
  context.fillText('Shot on  ', FONT_SIZE, H - PADDING_BOTTOM / 2);
  const shotOnWidth = context.measureText('Shot on  ').width;

  context.font = `normal 500 ${FONT_SIZE}px Barlow`;
  placeText(
    registry,
    context,
    'camera',
    'Camera',
    [photo.make, photo.model, photo.lensModel]
      .filter(Boolean)
      .map((v) => v!.trim())
      .join(' '),
    shotOnWidth + FONT_SIZE,
    H - PADDING_BOTTOM / 2
  );

  return canvas;
};

export { SHOT_ON_ONE_LINE_FUNC, SHOT_ON_ONE_LINE_OPTIONS };
