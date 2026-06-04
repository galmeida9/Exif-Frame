import { useStore } from '../store';
import themes from '../themes';

type Props = {
  photoCount: number;
  canExport: boolean;
  onOpen: () => void;
  onExport: () => void;
  onSettings: () => void;
};

export default function Toolbar({ photoCount, canExport, onOpen, onExport, onSettings }: Props) {
  const selectedThemeName = useStore((s) => s.selectedThemeName);
  const darkMode = useStore((s) => s.darkMode);
  const set = useStore((s) => s.set);

  return (
    <div className="toolbar">
      <button onClick={onOpen} title="Open photos (Ctrl+O)">
        📂 Open
      </button>
      <button onClick={onExport} disabled={!canExport} className="primary" title="Export (Ctrl+S)">
        💾 Export
      </button>

      <div className="divider" />

      <label style={{ margin: 0, color: 'var(--text-secondary)' }}>Theme:</label>
      <select
        value={selectedThemeName}
        onChange={(e) => set({ selectedThemeName: e.target.value })}
      >
        {themes.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>

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
