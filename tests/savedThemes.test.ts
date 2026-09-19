import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_THEME_NAME, hydrateStore, savedThemeKey, useStore, type State } from '../src/store';
import themes, { findTheme } from '../src/themes';

const persistence = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: { load: vi.fn(async () => persistence) },
}));
vi.mock('../src/themes/_shared/makerLogos', () => ({
  preloadAllMakerLogos: vi.fn(),
}));

const initialState = useStore.getState();
const source = '07. STRAP';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useStore.setState({
    ...initialState,
    selectedThemeName: source,
    themeOptions: { [source]: { PADDING_BOTTOM: 700, TEMPLATE: 'By {MAKER}' } },
    themeElementOffsets: { [source]: { logo: { dx: 120, dy: -30, hidden: true } } },
    themeElementStyles: { [source]: { exif: { color: '#123456', fontSize: 80 } } },
    themeExtraLines: {
      [source]: [{
        id: 'credit', template: 'Credit', fontFamily: 'Arial', fontWeight: 400,
        fontSize: 60, color: '#000000', align: 'center',
      }],
    },
  }, true);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  useStore.setState(initialState, true);
});

describe('saved themes', () => {
  it.each(themes.map((theme) => theme.name))('keeps the renderer and options for %s', (name) => {
    useStore.setState({ selectedThemeName: name });
    useStore.getState().saveCurrentTheme('  My design  ');
    const state = useStore.getState();
    expect(state.savedThemes[0]).toMatchObject({ name: 'My design', baseThemeName: name });
    expect(state.selectedThemeName).toBe(savedThemeKey(state.savedThemes[0].id));
    expect(findTheme(state.selectedThemeName, state.savedThemes)).toBe(findTheme(name));
  });

  it('copies all customizations independently and restores its saved baseline', () => {
    const before = useStore.getState();
    before.saveCurrentTheme('My strap');
    const state = useStore.getState();
    const key = state.selectedThemeName;
    const preset = state.savedThemes[0];
    for (const map of ['themeOptions', 'themeElementOffsets', 'themeElementStyles', 'themeExtraLines'] as const) {
      expect(state[map][source]).toBe(before[map][source]);
      expect(state[map][key]).toEqual(before[map][source]);
      expect(state[map][key]).not.toBe(before[map][source]);
    }
    expect(state.themeElementOffsets[key]).not.toBe(preset.baseline.offsets);
    state.setThemeOption(key, 'PADDING_BOTTOM', 950);
    state.setElementOffset(key, 'logo', { dx: 0, dy: 0 });
    state.setElementStyle(key, 'exif', { color: '#ffffff' });
    state.setExtraLines(key, []);
    state.resetSavedTheme(preset.id);
    const reset = useStore.getState();
    expect(reset.themeOptions[key]).toEqual(preset.baseline.options);
    expect(reset.themeElementOffsets[key]).toEqual(preset.baseline.offsets);
    expect(reset.themeElementStyles[key]).toEqual(preset.baseline.styles);
    expect(reset.themeExtraLines[key]).toEqual(preset.baseline.extraLines);
    expect(reset.themeOptions[source]).toEqual(before.themeOptions[source]);
  });

  it('saves edited presets as separate themes without depending on the source preset', () => {
    useStore.getState().saveCurrentTheme('First');
    const first = useStore.getState().savedThemes[0];
    useStore.getState().setThemeOption(savedThemeKey(first.id), 'PADDING_BOTTOM', 900);
    useStore.getState().saveCurrentTheme('Second');
    const state = useStore.getState();
    const second = state.savedThemes[1];
    expect(second.id).not.toBe(first.id);
    expect(second.baseThemeName).toBe(source);
    expect(second.baseline.options.PADDING_BOTTOM).toBe(900);
    expect(first.baseline.options.PADDING_BOTTOM).toBe(700);
    state.deleteSavedTheme(first.id);
    expect(findTheme(state.selectedThemeName, useStore.getState().savedThemes)).toBe(findTheme(source));
    expect(useStore.getState().themeOptions[state.selectedThemeName].PADDING_BOTTOM).toBe(900);
  });

  it('keeps newly saved data when undoing or redoing earlier source edits', () => {
    const state = useStore.getState();
    state.setThemeOption(source, 'PADDING_BOTTOM', 850);
    state.setElementOffset(source, 'logo', { dx: 150, dy: 50 });
    state.undo();
    state.saveCurrentTheme('Saved after undo');
    const key = useStore.getState().selectedThemeName;
    const expected = structuredClone(useStore.getState().themeOptions[key]);
    state.undo();
    expect(useStore.getState().themeOptions[key]).toEqual(expected);
    state.redo();
    state.redo();
    expect(useStore.getState().themeOptions[key]).toEqual(expected);
    state.setThemeOption(key, 'PADDING_BOTTOM', 1000);
    state.undo();
    expect(useStore.getState().themeOptions[key]).toEqual(expected);
  });

  it('requires a nonblank name without creating a preset', () => {
    expect(() => useStore.getState().saveCurrentTheme(' \t ')).toThrow('Enter a name');
    expect(useStore.getState().savedThemes).toEqual([]);
    expect(useStore.getState().selectedThemeName).toBe(source);
  });

  it('persists the base renderer and all saved data across hydration', async () => {
    useStore.getState().saveCurrentTheme('Persistent strap');
    const expected = useStore.getState();
    await vi.runAllTimersAsync();
    expect(persistence.save).toHaveBeenCalledOnce();
    const persisted = persistence.set.mock.calls[0][1] as State;
    expect(persisted.savedThemes).toEqual(expected.savedThemes);
    persistence.get.mockResolvedValue(persisted);
    useStore.setState(initialState, true);
    await hydrateStore();
    const restored = useStore.getState();
    expect(restored.selectedThemeName).toBe(expected.selectedThemeName);
    expect(findTheme(restored.selectedThemeName, restored.savedThemes)).toBe(findTheme(source));
    for (const map of ['themeOptions', 'themeElementOffsets', 'themeElementStyles', 'themeExtraLines'] as const) {
      expect(restored[map]).toEqual(expected[map]);
    }
  });

  it('continues rendering legacy saved themes as CUSTOM when loaded or copied', async () => {
    const legacy = { id: 'old', name: 'Legacy' };
    persistence.get.mockResolvedValue({
      __version: 4,
      selectedThemeName: savedThemeKey(legacy.id),
      savedThemes: [legacy],
      themeOptions: { [savedThemeKey(legacy.id)]: { PADDING_BOTTOM: 650 } },
    });
    await hydrateStore();
    const state = useStore.getState();
    expect(findTheme(state.selectedThemeName, state.savedThemes)).toBe(findTheme(CUSTOM_THEME_NAME));
    expect(state.savedThemes[0].baseline.options.PADDING_BOTTOM).toBe(650);
    state.saveCurrentTheme('Legacy copy');
    expect(useStore.getState().savedThemes[1].baseThemeName).toBe(CUSTOM_THEME_NAME);
  });
});
