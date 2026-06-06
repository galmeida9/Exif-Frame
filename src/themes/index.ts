import type { ThemeDescriptor } from '../core/drawing/theme';
import { preloadAllMakerLogos } from './_shared/makerLogos';

import { NO_FRAME_FUNC, NO_FRAME_OPTIONS } from './01_NO_FRAME';
import { JUST_FRAME_FUNC, JUST_FRAME_OPTIONS } from './02_JUST_FRAME';
import { ONE_LINE_FUNC, ONE_LINE_OPTIONS } from './03_ONE_LINE';
import { TWO_LINE_FUNC, TWO_LINE_OPTIONS } from './04_TWO_LINE';
import { SHOT_ON_ONE_LINE_FUNC, SHOT_ON_ONE_LINE_OPTIONS } from './05_SHOT_ON_ONE_LINE';
import { SHOT_ON_TWO_LINE_FUNC, SHOT_ON_TWO_LINE_OPTIONS } from './06_SHOT_ON_TWO_LINE';
import { STRAP_FUNC, STRAP_OPTIONS } from './07_STRAP';
import { FILM_FUNC, FILM_OPTIONS } from './08_FILM';
import { MONITOR_FUNC, MONITOR_OPTIONS } from './09_MONITOR';
import { LIGHTROOM_FUNC, LIGHTROOM_OPTIONS } from './10_LIGHTROOM';
import { CUSTOM_ONE_LINE_FUNC, CUSTOM_ONE_LINE_OPTIONS } from './11_CUSTOM_ONE_LINE';
import { CUSTOM_TWO_LINE_FUNC, CUSTOM_TWO_LINE_OPTIONS } from './12_CUSTOM_TWO_LINE';
import { TIP_FUNC, TIP_OPTIONS } from './13_TIP';
import { POSTER_FUNC, POSTER_OPTIONS } from './14_POSTER';
import { CINEMASCOPE_FUNC, CINEMASCOPE_OPTIONS } from './15_CINEMASCOPE';
import { SIMPLE_FUNC, SIMPLE_OPTIONS } from './16_SIMPLE';
import { CUSTOM_FUNC, CUSTOM_OPTIONS } from './17_CUSTOM';

preloadAllMakerLogos();

const themes: ThemeDescriptor[] = [
  { name: '01. NO FRAME', func: NO_FRAME_FUNC, options: NO_FRAME_OPTIONS },
  { name: '02. JUST FRAME', func: JUST_FRAME_FUNC, options: JUST_FRAME_OPTIONS },
  { name: '03. ONE LINE', func: ONE_LINE_FUNC, options: ONE_LINE_OPTIONS },
  { name: '04. TWO LINE', func: TWO_LINE_FUNC, options: TWO_LINE_OPTIONS },
  { name: '05. SHOT ON ONE LINE', func: SHOT_ON_ONE_LINE_FUNC, options: SHOT_ON_ONE_LINE_OPTIONS },
  { name: '06. SHOT ON TWO LINE', func: SHOT_ON_TWO_LINE_FUNC, options: SHOT_ON_TWO_LINE_OPTIONS },
  { name: '07. STRAP', func: STRAP_FUNC, options: STRAP_OPTIONS },
  { name: '08. FILM', func: FILM_FUNC, options: FILM_OPTIONS },
  { name: '09. MONITOR', func: MONITOR_FUNC, options: MONITOR_OPTIONS },
  { name: '10. LIGHTROOM', func: LIGHTROOM_FUNC, options: LIGHTROOM_OPTIONS },
  { name: '11. CUSTOM ONE LINE', func: CUSTOM_ONE_LINE_FUNC, options: CUSTOM_ONE_LINE_OPTIONS },
  { name: '12. CUSTOM TWO LINE', func: CUSTOM_TWO_LINE_FUNC, options: CUSTOM_TWO_LINE_OPTIONS },
  { name: '13. TIP', func: TIP_FUNC, options: TIP_OPTIONS },
  { name: '14. POSTER', func: POSTER_FUNC, options: POSTER_OPTIONS },
  { name: '15. CINEMASCOPE', func: CINEMASCOPE_FUNC, options: CINEMASCOPE_OPTIONS },
  { name: '16. SIMPLE', func: SIMPLE_FUNC, options: SIMPLE_OPTIONS },
  { name: '17. CUSTOM', func: CUSTOM_FUNC, options: CUSTOM_OPTIONS },
];

export default themes;

export function findTheme(name: string): ThemeDescriptor {
  // Saved custom presets are synthetic theme names ("saved:<id>") that render
  // through the CUSTOM theme. Their per-theme data lives under that key.
  if (name.startsWith('saved:')) {
    return themes.find((t) => t.name === '17. CUSTOM') ?? themes[3];
  }
  return themes.find((t) => t.name === name) ?? themes[3]; // default to TWO LINE
}
