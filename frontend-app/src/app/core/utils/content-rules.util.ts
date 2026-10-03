const BANNED_BUTTON_LABELS = ['submit', 'ok'];

function isAcronymOrNumber(word: string): boolean {
  return word === word.toUpperCase();
}

export function hasNoExclamation(text: string): boolean {
  return !text.includes('!');
}

export function isValidButtonLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0 || BANNED_BUTTON_LABELS.includes(trimmed.toLowerCase())) return false;
  if (!hasNoExclamation(trimmed)) return false;
  const [first, ...rest] = trimmed.split(' ');
  if (first[0] !== first[0].toUpperCase()) return false;
  return rest.every(word => word[0] === word[0].toLowerCase() || isAcronymOrNumber(word));
}
