import {
  MAX_SERVER_ONLY_PRODUCTS,
  MAX_SYNC_NAME_LENGTH,
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
  ProductSyncRecord,
  ProductSyncServerRecord,
} from '../models/domain/product-sync.model';
import { isBatchResponseUsable, isValidServerRecord } from './product-sync-validation.util';

describe('product-sync-validation.util', () => {
  const serverRecord = (key: string, overrides: Partial<ProductSyncServerRecord> = {}) => ({
    matchKey: key,
    name: 'Name',
    category: 'Cat',
    unit: 'tablet',
    priceCents: 100,
    costCents: 50,
    stockOnHand: 10,
    active: true,
    ...overrides,
  });
  const requestRecord = (key: string): ProductSyncRecord => ({
    ...serverRecord(key),
    stockDelta: 0,
    operationId: `${key}:0`,
  });
  const request = (overrides: Partial<ProductSyncBatchRequest> = {}): ProductSyncBatchRequest => ({
    batchNumber: 1,
    totalBatches: 1,
    records: [requestRecord('A'), requestRecord('B')],
    appMatchKeys: ['A', 'B'],
    ...overrides,
  });
  const response = (
    overrides: Partial<ProductSyncBatchResponse> = {}
  ): ProductSyncBatchResponse => ({
    batchNumber: 1,
    records: [serverRecord('A'), serverRecord('B')],
    serverOnlyRecords: [],
    ...overrides,
  });

  it('accepts a well formed response', () => {
    expect(isBatchResponseUsable(request(), response())).toBeTrue();
  });

  it('accepts server-only products on the final batch', () => {
    const reply = response({ serverOnlyRecords: [serverRecord('C')] });
    expect(isBatchResponseUsable(request(), reply)).toBeTrue();
  });

  it('refuses a null or non-object reply', () => {
    expect(
      isBatchResponseUsable(request(), null as unknown as ProductSyncBatchResponse)
    ).toBeFalse();
  });

  it('refuses a reply for a different batch number', () => {
    expect(isBatchResponseUsable(request(), response({ batchNumber: 2 }))).toBeFalse();
  });

  it('refuses a count mismatch', () => {
    expect(
      isBatchResponseUsable(request(), response({ records: [serverRecord('A')] }))
    ).toBeFalse();
  });

  it('refuses unknown or reordered match keys', () => {
    const unknown = response({ records: [serverRecord('A'), serverRecord('Z')] });
    const reordered = response({ records: [serverRecord('B'), serverRecord('A')] });
    expect(isBatchResponseUsable(request(), unknown)).toBeFalse();
    expect(isBatchResponseUsable(request(), reordered)).toBeFalse();
  });

  it('refuses duplicate keys in the reply', () => {
    const duplicate = response({ records: [serverRecord('A'), serverRecord('A')] });
    expect(isBatchResponseUsable(request(), duplicate)).toBeFalse();
  });

  it('refuses bad numbers', () => {
    const bad: Partial<ProductSyncServerRecord>[] = [
      { priceCents: Number.NaN },
      { priceCents: -1 },
      { priceCents: 1.5 },
      { priceCents: Number.POSITIVE_INFINITY },
      { costCents: -5 },
      { stockOnHand: -1 },
      { stockOnHand: 2.5 },
      { stockOnHand: 1e12 },
      { priceCents: '100' as unknown as number },
    ];
    for (const overrides of bad) {
      const reply = response({ records: [serverRecord('A', overrides), serverRecord('B')] });
      expect(isBatchResponseUsable(request(), reply))
        .withContext(JSON.stringify(overrides))
        .toBeFalse();
    }
  });

  it('refuses oversized or blank text and a non-boolean active flag', () => {
    const bad: Partial<ProductSyncServerRecord>[] = [
      { name: 'x'.repeat(MAX_SYNC_NAME_LENGTH + 1) },
      { name: '   ' },
      { category: 'x'.repeat(101) },
      { unit: 'x'.repeat(101) },
      { matchKey: 'k'.repeat(65) },
      { active: 'yes' as unknown as boolean },
    ];
    for (const overrides of bad) {
      expect(isValidServerRecord(serverRecord('A', overrides))).toBeFalse();
    }
  });

  it('refuses server-only products before the final batch', () => {
    const early = request({ batchNumber: 1, totalBatches: 2, appMatchKeys: null });
    const reply = response({ serverOnlyRecords: [serverRecord('C')] });
    expect(isBatchResponseUsable(early, reply)).toBeFalse();
  });

  it('refuses server-only products that are already in the app or repeated', () => {
    const known = response({ serverOnlyRecords: [serverRecord('A')] });
    const repeated = response({ serverOnlyRecords: [serverRecord('C'), serverRecord('C')] });
    expect(isBatchResponseUsable(request(), known)).toBeFalse();
    expect(isBatchResponseUsable(request(), repeated)).toBeFalse();
  });

  it('refuses an oversized server-only list', () => {
    const many = Array.from({ length: MAX_SERVER_ONLY_PRODUCTS + 1 }, (_, index) =>
      serverRecord(`S${index}`)
    );
    expect(isBatchResponseUsable(request(), response({ serverOnlyRecords: many }))).toBeFalse();
  });

  it('refuses a reply with no server-only list at all', () => {
    const reply = {
      ...response(),
      serverOnlyRecords: undefined,
    } as unknown as ProductSyncBatchResponse;
    expect(isBatchResponseUsable(request(), reply)).toBeFalse();
  });
});
