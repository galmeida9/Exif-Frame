import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SaveThemeDialog from '../src/components/SaveThemeDialog';
import Toolbar from '../src/components/Toolbar';
import { useStore, type Store } from '../src/store';

const hooks = vi.hoisted(() => ({
  state: undefined as unknown,
  setState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [hooks.state ?? initial, hooks.setState],
  useRef: () => ({ current: null }),
  useEffect: vi.fn(),
}));
vi.mock('../src/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/store')>();
  return {
    ...actual,
    useStore: Object.assign(
      (selector: (state: Store) => unknown) => selector(actual.useStore.getState()),
      actual.useStore,
    ),
  };
});
vi.mock('../src/themes/_shared/makerLogos', () => ({
  preloadAllMakerLogos: vi.fn(),
}));

type ElementProps = {
  children?: ReactNode;
  onClick?: () => void;
  onCancel?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
  type?: string;
  disabled?: boolean;
  value?: string;
};

function find(node: ReactNode, match: (element: ReactElement<ElementProps>) => boolean): ReactElement<ElementProps> {
  const elements: ReactElement<ElementProps>[] = [];
  const visit = (children: ReactNode) => Children.forEach(children, (child) => {
    if (!isValidElement<ElementProps>(child)) return;
    elements.push(child);
    visit(child.props.children);
  });
  visit(node);
  const result = elements.find(match);
  if (!result) throw new Error('Expected UI element was not found');
  return result;
}

const initialState = useStore.getState();
const toolbarProps = {
  photoCount: 0, canExport: false, libraryOpen: true,
  onToggleLibrary: vi.fn(), onOpen: vi.fn(), onExport: vi.fn(), onSettings: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  hooks.state = undefined;
  hooks.setState.mockImplementation((value: unknown) => { hooks.state = value; });
  useStore.setState(initialState, true);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  useStore.setState(initialState, true);
});

it.each(['04. TWO LINE', '17. CUSTOM', 'saved:existing'])(
  'opens the name dialog from %s',
  (selectedThemeName) => {
    useStore.setState({ selectedThemeName });
    const toolbar = Toolbar(toolbarProps);
    const button = find(toolbar, (el) => el.type === 'button'
      && String(el.props.children).includes('Save new theme'));
    button.props.onClick!();
    expect(find(Toolbar(toolbarProps), (el) => el.type === SaveThemeDialog)).toBeDefined();
    expect(useStore.getState().savedThemes).toHaveLength(0);
  }
);

it.each(['', '   '])('does not save an empty or whitespace-only name (%j)', (name) => {
  hooks.state = name;
  const onClose = vi.fn();
  const dialog = SaveThemeDialog({ onClose });
  expect(find(dialog, (el) => el.props.type === 'submit').props.disabled).toBe(true);
  find(dialog, (el) => el.type === 'form').props.onSubmit!({ preventDefault: vi.fn() });
  expect(useStore.getState().savedThemes).toHaveLength(0);
  expect(onClose).not.toHaveBeenCalled();
});

it('saves the entered name and selects the new theme in the dropdown', () => {
  const onClose = vi.fn();
  const dialog = SaveThemeDialog({ onClose });
  find(dialog, (el) => el.type === 'input').props.onChange!({ target: { value: '  My frame  ' } });
  const updatedDialog = SaveThemeDialog({ onClose });
  expect(find(updatedDialog, (el) => el.props.type === 'submit').props.disabled).toBe(false);
  find(updatedDialog, (el) => el.type === 'form').props.onSubmit!({ preventDefault: vi.fn() });
  expect(onClose).toHaveBeenCalledOnce();
  const state = useStore.getState();
  expect(state.savedThemes).toHaveLength(1);
  expect(state.savedThemes[0].name).toBe('My frame');
  hooks.state = false;
  const toolbar = Toolbar(toolbarProps);
  expect(find(toolbar, (el) => el.type === 'select').props.value).toBe(state.selectedThemeName);
  expect(find(toolbar, (el) => el.type === 'option' && el.props.value === state.selectedThemeName)
    .props.children).toBe('My frame');
});

it('cancels without creating a saved theme', () => {
  const onClose = vi.fn();
  const dialog = SaveThemeDialog({ onClose });
  find(dialog, (el) => el.type === 'button' && el.props.children === 'Cancel').props.onClick!();
  expect(onClose).toHaveBeenCalledOnce();
  expect(useStore.getState().savedThemes).toHaveLength(0);
});

it('handles native dialog cancellation without saving', () => {
  const onClose = vi.fn();
  const dialog = SaveThemeDialog({ onClose });
  find(dialog, (el) => el.type === 'dialog').props.onCancel!();
  expect(onClose).toHaveBeenCalledOnce();
  expect(useStore.getState().savedThemes).toHaveLength(0);
});
