import { PosShortcutAction, shortcutActionFor } from './pos-shortcut.util';

const press = (key: string, modifiers: Partial<Record<string, boolean>> = {}) =>
  shortcutActionFor({
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  });

describe('pos shortcuts', () => {
  it('maps each function key to its till action', () => {
    expect(press('F1')).toBe(PosShortcutAction.SAVE_AND_PRINT);
    expect(press('F2')).toBe(PosShortcutAction.SAVE);
    expect(press('F3')).toBe(PosShortcutAction.PAY_CASH);
    expect(press('F4')).toBe(PosShortcutAction.PAY_CARD);
    expect(press('F7')).toBe(PosShortcutAction.PAY_ONLINE);
    expect(press('F10')).toBe(PosShortcutAction.HOLD);
    expect(press('F12')).toBe(PosShortcutAction.NEW_BILL);
  });

  it('leaves every other key to the browser', () => {
    for (const key of ['F5', 'F6', 'F8', 'F9', 'F11', 'a', 'Enter', 'Escape', '1', '']) {
      expect(press(key)).withContext(key).toBeNull();
    }
  });

  it('ignores a function key pressed with a modifier', () => {
    expect(press('F1', { ctrlKey: true })).toBeNull();
    expect(press('F2', { altKey: true })).toBeNull();
    expect(press('F3', { metaKey: true })).toBeNull();
    expect(press('F4', { shiftKey: true })).toBeNull();
  });
});
