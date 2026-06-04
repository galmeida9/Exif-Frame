import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The metadata tokens a template can contain. The `token` is the wire format
 * stored inside the `{...}` template string consumed by applyTemplate(); the
 * `label` is what the user sees on the pill / dropdown.
 *
 * Keep in sync with src/themes/_shared/applyTemplate.ts.
 */
export const TEMPLATE_TOKENS: { token: string; label: string }[] = [
  { token: 'MAKER', label: 'Maker' },
  { token: 'BODY', label: 'Body' },
  { token: 'LENS', label: 'Lens' },
  { token: 'ISO', label: 'ISO' },
  { token: 'MM', label: 'Focal length' },
  { token: 'F', label: 'Aperture' },
  { token: 'SEC', label: 'Shutter' },
  { token: 'TAKEN_AT', label: 'Date' },
];

const LABEL_BY_TOKEN = new Map(TEMPLATE_TOKENS.map((t) => [t.token, t.label]));

/** Parse a `{MAKER}{ISO}` style string into an ordered list of known tokens. */
export function parseTemplate(value: string): string[] {
  const matches = value.match(/\{([A-Z0-9_]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1)).filter((t) => LABEL_BY_TOKEN.has(t));
}

/** Serialize an ordered token list back into the `{MAKER}{ISO}` wire format. */
export function serializeTemplate(tokens: string[]): string {
  return tokens.map((t) => `{${t}}`).join('');
}

const DRAG_THRESHOLD = 4; // px before a press becomes a drag

type DragState = {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
};

export default function TemplatePillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const tokens = parseTemplate(value);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dragRef = useRef<DragState | null>(null);
  // Mirror overIndex into a ref so the pointerup handler reads the latest value
  // without needing it in a dependency array.
  const overIndexRef = useRef<number | null>(null);
  overIndexRef.current = overIndex;

  // Close the add-token dropdown on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Keep the pill ref array length in sync.
  useLayoutEffect(() => {
    pillRefs.current.length = tokens.length;
  }, [tokens.length]);

  const commit = (next: string[]) => onChange(serializeTemplate(next));

  const removeAt = (index: number) => {
    const next = tokens.slice();
    next.splice(index, 1);
    commit(next);
  };

  const addToken = (token: string) => {
    commit([...tokens, token]);
    setMenuOpen(false);
  };

  // Given a pointer position, find which pill index it is hovering (by nearest
  // center). Works with wrapped rows because it compares full 2D distance.
  const indexAtPoint = (clientX: number, clientY: number): number => {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pillRefs.current.length; i++) {
      const el = pillRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = (clientX - cx) ** 2 + (clientY - cy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent<HTMLSpanElement>) => {
    // Ignore presses that start on the remove button.
    if ((e.target as HTMLElement).closest('.pill-remove')) return;
    if (e.button !== 0) return;
    dragRef.current = {
      index,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (!drag.active) {
      const moved =
        Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - drag.startY) > DRAG_THRESHOLD;
      if (!moved) return;
      drag.active = true;
      setDragIndex(drag.index);
    }

    const target = indexAtPoint(e.clientX, e.clientY);
    if (target !== -1) setOverIndex(target);
  };

  const finishDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const over = overIndexRef.current;
    if (drag.active && over !== null && over !== drag.index) {
      const next = tokens.slice();
      const [moved] = next.splice(drag.index, 1);
      const insertAt = drag.index < over ? over - 1 : over;
      next.splice(insertAt, 0, moved);
      commit(next);
    }

    dragRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="template-editor" ref={rootRef}>
      <div className="template-pills">
        {tokens.map((token, index) => (
          <span
            key={`${token}-${index}`}
            ref={(el) => {
              pillRefs.current[index] = el;
            }}
            className={`template-pill${dragIndex === index ? ' dragging' : ''}${
              dragIndex !== null && overIndex === index && overIndex !== dragIndex ? ' drop-target' : ''
            }`}
            onPointerDown={onPointerDown(index)}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            title="Drag to reorder"
          >
            <span className="grip" aria-hidden>
              ⠿
            </span>
            <span className="pill-label">{LABEL_BY_TOKEN.get(token) ?? token}</span>
            <button
              type="button"
              className="pill-remove"
              onClick={() => removeAt(index)}
              title="Remove"
              aria-label={`Remove ${LABEL_BY_TOKEN.get(token) ?? token}`}
            >
              ×
            </button>
          </span>
        ))}

        <div className="template-add">
          <button
            type="button"
            className="template-add-btn"
            onClick={() => setMenuOpen((o) => !o)}
            title="Add field"
            aria-label="Add field"
            aria-expanded={menuOpen}
          >
            +
          </button>
          {menuOpen && (
            <div className="template-menu" role="menu">
              {TEMPLATE_TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  className="template-menu-item"
                  role="menuitem"
                  onClick={() => addToken(t.token)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
