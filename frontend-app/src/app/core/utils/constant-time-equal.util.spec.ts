import { constantTimeEqual } from './constant-time-equal.util';

describe('constant-time-equal.util', () => {
  it('matches equal strings', () => {
    expect(constantTimeEqual('Owner@2026', 'Owner@2026')).toBeTrue();
  });

  it('rejects different strings of the same length', () => {
    expect(constantTimeEqual('abcd', 'abce')).toBeFalse();
  });

  it('rejects strings of different length, including prefixes', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBeFalse();
    expect(constantTimeEqual('', 'a')).toBeFalse();
  });

  it('matches two empty strings', () => {
    expect(constantTimeEqual('', '')).toBeTrue();
  });
});
