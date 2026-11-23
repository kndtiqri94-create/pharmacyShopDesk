import { generateDeviceCode, newId } from './device-id.util';
import { currentDeviceCode, isValidDeviceCode, setCurrentDeviceCode } from './device-identity.util';

describe('device-id.util', () => {
  it('gives a different id every time, across many ids', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
  });

  it('shapes an id like a UUID', () => {
    const parts = newId().split('-');
    expect(parts.map(part => part.length)).toEqual([8, 4, 4, 4, 12]);
  });

  it('still gives unique, well formed ids when crypto.randomUUID is missing', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 500 }, () => newId()));
      expect(ids.size).toBe(500);
      const [first] = [...ids];
      expect(first.split('-').map(part => part.length)).toEqual([8, 4, 4, 4, 12]);
      expect(first[14]).toBe('4');
    } finally {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
  });

  it('makes a three character device code from capital letters and digits', () => {
    for (let count = 0; count < 200; count++) {
      const code = generateDeviceCode();
      expect(code).toHaveSize(3);
      expect(isValidDeviceCode(code)).toBeTrue();
    }
  });

  it('accepts only 2 to 4 capital letters or digits as a device code', () => {
    expect(isValidDeviceCode('T1')).toBeTrue();
    expect(isValidDeviceCode('K7M')).toBeTrue();
    expect(isValidDeviceCode('TILL')).toBeTrue();
    expect(isValidDeviceCode('T')).toBeFalse();
    expect(isValidDeviceCode('TILL1')).toBeFalse();
    expect(isValidDeviceCode('k7m')).toBeFalse();
    expect(isValidDeviceCode('K-7')).toBeFalse();
  });

  it('refuses to use a bad device code', () => {
    expect(() => setCurrentDeviceCode('bad code')).toThrowError();
    expect(currentDeviceCode()).toBeNull();
  });
});
