import { useStore } from '../store';

type Props = { onClose: () => void };

const DATE_FORMATS = [
  '2001-01-01 01:01:01',
  '2001/01/01 01:01:01',
  '2001-01-01',
  '2001/01/01',
  'Jan 1, 2001',
  '2001年01月01日 01時01分',
  '2001年01月01日',
  '2001년 01월 01일 01시 01분',
  '2001년 01월 01일',
];

const RATIOS = ['free', '1:1', '4:5', '5:4', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4'];

export default function SettingsDialog({ onClose }: Props) {
  const store = useStore();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          Settings
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>Display</h3>
            <Row label="Dark mode">
              <Switch value={store.darkMode} onChange={(v) => store.set({ darkMode: v })} />
            </Row>
          </div>

          <div className="settings-section">
            <h3>Canvas</h3>
            <Row label="Aspect ratio">
              <select value={store.ratio} onChange={(e) => store.set({ ratio: e.target.value })}>
                {RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Not cropped (letterbox)">
              <Switch value={store.notCroppedMode} onChange={(v) => store.set({ notCroppedMode: v })} />
            </Row>
          </div>

          <div className="settings-section">
            <h3>Output</h3>
            <Row label="Format">
              <select value={store.format} onChange={(e) => store.set({ format: e.target.value as typeof store.format })}>
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
                <option value="image/webp">WebP (.webp)</option>
              </select>
            </Row>
            <Row label={`Quality: ${store.quality}`}>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={store.quality}
                onChange={(e) => store.set({ quality: Number(e.target.value) })}
              />
            </Row>
            <Row label="Resize on export">
              <Switch value={store.fixImageWidth} onChange={(v) => store.set({ fixImageWidth: v })} />
            </Row>
            {store.fixImageWidth && (
              <Row label="Max width (px)">
                <input
                  type="number"
                  min={64}
                  max={4096}
                  value={store.imageWidth}
                  onChange={(e) => store.set({ imageWidth: Math.max(64, Math.min(4096, Number(e.target.value) || 1920)) })}
                />
              </Row>
            )}
            <Row label="Maintain original EXIF">
              <Switch value={store.maintainExif} onChange={(v) => store.set({ maintainExif: v })} />
            </Row>
          </div>

          <div className="settings-section">
            <h3>Watermark</h3>
            <Row label="Burn-in watermark">
              <Switch value={store.fixWatermark} onChange={(v) => store.set({ fixWatermark: v })} />
            </Row>
            {store.fixWatermark && (
              <Row label="Watermark text">
                <input
                  type="text"
                  value={store.watermark}
                  onChange={(e) => store.set({ watermark: e.target.value })}
                />
              </Row>
            )}
          </div>

          <div className="settings-section">
            <h3>Metadata display</h3>
            <Row label="Show camera maker">
              <Switch value={store.showCameraMaker} onChange={(v) => store.set({ showCameraMaker: v })} />
            </Row>
            <Row label="Show camera model">
              <Switch value={store.showCameraModel} onChange={(v) => store.set({ showCameraModel: v })} />
            </Row>
            <Row label="Show lens model">
              <Switch value={store.showLensModel} onChange={(v) => store.set({ showLensModel: v })} />
            </Row>
            <Row label="Hide exposure (ISO/MM/F/SEC)">
              <Switch value={store.disableExposureMeter} onChange={(v) => store.set({ disableExposureMeter: v })} />
            </Row>
            <Row label="Date format">
              <select value={store.dateNotation} onChange={(e) => store.set({ dateNotation: e.target.value })}>
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Use camera focal length (don't convert to 35mm)">
              <Switch value={store.useCameraFocalLength} onChange={(v) => store.set({ useCameraFocalLength: v })} />
            </Row>
            <Row label="Multiply focal length by crop factor">
              <Switch value={store.focalLengthRatioMode} onChange={(v) => store.set({ focalLengthRatioMode: v })} />
            </Row>
            {store.focalLengthRatioMode && (
              <Row label={`Crop factor: ${store.focalLengthRatio.toFixed(2)}×`}>
                <input
                  type="number"
                  step={0.01}
                  min={0.1}
                  max={10}
                  value={store.focalLengthRatio}
                  onChange={(e) => store.set({ focalLengthRatio: Number(e.target.value) || 1 })}
                />
              </Row>
            )}
          </div>

          <div className="settings-section">
            <h3>Global metadata override</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 0 }}>
              Replace the EXIF maker / model / lens text on every photo. Leave empty to use what's in the file.
            </p>
            <Row label="Camera maker">
              <input
                type="text"
                value={store.overrideCameraMaker}
                onChange={(e) => store.set({ overrideCameraMaker: e.target.value })}
                placeholder="e.g. Sony"
              />
            </Row>
            <Row label="Camera model">
              <input
                type="text"
                value={store.overrideCameraModel}
                onChange={(e) => store.set({ overrideCameraModel: e.target.value })}
                placeholder="e.g. α7 III"
              />
            </Row>
            <Row label="Lens model">
              <input
                type="text"
                value={store.overrideLensModel}
                onChange={(e) => store.set({ overrideLensModel: e.target.value })}
                placeholder="e.g. FE 24-105mm F4"
              />
            </Row>
          </div>

          <div className="settings-section">
            <h3>Keyboard shortcuts</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8, margin: 0 }}>
              <span className="kbd">Ctrl+O</span> Open · <span className="kbd">Ctrl+S</span> Export ·{' '}
              <span className="kbd">Ctrl+,</span> Settings · <span className="kbd">Del</span> Remove ·{' '}
              <span className="kbd">↑↓←→</span> Navigate
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="label">{label}</div>
      <div className="control">{children}</div>
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch" style={{ justifyContent: 'flex-end' }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
