// Bundle Barlow locally (works offline inside the Tauri WebView). These imports
// emit @font-face rules into the built CSS so the canvas can use "Barlow"
// without depending on Google Fonts at runtime.
import '@fontsource/barlow/300.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow/300-italic.css';
import '@fontsource/barlow/400-italic.css';
import '@fontsource/barlow/500-italic.css';
import '@fontsource/barlow/600-italic.css';
import '@fontsource/barlow/700-italic.css';

/**
 * Available bundled fonts. Files must live in /public/fonts/<id>.ttf
 * (or .woff2). Font ids are also used as CSS family names on the
 * Canvas 2D context.
 *
 * NOTE: The original mobile app ships custom display fonts (Digital-7,
 *       Poxel, DIN Alternate Bold, Pretendard). Because we can't bundle
 *       proprietary font files automatically, we load only what is
 *       physically present in /public/fonts/. The font picker falls back
 *       to system fonts ("Barlow", "Arial", "sans-serif") if a font is
 *       missing — Canvas just uses the next family in the cascade.
 */
export enum Font {
  Digital7 = 'digital-7',
  Poxel = 'poxel',
  DINAlternateBold = 'din-alternate-bold',
  Pretendard = 'pretendard',
}

const BARLOW_WEIGHTS_TO_PRELOAD: Array<{ weight: number; style: 'normal' | 'italic' }> = [
  { weight: 300, style: 'normal' },
  { weight: 400, style: 'normal' },
  { weight: 500, style: 'normal' },
  { weight: 600, style: 'normal' },
  { weight: 700, style: 'normal' },
  { weight: 400, style: 'italic' },
  { weight: 500, style: 'italic' },
];

/**
 * Best-effort font loader. Tries to register each optional bundled TTF
 * (the proprietary display fonts) and waits for all Barlow weights —
 * the workhorse font used by nearly every theme — to be decoded so that
 * the canvas doesn't draw with a system-fallback serif on the first paint.
 */
export async function loadFonts(): Promise<void> {
  // Optional TTFs (silent on miss).
  for (const family of Object.values(Font)) {
    const face = new FontFace(family, `url(/fonts/${family}.ttf)`);
    face
      .load()
      .then((loaded) => {
        (document as Document & { fonts: FontFaceSet }).fonts.add(loaded);
      })
      .catch(() => {
        /* font not bundled — fall back to system stack */
      });
  }

  // Force Barlow weights to be decoded before we hand control to React.
  // Without this, the first canvas render uses the browser default sans/serif
  // and looks visibly worse (smaller x-height, wrong glyph shapes, extra
  // pixelation) until the user triggers a re-render.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    try {
      await Promise.all(
        BARLOW_WEIGHTS_TO_PRELOAD.map(({ weight, style }) =>
          document.fonts.load(`${style} ${weight} 16px Barlow`)
        )
      );
      await document.fonts.ready;
    } catch {
      /* canvas will fall back to system sans-serif, still functional */
    }
  }
}

export const SYSTEM_FONT_FAMILIES = ['Barlow', 'Arial', 'Helvetica', 'Segoe UI', 'Georgia', 'Times New Roman'];

export const ALL_FONT_FAMILIES = ['Barlow', ...Object.values(Font), 'Arial', 'Helvetica', 'Segoe UI', 'Georgia', 'Times New Roman'];

export default Font;
