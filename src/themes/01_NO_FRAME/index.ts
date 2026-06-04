import type Photo from '../../core/drawing/Photo';
import sandbox from '../../core/drawing/sandbox';
import type { ThemeFunc, ThemeOption } from '../../core/drawing/theme';
import type { Store } from '../../store';

const NO_FRAME_OPTIONS: ThemeOption[] = [];

const NO_FRAME_FUNC: ThemeFunc = (photo: Photo, _input, store: Store) => {
  return sandbox(photo, {
    targetRatio: store.ratio,
    notCroppedMode: store.notCroppedMode,
    backgroundColor: '#ffffff',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });
};

export { NO_FRAME_FUNC, NO_FRAME_OPTIONS };
