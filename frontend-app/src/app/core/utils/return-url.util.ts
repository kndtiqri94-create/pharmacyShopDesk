const MAX_RETURN_URL_LENGTH = 200;
const BLOCKED_TARGETS = ['/sign-in'];

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => (character.codePointAt(0) ?? 0) < 32);
}

export function sanitizeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_RETURN_URL_LENGTH) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  if (hasControlCharacter(raw)) return null;
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (BLOCKED_TARGETS.includes(pathOnly)) return null;
  return raw;
}
