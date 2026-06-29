import { useStore } from '../store';
import { CUSTOM_THEME_NAME, savedThemeKey } from '../store';
import themes from '../themes';

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
  const saveCurrentTheme = useStore((s) => s.saveCurrentTheme);

  // The Save button only appears on the base CUSTOM theme.
  const isCustom = selectedThemeName === CUSTOM_THEME_NAME;

  const onSave = () => {
    const name = window.prompt('Save this custom theme as:', 'My custom theme');
    if (name && name.trim()) saveCurrentTheme(name.trim());
  };

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

      {isCustom && (
        <button onClick={onSave} title="Save this custom theme so it appears in the dropdown">
          ⭐ Save theme
        </button>
      )}

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
