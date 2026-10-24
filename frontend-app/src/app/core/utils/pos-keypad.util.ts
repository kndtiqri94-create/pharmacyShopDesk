export const KEYPAD_MAX_LENGTH = 10;
export const KEYPAD_MAX_DECIMALS = 2;
export const KEYPAD_BACKSPACE = 'BACKSPACE';
export const KEYPAD_KEYS: readonly string[] = [
  '7',
  '8',
  '9',
  '4',
  '5',
  '6',
  '1',
  '2',
  '3',
  '.',
  '0',
  KEYPAD_BACKSPACE,
];

function isDigit(key: string): boolean {
  return key.length === 1 && key >= '0' && key <= '9';
}

function appendDigit(current: string, key: string): string {
  if (current === '0') return key;
  const point = current.indexOf('.');
  if (point !== -1 && current.length - point - 1 >= KEYPAD_MAX_DECIMALS) return current;
  return `${current}${key}`;
}

function appendPoint(current: string): string {
  if (current.includes('.')) return current;
  return current.length === 0 ? '0.' : `${current}.`;
}

export function applyKeypadKey(current: string, key: string): string {
  if (key === KEYPAD_BACKSPACE) return current.slice(0, -1);
  if (current.length >= KEYPAD_MAX_LENGTH) return current;
  if (isDigit(key)) return appendDigit(current, key);
  if (key === '.') return appendPoint(current);
  return current;
}
