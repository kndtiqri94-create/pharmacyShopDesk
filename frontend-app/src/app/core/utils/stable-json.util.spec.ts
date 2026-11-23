import { sameContent } from './stable-json.util';

describe('sameContent', () => {
  it('ignores the order of keys at every depth', () => {
    expect(
      sameContent(
        { a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } },
        { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 }
      )
    ).toBeTrue();
  });

  it('notices a different value, a missing key and a different array order', () => {
    expect(sameContent({ a: 1 }, { a: 2 })).toBeFalse();
    expect(sameContent({ a: 1 }, { a: 1, b: 1 })).toBeFalse();
    expect(sameContent({ a: [1, 2] }, { a: [2, 1] })).toBeFalse();
    expect(sameContent(null, {})).toBeFalse();
  });
});
