import { useState } from 'react';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import type Photo from '../core/drawing/Photo';
import { useStore } from '../store';
import { findTheme } from '../themes';
import render from '../core/drawing/render';
import { canvasToBlob, type ImageMimeType } from '../core/drawing/convert';
import { transplantExif } from '../core/exif/transplantExif';
import type { ThemeOptionInput, AcceptInputType } from '../core/drawing/theme';

type Props = {
  photos: Photo[];
  selectedIndex: number | null;
  onClose: () => void;
  onStatus: (s: { kind: 'idle' | 'busy' | 'error'; text: string }) => void;
};

function extFor(format: ImageMimeType): string {
  if (format === 'image/png') return 'png';
  if (format === 'image/webp') return 'webp';
  return 'jpg';
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.substring(0, i) : name;
}

function buildOptionsInput(
  themeName: string,
  themeOptions: { id: string; default: AcceptInputType }[],
  getThemeOption: <T extends AcceptInputType>(themeName: string, key: string, fallback: T) => T
): ThemeOptionInput {
  const m = new Map<string, AcceptInputType>();
  for (const o of themeOptions) {
    m.set(o.id, getThemeOption(themeName, o.id, o.default));
  }
  return m;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export default function ExportDialog({ photos, selectedIndex, onClose, onStatus }: Props) {
  const store = useStore();
  const [scope, setScope] = useState<'current' | 'all'>(
    selectedIndex !== null ? 'current' : 'all'
  );
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const themeDesc = findTheme(store.selectedThemeName);
  const ext = extFor(store.format);

  const renderPhoto = async (photo: Photo): Promise<Uint8Array> => {
    const input = buildOptionsInput(
      themeDesc.name,
      themeDesc.options as { id: string; default: AcceptInputType }[],
      store.getThemeOption
    );
    const canvas = await render(themeDesc.func, photo, input, store);
    const blob = await canvasToBlob(canvas, { type: store.format, quality: store.quality });
    let bytes = await blobToBytes(blob);
    // Preserve the original capture date / camera EXIF when requested.
    if (store.maintainExif) {
      bytes = await transplantExif(photo.file, bytes, store.format);
    }
    return bytes;
  };

  const exportOne = async () => {
    const idx = selectedIndex !== null ? selectedIndex : 0;
    const photo = photos[idx];
    if (!photo) return;
    const defaultName = `${stripExt(photo.file.name)}.framed.${ext}`;
    const dest = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!dest) return;
    setExporting(true);
    setProgress({ done: 0, total: 1 });
    onStatus({ kind: 'busy', text: `Exporting ${photo.file.name}…` });
    try {
      const bytes = await renderPhoto(photo);
      await writeFile(dest, bytes);
      setProgress({ done: 1, total: 1 });
      onStatus({ kind: 'idle', text: `Exported ${dest}` });
      onClose();
    } catch (err) {
      console.error(err);
      onStatus({ kind: 'error', text: `Export failed: ${err}` });
    } finally {
      setExporting(false);
    }
  };

  const exportAll = async () => {
    if (photos.length === 0) return;
    const folder = await openDialog({ directory: true, multiple: false });
    if (!folder || typeof folder !== 'string') return;
    setExporting(true);
    setProgress({ done: 0, total: photos.length });
    onStatus({ kind: 'busy', text: `Exporting ${photos.length} photos…` });
    let failures = 0;
    try {
      if (!(await exists(folder))) await mkdir(folder, { recursive: true });
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const outPath = `${folder}\\${stripExt(photo.file.name)}.framed.${ext}`;
        try {
          const bytes = await renderPhoto(photo);
          await writeFile(outPath, bytes);
        } catch (err) {
          console.error('Export failed for', photo.file.name, err);
          failures++;
        }
        setProgress({ done: i + 1, total: photos.length });
      }
      if (failures > 0) {
        onStatus({ kind: 'error', text: `Exported ${photos.length - failures}/${photos.length}, ${failures} failed` });
      } else {
        onStatus({ kind: 'idle', text: `Exported ${photos.length} photo${photos.length === 1 ? '' : 's'} to ${folder}` });
      }
      onClose();
    } catch (err) {
      console.error(err);
      onStatus({ kind: 'error', text: `Batch export failed: ${err}` });
    } finally {
      setExporting(false);
    }
  };

  const onExport = () => {
    if (scope === 'current') exportOne();
    else exportAll();
  };

  return (
    <div className="modal-backdrop" onClick={exporting ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          Export
          <button className="close" onClick={onClose} disabled={exporting}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>Scope</h3>
            <div className="settings-row">
              <div className="label">
                <label className="switch">
                  <input
                    type="radio"
                    checked={scope === 'current'}
                    onChange={() => setScope('current')}
                    disabled={selectedIndex === null}
                  />
                  <span>Current photo</span>
                </label>
              </div>
            </div>
            <div className="settings-row">
              <div className="label">
                <label className="switch">
                  <input
                    type="radio"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                  />
                  <span>All {photos.length} photo{photos.length === 1 ? '' : 's'} (pick folder)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Format</h3>
            <div className="settings-row">
              <div className="label">Format</div>
              <div className="control">
                <select
                  value={store.format}
                  onChange={(e) => store.set({ format: e.target.value as ImageMimeType })}
                >
                  <option value="image/jpeg">JPEG (.jpg)</option>
                  <option value="image/png">PNG (.png)</option>
                  <option value="image/webp">WebP (.webp)</option>
                </select>
              </div>
            </div>
            <div className="settings-row">
              <div className="label">Quality: {store.quality}</div>
              <div className="control">
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={store.quality}
                  onChange={(e) => store.set({ quality: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="settings-row">
              <div className="label">Resize to {store.fixImageWidth ? `${store.imageWidth}px wide` : 'original'}</div>
              <div className="control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={store.fixImageWidth}
                    onChange={(e) => store.set({ fixImageWidth: e.target.checked })}
                  />
                  <span>Resize</span>
                </label>
              </div>
            </div>
          </div>

          {exporting && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {progress.done} / {progress.total}
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-input)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width 0.1s',
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button className="primary" onClick={onExport} disabled={exporting}>
            {exporting ? 'Exporting…' : scope === 'current' ? 'Export…' : 'Choose folder…'}
          </button>
        </div>
      </div>
    </div>
  );
}
