import { useState, useEffect } from 'react';
import type Photo from '../core/drawing/Photo';
import { useStore, type OverridableMetadata } from '../store';

type Props = {
  targetIndex: number;
  photo: Photo | null;
  onClose: () => void;
};

const FIELDS: Array<{ key: keyof OverridableMetadata | string; label: string; placeholder: string }> = [
  { key: 'make', label: 'Camera maker', placeholder: 'e.g. Sony' },
  { key: 'model', label: 'Camera model', placeholder: 'e.g. α7 III' },
  { key: 'lensModel', label: 'Lens model', placeholder: 'e.g. FE 24-105mm F4' },
  { key: 'focalLength', label: 'Focal length', placeholder: 'e.g. 50mm' },
  { key: 'focalLengthIn35mm', label: 'Focal length (35mm)', placeholder: 'e.g. 75mm' },
  { key: 'fNumber', label: 'Aperture', placeholder: 'e.g. F2.8' },
  { key: 'iso', label: 'ISO', placeholder: 'e.g. ISO400' },
  { key: 'exposureTime', label: 'Shutter', placeholder: 'e.g. 1/200s' },
  { key: 'takenAt', label: 'Taken at', placeholder: 'YYYY-MM-DD HH:MM:SS' },
];

export default function OverrideMetadataDialog({ targetIndex, photo, onClose }: Props) {
  const list = useStore((s) => s.overridableMetadata);
  const activeIndex = useStore((s) => s.overrideMetadataIndex);
  const upsert = useStore((s) => s.upsertOverridableMetadata);
  const remove = useStore((s) => s.removeOverridableMetadata);
  const set = useStore((s) => s.set);

  const existing = list[targetIndex] ?? {};
  const [draft, setDraft] = useState<OverridableMetadata>(existing);
  const [active, setActive] = useState<boolean>(activeIndex === targetIndex);

  useEffect(() => {
    setDraft(list[targetIndex] ?? {});
  }, [targetIndex, list]);

  const save = () => {
    upsert(targetIndex, draft);
    set({ overrideMetadataIndex: active ? targetIndex : activeIndex === targetIndex ? null : activeIndex });
    onClose();
  };

  const deletePreset = () => {
    remove(targetIndex);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          Override metadata
          <button className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {photo && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 0 }}>
              Preset #{targetIndex + 1} for <b>{photo.file.name}</b>. Leave fields empty to keep the
              original EXIF value.
            </p>
          )}

          <label className="switch" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Use this preset (replaces metadata for ALL photos while active)</span>
          </label>

          {FIELDS.map((f) => (
            <div className="settings-row" key={f.key as string}>
              <div className="label">{f.label}</div>
              <div className="control">
                <input
                  type="text"
                  value={(draft[f.key as string] as string) ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft({ ...draft, [f.key as string]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          {list[targetIndex] && (
            <button onClick={deletePreset} style={{ marginRight: 'auto' }}>
              Delete preset
            </button>
          )}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
