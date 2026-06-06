import { useCallback } from 'react';
import type { CustomLine } from '../core/drawing/theme';
import { ALL_FONT_FAMILIES } from '../fonts';
import TemplatePillEditor from './TemplatePillEditor';
import { parseLines, newLineId } from '../themes/_shared/customLines';
import { setHoveredElement } from './elementHover';

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const ALIGNS: CustomLine['align'][] = ['left', 'center', 'right'];

/**
 * Editor for the CUSTOM theme's dynamic text lines. The whole list is
 * serialized to a JSON string and stored as a single `lines` theme option, so
 * it rides the existing persistence / undo-redo / drag systems. Hovering a line
 * card highlights the matching element in the preview.
 */
export default function LinesEditor({
  value,
  onChange,
  idPrefix = '',
}: {
  value: string;
  onChange: (next: string) => void;
  /** Prefix used when publishing element-hover ids (extra lines use "extra:"). */
  idPrefix?: string;
}) {
  const lines = parseLines(value);

  const commit = useCallback(
    (next: CustomLine[]) => onChange(JSON.stringify(next)),
    [onChange]
  );

  const update = (index: number, patch: Partial<CustomLine>) => {
    const next = lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
    commit(next);
  };

  const remove = (index: number) => {
    commit(lines.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = lines.slice();
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const add = () => {
    const next: CustomLine[] = [
      ...lines,
      {
        id: newLineId(),
        template: '{MAKER}',
        fontFamily: 'Barlow',
        fontWeight: 400,
        fontSize: 60,
        color: '#000000',
        align: 'center',
      },
    ];
    commit(next);
  };

  return (
    <div className="lines-editor">
      {lines.map((line, index) => (
        <div
          key={line.id}
          className="line-card"
          onMouseEnter={() => setHoveredElement(idPrefix + line.id)}
          onMouseLeave={() => setHoveredElement(null)}
        >
          <div className="line-card-head">
            <input
              className="line-title-input"
              value={line.label ?? ''}
              placeholder={`Line ${index + 1}`}
              title="Rename this line"
              onChange={(e) => update(index, { label: e.target.value || undefined })}
            />
            <div className="line-card-actions">
              <button
                type="button"
                className="line-mini"
                title="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="line-mini"
                title="Move down"
                disabled={index === lines.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="line-mini danger"
                title="Remove line"
                onClick={() => remove(index)}
              >
                ✕
              </button>
            </div>
          </div>

          <TemplatePillEditor value={line.template} onChange={(t) => update(index, { template: t })} />

          <div className="line-controls">
            <label className="line-ctl">
              <span>Font</span>
              <select
                value={line.fontFamily}
                onChange={(e) => update(index, { fontFamily: e.target.value })}
              >
                {ALL_FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="line-ctl">
              <span>Weight</span>
              <select
                value={line.fontWeight}
                onChange={(e) => update(index, { fontWeight: Number(e.target.value) })}
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            <label className="line-ctl">
              <span>Size</span>
              <input
                type="number"
                min={8}
                max={400}
                value={line.fontSize}
                onChange={(e) => update(index, { fontSize: Number(e.target.value) || 0 })}
              />
            </label>

            <label className="line-ctl">
              <span>Align</span>
              <select
                value={line.align}
                onChange={(e) => update(index, { align: e.target.value as CustomLine['align'] })}
              >
                {ALIGNS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="line-ctl color">
              <span>Color</span>
              <input
                type="color"
                value={line.color}
                onChange={(e) => update(index, { color: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="add-line-btn" onClick={add}>
        + Add line
      </button>
    </div>
  );
}
