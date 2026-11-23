import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApi, createApi, movement, product, sale } from './helpers.js';

let api: TestApi;
beforeEach(async () => {
  api = await createApi();
});
afterEach(async () => api.app.close());

const put = (changeId: string, entity: string, id: string, data: unknown, baseSeq?: number | null) => ({
  changeId,
  entity,
  op: 'put' as const,
  id,
  data,
  ...(baseSeq === undefined ? {} : { baseSeq }),
});

const push = (deviceCode: string, changes: unknown[]) => api.post('/sync/push', { deviceCode, changes });
const statuses = (response: { body: { results: { status: string }[] } }) =>
  response.body.results.map(result => result.status);

describe('S-3.3.6 push', () => {
  it('reports accepted per change, and the same batch sent again changes nothing', async () => {
    const batch = [
      put('c1', 'products', 'prod-1', product()),
      put('c2', 'posCustomers', 'cus-1', { id: 'cus-1', name: 'Walk-in', isWalkIn: true }),
      put('c3', 'sales', 'sale-1', sale()),
      put('c4', 'stockMovements', 'mov-1', movement()),
    ];
    const first = await push('AB1', batch);
    expect(statuses(first)).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    const seqAfterFirst = await api.store.transaction(tx => tx.currentSeq());
    const stockAfterFirst = (await api.get('/products/prod-1')).body.stockOnHand;

    const second = await push('AB1', batch);
    expect(statuses(second)).toEqual(['duplicate', 'duplicate', 'duplicate', 'duplicate']);
    expect(await api.store.transaction(tx => tx.currentSeq())).toBe(seqAfterFirst);
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(stockAfterFirst);
    expect((await api.get('/sales')).body.total).toBe(1);
  });

  it('lets two devices sell the same item and both reduce stock', async () => {
    await push('AB1', [put('p', 'products', 'prod-1', { ...product(), stockOnHand: 10 })]);
    const deviceA = push('AB1', [
      put('a-sale', 'sales', 'sale-a', sale({ id: 'sale-a', invoiceNo: 'AB1-0001' })),
      put('a-mov', 'stockMovements', 'mov-a', movement({ id: 'mov-a', qtyDelta: -2, refId: 'sale-a', deviceCode: 'AB1' })),
    ]);
    const deviceB = push('CD2', [
      put('b-sale', 'sales', 'sale-b', sale({ id: 'sale-b', invoiceNo: 'CD2-0001' })),
      put('b-mov', 'stockMovements', 'mov-b', movement({ id: 'mov-b', qtyDelta: -3, refId: 'sale-b', deviceCode: 'CD2' })),
    ]);
    await Promise.all([deviceA, deviceB]);
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(5);
    expect((await api.get('/sales')).body.total).toBe(2);
  });

  it('never rejects a sale for stock reasons', async () => {
    await push('AB1', [put('p', 'products', 'prod-1', { ...product(), stockOnHand: 1 })]);
    const result = await push('AB1', [
      put('s', 'sales', 'sale-1', sale()),
      put('m', 'stockMovements', 'mov-1', movement({ qtyDelta: -50 })),
    ]);
    expect(statuses(result)).toEqual(['accepted', 'accepted']);
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(-49);
  });

  it('rejects malformed and unknown changes with a reason, and remembers the rejection', async () => {
    const batch = [
      put('bad-1', 'sales', 'sale-1', sale({ lines: [] })),
      put('bad-2', 'spaceships', 'x', {}),
      { op: 'put' },
      put('bad-3', 'sales', 'other-id', sale()),
      { changeId: 'bad-4', entity: 'stockMovements', op: 'delete', id: 'mov-1' },
    ];
    const result = await push('AB1', batch);
    expect(statuses(result)).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
    expect(result.body.results.map((item: { reason: string }) => item.reason)).toEqual([
      'validation_error',
      'unknown_entity',
      'invalid_change',
      'id_mismatch',
      'movement_cannot_be_deleted',
    ]);
    const again = await push('AB1', batch.slice(0, 2));
    expect(statuses(again)).toEqual(['duplicate', 'duplicate']);
    expect((await api.get('/sales')).body.total).toBe(0);
  });

  it('refuses a bad envelope', async () => {
    expect((await api.post('/sync/push', { deviceCode: 'lower', changes: [] })).status).toBe(400);
    expect((await api.post('/sync/push', { deviceCode: 'AB1' })).status).toBe(400);
    const tooMany = Array.from({ length: 501 }, (_, index) => ({ changeId: `c${index}` }));
    expect((await api.post('/sync/push', { deviceCode: 'AB1', changes: tooMany })).status).toBe(400);
  });

  it('keeps a posted sale whose number clashes, and flags it', async () => {
    await push('AB1', [put('s1', 'sales', 'sale-1', sale())]);
    const clash = await push('CD2', [put('s2', 'sales', 'sale-2', sale({ id: 'sale-2' }))]);
    expect(clash.body.results[0]).toMatchObject({ status: 'accepted', reason: 'unique_key_clash_flagged' });
    expect((await api.get('/sales')).body.total).toBe(2);
  });

  it('rejects a master-data clash (duplicate SKU) with its reason', async () => {
    await push('AB1', [put('p1', 'products', 'prod-1', product())]);
    const clash = await push('CD2', [put('p2', 'products', 'prod-2', product({ id: 'prod-2' }))]);
    expect(clash.body.results[0]).toMatchObject({ status: 'rejected', reason: 'duplicate_sku' });
  });

  it('server wins on a non-stock conflict, applies an update from an up-to-date device', async () => {
    await push('AB1', [put('s1', 'suppliers', 'sup-1', supplier('Acme'))]);
    const seq = (await pull(0)).body.changes.find((change: { id: string }) => change.id === 'sup-1').seq;
    // Another device updates it on the server.
    expect(statuses(await push('CD2', [put('s2', 'suppliers', 'sup-1', supplier('Acme Pharma'), seq)]))).toEqual(['accepted']);
    // The first device edits from its stale copy: the server's version stands.
    const stale = await push('AB1', [put('s3', 'suppliers', 'sup-1', supplier('Old edit'), seq)]);
    expect(stale.body.results[0]).toMatchObject({ status: 'duplicate', reason: 'server_wins' });
    expect((await api.get('/suppliers/sup-1')).body.name).toBe('Acme Pharma');
  });

  it('never overwrites server stock with a total pushed in a product row', async () => {
    await push('AB1', [put('p1', 'products', 'prod-1', { ...product(), stockOnHand: 10 })]);
    await push('AB1', [put('m1', 'stockMovements', 'mov-1', movement({ qtyDelta: -4 }))]);
    const seq = (await pull(0)).body.changes.find((change: { id: string; entity: string }) => change.id === 'prod-1' && change.entity === 'products').seq;
    await push('CD2', [put('p2', 'products', 'prod-1', { ...product({ name: 'Renamed', priceCents: 300 }), stockOnHand: 999 }, seq)]);
    const read = (await api.get('/products/prod-1')).body;
    expect(read.name).toBe('Renamed');
    expect(read.stockOnHand).toBe(6);
  });

  it('syncs deletes as tombstones, and a resent delete is a duplicate', async () => {
    await push('AB1', [put('c1', 'suppliers', 'sup-1', supplier('Acme'))]);
    const seq = (await pull(0)).body.changes[0].seq;
    const del = { changeId: 'd1', entity: 'suppliers', op: 'delete', id: 'sup-1', baseSeq: seq };
    expect(statuses(await push('AB1', [del]))).toEqual(['accepted']);
    expect(statuses(await push('AB1', [del]))).toEqual(['duplicate']);
    expect(statuses(await push('AB1', [{ ...del, changeId: 'd2' }]))).toEqual(['duplicate']);
    expect((await api.get('/suppliers/sup-1')).status).toBe(404);
    const changes = (await pull(0)).body.changes;
    expect(changes.at(-1)).toMatchObject({ entity: 'suppliers', id: 'sup-1', op: 'delete', data: null });
    expect(statuses(await push('AB1', [{ changeId: 'd3', entity: 'sales', op: 'delete', id: 'x' }]))).toEqual(['rejected']);
  });

  it('syncs settings documents', async () => {
    const roleMatrix = Object.fromEntries(
      ['ADMIN', 'MANAGER', 'PHARMACIST', 'CASHIER'].map(role => [
        role,
        Object.fromEntries(
          ['dashboard', 'products', 'grn', 'purchase-orders', 'suppliers', 'employees', 'payroll', 'reload-utility', 'pos', 'users', 'settings'].map(key => [key, 'FULL'])
        ),
      ])
    );
    expect(statuses(await push('AB1', [put('r1', 'documents', 'role-matrix', roleMatrix)]))).toEqual(['accepted']);
    expect(statuses(await push('AB1', [put('r2', 'documents', 'nope', {})]))).toEqual(['rejected']);
    expect((await pull(0)).body.changes[0]).toMatchObject({ entity: 'documents', id: 'role-matrix' });
  });
});

const supplier = (name: string) => ({
  id: 'sup-1', name, contactPerson: '', phone: '', email: '', sinceYear: 2020,
  creditDays: 0, deliveryDays: '', active: true,
});
const pull = (cursor: number, limit = 200) => api.get(`/sync/pull?cursor=${cursor}&limit=${limit}`);

describe('S-3.3.6 pull', () => {
  it('returns changes after a cursor in order and pages with hasMore', async () => {
    await push('AB1', [
      put('c1', 'suppliers', 'sup-1', supplier('A')),
      put('c2', 'products', 'prod-1', product()),
      put('c3', 'stockMovements', 'mov-1', movement()),
    ]);
    const all = (await pull(0)).body;
    expect(all.changes.map((change: { entity: string }) => change.entity)).toEqual(['suppliers', 'products', 'stockMovements']);
    expect(all.hasMore).toBe(false);

    const first = (await pull(0, 2)).body;
    expect(first.changes).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const rest = (await pull(first.nextCursor, 2)).body;
    expect(rest.changes.map((change: { id: string }) => change.id)).toEqual(['mov-1']);
    expect(rest.hasMore).toBe(false);
    expect((await pull(rest.nextCursor)).body).toMatchObject({ changes: [], hasMore: false, nextCursor: rest.nextCursor });
  });

  it('includes changes made through the plain endpoints and never loses a record between pulls', async () => {
    const start = (await pull(0)).body.nextCursor;
    await api.post('/suppliers', supplier('REST'));
    await api.post('/stock-movements', { movements: [movement()] });
    const changes = (await pull(start)).body.changes;
    expect(changes.map((change: { entity: string }) => change.entity)).toEqual(['suppliers', 'stockMovements']);
    expect(changes[1].data).toMatchObject({ id: 'mov-1', qtyDelta: -2, deviceCode: 'AB1' });
  });

  it('does not show internal bookkeeping and cannot stall on it', async () => {
    await api.post('/products', product());
    await api.post('/products/sync-batch', {
      batchNumber: 1, totalBatches: 1,
      records: [{ matchKey: '4791000000011', name: 'x', category: '', unit: 'tablet', priceCents: 1, costCents: 1, stockOnHand: 0, active: true, stockDelta: -1, operationId: '4791000000011:1' }],
      appMatchKeys: ['4791000000011'],
    });
    const body = (await pull(0, 500)).body;
    expect(body.changes.every((change: { entity: string }) => !change.entity.startsWith('_'))).toBe(true);
    const tiny = (await pull(0, 1)).body;
    expect(tiny.nextCursor).toBeGreaterThan(0);
  });

  it('validates the query', async () => {
    expect((await api.get('/sync/pull?cursor=-1')).status).toBe(400);
    expect((await api.get('/sync/pull?limit=100000')).status).toBe(400);
  });
});

describe('OQ48 Update Products sync batch (S-2.10.9 contract on the new server)', () => {
  const record = (overrides: Record<string, unknown> = {}) => ({
    matchKey: '4791000000011', name: 'App name', category: 'App', unit: 'tablet', priceCents: 1, costCents: 1,
    stockOnHand: 100, active: false, stockDelta: -10, operationId: '4791000000011:1', ...overrides,
  });
  const request = (records: unknown[], appMatchKeys: string[] | null = null, batchNumber = 1, totalBatches = 1) => ({
    batchNumber, totalBatches, records, appMatchKeys,
  });

  it('applies the app stock change once, returns server values and keeps the server winning', async () => {
    await api.post('/products', product());
    const first = await api.post('/products/sync-batch', request([record()]));
    expect(first.status).toBe(200);
    expect(first.body.records[0]).toMatchObject({
      matchKey: '4791000000011', name: 'Paracetamol 500mg', priceCents: 250, active: true, stockOnHand: 90,
    });
    const repeat = await api.post('/products/sync-batch', request([record()]));
    expect(repeat.body.records[0].stockOnHand).toBe(90);
    const different = await api.post('/products/sync-batch', request([record({ stockDelta: -5 })]));
    expect(different.status).toBe(422);
    expect(different.body.error.code).toBe('batch_failed');
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(90);
  });

  it('floors stock at zero, creates app-only products and returns server-only ones on the last batch', async () => {
    await api.post('/products', product({ stockOnHand: 3 }));
    await api.post('/products', product({ id: 'prod-2', sku: 'ONLY-SERVER', barcode: '999' }));
    const response = await api.post(
      '/products/sync-batch',
      request([
        record({ stockDelta: -50 }),
        record({ matchKey: 'NEW-KEY', name: 'New in app', stockOnHand: 7, stockDelta: 0, operationId: 'NEW-KEY:1', active: true }),
      ], ['4791000000011', 'NEW-KEY'])
    );
    expect(response.body.records[0].stockOnHand).toBe(0);
    expect(response.body.records[1]).toMatchObject({ matchKey: 'NEW-KEY', stockOnHand: 7 });
    expect(response.body.serverOnlyRecords.map((item: { matchKey: string }) => item.matchKey)).toEqual(['999']);
  });

  it('validates the batch', async () => {
    expect((await api.post('/products/sync-batch', request(Array.from({ length: 501 }, (_, index) => record({ operationId: `k:${index}` }))))).status).toBe(400);
    expect((await api.post('/products/sync-batch', request([record({ priceCents: 1.5 })]))).status).toBe(400);
    expect((await api.post('/products/sync-batch', request([], null, 3, 2))).status).toBe(400);
  });
});
