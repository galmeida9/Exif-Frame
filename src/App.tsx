import { useEffect, useState, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import Photo from './core/drawing/Photo';
import { useStore } from './store';
import Toolbar from './components/Toolbar';
import PhotoLibrary from './components/PhotoLibrary';
import PreviewCanvas from './components/PreviewCanvas';
import OptionsPanel from './components/OptionsPanel';
import StatusBar from './components/StatusBar';
import SettingsDialog from './components/SettingsDialog';
import OverrideMetadataDialog from './components/OverrideMetadataDialog';
import ExportDialog from './components/ExportDialog';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'heic', 'heif', 'bmp'];

export default function App() {
  const darkMode = useStore((s) => s.darkMode);
  const hydrated = useStore((s) => s.hydrated);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'error'; text: string }>({
    kind: 'idle',
    text: 'Ready',
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] ?? null : null;

  const loadFromPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setLoading(true);
    setStatus({ kind: 'busy', text: `Loading ${paths.length} photo${paths.length === 1 ? '' : 's'}…` });
    const newPhotos: Photo[] = [];
    let failures = 0;
    for (const path of paths) {
      try {
        const bytes = await readFile(path);
        const name = path.split(/[\\/]/).pop() || 'photo';
        const file = new File([bytes], name);
        const photo = await Photo.create(file);
        newPhotos.push(photo);
      } catch (err) {
        console.warn('Failed to load', path, err);
        failures++;
      }
    }
    setPhotos((prev) => {
      const next = [...prev, ...newPhotos];
      if (selectedIndex === null && next.length > 0) setSelectedIndex(prev.length);
      return next;
    });
    setLoading(false);
    if (failures > 0) {
      setStatus({ kind: 'error', text: `Loaded ${newPhotos.length}, failed ${failures}` });
    } else {
      setStatus({ kind: 'idle', text: `Loaded ${newPhotos.length} photo${newPhotos.length === 1 ? '' : 's'}` });
    }
  }, [selectedIndex]);

  const loadFromFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setLoading(true);
    setStatus({ kind: 'busy', text: `Loading ${files.length} photo${files.length === 1 ? '' : 's'}…` });
    const newPhotos: Photo[] = [];
    let failures = 0;
    for (const file of files) {
      try {
        newPhotos.push(await Photo.create(file));
      } catch (err) {
        console.warn('Failed to load', file.name, err);
        failures++;
      }
    }
    setPhotos((prev) => {
      const next = [...prev, ...newPhotos];
      if (selectedIndex === null && next.length > 0) setSelectedIndex(prev.length);
      return next;
    });
    setLoading(false);
    if (failures > 0) {
      setStatus({ kind: 'error', text: `Loaded ${newPhotos.length}, failed ${failures}` });
    } else {
      setStatus({ kind: 'idle', text: `Loaded ${newPhotos.length} photo${newPhotos.length === 1 ? '' : 's'}` });
    }
  }, [selectedIndex]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: IMAGE_EXTS }],
      });
      if (!result) return;
      const paths = Array.isArray(result) ? result : [result];
      await loadFromPaths(paths);
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', text: 'Open dialog failed' });
    }
  }, [loadFromPaths]);

  const handleRemove = useCallback((index: number) => {
    setPhotos((prev) => {
      const photo = prev[index];
      if (photo) photo.dispose();
      return prev.filter((_, i) => i !== index);
    });
    setSelectedIndex((prevSel) => {
      if (prevSel === null) return null;
      // New length is (current photos length) - 1, but we compute via prevSel-relative logic.
      if (prevSel === index) {
        // The selected item was removed: keep the position if possible, else fall back to last.
        return prevSel; // App will clamp on next render via photos array bounds
      }
      if (prevSel > index) return prevSel - 1;
      return prevSel;
    });
  }, []);

  // Clamp selectedIndex if photos shrink past it.
  useEffect(() => {
    if (selectedIndex === null) return;
    if (photos.length === 0) {
      setSelectedIndex(null);
    } else if (selectedIndex >= photos.length) {
      setSelectedIndex(photos.length - 1);
    }
  }, [photos.length, selectedIndex]);

  const handleClear = useCallback(() => {
    for (const p of photos) p.dispose();
    setPhotos([]);
    setSelectedIndex(null);
    setStatus({ kind: 'idle', text: 'Cleared' });
  }, [photos]);

  // OS-level file drop (Tauri)
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', async (e) => {
      const paths = (e.payload?.paths || []).filter((p) =>
        IMAGE_EXTS.some((ext) => p.toLowerCase().endsWith('.' + ext))
      );
      if (paths.length > 0) await loadFromPaths(paths);
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [loadFromPaths]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpen();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (photos.length > 0) setExportOpen(true);
        return;
      }
      if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // Undo / redo per-theme edits (work even while focused in an input).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useStore.getState().redo();
        return;
      }

      if (isEditing) return;

      if (e.key === 'Delete' && selectedIndex !== null) {
        e.preventDefault();
        handleRemove(selectedIndex);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (photos.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev === null ? 0 : Math.min(photos.length - 1, prev + 1)));
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (photos.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, selectedIndex, handleOpen, handleRemove]);

  const aboutSelected = useMemo(() => {
    if (!selectedPhoto) return null;
    return {
      width: selectedPhoto.image.width,
      height: selectedPhoto.image.height,
      filename: selectedPhoto.file.name,
    };
  }, [selectedPhoto]);

  if (!hydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Toolbar
        photoCount={photos.length}
        canExport={photos.length > 0}
        onOpen={handleOpen}
        onExport={() => setExportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="app-body">
        <PhotoLibrary
          photos={photos}
          selectedIndex={selectedIndex}
          loading={loading}
          onSelect={setSelectedIndex}
          onRemove={handleRemove}
          onClear={handleClear}
          onAdd={handleOpen}
          onFilesDropped={loadFromFiles}
          onOverride={(i) => setOverrideTarget(i)}
        />

        <PreviewCanvas photo={selectedPhoto} onFilesDropped={loadFromFiles} onOpen={handleOpen} />

        <OptionsPanel />
      </div>

      <StatusBar
        photoCount={photos.length}
        selected={aboutSelected}
        statusKind={status.kind}
        statusText={status.text}
      />

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      {overrideTarget !== null && (
        <OverrideMetadataDialog
          targetIndex={overrideTarget}
          photo={photos[overrideTarget] ?? null}
          onClose={() => setOverrideTarget(null)}
        />
      )}

      {exportOpen && (
        <ExportDialog
          photos={photos}
          selectedIndex={selectedIndex}
          onClose={() => setExportOpen(false)}
          onStatus={setStatus}
        />
      )}
    </div>
  );
}
