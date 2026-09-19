import { useState } from 'react';
import { useStore } from '../store';
import { savedThemeKey } from '../store';
import themes from '../themes';
import SaveThemeDialog from './SaveThemeDialog';

type Props = {
  photoCount: number;
  canExport: boolean;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  onOpen: () => void;
  onExport: () => void;
  onSettings: () => void;
};

export default function Toolbar({
  photoCount,
  canExport,
  libraryOpen,
  onToggleLibrary,
  onOpen,
  onExport,
  onSettings,
}: Props) {
  const selectedThemeName = useStore((s) => s.selectedThemeName);
  const darkMode = useStore((s) => s.darkMode);
  const savedThemes = useStore((s) => s.savedThemes);
  const set = useStore((s) => s.set);
  const [saveThemeOpen, setSaveThemeOpen] = useState(false);

  return (
    <div className="toolbar">
      <button
        className="icon-only"
        onClick={onToggleLibrary}
        title={libraryOpen ? 'Hide photo list' : 'Show photo list'}
        aria-pressed={libraryOpen}
      >
        {libraryOpen ? '◧' : '▥'}
      </button>

      <div className="divider" />

      <button onClick={onOpen} title="Open photos (Ctrl+O)">
        📂 Open
      </button>
      <button onClick={onExport} disabled={!canExport} className="primary" title="Export (Ctrl+S)">
        💾 Export
      </button>

      <div className="divider" />

      <label style={{ margin: 0, color: 'var(--text-secondary)' }}>Theme:</label>
      <select value={selectedThemeName} onChange={(e) => set({ selectedThemeName: e.target.value })}>
        {themes.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
        {savedThemes.length > 0 && (
          <optgroup label="Saved custom themes">
            {savedThemes.map((p) => (
              <option key={p.id} value={savedThemeKey(p.id)}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <button
        onClick={() => setSaveThemeOpen(true)}
        title="Save a named copy of this theme with its current customizations"
      >
        ⭐ Save new theme
      </button>
      {saveThemeOpen && <SaveThemeDialog onClose={() => setSaveThemeOpen(false)} />}

      <div className="spacer" />

      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {photoCount} photo{photoCount === 1 ? '' : 's'}
      </span>

      <button
        className="icon-only"
        onClick={() => set({ darkMode: !darkMode })}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <button className="icon-only" onClick={onSettings} title="Settings (Ctrl+,)">
        ⚙️
      </button>
    </div>
  );
}
