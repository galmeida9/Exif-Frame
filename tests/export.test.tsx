import { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import ExportDialog from '../src/components/ExportDialog';
import Photo from '../src/core/drawing/Photo';
import { ElementRegistry } from '../src/core/drawing/elements';
import render from '../src/core/drawing/render';
import type { ThemeOptionInput } from '../src/core/drawing/theme';
import type ExifMetadata from '../src/core/exif/ExifMetadata';
import { useStore } from '../src/store';
import { findTheme } from '../src/themes';

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [initial, vi.fn()],
}));

vi.mock('../src/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/store')>();
  return {
    ...actual,
    useStore: Object.assign(() => actual.useStore.getState(), actual.useStore),
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('C:\\exports\\photo.png'),
  open: vi.fn().mockResolvedValue('C:\\exports'),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn(),
}));
vi.mock('../src/themes/_shared/makerLogos', () => ({
  preloadAllMakerLogos: vi.fn(),
  findMakerLogo: () => ({
    width: 400, height: 100, complete: true, naturalWidth: 400,
  }),
}));

const initialState = useStore.getState();
type Draw = { kind: string; args: unknown[]; font?: string; color?: string; align?: string };
const canvases: ReturnType<typeof createCanvas>[] = [];

function createCanvas() {
  const draws: Draw[] = [];
  const ctx = {
    font: 'normal 400 70px Barlow',
    fillStyle: '#000000',
    textAlign: 'left',
    textBaseline: 'middle',
    scale: (...args: number[]) => draws.push({ kind: 'scale', args }),
    fillRect: (...args: number[]) => draws.push({ kind: 'rect', args }),
    drawImage: (...args: unknown[]) => draws.push({ kind: 'image', args }),
    fillText: (...args: unknown[]) => draws.push({
      kind: 'text', args, font: ctx.font, color: ctx.fillStyle, align: ctx.textAlign,
    }),
    measureText: (text: string) => ({
      width: text.length * 35, actualBoundingBoxAscent: 50, actualBoundingBoxDescent: 20,
    }),
    beginPath: () => {},
    moveTo: (...args: number[]) => draws.push({ kind: 'moveTo', args }),
    lineTo: (...args: number[]) => draws.push({ kind: 'lineTo', args }),
    stroke: () => draws.push({ kind: 'stroke', args: [] }),
  };
  return {
    width: 0,
    height: 0,
    draws,
    getContext: () => ctx,
    toBlob: (callback: BlobCallback) => callback(new Blob(['encoded image'])),
  };
}

function photo(width = 6000, height = 4000): Photo {
  const metadata: ExifMetadata = {
    make: 'SONY', model: 'ILCE-6000', lensModel: '30mm F1.4',
    iso: 'ISO100', focalLength: '45mm', fNumber: 'F4.5', exposureTime: '1/800s',
    focalLengthIn35mm: undefined, cropFactor: undefined, thumbnail: undefined, takenAt: undefined,
  };
  return Object.assign(Object.create(Photo.prototype), {
    file: new File(['photo'], 'photo.jpg'),
    image: { width, height },
    metadata,
  });
}

async function preview(source: Photo, registry?: ElementRegistry) {
  const store = useStore.getState();
  const theme = findTheme(store.selectedThemeName, store.savedThemes);
  const options: ThemeOptionInput = new Map(theme.options.map((o) => [
    o.id, store.getThemeOption(store.selectedThemeName, o.id, o.default),
  ]));
  await render(theme.func, source, options, store, registry ?? new ElementRegistry(
    store.selectedThemeName, store.getElementOffset, store.getElementStyle
  ));
  return canvases.at(-1)!;
}

function clickExport(node: ReactNode): boolean {
  let clicked = false;
  Children.forEach(node, (child) => {
    if (!isValidElement<{ className?: string; onClick?: () => void; children?: ReactNode }>(child)) return;
    if (child.type === 'button' && child.props.className === 'primary') {
      child.props.onClick!();
      clicked = true;
    } else if (clickExport(child.props.children)) {
      clicked = true;
    }
  });
  return clicked;
}

async function exportPhotos(photos: Photo[], selectedIndex: number | null) {
  const onClose = vi.fn();
  const onStatus = vi.fn();
  expect(clickExport(ExportDialog({ photos, selectedIndex, onClose, onStatus }))).toBe(true);
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onStatus).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  canvases.length = 0;
  useStore.setState({ ...initialState, selectedThemeName: '07. STRAP', format: 'image/png' }, true);
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`);
      const canvas = createCanvas();
      canvases.push(canvas);
      return canvas;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useStore.setState(initialState, true);
});

describe('export layout matches the preview', () => {
  it.each([[6000, 4000], [4000, 6000]])('preserves moved text, logo and divider at %sx%s', async (w, h) => {
    const source = photo(w, h);
    const original = await preview(source);
    useStore.setState({
      themeElementOffsets: {
        '07. STRAP': {
          exif: { dx: 180, dy: -40 },
          logo: { dx: 450, dy: 25 },
          divider: { dx: -75, dy: 15 },
        },
      },
    });
    const expected = await preview(source);
    const originalText = original.draws.find((d) => d.kind === 'text')!;
    const movedText = expected.draws.find((d) => d.kind === 'text')!;
    expect(movedText.args).toEqual([
      originalText.args[0], Number(originalText.args[1]) + 180, Number(originalText.args[2]) - 40,
    ]);
    expect(expected.draws).not.toEqual(original.draws);
    await exportPhotos([source], 0);
    expect(canvases.at(-1)?.draws).toEqual(expected.draws);
    expect(save).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it('preserves hidden elements, text styles and extra lines in every batch output', async () => {
    useStore.setState({
      themeElementOffsets: {
        '07. STRAP': {
          lens: { dx: 0, dy: 0, hidden: true },
          logo: { dx: 0, dy: 0, hidden: true },
          divider: { dx: 0, dy: 0, hidden: true },
          'extra:credit': { dx: 125, dy: -80 },
        },
      },
      themeElementStyles: {
        '07. STRAP': { exif: { color: '#ff0000', fontFamily: 'Arial', fontSize: 90, fontWeight: 700, align: 'center' } },
      },
      themeExtraLines: {
        '07. STRAP': [{
          id: 'credit', template: 'Photo credit', fontFamily: 'Barlow',
          fontWeight: 300, fontSize: 60, color: '#123456', align: 'center',
        }],
      },
    });
    const sources = [photo(), photo(3000, 4500)];
    const expected = [];
    for (const source of sources) expected.push(await preview(source));
    expect(expected[0].draws.filter((d) => d.kind === 'image')).toHaveLength(1);
    expect(expected[0].draws.some((d) => d.kind === 'stroke')).toBe(false);
    expect(expected[0].draws.find((d) => d.kind === 'text')).toMatchObject({
      font: 'normal 700 90px Arial', color: '#ff0000', align: 'center',
    });
    expect(expected[0].draws.some((d) => d.args[0] === 'Photo credit')).toBe(true);
    const start = canvases.length;
    await exportPhotos(sources, null);
    expect(canvases.slice(start).map((c) => c.draws)).toEqual(expected.map((c) => c.draws));
    expect(open).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('uses a saved preset key for options, offsets, styles and extra lines', async () => {
    const key = 'saved:my-preset';
    useStore.setState({
      selectedThemeName: key,
      themeOptions: {
        '17. CUSTOM': { PADDING_BOTTOM: 100 },
        [key]: { PADDING_BOTTOM: 800, SHOW_LOGO: true, LOGO_SIZE: 200 },
      },
      themeElementOffsets: { [key]: { logo: { dx: 400, dy: 50 }, 'extra:note': { dx: -250, dy: 70 } } },
      themeElementStyles: { [key]: { 'extra:note': { color: '#00ff00', fontSize: 100 } } },
      themeExtraLines: {
        [key]: [{
          id: 'note', template: 'Saved note', fontFamily: 'Arial',
          fontWeight: 500, fontSize: 60, color: '#111111', align: 'left',
        }],
      },
    });
    const source = photo();
    const expected = await preview(source);
    await exportPhotos([source], 0);
    expect(canvases.at(-1)).toMatchObject({ width: expected.width, height: expected.height, draws: expected.draws });
  });

  it.each(['07. STRAP', '04. TWO LINE', '17. CUSTOM'])(
    'preserves the %s design in a saved copy, its preview and batch exports',
    async (themeName) => {
      useStore.setState({
        selectedThemeName: themeName,
        themeOptions: { [themeName]: { PADDING_BOTTOM: 800 } },
        themeElementOffsets: {
          [themeName]: { logo: { dx: 200, dy: 50 }, divider: { dx: 0, dy: 0, hidden: true } },
        },
        themeElementStyles: { [themeName]: { exif: { color: '#ff0000', fontSize: 90 } } },
        themeExtraLines: {
          [themeName]: [{
            id: 'credit', template: 'Photo credit', fontFamily: 'Arial',
            fontWeight: 400, fontSize: 60, color: '#123456', align: 'center',
          }],
        },
      });
      const sources = [photo(), photo(4000, 6000)];
      const expected = [];
      for (const source of sources) expected.push(await preview(source));
      useStore.getState().saveCurrentTheme('My saved design');
      for (const [index, source] of sources.entries()) {
        expect(await preview(source)).toMatchObject({
          width: expected[index].width, height: expected[index].height, draws: expected[index].draws,
        });
      }
      const start = canvases.length;
      await exportPhotos(sources, null);
      expect(canvases.slice(start).map((c) => ({ width: c.width, height: c.height, draws: c.draws })))
        .toEqual(expected.map((c) => ({ width: c.width, height: c.height, draws: c.draws })));
    }
  );

  it('keeps customizations before resize and watermark post-effects', async () => {
    useStore.setState({
      fixImageWidth: true, imageWidth: 1920, fixWatermark: true, watermark: 'Watermark',
      themeElementOffsets: { '07. STRAP': { logo: { dx: 300, dy: -20 } } },
    });
    const source = photo();
    await preview(source);
    const expected = canvases[0].draws;
    await exportPhotos([source], 0);
    expect(canvases[2].draws).toEqual(expected);
    expect(canvases[3].width).toBe(1920);
    expect(canvases[3].draws[0].args[0]).toBe(canvases[2]);
    expect(expected.some((d) => d.args[0] === 'Watermark')).toBe(true);
  });

  it('keeps the explicit registry used for live preview drags', async () => {
    const source = photo();
    const original = await preview(source);
    const registry = new ElementRegistry('07. STRAP', (theme, id) => ({
      dx: id === 'logo' ? 123 : 0, dy: id === 'logo' ? 45 : 0,
    }));
    const dragged = await preview(source, registry);
    expect(registry.elements.find((e) => e.id === 'logo')).toBeDefined();
    expect(dragged.draws).not.toEqual(original.draws);
    await exportPhotos([source], 0);
    expect(canvases.at(-1)?.draws).toEqual(original.draws);
  });
});
