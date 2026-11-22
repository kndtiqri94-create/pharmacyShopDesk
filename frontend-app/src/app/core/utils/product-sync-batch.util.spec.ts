import { splitIntoBatches } from './product-sync-batch.util';

describe('product-sync-batch.util', () => {
  const items = (count: number) => Array.from({ length: count }, (_, index) => index);
  const sizes = (count: number) => splitIntoBatches(items(count)).map(batch => batch.length);

  it('returns no batches for an empty list', () => {
    expect(sizes(0)).toEqual([]);
  });

  it('keeps a single product in one batch', () => {
    expect(sizes(1)).toEqual([1]);
  });

  it('puts 389 products in one batch', () => {
    expect(sizes(389)).toEqual([389]);
  });

  it('puts exactly 500 products in one batch', () => {
    expect(sizes(500)).toEqual([500]);
  });

  it('splits 501 products into two batches', () => {
    expect(sizes(501)).toEqual([500, 1]);
  });

  it('splits 1200 products into 500, 500 and 200', () => {
    expect(sizes(1200)).toEqual([500, 500, 200]);
  });

  it('keeps the original order across batches', () => {
    expect(splitIntoBatches(items(1200)).flat()).toEqual(items(1200));
  });

  it('never makes a batch size below one', () => {
    expect(splitIntoBatches(items(3), 0).map(batch => batch.length)).toEqual([1, 1, 1]);
    expect(splitIntoBatches(items(3), -5)).toHaveSize(3);
  });
});
