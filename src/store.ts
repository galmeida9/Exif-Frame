import { create } from 'zustand';
import { Store as TauriStore } from '@tauri-apps/plugin-store';

// ----- Public types -----

export type OverridableMetadata = { [key: string]: string };

export type ThemeOptionValue = string | number | boolean;

/** Per-element drag offset + visibility for the draggable-layout feature. */
export type ElementOffset = { dx: number; dy: number; hidden?: boolean };

/**
 * A point-in-time snapshot of the per-theme editable state used by the
 * undo/redo history. Captures everything the user edits while customizing a
 * frame: theme options (padding, template, colors, sliders, …) and element
 * layout (drag offsets, hidden flags, dividers).
 */
export type HistorySnapshot = {
  themeOptions: Record<string, Record<string, ThemeOptionValue>>;
  themeElementOffsets: Record<string, Record<string, ElementOffset>>;
};

export type Format = 'image/jpeg' | 'image/webp' | 'image/png';
export type ThumbnailSize = 'small' | 'medium' | 'large';

export type State = {
  hydrated: boolean;

  // Display / global
  language: string;
  darkMode: boolean;

  // Theme + per-theme options (persisted)
  selectedThemeName: string;
  themeOptions: Record<string, Record<string, ThemeOptionValue>>;
  /** Per-theme, per-element drag offsets / visibility (persisted). */
  themeElementOffsets: Record<string, Record<string, ElementOffset>>;

  // Canvas pipeline
  ratio: string;
  notCroppedMode: boolean;
  fixImageWidth: boolean;
  imageWidth: number;

  // Export
  format: Format;
  quality: number;
  exportToJpeg: boolean;
  maintainExif: boolean;
  exportFolder: string;

  // Watermark
  fixWatermark: boolean;
  watermark: string;

  // Metadata display
  dateNotation: string;
  showCameraMaker: boolean;
  showCameraModel: boolean;
  showLensModel: boolean;
  /**
   * When true, always display the camera's RAW focal length (no conversion).
   * When false (default), display the 35mm-equivalent focal length — first
   * from the EXIF `FocalLengthIn35mmFilm` tag if present, otherwise derived
   * from the sensor crop factor computed from EXIF FocalPlane data.
   */
  useCameraFocalLength: boolean;
  focalLengthRatioMode: boolean;
  focalLengthRatio: number;
  disableExposureMeter: boolean;

  // Global overrides (empty string = no override)
  overrideCameraMaker: string;
  overrideCameraModel: string;
  overrideLensModel: string;

  // Named overrides list + active selection
  overridableMetadata: OverridableMetadata[];
  overrideMetadataIndex: number | null;

  // Desktop UX
  thumbnailSize: ThumbnailSize;
  zoomToFit: boolean;

  // Undo/redo history for per-theme edits (NOT persisted to disk).
  history: HistorySnapshot[];
  future: HistorySnapshot[];
};

export type StoreActions = {
  set: (patch: Partial<State>) => void;
  setThemeOption: (themeName: string, key: string, value: ThemeOptionValue) => void;
  getThemeOption: <T extends ThemeOptionValue>(themeName: string, key: string, fallback: T) => T;
  getElementOffset: (themeName: string, elementId: string) => ElementOffset;
  setElementOffset: (themeName: string, elementId: string, offset: ElementOffset) => void;
  resetElementOffset: (themeName: string, elementId: string) => void;
  toggleElementHidden: (themeName: string, elementId: string, hidden: boolean) => void;
  resetThemeLayout: (themeName: string) => void;
  /** Reset a single theme option back to its default (with history). */
  resetThemeField: (themeName: string, key: string) => void;
  /** Reset ALL options AND layout for one theme (with history). */
  resetThemeAll: (themeName: string) => void;
  /** Reset options AND layout for EVERY theme (with history). */
  resetAllThemes: () => void;
  /** Undo / redo per-theme edits. */
  undo: () => void;
  redo: () => void;
  upsertOverridableMetadata: (index: number, patch: OverridableMetadata) => void;
  removeOverridableMetadata: (index: number) => void;
  clearOverridableMetadata: () => void;
};

export type Store = State & StoreActions;

// ----- Defaults -----

const DEFAULTS: State = {
  hydrated: false,

  language: 'en',
  darkMode: true,

  selectedThemeName: '04. TWO LINE',
  themeOptions: {},
  themeElementOffsets: {},

  ratio: 'free',
  notCroppedMode: false,
  fixImageWidth: false,
  imageWidth: 1920,

  format: 'image/jpeg',
  quality: 95,
  exportToJpeg: true,
  maintainExif: false,
  exportFolder: '',

  fixWatermark: false,
  watermark: '',

  dateNotation: '2001/01/01 01:01:01',
  showCameraMaker: true,
  showCameraModel: true,
  showLensModel: true,
  useCameraFocalLength: false,
  focalLengthRatioMode: false,
  focalLengthRatio: 1,
  disableExposureMeter: false,

  overrideCameraMaker: '',
  overrideCameraModel: '',
  overrideLensModel: '',

  overridableMetadata: [],
  overrideMetadataIndex: null,

  thumbnailSize: 'medium',
  zoomToFit: true,

  history: [],
  future: [],
};

// ----- Persistence (Tauri store plugin) -----

const STORE_FILE = 'settings.json';
const STATE_KEY = 'state';

let tauriStore: TauriStore | null = null;

async function getTauriStore(): Promise<TauriStore | null> {
  if (tauriStore) return tauriStore;
  try {
    tauriStore = await TauriStore.load(STORE_FILE, { autoSave: false, defaults: {} });
    return tauriStore;
  } catch (err) {
    // Outside Tauri (e.g. `vite preview`) — silently fall back to in-memory only.
    console.warn('[store] Tauri store unavailable, running in-memory:', err);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    const s = await getTauriStore();
    if (!s) return;
    const snap = useStore.getState();
    const persistable: PersistedState = { ...snap, __version: CURRENT_SCHEMA_VERSION };
    delete (persistable as Partial<State>).hydrated;
    // Undo/redo history is session-only — never write it to disk.
    delete (persistable as Partial<State>).history;
    delete (persistable as Partial<State>).future;
    try {
      await s.set(STATE_KEY, persistable);
      await s.save();
    } catch (err) {
      console.warn('[store] persist failed:', err);
    }
  }, 250);
}

// ----- Migrations -----
// Bumped whenever a default value of a theme option changes in a way that
// would make a previously-saved-as-default user override misleading. When
// the persisted version is older than CURRENT_SCHEMA_VERSION we apply the
// migrations between them and then bump.
const CURRENT_SCHEMA_VERSION = 4;

type PersistedState = Partial<State> & {
  __version?: number;
  /** Deprecated in v3: replaced by `useCameraFocalLength` (inverted semantics). */
  focalLength35mmMode?: boolean;
};

function migrate(persisted: PersistedState): PersistedState {
  const fromVersion = persisted.__version ?? 1;
  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    return persisted;
  }

  const next: PersistedState = { ...persisted };

  // v1 -> v2: STRAP and SHOT_ON_ONE_LINE used to add +300 / +200 to
  // PADDING_BOTTOM internally so users typically left the input at 0. The
  // hardcoded additions have been removed and the defaults are now 300 / 200
  // respectively. Anyone with the old default 0 saved would otherwise see
  // their text strip vanish — clear those overrides so the new defaults apply.
  if (fromVersion < 2 && next.themeOptions) {
    const themeOptions = { ...next.themeOptions };
    for (const themeName of ['07. STRAP', '05. SHOT ON ONE LINE']) {
      const themeMap = themeOptions[themeName];
      if (themeMap && themeMap.PADDING_BOTTOM === 0) {
        const cleaned = { ...themeMap };
        delete cleaned.PADDING_BOTTOM;
        if (Object.keys(cleaned).length === 0) {
          delete themeOptions[themeName];
        } else {
          themeOptions[themeName] = cleaned;
        }
      }
    }
    next.themeOptions = themeOptions;
  }

  // v2 -> v3: rename + invert focal-length-display toggle.
  //   old: focalLength35mmMode (default false → camera focal length)
  //   new: useCameraFocalLength  (default false → 35mm-equivalent focal length)
  // If a user had explicitly enabled 35mm mode, they clearly wanted 35mm — that
  // matches the new default, so we drop the override. If they had it disabled
  // (the old default), we have no way to tell whether they preferred raw or just
  // never touched it; we err on the side of the new default behaviour (35mm).
  if (fromVersion < 3) {
    delete next.focalLength35mmMode;
  }

  next.__version = CURRENT_SCHEMA_VERSION;
  return next;
}

// ----- Undo/redo history -----

const MAX_HISTORY = 100;
// Coalesce rapid successive edits to the SAME logical control (e.g. dragging a
// slider, typing in a number field) into a single undo step.
const COALESCE_MS = 500;
let lastHistoryKey: string | null = null;
let lastHistoryTime = 0;

function cloneSnapshot(s: { themeOptions: State['themeOptions']; themeElementOffsets: State['themeElementOffsets'] }): HistorySnapshot {
  return {
    themeOptions: structuredClone(s.themeOptions),
    themeElementOffsets: structuredClone(s.themeElementOffsets),
  };
}

// ----- Zustand store -----

export const useStore = create<Store>((set, get) => {
  /**
   * Capture the current per-theme editable state onto the undo stack BEFORE a
   * mutation is applied. `coalesceKey` lets consecutive edits to the same
   * control within COALESCE_MS collapse into one undo step (pass null to always
   * create a discrete step).
   */
  const pushHistory = (coalesceKey: string | null) => {
    const now = Date.now();
    if (coalesceKey !== null && coalesceKey === lastHistoryKey && now - lastHistoryTime < COALESCE_MS) {
      lastHistoryTime = now;
      return; // merge into the existing (earlier) undo step
    }
    lastHistoryKey = coalesceKey;
    lastHistoryTime = now;
    const snap = cloneSnapshot(get());
    let history = [...get().history, snap];
    if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
    set({ history, future: [] });
  };

  return ({
  ...DEFAULTS,

  set: (patch) => {
    set(patch);
    schedulePersist();
  },

  setThemeOption: (themeName, key, value) => {
    pushHistory(`opt:${themeName}:${key}`);
    const themeOptions = { ...get().themeOptions };
    const themeMap = { ...(themeOptions[themeName] ?? {}) };
    themeMap[key] = value;
    themeOptions[themeName] = themeMap;
    set({ themeOptions });
    schedulePersist();
  },

  getThemeOption: <T extends ThemeOptionValue>(themeName: string, key: string, fallback: T): T => {
    const v = get().themeOptions[themeName]?.[key];
    return v === undefined ? fallback : (v as T);
  },

  getElementOffset: (themeName, elementId) => {
    return get().themeElementOffsets[themeName]?.[elementId] ?? { dx: 0, dy: 0, hidden: false };
  },

  setElementOffset: (themeName, elementId, offset) => {
    pushHistory(null);
    const all = { ...get().themeElementOffsets };
    const themeMap = { ...(all[themeName] ?? {}) };
    themeMap[elementId] = offset;
    all[themeName] = themeMap;
    set({ themeElementOffsets: all });
    schedulePersist();
  },

  resetElementOffset: (themeName, elementId) => {
    pushHistory(null);
    const all = { ...get().themeElementOffsets };
    const themeMap = { ...(all[themeName] ?? {}) };
    delete themeMap[elementId];
    if (Object.keys(themeMap).length === 0) {
      delete all[themeName];
    } else {
      all[themeName] = themeMap;
    }
    set({ themeElementOffsets: all });
    schedulePersist();
  },

  toggleElementHidden: (themeName, elementId, hidden) => {
    pushHistory(null);
    const all = { ...get().themeElementOffsets };
    const themeMap = { ...(all[themeName] ?? {}) };
    const cur = themeMap[elementId] ?? { dx: 0, dy: 0 };
    themeMap[elementId] = { ...cur, hidden };
    all[themeName] = themeMap;
    set({ themeElementOffsets: all });
    schedulePersist();
  },

  resetThemeLayout: (themeName) => {
    pushHistory(null);
    const all = { ...get().themeElementOffsets };
    delete all[themeName];
    set({ themeElementOffsets: all });
    schedulePersist();
  },

  resetThemeField: (themeName, key) => {
    pushHistory(null);
    const themeOptions = { ...get().themeOptions };
    const themeMap = { ...(themeOptions[themeName] ?? {}) };
    delete themeMap[key];
    if (Object.keys(themeMap).length === 0) {
      delete themeOptions[themeName];
    } else {
      themeOptions[themeName] = themeMap;
    }
    set({ themeOptions });
    schedulePersist();
  },

  resetThemeAll: (themeName) => {
    pushHistory(null);
    const themeOptions = { ...get().themeOptions };
    delete themeOptions[themeName];
    const themeElementOffsets = { ...get().themeElementOffsets };
    delete themeElementOffsets[themeName];
    set({ themeOptions, themeElementOffsets });
    schedulePersist();
  },

  resetAllThemes: () => {
    pushHistory(null);
    set({ themeOptions: {}, themeElementOffsets: {} });
    schedulePersist();
  },

  undo: () => {
    const history = get().history;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const current = cloneSnapshot(get());
    lastHistoryKey = null; // break coalescing across undo
    set({
      themeOptions: structuredClone(prev.themeOptions),
      themeElementOffsets: structuredClone(prev.themeElementOffsets),
      history: history.slice(0, -1),
      future: [...get().future, current],
    });
    schedulePersist();
  },

  redo: () => {
    const future = get().future;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = cloneSnapshot(get());
    lastHistoryKey = null;
    set({
      themeOptions: structuredClone(next.themeOptions),
      themeElementOffsets: structuredClone(next.themeElementOffsets),
      future: future.slice(0, -1),
      history: [...get().history, current],
    });
    schedulePersist();
  },

  upsertOverridableMetadata: (index, patch) => {
    const list = get().overridableMetadata.slice();
    list[index] = { ...(list[index] ?? {}), ...patch };
    set({ overridableMetadata: list });
    schedulePersist();
  },

  removeOverridableMetadata: (index) => {
    const list = get().overridableMetadata.slice();
    list.splice(index, 1);
    let activeIdx = get().overrideMetadataIndex;
    if (activeIdx !== null) {
      if (activeIdx === index) activeIdx = null;
      else if (activeIdx > index) activeIdx -= 1;
    }
    set({ overridableMetadata: list, overrideMetadataIndex: activeIdx });
    schedulePersist();
  },

  clearOverridableMetadata: () => {
    set({ overridableMetadata: [], overrideMetadataIndex: null });
    schedulePersist();
  },
  });
});

export async function hydrateStore(): Promise<void> {
  const s = await getTauriStore();
  if (!s) {
    useStore.setState({ hydrated: true });
    return;
  }
  try {
    const raw = (await s.get<PersistedState>(STATE_KEY)) ?? {};
    const migrated = migrate(raw);
    // Strip the version marker before merging into state (it's not part of State).
    const { __version, ...rest } = migrated;
    void __version;
    useStore.setState({ ...rest, hydrated: true });
    // If a migration changed anything (or this is a first run on the new
    // schema), write it back so the next launch reads the migrated shape.
    if ((raw.__version ?? 1) < CURRENT_SCHEMA_VERSION) {
      schedulePersist();
    }
  } catch (err) {
    console.warn('[store] hydrate failed:', err);
    useStore.setState({ hydrated: true });
  }
}
