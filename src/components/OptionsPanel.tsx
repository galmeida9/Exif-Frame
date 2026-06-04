import { useState } from 'react';
import { useStore } from '../store';
import { findTheme } from '../themes';
import type { ThemeOption } from '../core/drawing/theme';
import TemplatePillEditor from './TemplatePillEditor';

/** Template fields use a curly-brace token string and get the pill editor UI. */
function isTemplateField(opt: ThemeOption): boolean {
  return opt.type === 'string' && /^TEMPLATE/i.test(opt.id);
}

export default function OptionsPanel() {
  // Subscribe to the full store so the panel always re-renders on any change
  // (including hydration), and use the exact same getter the renderer uses.
  // This guarantees the displayed input value can never diverge from the
  // value the renderer actually feeds into the theme function.
  const store = useStore();
  const {
    selectedThemeName,
    themeOptions,
    themeElementOffsets,
    setThemeOption,
    set,
    getThemeOption,
    resetThemeLayout,
    toggleElementHidden,
  } = store;

  const themeDesc = findTheme(selectedThemeName);
  const customizedThemeCount = Object.keys(themeOptions).filter(
    (name) => Object.keys(themeOptions[name] ?? {}).length > 0
  ).length;
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Layout (per-element drag) state for the current theme.
  const layoutMap = themeElementOffsets[selectedThemeName] ?? {};
  const layoutIds = Object.keys(layoutMap);
  const hasLayoutChanges = layoutIds.some(
    (id) => layoutMap[id].dx !== 0 || layoutMap[id].dy !== 0 || layoutMap[id].hidden
  );
  const hiddenIds = layoutIds.filter((id) => layoutMap[id].hidden);

  const reset = () => {
    const next = { ...themeOptions };
    delete next[selectedThemeName];
    set({ themeOptions: next });
  };

  const resetAll = () => {
    set({ themeOptions: {}, themeElementOffsets: {} });
    setConfirmResetAll(false);
  };

  const resetField = (id: string) => {
    const themeMap = { ...(themeOptions[selectedThemeName] ?? {}) };
    delete themeMap[id];
    const next = { ...themeOptions };
    if (Object.keys(themeMap).length === 0) {
      delete next[selectedThemeName];
    } else {
      next[selectedThemeName] = themeMap;
    }
    set({ themeOptions: next });
  };

  return (
    <div className="options-panel">
      <div className="header">
        <span>Options</span>
        <div className="header-actions">
          <button
            className="reset"
            onClick={reset}
            title="Reset all options for this theme back to its defaults"
          >
            Reset theme
          </button>
          <button
            className="reset"
            onClick={() => setConfirmResetAll(true)}
            disabled={customizedThemeCount === 0}
            title={
              customizedThemeCount === 0
                ? 'No custom options to reset'
                : `Wipe customizations for all ${customizedThemeCount} theme(s)`
            }
          >
            Reset all
          </button>
        </div>
      </div>
      <div className="body">
        {themeDesc.options.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
            This theme has no options.
          </div>
        ) : (
          themeDesc.options.map((opt) => {
            const value = getThemeOption(
              selectedThemeName,
              opt.id,
              opt.default as string | number | boolean
            );
            const isCustomized = themeOptions[selectedThemeName]?.[opt.id] !== undefined;
            return (
              <OptionField
                key={`${selectedThemeName}::${opt.id}`}
                opt={opt}
                value={value}
                isCustomized={isCustomized}
                onChange={(v) => setThemeOption(selectedThemeName, opt.id, v)}
                onResetField={() => resetField(opt.id)}
              />
            );
          })
        )}

        {(hasLayoutChanges || hiddenIds.length > 0) && (
          <div className="layout-section">
            <div className="layout-header">
              <span>Layout</span>
              <button
                className="reset"
                onClick={() => resetThemeLayout(selectedThemeName)}
                title="Move every element back to its default position and unhide all"
              >
                Reset layout
              </button>
            </div>
            <div className="layout-hint">Drag elements directly on the preview to reposition them.</div>
            {hiddenIds.length > 0 && (
              <div className="hidden-elements">
                <div className="hidden-title">Hidden elements</div>
                {hiddenIds.map((id) => (
                  <button
                    key={id}
                    className="restore-btn"
                    onClick={() => toggleElementHidden(selectedThemeName, id, false)}
                    title={`Show "${prettyId(id)}" again`}
                  >
                    + {prettyId(id)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmResetAll && (
        <div
          className="confirm-overlay"
          onClick={() => setConfirmResetAll(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              maxWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Reset all theme customizations?</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              This wipes saved options for every theme ({customizedThemeCount} customized). Other
              settings (ratio, watermark, metadata overrides) are untouched.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmResetAll(false)}>Cancel</button>
              <button className="primary" onClick={resetAll}>
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function prettyId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function OptionField({
  opt,
  value,
  isCustomized,
  onChange,
  onResetField,
}: {
  opt: ThemeOption;
  value: string | number | boolean;
  isCustomized: boolean;
  onChange: (v: string | number | boolean) => void;
  onResetField: () => void;
}) {
  return (
    <div className="option-field">
      {opt.type !== 'boolean' && (
        <label className="option-label">
          <span>{opt.id}</span>
          {isCustomized && (
            <button
              type="button"
              className="field-reset"
              onClick={onResetField}
              title={`Reset to default (${String(opt.default)})`}
            >
              ↺
            </button>
          )}
        </label>
      )}

      {opt.type === 'string' && isTemplateField(opt) && (
        <TemplatePillEditor value={value as string} onChange={(v) => onChange(v)} />
      )}

      {opt.type === 'string' && !isTemplateField(opt) && (
        <div className="row">
          <input type="text" value={value as string} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}

      {opt.type === 'number' && (
        <div className="row">
          <input
            type="number"
            value={value as number}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </div>
      )}

      {opt.type === 'color' && (
        <div className="row">
          <input
            type="color"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      )}

      {opt.type === 'boolean' && (
        <label className="switch">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{opt.id}</span>
          {isCustomized && (
            <button
              type="button"
              className="field-reset"
              onClick={onResetField}
              title={`Reset to default (${String(opt.default)})`}
            >
              ↺
            </button>
          )}
        </label>
      )}

      {opt.type === 'select' && (
        <div className="row">
          <select value={value as string} onChange={(e) => onChange(e.target.value)}>
            {opt.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      )}

      {opt.type === 'range-slider' && (
        <div className="row">
          <input
            type="range"
            min={opt.min}
            max={opt.max}
            step={opt.step}
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="value">{Number(value).toFixed(opt.step < 1 ? 2 : 0)}</span>
        </div>
      )}

      {opt.description && <div className="desc">{opt.description}</div>}
    </div>
  );
}
