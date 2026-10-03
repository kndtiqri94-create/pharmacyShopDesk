import { capitalize, pluralize } from './text.util';

describe('text.util', () => {
  it('pluralizes by count', () => {
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
    expect(pluralize(2, 'batch', 'batches')).toBe('2 batches');
    expect(pluralize(0, 'bill')).toBe('0 bills');
  });

  it('capitalizes the first letter', () => {
    expect(capitalize('tablet')).toBe('Tablet');
    expect(capitalize('')).toBe('');
  });
});
