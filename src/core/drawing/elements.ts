/**
 * Draggable-element capture layer.
 *
 * Themes draw in a NORMALIZED coordinate space (see sandbox `getLayout`). To let
 * the user reposition individual text lines / logos / dividers, themes route
 * their labeled draws through the `place*` helpers below. Each helper:
 *   1. Looks up the element's stored offset `{ dx, dy, hidden }`.
 *   2. Skips drawing (but still records a hidden entry) when `hidden`.
 *   3. Translates the anchor by the offset and performs the draw.
 *   4. Records the element's normalized bounding box + metadata so the preview
 *      layer can hit-test, drag, and snap it.
 *
 * The registry is created per render by the preview component and threaded into
 * the theme via the render context, so the same offsets feed both the on-screen
 * preview and the exported image.
 */

export interface ElementOffset {
  dx: number;
  dy: number;
  hidden?: boolean;
}

export type ElementKind = 'text' | 'image' | 'divider';

export interface CapturedElement {
  id: string;
  label: string;
  kind: ElementKind;
  /** Normalized bounding box (same space the theme draws in). */
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  /**
   * The text style actually used to draw this element (after any style
   * override), so the UI can show the real current values instead of "default".
   * Only present for text elements.
   */
  resolved?: {
    color: string;
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    align: 'left' | 'center' | 'right';
  };
}

export type OffsetGetter = (themeName: string, elementId: string) => ElementOffset;

/** Partial text-style override applied to a captured text element. */
export type ElementStyleOverride = {
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
};
export type StyleGetter = (themeName: string, elementId: string) => ElementStyleOverride;

const ZERO: ElementOffset = { dx: 0, dy: 0, hidden: false };
const NO_STYLE: ElementStyleOverride = {};

export class ElementRegistry {
  readonly elements: CapturedElement[] = [];

  constructor(
    public readonly themeName: string,
    private readonly getOffset: OffsetGetter,
    private readonly getStyle: StyleGetter = () => NO_STYLE
  ) {}

  offset(id: string): ElementOffset {
    return this.getOffset(this.themeName, id) ?? ZERO;
  }

  style(id: string): ElementStyleOverride {
    return this.getStyle(this.themeName, id) ?? NO_STYLE;
  }

  private push(el: CapturedElement) {
    this.elements.push(el);
  }

  /**
   * Draw a single line of text through the offset/capture pipeline. The caller
   * must have already configured `ctx.font`, `ctx.fillStyle`, `ctx.textAlign`
   * and `ctx.textBaseline` exactly as for a normal fillText. Any per-element
   * style override (color / font / size / weight / align) is applied on top.
   */
  text(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    textValue: string,
    x: number,
    y: number
  ): void {
    const off = this.offset(id);
    const st = this.style(id);

    // Apply style overrides over the font/color/align the theme set.
    if (st.color !== undefined) ctx.fillStyle = st.color;
    if (st.align !== undefined) ctx.textAlign = st.align;
    if (st.fontFamily !== undefined || st.fontWeight !== undefined || st.fontSize !== undefined) {
      const base = parseFont(ctx.font);
      const family = st.fontFamily ?? base.family;
      const weight = st.fontWeight ?? base.weight;
      const size = st.fontSize ?? base.size;
      ctx.font = `${base.style} ${weight} ${size}px ${family}`;
    }

    const px = x + off.dx;
    const py = y + off.dy;

    const metrics = ctx.measureText(textValue);
    const fontPx = parseFontSize(ctx.font);
    const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.8;
    const descent = metrics.actualBoundingBoxDescent || fontPx * 0.2;
    const width =
      metrics.width ||
      (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0);
    const height = ascent + descent;

    const left = anchorLeft(px, width, ctx.textAlign);
    const top = anchorTop(py, ascent, descent, ctx.textBaseline);

    if (!off.hidden) {
      ctx.fillText(textValue, px, py);
    }

    // Resolve the actual style used (after overrides) so the UI can display the
    // true current values instead of "default".
    const usedFont = parseFont(ctx.font);
    const usedColor = typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#000000';

    this.push({
      id,
      label,
      kind: 'text',
      x: left,
      y: top,
      w: Math.max(1, width),
      h: Math.max(1, height),
      hidden: !!off.hidden,
      resolved: {
        color: usedColor,
        fontFamily: usedFont.family,
        fontWeight: usedFont.weight,
        fontSize: usedFont.size,
        align: ctx.textAlign === 'left' || ctx.textAlign === 'right' ? ctx.textAlign : 'center',
      },
    });
  }

  /**
   * Draw an image (e.g. a maker logo). `x`/`y` are the top-left anchor and
   * `w`/`h` the draw size, all in normalized units.
   */
  image(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    img: CanvasImageSource,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const off = this.offset(id);
    const px = x + off.dx;
    const py = y + off.dy;

    if (!off.hidden) {
      ctx.drawImage(img, px, py, w, h);
    }

    this.push({
      id,
      label,
      kind: 'image',
      x: px,
      y: py,
      w: Math.max(1, w),
      h: Math.max(1, h),
      hidden: !!off.hidden,
    });
  }

  /**
   * Draw a vertical divider line. `x` is the line's x position, `y1`/`y2` its
   * top/bottom. Dividers default to being toggled via the hidden flag.
   */
  divider(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    x: number,
    y1: number,
    y2: number,
    strokeStyle: string,
    lineWidth: number
  ): void {
    const off = this.offset(id);
    const px = x + off.dx;
    const py1 = y1 + off.dy;
    const py2 = y2 + off.dy;

    if (!off.hidden) {
      ctx.beginPath();
      ctx.moveTo(px, py1);
      ctx.lineTo(px, py2);
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    const pad = Math.max(8, lineWidth * 4);
    this.push({
      id,
      label,
      kind: 'divider',
      x: px - pad,
      y: Math.min(py1, py2),
      w: pad * 2,
      h: Math.abs(py2 - py1),
      hidden: !!off.hidden,
    });
  }
}

function parseFontSize(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 70;
}

/**
 * Tolerant parse of a CSS canvas `font` shorthand into its parts. Handles the
 * variants used across themes, e.g. `normal 500 70px Barlow`, `700 100px Arial`,
 * `100px Barlow`, `normal 300 50px "Segoe UI"`.
 */
function parseFont(font: string): { style: string; weight: number; size: number; family: string } {
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px\s+(.+)$/);
  const size = sizeMatch ? parseFloat(sizeMatch[1]) : 70;
  const family = sizeMatch ? sizeMatch[2].trim() : 'Barlow';
  const before = sizeMatch ? font.slice(0, sizeMatch.index).trim() : font.trim();
  const tokens = before.split(/\s+/).filter(Boolean);
  let style = 'normal';
  let weight = 400;
  for (const t of tokens) {
    if (t === 'italic' || t === 'oblique' || t === 'normal') {
      if (t !== 'normal') style = t;
    } else if (/^\d+$/.test(t)) {
      weight = parseInt(t, 10);
    } else if (t === 'bold') {
      weight = 700;
    }
  }
  return { style, weight, size, family };
}

function anchorLeft(px: number, width: number, align: CanvasTextAlign): number {
  switch (align) {
    case 'center':
      return px - width / 2;
    case 'right':
    case 'end':
      return px - width;
    default:
      return px;
  }
}

function anchorTop(
  py: number,
  ascent: number,
  descent: number,
  baseline: CanvasTextBaseline
): number {
  switch (baseline) {
    case 'middle':
      return py - (ascent + descent) / 2;
    case 'bottom':
    case 'ideographic':
      return py - (ascent + descent);
    case 'top':
    case 'hanging':
      return py;
    default: // alphabetic
      return py - ascent;
  }
}
