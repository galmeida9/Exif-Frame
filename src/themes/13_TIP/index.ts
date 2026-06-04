import type Photo from '../../core/drawing/Photo';
import sandbox, { getLayout } from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption, ThemeOptionInput } from '../../core/drawing/theme';
import type { ElementRegistry } from '../../core/drawing/elements';
import { placeText } from '../_shared/place';
import type { Store } from '../../store';
import Font from '../../fonts';

const TIP_OPTIONS: ThemeOption[] = [
  { id: 'DARK_MODE', type: 'boolean', default: false, description: 'enable to use dark mode' },
  { id: 'HIDE_TEXT', type: 'boolean', default: false, description: 'hide text' },
  { id: 'TAG', type: 'string', default: 'TIP' },
  { id: 'TITLE', type: 'string', default: '01. Lorem ipsum' },
  { id: 'DESCRIPTION1', type: 'string', default: 'Pellentesque a pharetra justo' },
  { id: 'DESCRIPTION2', type: 'string', default: 'Nam maximus risus et rhoncus eleifend' },
  { id: 'PADDING_TOP', type: 'number', default: 250, description: 'px' },
  { id: 'PADDING_BOTTOM', type: 'number', default: 125, description: 'px' },
  { id: 'TAG_SIZE', type: 'number', default: 140, description: 'px' },
  { id: 'TAG_WEIGHT', type: 'range-slider', min: 100, max: 900, step: 100, default: 700, description: '100 ~ 900' },
  { id: 'TITLE_SIZE', type: 'number', default: 120, description: 'px' },
  { id: 'TITLE_WEIGHT', type: 'range-slider', min: 100, max: 900, step: 100, default: 500, description: '100 ~ 900' },
  { id: 'DESCRIPTION_SIZE', type: 'number', default: 95, description: 'px' },
  { id: 'DESCRIPTION_WEIGHT', type: 'range-slider', min: 100, max: 900, step: 100, default: 200, description: '100 ~ 900' },
  { id: 'EXIF_SIZE', type: 'number', default: 60, description: 'px' },
  { id: 'EXIF_WEIGHT', type: 'range-slider', min: 100, max: 900, step: 100, default: 500, description: '100 ~ 900' },
  { id: 'FONT_FAMILY', type: 'select', options: ['Barlow', ...Object.values(Font)], default: 'Barlow', description: 'ex. Barlow, Arial, sans-serif' },
  { id: 'SHADOW_SIZE', type: 'number', default: 10, description: '0 ~ 100' },
];

const TIP_FUNC: ThemeFunc = (photo: Photo, input: ThemeOptionInput, store: Store, registry?: ElementRegistry) => {
  const DARK_MODE = input.get('DARK_MODE') as boolean;
  const HIDE_TEXT = input.get('HIDE_TEXT') as boolean;
  const TAG = (input.get('TAG') as string).trim();
  const TITLE = (input.get('TITLE') as string).trim();
  const DESCRIPTION1 = (input.get('DESCRIPTION1') as string).trim();
  const DESCRIPTION2 = (input.get('DESCRIPTION2') as string).trim();
  const PADDING_TOP = input.get('PADDING_TOP') as number;
  const PADDING_BOTTOM = input.get('PADDING_BOTTOM') as number;
  const TAG_SIZE = input.get('TAG_SIZE') as number;
  const TAG_WEIGHT = input.get('TAG_WEIGHT') as number;
  const TITLE_SIZE = input.get('TITLE_SIZE') as number;
  const TITLE_WEIGHT = input.get('TITLE_WEIGHT') as number;
  const DESCRIPTION_SIZE = input.get('DESCRIPTION_SIZE') as number;
  const DESCRIPTION_WEIGHT = input.get('DESCRIPTION_WEIGHT') as number;
  const EXIF_SIZE = input.get('EXIF_SIZE') as number;
  const EXIF_WEIGHT = input.get('EXIF_WEIGHT') as number;
  const FONT_FAMILY = (input.get('FONT_FAMILY') as string).trim();
  const SHADOW_SIZE = input.get('SHADOW_SIZE') as number;

  const canvas = sandbox(photo, {
    targetRatio: store.ratio,
    notCroppedMode: store.notCroppedMode,
    backgroundColor: DARK_MODE ? '#ffffff' : '#000000',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const context = canvas.getContext('2d')!;
  const { width: W, height: H } = getLayout(canvas);
  context.fillStyle = DARK_MODE ? '#000000' : '#ffffff';
  context.shadowColor = DARK_MODE ? '#ffffff' : '#000000';
  context.shadowBlur = SHADOW_SIZE;
  context.textBaseline = 'middle';
  context.textAlign = 'center';

  if (!HIDE_TEXT) {
    context.font = `normal ${TAG_WEIGHT} ${TAG_SIZE}px ${FONT_FAMILY}`;
    placeText(registry, context, 'tag', 'Tag', TAG, W / 2, PADDING_TOP);

    context.font = `normal ${TITLE_WEIGHT} ${TITLE_SIZE}px ${FONT_FAMILY}`;
    placeText(registry, context, 'title', 'Title', TITLE, W / 2, PADDING_TOP + TAG_SIZE + TITLE_SIZE / 2);

    context.font = `normal ${DESCRIPTION_WEIGHT} ${DESCRIPTION_SIZE}px ${FONT_FAMILY}`;
    placeText(registry, context, 'desc1', 'Description 1', DESCRIPTION1, W / 2, H - PADDING_BOTTOM - EXIF_SIZE - DESCRIPTION_SIZE * 2.2);
    placeText(registry, context, 'desc2', 'Description 2', DESCRIPTION2, W / 2, H - PADDING_BOTTOM - EXIF_SIZE - DESCRIPTION_SIZE);
  }

  if (!store.disableExposureMeter) {
    const exifWidth = W / 2;
    context.font = `normal ${EXIF_WEIGHT} ${EXIF_SIZE}px ${FONT_FAMILY}`;
    placeText(registry, context, 'fNumber', 'Aperture', `${photo.fNumber?.replace('f/', 'F')}`, W / 2 - exifWidth / 2 + (exifWidth / 5) * 1, H - PADDING_BOTTOM);
    placeText(registry, context, 'shutter', 'Shutter', `${photo.exposureTime}`, W / 2 - exifWidth / 2 + (exifWidth / 5) * 2, H - PADDING_BOTTOM);
    placeText(registry, context, 'iso', 'ISO', `${photo.iso}`, W / 2 - exifWidth / 2 + (exifWidth / 5) * 3, H - PADDING_BOTTOM);
    placeText(registry, context, 'focal', 'Focal length', `${photo.focalLength}`, W / 2 - exifWidth / 2 + (exifWidth / 5) * 4, H - PADDING_BOTTOM);
  }

  return canvas;
};

export { TIP_FUNC, TIP_OPTIONS };
