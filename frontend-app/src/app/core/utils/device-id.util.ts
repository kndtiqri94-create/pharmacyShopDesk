const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEVICE_CODE_LENGTH = 3;
const ALPHABET_MASK = 31;
const HEX_RADIX = 16;
const BYTE_PAD = 2;
const UUID_VERSION_BYTE = 6;
const UUID_VARIANT_BYTE = 8;
const UUID_BYTES = 16;

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function uuidFromRandomValues(): string {
  const bytes = randomBytes(UUID_BYTES);
  bytes[UUID_VERSION_BYTE] = (bytes[UUID_VERSION_BYTE] & 0x0f) | 0x40;
  bytes[UUID_VARIANT_BYTE] = (bytes[UUID_VARIANT_BYTE] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(HEX_RADIX).padStart(BYTE_PAD, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

export function newId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidFromRandomValues();
}

export function generateDeviceCode(): string {
  return Array.from(
    randomBytes(DEVICE_CODE_LENGTH),
    byte => CODE_ALPHABET[byte & ALPHABET_MASK]
  ).join('');
}
