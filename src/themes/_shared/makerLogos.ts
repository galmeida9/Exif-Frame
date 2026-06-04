/**
 * Shared maker (camera-brand) logo loader.
 *
 * Logos are served from /maker/light/<name>.png and /maker/dark/<name>.png
 * (placed in the public/ folder so Vite ships them unchanged).
 *
 * The lookup map mirrors the original mobile/web app's substring matching:
 * the photo's maker/model field is normalized and tested against each
 * brand keyword in priority order.  Pentax MUST be checked after Ricoh
 * because some Pentax bodies report "RICOH IMAGING ... PENTAX" — we want
 * the Pentax logo to win.
 */

const cache = new Map<string, HTMLImageElement>();

type Listener = () => void;
const listeners = new Set<Listener>();

export function onAnyMakerLogoLoad(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  }
}

function load(path: string): HTMLImageElement {
  const img = new Image();
  img.addEventListener('load', notify, { once: true });
  img.src = path;
  return img;
}

function get(key: string): HTMLImageElement {
  let img = cache.get(key);
  if (img) return img;
  img = load(key);
  cache.set(key, img);
  return img;
}

const MAKERS: Array<{ keyword: string; file: string }> = [
  { keyword: 'APPLE', file: 'apple' },
  { keyword: 'CANON', file: 'canon' },
  { keyword: 'CONTAX', file: 'contax' },
  { keyword: 'DJI', file: 'dji' },
  { keyword: 'EPSON', file: 'epson' },
  { keyword: 'FUJI', file: 'fujifilm' },
  { keyword: 'GOLDSTAR', file: 'goldstar' },
  { keyword: 'HASSELBLAD', file: 'hasselblad' },
  { keyword: 'LEICA', file: 'leica' },
  { keyword: 'LG', file: 'lg' },
  { keyword: 'MAMIYA', file: 'mamiya' },
  { keyword: 'NIKON', file: 'nikon' },
  { keyword: 'OLYMPUS', file: 'olympus' },
  { keyword: 'OM', file: 'om' },
  { keyword: 'PANASONIC', file: 'lumix' },
  { keyword: 'PHASE', file: 'phaseone' },
  { keyword: 'RICO', file: 'ricoh' },
  { keyword: 'PENTAX', file: 'pentax' },
  { keyword: 'SIGMA', file: 'sigma' },
  { keyword: 'SONY', file: 'sony' },
  { keyword: 'SAMSUNG', file: 'samsung' },
];

export function findMakerLogo(
  make: string | undefined | null,
  model: string | undefined | null,
  darkMode: boolean
): HTMLImageElement | undefined {
  const m = (make ?? '').toUpperCase();
  const md = (model ?? '').toUpperCase();
  let match: { file: string } | undefined;
  for (const entry of MAKERS) {
    if (m.includes(entry.keyword) || md.includes(entry.keyword)) {
      match = entry;
    }
  }
  if (!match) return undefined;
  const variant = darkMode ? 'dark' : 'light';
  return get(`/maker/${variant}/${match.file}.png`);
}

export function preloadAllMakerLogos(): void {
  for (const entry of MAKERS) {
    get(`/maker/light/${entry.file}.png`);
    get(`/maker/dark/${entry.file}.png`);
  }
}
