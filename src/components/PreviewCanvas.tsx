import { useEffect, useRef, useState, useCallback } from 'react';
import type Photo from '../core/drawing/Photo';
import { useStore } from '../store';
import { findTheme } from '../themes';
import render from '../core/drawing/render';
import type { ThemeOptionInput, AcceptInputType } from '../core/drawing/theme';
import { onAnyMakerLogoLoad } from '../themes/_shared/makerLogos';
import { ElementRegistry, type CapturedElement } from '../core/drawing/elements';
import { getLayout } from '../core/drawing/sandbox';
import { subscribeHoveredElement, getHoveredElement } from './elementHover';

type Props = {
  photo: Photo | null;
  onFilesDropped: (files: File[]) => void;
  onOpen: () => void;
};

function buildOptionsInput(
  themeName: string,
  themeOptions: { id: string; default: AcceptInputType }[],
  getThemeOption: <T extends AcceptInputType>(themeName: string, key: string, fallback: T) => T
): ThemeOptionInput {
  const m = new Map<string, AcceptInputType>();
  for (const o of themeOptions) {
    m.set(o.id, getThemeOption(themeName, o.id, o.default));
  }
  return m;
}

export default function PreviewCanvas({ photo, onFilesDropped, onOpen }: Props) {
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // We keep the full-resolution output canvas around so we can re-downscale
  // it onto the visible canvas whenever the window resizes, without re-running
  // the (expensive) theme function.
  const fullResRef = useRef<HTMLCanvasElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCount = useRef(0);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{
    w: number;
    h: number;
    paddings: Array<{ id: string; value: number; isDefault: boolean }>;
  } | null>(null);

  const store = useStore();
  const themeDesc = findTheme(store.selectedThemeName);
  const [logoTick, setLogoTick] = useState(0);

  // Preview zoom. `zoom === 1` means "fit to window" (the default). Values > 1
  // zoom in (canvas overflows the wrap → scrollbars), < 1 zoom out.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);

  // ----- Draggable elements state -----
  // The most recent registry of captured (draggable) elements + the normalized
  // canvas dimensions, used for hit-testing and snapping.
  const elementsRef = useRef<CapturedElement[]>([]);
  const normSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // Mapping from normalized coords → on-screen CSS px, recomputed each repaint.
  const mapRef = useRef<{ dispW: number; dispH: number; normW: number; normH: number }>({
    dispW: 0,
    dispH: 0,
    normW: 0,
    normH: 0,
  });
  // Active drag (null when idle). `dx`/`dy` are the live normalized offset for
  // the dragged element; consulted by the registry's offset getter.
  const dragRef = useRef<{
    id: string;
    kind: string;
    pointerId: number;
    startNormX: number;
    startNormY: number;
    baseDx: number;
    baseDy: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);
  const anchorRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  hoverIdRef.current = hoverId;
  // Element highlighted from outside (Options-panel field hover).
  const externalHoverRef = useRef<string | null>(null);
  // Guide lines to draw as an overlay while dragging (normalized coords).
  const guidesRef = useRef<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] });
  const renderSeq = useRef(0);

  useEffect(() => {
    return onAnyMakerLogoLoad(() => setLogoTick((t) => t + 1));
  }, []);

  // Paint the full-res result onto the visible canvas at actual display-pixel
  // resolution (CSS size × devicePixelRatio). Using canvas 2D's stepwise
  // downscale produces a much sharper result than leaving the scaling to CSS,
  // especially when the source is 4096px wide and the preview pane is ~1000px.
  const repaintVisible = useCallback(() => {
    const visible = visibleCanvasRef.current;
    const wrap = wrapRef.current;
    const fullRes = fullResRef.current;
    if (!visible || !wrap || !fullRes || fullRes.width === 0 || fullRes.height === 0) return;

    // Use the wrap's CONTENT box (clientWidth/clientHeight minus padding).
    // getBoundingClientRect() includes padding, which would make us hand the
    // canvas a CSS size larger than the available area — the browser would
    // then clamp via max-width:100% / max-height:100%, changing the CSS
    // aspect from what we asked for and triggering object-fit letterboxing.
    const cs = window.getComputedStyle(wrap);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const availW = Math.max(0, wrap.clientWidth - padL - padR);
    const availH = Math.max(0, wrap.clientHeight - padT - padB);
    if (availW <= 0 || availH <= 0) return;

    const aspect = fullRes.width / fullRes.height;
    // First compute the "fit to window" size (zoom === 1), then scale by the
    // current zoom factor. Zooming in makes dispW/dispH exceed availW/availH,
    // and the wrap's `overflow: auto` produces scrollbars.
    let fitW = availW;
    let fitH = fitW / aspect;
    if (fitH > availH) {
      fitH = availH;
      fitW = fitH * aspect;
    }
    const z = zoomRef.current;
    const dispW = fitW * z;
    const dispH = fitH * z;
    if (dispW <= 0 || dispH <= 0) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Cap the backing-store resolution at the source resolution — there is no
    // detail to gain by rendering more pixels than the full-res canvas holds,
    // and it keeps very high zoom levels cheap.
    const targetW = Math.max(1, Math.min(fullRes.width, Math.round(dispW * dpr)));
    const targetH = Math.max(1, Math.min(fullRes.height, Math.round(dispH * dpr)));

    mapRef.current = { dispW, dispH, normW: normSizeRef.current.w, normH: normSizeRef.current.h };

    const paint = () => {
      const ctx = visible.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, visible.width, visible.height);
      ctx.drawImage(downsample(fullRes, visible.width, visible.height), 0, 0, visible.width, visible.height);
      drawOverlay(ctx, visible.width, visible.height);
    };

    // Avoid resizing the backing store when nothing changed (e.g. ResizeObserver
    // fires on the same dimensions), but still repaint so overlays refresh.
    if (
      visible.width === targetW &&
      visible.height === targetH &&
      visible.style.width === `${dispW}px`
    ) {
      paint();
      return;
    }

    visible.style.width = `${dispW}px`;
    visible.style.height = `${dispH}px`;
    visible.width = targetW;
    visible.height = targetH;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw hover outline + snap guide lines on top of the preview (overlay only —
  // never part of the exported image). Coordinates are converted from the
  // normalized layout space into the visible canvas's device pixels.
  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, devW: number, devH: number) => {
    const { w: normW, h: normH } = normSizeRef.current;
    if (normW <= 0 || normH <= 0) return;
    const sx = devW / normW;
    const sy = devH / normH;

    // Hover / drag highlight. Either the canvas pointer hover, an active drag,
    // or an external hover coming from the Options panel (hovering a field that
    // maps to this element).
    const activeId = dragRef.current?.id ?? hoverIdRef.current ?? externalHoverRef.current;
    if (activeId) {
      const el = elementsRef.current.find((e) => e.id === activeId);
      if (el && !el.hidden) {
        ctx.save();
        ctx.strokeStyle = 'rgba(74,158,255,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        const pad = 6;
        ctx.strokeRect(el.x * sx - pad, el.y * sy - pad, el.w * sx + pad * 2, el.h * sy + pad * 2);
        ctx.restore();
      }
    }

    // Snap guide lines.
    const guides = guidesRef.current;
    if (guides.vx.length || guides.hy.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,64,129,0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      for (const vx of guides.vx) {
        ctx.beginPath();
        ctx.moveTo(vx * sx, 0);
        ctx.lineTo(vx * sx, devH);
        ctx.stroke();
      }
      for (const hy of guides.hy) {
        ctx.beginPath();
        ctx.moveTo(0, hy * sy);
        ctx.lineTo(devW, hy * sy);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  // ----- Zoom controls -----
  const ZOOM_MIN = 0.1;
  const ZOOM_MAX = 8;
  const ZOOM_STEP = 1.2;

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      // Snap very close to 1 so "fit" is easy to land on.
      const snapped = Math.abs(clamped - 1) < 0.02 ? 1 : clamped;
      zoomRef.current = snapped;
      setZoom(snapped);
    },
    []
  );
  const zoomIn = useCallback(() => applyZoom(zoomRef.current * ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current / ZOOM_STEP), [applyZoom]);
  const resetZoom = useCallback(() => applyZoom(1), [applyZoom]);

  // Repaint whenever the zoom level changes.
  useEffect(() => {
    repaintVisible();
  }, [zoom, repaintVisible]);

  // Highlight an element when its Options-panel field is hovered.
  useEffect(() => {
    externalHoverRef.current = getHoveredElement();
    return subscribeHoveredElement((id) => {
      externalHoverRef.current = id;
      repaintVisible();
    });
  }, [repaintVisible]);

  const renderPreview = useCallback(async () => {
    if (!photo) {
      const canvas = visibleCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      fullResRef.current = null;
      setOutput(null);
      return;
    }

    const dragging = !!dragRef.current;
    if (!dragging) setBusy(true);
    const seq = ++renderSeq.current;
    try {
      const input = buildOptionsInput(
        themeDesc.name,
        themeDesc.options as { id: string; default: AcceptInputType }[],
        store.getThemeOption
      );

      // Build a registry whose offset getter merges the persisted per-element
      // offsets with any live drag delta, so dragging updates the preview in
      // real time before being committed to the store on pointer-up.
      const registry = new ElementRegistry(themeDesc.name, (themeName, elementId) => {
        const base = store.getElementOffset(themeName, elementId);
        const drag = dragRef.current;
        if (drag && drag.id === elementId) {
          return { dx: drag.dx, dy: drag.dy, hidden: base.hidden };
        }
        return base;
      });

      const result = await render(themeDesc.func, photo, input, store, registry);
      // A newer render started while we awaited fonts — discard this one.
      if (seq !== renderSeq.current) return;

      const layout = getLayout(result);
      normSizeRef.current = { w: layout.width, h: layout.height };
      elementsRef.current = registry.elements;

      // Capture the actual padding values the renderer used, so the UI can
      // surface any divergence between the OptionsPanel inputs and what is
      // actually being drawn on the canvas.
      const paddings: Array<{ id: string; value: number; isDefault: boolean }> = [];
      for (const opt of themeDesc.options) {
        if (opt.type === 'number' && /^PADDING_/i.test(opt.id)) {
          const v = input.get(opt.id);
          const numV = typeof v === 'number' ? v : Number(v);
          paddings.push({
            id: opt.id,
            value: numV,
            isDefault: numV === (opt.default as number),
          });
        }
      }

      fullResRef.current = result;
      repaintVisible();
      setOutput({ w: result.width, h: result.height, paddings });
    } catch (err) {
      console.error('Preview render failed:', err);
    } finally {
      if (seq === renderSeq.current && !dragRef.current) setBusy(false);
    }
  }, [photo, themeDesc, store, repaintVisible]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) renderPreview();
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    photo,
    themeDesc.name,
    JSON.stringify(store.themeOptions[themeDesc.name] ?? {}),
    JSON.stringify(store.themeElementOffsets[themeDesc.name] ?? {}),
    store.ratio,
    store.notCroppedMode,
    store.fixImageWidth,
    store.imageWidth,
    store.fixWatermark,
    store.watermark,
    store.dateNotation,
    store.showCameraMaker,
    store.showCameraModel,
    store.showLensModel,
    store.useCameraFocalLength,
    store.focalLengthRatioMode,
    store.focalLengthRatio,
    store.disableExposureMeter,
    store.overrideCameraMaker,
    store.overrideCameraModel,
    store.overrideLensModel,
    store.overrideMetadataIndex,
    JSON.stringify(store.overridableMetadata),
    logoTick,
  ]);

  // Re-paint the visible canvas (without re-rendering the theme) whenever the
  // preview pane resizes — so the canvas always uses display-native pixels.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf: number | null = null;
    const schedule = () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        repaintVisible();
      });
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [repaintVisible]);

  // Ctrl + mouse wheel to zoom on the preview area.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // only hijack Ctrl+scroll; plain scroll pans
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      applyZoom(zoomRef.current * factor);
    };
    // Must be non-passive so preventDefault() actually stops the page zoom.
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Ctrl +, Ctrl -, Ctrl 0 keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Ignore when typing into an input/textarea/select.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, resetZoom]);

  // ----- Element drag interaction -----

  // Convert a pointer event to normalized layout coordinates.
  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    const visible = visibleCanvasRef.current;
    const { normW, normH } = mapRef.current;
    if (!visible || normW <= 0 || normH <= 0) return null;
    const rect = visible.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const nx = ((clientX - rect.left) / rect.width) * normW;
    const ny = ((clientY - rect.top) / rect.height) * normH;
    return { nx, ny };
  }, []);

  // Topmost element (last drawn) whose padded bbox contains the point.
  const hitTest = useCallback((nx: number, ny: number): CapturedElement | null => {
    const els = elementsRef.current;
    const { normW, dispW } = mapRef.current;
    const pad = dispW > 0 ? (8 * normW) / dispW : 8; // ~8 screen px in norm units
    for (let i = els.length - 1; i >= 0; i--) {
      const e = els[i];
      if (e.hidden) continue;
      if (nx >= e.x - pad && nx <= e.x + e.w + pad && ny >= e.y - pad && ny <= e.y + e.h + pad) {
        return e;
      }
    }
    return null;
  }, []);

  // rAF-throttled re-render used during a drag.
  const dragRafRef = useRef<number | null>(null);
  const scheduleDragRender = useCallback(() => {
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      renderPreview();
    });
  }, [renderPreview]);

  // Snap the dragged element (predicted box) to alignment targets, mutating the
  // total offset (dx,dy) in place and returning the guide lines to draw.
  const applySnap = useCallback(
    (draggedId: string, anchorX: number, anchorY: number, w: number, h: number, dx: number, dy: number) => {
      const { normW, normH, dispW } = mapRef.current;
      const threshold = dispW > 0 ? (10 * normW) / dispW : 14;

      const left = anchorX + dx;
      const right = left + w;
      const cx = left + w / 2;
      const top = anchorY + dy;
      const bottom = top + h;
      const cy = top + h / 2;

      const xTargets: number[] = [normW / 2];
      const yTargets: number[] = [normH / 2];
      for (const e of elementsRef.current) {
        if (e.id === draggedId || e.hidden) continue;
        xTargets.push(e.x, e.x + e.w / 2, e.x + e.w);
        yTargets.push(e.y, e.y + e.h / 2, e.y + e.h);
      }

      const vx: number[] = [];
      const hy: number[] = [];

      // X axis: try to align left / center / right to the nearest target.
      let bestXAdj = 0;
      let bestXDist = threshold;
      let bestXGuide: number | null = null;
      for (const t of xTargets) {
        for (const coord of [left, cx, right]) {
          const d = Math.abs(coord - t);
          if (d < bestXDist) {
            bestXDist = d;
            bestXAdj = t - coord;
            bestXGuide = t;
          }
        }
      }
      if (bestXGuide !== null) {
        dx += bestXAdj;
        vx.push(bestXGuide);
      }

      let bestYAdj = 0;
      let bestYDist = threshold;
      let bestYGuide: number | null = null;
      for (const t of yTargets) {
        for (const coord of [top, cy, bottom]) {
          const d = Math.abs(coord - t);
          if (d < bestYDist) {
            bestYDist = d;
            bestYAdj = t - coord;
            bestYGuide = t;
          }
        }
      }
      if (bestYGuide !== null) {
        dy += bestYAdj;
        hy.push(bestYGuide);
      }

      return { dx, dy, vx, hy };
    },
    []
  );

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const pt = clientToNorm(e.clientX, e.clientY);
      if (!pt) return;
      const hit = hitTest(pt.nx, pt.ny);
      if (!hit) return;
      e.preventDefault();
      const base = store.getElementOffset(themeDesc.name, hit.id);
      dragRef.current = {
        id: hit.id,
        kind: hit.kind,
        pointerId: e.pointerId,
        startNormX: pt.nx,
        startNormY: pt.ny,
        baseDx: base.dx,
        baseDy: base.dy,
        dx: base.dx,
        dy: base.dy,
        // Anchor (zero-offset top-left) of the element, derived from its current
        // captured box minus the offset that produced it.
        moved: false,
      };
      // Stash the anchor + size on the drag object via closure-friendly refs.
      anchorRef.current = { x: hit.x - base.dx, y: hit.y - base.dy, w: hit.w, h: hit.h };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      hoverIdRef.current = hit.id;
      setHoverId(hit.id);
    },
    [clientToNorm, hitTest, store, themeDesc.name]
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) {
        // Hover feedback when not dragging.
        const pt = clientToNorm(e.clientX, e.clientY);
        const hit = pt ? hitTest(pt.nx, pt.ny) : null;
        const id = hit?.id ?? null;
        if (id !== hoverIdRef.current) {
          // Update the ref synchronously so the immediate repaint below draws
          // the highlight for the element we are NOW over (setHoverId only
          // updates the ref on the next render, which would lag by one event).
          hoverIdRef.current = id;
          setHoverId(id);
          repaintVisible();
        }
        return;
      }
      const pt = clientToNorm(e.clientX, e.clientY);
      if (!pt) return;
      drag.moved = true;
      const a = anchorRef.current;
      let dx = drag.baseDx + (pt.nx - drag.startNormX);
      let dy = drag.baseDy + (pt.ny - drag.startNormY);
      const snapped = applySnap(drag.id, a.x, a.y, a.w, a.h, dx, dy);
      dx = snapped.dx;
      dy = snapped.dy;
      drag.dx = dx;
      drag.dy = dy;
      guidesRef.current = { vx: snapped.vx, hy: snapped.hy };
      scheduleDragRender();
    },
    [clientToNorm, hitTest, applySnap, scheduleDragRender, repaintVisible]
  );

  const endCanvasDrag = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      guidesRef.current = { vx: [], hy: [] };

      if (drag.moved) {
        // Dragging a divider entirely off the canvas removes it.
        const pt = clientToNorm(e.clientX, e.clientY);
        const { normW, normH } = mapRef.current;
        const outside =
          pt && (pt.nx < 0 || pt.ny < 0 || pt.nx > normW || pt.ny > normH);
        if (drag.kind === 'divider' && outside) {
          store.resetElementOffset(themeDesc.name, drag.id);
          store.toggleElementHidden(themeDesc.name, drag.id, true);
        } else {
          store.setElementOffset(themeDesc.name, drag.id, { dx: drag.dx, dy: drag.dy });
        }
      }

      dragRef.current = null;
      // Committed offset change triggers a re-render via the store effect; also
      // repaint to clear guides immediately.
      repaintVisible();
    },
    [clientToNorm, store, themeDesc.name, repaintVisible]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current++;
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current--;
    if (dragCount.current <= 0) setDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tiff?|heic|heif|bmp)$/i.test(f.name)
    );
    if (files.length > 0) onFilesDropped(files);
  };

  return (
    <div className="preview">
      <div className="preview-header">
        <span style={{ fontWeight: 600 }}>{themeDesc.name}</span>
        {photo && (
          <div className="zoom" role="group" aria-label="Zoom controls">
            <button className="zoom-btn" title="Zoom out (Ctrl -)" onClick={zoomOut} aria-label="Zoom out">
              −
            </button>
            <button
              className="zoom-level"
              title="Reset zoom to fit (Ctrl 0)"
              onClick={resetZoom}
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button className="zoom-btn" title="Zoom in (Ctrl +)" onClick={zoomIn} aria-label="Zoom in">
              +
            </button>
            <button className="zoom-btn reset" title="Fit to window (Ctrl 0)" onClick={resetZoom} aria-label="Fit to window">
              ⤢
            </button>
          </div>
        )}
        {photo && (
          <div className="info">
            <div>
              Input: {photo.image.width}×{photo.image.height}
            </div>
            {output && (
              <>
                <div>
                  Output: {output.w}×{output.h}
                </div>
                {output.paddings.length > 0 && (
                  <div title="Padding values being used by the renderer (right now)">
                    Pad:{' '}
                    {output.paddings.map((p, i) => (
                      <span
                        key={p.id}
                        style={{ color: p.isDefault ? 'var(--text-muted)' : 'var(--accent)' }}
                      >
                        {p.id.replace('PADDING_', '').charAt(0)}={p.value}
                        {i < output.paddings.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        className={`canvas-wrap${!photo ? ' empty' : ''}${dragOver ? ' drag-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {!photo && (
          <>
            <div className="icon">🖼️</div>
            <div>Drop photos here, or</div>
            <button className="primary" onClick={onOpen}>
              Open photos
            </button>
            <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
              JPEG · PNG · WebP · TIFF · HEIC
            </div>
          </>
        )}
        <canvas
          ref={visibleCanvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endCanvasDrag}
          onPointerCancel={endCanvasDrag}
          onPointerLeave={() => {
            if (!dragRef.current && hoverIdRef.current) {
              hoverIdRef.current = null;
              setHoverId(null);
              repaintVisible();
            }
          }}
          style={{
            display: photo ? 'block' : 'none',
            opacity: busy ? 0.85 : 1,
            transition: 'opacity 0.1s',
            cursor: hoverId ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Stepwise canvas downscale. Canvas 2D's single-pass `drawImage` produces
 * noticeably aliased / grainy output when the downscale factor is large
 * (e.g. 4096 → 1000), even with `imageSmoothingQuality = 'high'`. Halving
 * dimensions repeatedly until we're within 2× of the target gives a result
 * that is visibly smoother and closer to a proper Lanczos filter, while
 * being fast enough for live preview.
 */
function downsample(source: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  let src: HTMLCanvasElement = source;
  while (src.width >= targetW * 2 && src.height >= targetH * 2) {
    const nextW = Math.max(targetW, Math.floor(src.width / 2));
    const nextH = Math.max(targetH, Math.floor(src.height / 2));
    const next = document.createElement('canvas');
    next.width = nextW;
    next.height = nextH;
    const nctx = next.getContext('2d')!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(src, 0, 0, nextW, nextH);
    src = next;
  }
  return src;
}
