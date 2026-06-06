import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { findTheme } from '../themes';
import type { CapturedElement } from '../core/drawing/elements';
import { subscribeElements, getPublishedElements } from './elementsChannel';
import { setHoveredElement } from './elementHover';
import { ALL_FONT_FAMILIES } from '../fonts';
import TemplatePillEditor from './TemplatePillEditor';
import LinesEditor from './LinesEditor';

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const ALIGNS = ['left', 'center', 'right'] as const;

/**
 * Unified per-element editor used by every built-in theme. Lists each text line
 * the theme draws as a "Text line" card with — like the CUSTOM theme — its
 * template pills (when the line is template-backed) plus font / weight / size /
 * color / alignment, and hide / reset. Non-text things (logo, divider) are
 * listed separately as "Other elements" with just show/hide.
 */
export default function ElementStylePanel({
  extraLinesJson,
  onExtraLinesChange,
}: {
  extraLinesJson: string;
  onExtraLinesChange: (json: string) => void;
}) {
  const store = useStore();
  const {
    selectedThemeName,
    getElementStyle,
    setElementStyle,
    resetElementStyle,
    resetElementOffset,
    toggleElementHidden,
    getElementOffset,
    getThemeOption,
    setThemeOption,
  } = store;
  // Re-render when style/offset/option maps change.
  void store.themeElementStyles;
  void store.themeElementOffsets;
  void store.themeOptions;

  const themeDesc = findTheme(selectedThemeName);

  // Map element id -> backing template option id (string options that declared
  // an `elementId`), so each line can show its content as editable pills.
  const templateForElement = new Map<string, { id: string; def: string }>();
  for (const opt of themeDesc.options) {
    if (opt.type === 'string' && 'elementId' in opt && opt.elementId) {
      templateForElement.set(opt.elementId, { id: opt.id, def: opt.default });
    }
  }

  const [elements, setElements] = useState<CapturedElement[]>(getPublishedElements());
  useEffect(() => {
    setElements(getPublishedElements());
    return subscribeElements(setElements);
  }, []);

  // Theme's own text lines (exclude user-added extra lines — those have their
  // own editor).
  const textLines = elements.filter((e) => e.kind === 'text' && !e.id.startsWith('extra:'));
  const others = elements.filter((e) => e.kind !== 'text' && !e.id.startsWith('extra:'));

  return (
    <>
      <div className="elements-section">
        <div className="elements-title">Text lines</div>
          {textLines.map((el) => {
            const style = getElementStyle(selectedThemeName, el.id);
            const offset = getElementOffset(selectedThemeName, el.id);
            const hidden = !!offset.hidden;
            const tmpl = templateForElement.get(el.id);
            // Whether the user changed anything resettable (style override or a
            // moved/hidden position) — used to gray out the reset button.
            const hasChange = Object.keys(style).length > 0 || offset.dx !== 0 || offset.dy !== 0 || hidden;
            // Actual values the theme drew this line with (used as the shown
            // value when the user hasn't overridden a property).
            const r = el.resolved;
            const curFamily = style.fontFamily ?? r?.fontFamily ?? 'Barlow';
            const curWeight = style.fontWeight ?? r?.fontWeight ?? 400;
            const curSize = style.fontSize ?? r?.fontSize ?? 60;
            const curAlign = style.align ?? r?.align ?? 'center';
            const curColor = style.color ?? r?.color ?? '#000000';
            return (
              <div
                key={el.id}
                className="line-card"
                onMouseEnter={() => setHoveredElement(el.id)}
                onMouseLeave={() => setHoveredElement(null)}
              >
                <div className="line-card-head">
                  <span className="line-title">{el.label}</span>
                  <div className="line-card-actions">
                    <button
                      type="button"
                      className="line-mini"
                      title={hidden ? 'Show line' : 'Hide line'}
                      onClick={() => toggleElementHidden(selectedThemeName, el.id, !hidden)}
                    >
                      {hidden ? '🚫' : '👁'}
                    </button>
                    <button
                      type="button"
                      className="line-mini"
                      title="Reset this line to its defaults"
                      disabled={!hasChange}
                      onClick={() => {
                        resetElementStyle(selectedThemeName, el.id);
                        resetElementOffset(selectedThemeName, el.id);
                      }}
                    >
                      ↺
                    </button>
                  </div>
                </div>

                {tmpl && (
                  <TemplatePillEditor
                    value={getThemeOption(selectedThemeName, tmpl.id, tmpl.def) as string}
                    onChange={(v) => setThemeOption(selectedThemeName, tmpl.id, v)}
                  />
                )}

                {!hidden && (
                  <div className="line-controls">
                    <label className="line-ctl">
                      <span>Font</span>
                      <select
                        value={curFamily}
                        onChange={(e) =>
                          setElementStyle(selectedThemeName, el.id, { fontFamily: e.target.value })
                        }
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
                        value={curWeight}
                        onChange={(e) =>
                          setElementStyle(selectedThemeName, el.id, { fontWeight: Number(e.target.value) })
                        }
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
                        value={Math.round(curSize)}
                        onChange={(e) =>
                          setElementStyle(selectedThemeName, el.id, {
                            fontSize: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </label>

                    <label className="line-ctl">
                      <span>Align</span>
                      <select
                        value={curAlign}
                        onChange={(e) =>
                          setElementStyle(selectedThemeName, el.id, {
                            align: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
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
                        value={curColor}
                        onChange={(e) => setElementStyle(selectedThemeName, el.id, { color: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <LinesEditor value={extraLinesJson} onChange={onExtraLinesChange} idPrefix="extra:" />
        </div>

      {others.length > 0 && (
        <div className="elements-section">
          <div className="elements-title">Other elements</div>
          {others.map((el) => {
            const offset = getElementOffset(selectedThemeName, el.id);
            const hidden = !!offset.hidden;
            const moved = offset.dx !== 0 || offset.dy !== 0;
            return (
              <div
                key={el.id}
                className="element-row"
                onMouseEnter={() => setHoveredElement(el.id)}
                onMouseLeave={() => setHoveredElement(null)}
              >
                <span className="element-name">{el.label}</span>
                <div className="line-card-actions">
                  <button
                    type="button"
                    className="line-mini"
                    title={hidden ? 'Show element' : 'Hide element'}
                    onClick={() => toggleElementHidden(selectedThemeName, el.id, !hidden)}
                  >
                    {hidden ? '🚫' : '👁'}
                  </button>
                  <button
                    type="button"
                    className="line-mini"
                    title="Reset to original position"
                    disabled={!moved && !hidden}
                    onClick={() => resetElementOffset(selectedThemeName, el.id)}
                  >
                    ↺
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
