import { sanitizeReturnUrl } from './return-url.util';

describe('return-url.util', () => {
  it('keeps safe internal paths', () => {
    expect(sanitizeReturnUrl('/products?page=2')).toBe('/products?page=2');
  });

  it('rejects empty and missing values', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
    expect(sanitizeReturnUrl(undefined)).toBeNull();
    expect(sanitizeReturnUrl('')).toBeNull();
  });

  it('rejects external and protocol-relative urls', () => {
    expect(sanitizeReturnUrl('https://evil.example')).toBeNull();
    expect(sanitizeReturnUrl('//evil.example')).toBeNull();
    expect(sanitizeReturnUrl('/\\evil.example')).toBeNull();
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects control characters, the sign-in page and oversized values', () => {
    expect(sanitizeReturnUrl('/products\nSet-Cookie: x')).toBeNull();
    expect(sanitizeReturnUrl('/sign-in?returnUrl=/products')).toBeNull();
    expect(sanitizeReturnUrl(`/${'a'.repeat(300)}`)).toBeNull();
  });
});
