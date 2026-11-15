import { firstValueFrom } from 'rxjs';
import {
  ProductSyncBatchRequest,
  ProductSyncRecord,
} from '../../../models/domain/product-sync.model';
import { BatchFailedError, ServerUnreachableError } from '../product-sync-server';
import { InMemoryProductSyncServer } from './in-memory-product-sync-server';

describe('InMemoryProductSyncServer', () => {
  const KNOWN = '4791000000011';
  const record = (key: string, overrides: Partial<ProductSyncRecord> = {}): ProductSyncRecord => ({
    matchKey: key,
    name: 'Local name',
    category: 'Local',
    unit: 'tablet',
    priceCents: 100,
    costCents: 50,
    stockOnHand: 7,
    active: true,
    stockDelta: 0,
    operationId: `${key}:0`,
    ...overrides,
  });
  const request = (
    records: ProductSyncRecord[],
    overrides: Partial<ProductSyncBatchRequest> = {}
  ): ProductSyncBatchRequest => ({
    batchNumber: 1,
    totalBatches: 1,
    records,
    appMatchKeys: null,
    ...overrides,
  });
  const send = (server: InMemoryProductSyncServer, req: ProductSyncBatchRequest) =>
    firstValueFrom(server.syncBatch(req));

  it('returns its own values for a known product', async () => {
    const server = new InMemoryProductSyncServer();
    const reply = await send(server, request([record(KNOWN)]));
    expect(reply.records[0].name).toBe('Paracetamol 500mg');
    expect(reply.records[0].priceCents).toBe(250);
    expect(reply.records[0].stockOnHand).toBe(3600);
  });

  it('applies a stock delta once per operation id and replays on a repeat', async () => {
    const server = new InMemoryProductSyncServer();
    const sale = record(KNOWN, { stockDelta: -10, operationId: `${KNOWN}:5` });
    const first = await send(server, request([sale]));
    const repeat = await send(server, request([sale]));
    expect(first.records[0].stockOnHand).toBe(3590);
    expect(repeat.records[0].stockOnHand).toBe(3590);
    expect(server.getRecord(KNOWN)!.stockOnHand).toBe(3590);
  });

  it('applies a new operation id on top of the earlier result', async () => {
    const server = new InMemoryProductSyncServer();
    await send(server, request([record(KNOWN, { stockDelta: -10, operationId: 'x:1' })]));
    const next = await send(
      server,
      request([record(KNOWN, { stockDelta: -5, operationId: 'x:2' })])
    );
    expect(next.records[0].stockOnHand).toBe(3585);
  });

  it('refuses a reused operation id that carries a different delta', async () => {
    const server = new InMemoryProductSyncServer();
    await send(server, request([record(KNOWN, { stockDelta: -10, operationId: 'x:1' })]));
    await expectAsync(
      send(server, request([record(KNOWN, { stockDelta: -3, operationId: 'x:1' })]))
    ).toBeRejectedWithError(BatchFailedError);
  });

  it('never lets stock go below zero', async () => {
    const server = new InMemoryProductSyncServer();
    const reply = await send(server, request([record(KNOWN, { stockDelta: -99999 })]));
    expect(reply.records[0].stockOnHand).toBe(0);
  });

  it('adds an app-only product with the app values', async () => {
    const server = new InMemoryProductSyncServer();
    const before = server.recordCount();
    const reply = await send(server, request([record('APP-ONLY')]));
    expect(reply.records[0].stockOnHand).toBe(7);
    expect(server.recordCount()).toBe(before + 1);
    expect(server.getRecord('APP-ONLY')!.name).toBe('Local name');
  });

  it('returns server-only products when the app sends its key list', async () => {
    const server = new InMemoryProductSyncServer();
    const reply = await send(server, request([record(KNOWN)], { appMatchKeys: [KNOWN] }));
    const keys = reply.serverOnlyRecords.map(item => item.matchKey);
    expect(keys).toContain('4791000009001');
    expect(keys).not.toContain(KNOWN);
  });

  it('returns no server-only products without a key list', async () => {
    const server = new InMemoryProductSyncServer();
    const reply = await send(server, request([record(KNOWN)]));
    expect(reply.serverOnlyRecords).toEqual([]);
  });

  it('hands out copies so callers cannot change server data', async () => {
    const server = new InMemoryProductSyncServer();
    const reply = await send(server, request([record(KNOWN)]));
    reply.records[0].priceCents = 1;
    server.getRecord(KNOWN)!.priceCents = 2;
    expect(server.getRecord(KNOWN)!.priceCents).toBe(250);
  });

  it('refuses an oversized or malformed batch', async () => {
    const server = new InMemoryProductSyncServer();
    const tooMany = Array.from({ length: 501 }, (_, index) => record(`K${index}`));
    await expectAsync(send(server, request(tooMany))).toBeRejectedWithError(BatchFailedError);
    await expectAsync(
      send(server, request([record('BAD', { priceCents: -1 })]))
    ).toBeRejectedWithError(BatchFailedError);
    await expectAsync(
      send(server, request([record('BAD', { stockDelta: 1.5 })]))
    ).toBeRejectedWithError(BatchFailedError);
  });

  it('is reachable and healthy by default', async () => {
    const server = new InMemoryProductSyncServer();
    await expectAsync(send(server, request([record(KNOWN)]))).toBeResolved();
  });

  it('can simulate an unreachable server', async () => {
    const server = new InMemoryProductSyncServer();
    server.simulateUnreachable(true);
    await expectAsync(send(server, request([record(KNOWN)]))).toBeRejectedWithError(
      ServerUnreachableError
    );
  });

  it('can simulate a failing batch number without applying it', async () => {
    const server = new InMemoryProductSyncServer();
    server.simulateFailingBatch(2);
    const sale = record(KNOWN, { stockDelta: -10, operationId: 'x:1' });
    await expectAsync(
      send(server, request([sale], { batchNumber: 2, totalBatches: 3 }))
    ).toBeRejectedWithError(BatchFailedError);
    expect(server.getRecord(KNOWN)!.stockOnHand).toBe(3600);
  });

  it('can simulate a failure after the batch was applied', async () => {
    const server = new InMemoryProductSyncServer();
    server.simulateFailureAfterApply(1);
    const sale = record(KNOWN, { stockDelta: -10, operationId: 'x:1' });
    await expectAsync(send(server, request([sale]))).toBeRejectedWithError(BatchFailedError);
    expect(server.getRecord(KNOWN)!.stockOnHand).toBe(3590);
  });
});
