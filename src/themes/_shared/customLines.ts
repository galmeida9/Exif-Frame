import type { CustomLine } from '../../core/drawing/theme';

/** The default line stack for a fresh CUSTOM theme. */
export const DEFAULT_CUSTOM_LINES: CustomLine[] = [
  {
    id: 'line1',
    template: '{MAKER}{BODY}',
    fontFamily: 'Barlow',
    fontWeight: 500,
    fontSize: 70,
    color: '#000000',
    align: 'center',
  },
  {
    id: 'line2',
    template: '{ISO}{MM}{F}{SEC}',
    fontFamily: 'Barlow',
    fontWeight: 300,
    fontSize: 60,
    color: '#555555',
    align: 'center',
  },
  {
    id: 'line3',
    template: '{LENS}',
    fontFamily: 'Barlow',
    fontWeight: 300,
    fontSize: 50,
    color: '#888888',
    align: 'center',
  },
];

export const DEFAULT_CUSTOM_LINES_JSON = JSON.stringify(DEFAULT_CUSTOM_LINES);

/** A short, reasonably-unique id for a freshly added line. */
export function newLineId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'l' + crypto.randomUUID().slice(0, 8);
  } catch {
    /* fall through */
  }
  return 'l' + Math.random().toString(36).slice(2, 10);
}

/** Tolerantly parse the serialized `lines` option back into CustomLine[]. */
export function parseLines(value: string | undefined): CustomLine[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((l) => l && typeof l === 'object')
      .map((l, i) => ({
        id: typeof l.id === 'string' && l.id ? l.id : `line${i + 1}`,
        label: typeof l.label === 'string' && l.label ? l.label : undefined,
        template: typeof l.template === 'string' ? l.template : '',
        fontFamily: typeof l.fontFamily === 'string' ? l.fontFamily : 'Barlow',
        fontWeight: Number.isFinite(l.fontWeight) ? l.fontWeight : 400,
        fontSize: Number.isFinite(l.fontSize) ? l.fontSize : 60,
        color: typeof l.color === 'string' ? l.color : '#000000',
        align: l.align === 'left' || l.align === 'right' ? l.align : 'center',
      }));
  } catch {
    return [];
  }
}
