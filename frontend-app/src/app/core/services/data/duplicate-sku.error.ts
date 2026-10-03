export class DuplicateSkuError extends Error {
  constructor(readonly sku: string) {
    super('That SKU is already used by another product.');
    this.name = 'DuplicateSkuError';
  }
}
