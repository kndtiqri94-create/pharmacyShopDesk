const DEVICE_CODE_MIN_LENGTH = 2;
const DEVICE_CODE_MAX_LENGTH = 4;
const UPPER_A = 65;
const UPPER_Z = 90;
const DIGIT_ZERO = 48;
const DIGIT_NINE = 57;

let activeDeviceCode: string | null = null;

function isAllowedCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= UPPER_A && codePoint <= UPPER_Z) ||
    (codePoint >= DIGIT_ZERO && codePoint <= DIGIT_NINE)
  );
}

export function isValidDeviceCode(value: string): boolean {
  if (value.length < DEVICE_CODE_MIN_LENGTH || value.length > DEVICE_CODE_MAX_LENGTH) return false;
  return Array.from(value).every(character => isAllowedCodePoint(character.codePointAt(0) ?? 0));
}

export function currentDeviceCode(): string | null {
  return activeDeviceCode;
}

export function setCurrentDeviceCode(code: string | null): void {
  if (code !== null && !isValidDeviceCode(code)) {
    throw new Error('A device code is 2 to 4 capital letters or digits.');
  }
  activeDeviceCode = code;
}
