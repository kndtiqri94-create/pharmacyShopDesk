import {
  KEYPAD_BACKSPACE,
  KEYPAD_KEYS,
  KEYPAD_MAX_LENGTH,
  applyKeypadKey,
} from './pos-keypad.util';

function type(keys: string[], start = ''): string {
  return keys.reduce((text, key) => applyKeypadKey(text, key), start);
}

describe('pos keypad', () => {
  it('types digits one after another', () => {
    expect(type(['1', '2', '5'])).toBe('125');
  });

  it('drops a leading zero when another digit follows', () => {
    expect(type(['0', '5'])).toBe('5');
    expect(type(['0', '0', '0'])).toBe('0');
  });

  it('adds one decimal point and ignores a second', () => {
    expect(type(['1', '.', '5'])).toBe('1.5');
    expect(type(['1', '.', '5', '.', '2'])).toBe('1.52');
  });

  it('starts a decimal with a zero in front', () => {
    expect(type(['.', '5'])).toBe('0.5');
  });

  it('ignores a third decimal place', () => {
    expect(type(['1', '.', '2', '3', '4', '5'])).toBe('1.23');
  });

  it('deletes the last character with Backspace and is safe on empty text', () => {
    expect(type(['1', '2', KEYPAD_BACKSPACE])).toBe('1');
    expect(type([KEYPAD_BACKSPACE, KEYPAD_BACKSPACE])).toBe('');
    expect(type([KEYPAD_BACKSPACE], '1.')).toBe('1');
  });

  it('stops growing at the longest length', () => {
    const typed = type(Array.from({ length: 30 }, () => '9'));
    expect(typed).toHaveSize(KEYPAD_MAX_LENGTH);
    expect(applyKeypadKey(typed, '1')).toBe(typed);
    expect(applyKeypadKey(typed, '.')).toBe(typed);
  });

  it('ignores any other key', () => {
    expect(applyKeypadKey('5', 'a')).toBe('5');
    expect(applyKeypadKey('5', '-')).toBe('5');
    expect(applyKeypadKey('5', '12')).toBe('5');
    expect(applyKeypadKey('5', '')).toBe('5');
  });

  it('offers the digits, the decimal point and Backspace and nothing else', () => {
    expect([...KEYPAD_KEYS].sort()).toEqual(
      ['.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', KEYPAD_BACKSPACE].sort()
    );
  });
});
