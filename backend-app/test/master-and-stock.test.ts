import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApi, createApi, movement, product } from './helpers.js';

let api: TestApi;
beforeEach(async () => {
  api = await createApi();
});
afterEach(async () => api.app.close());

const bank = (overrides: Record<string, unknown> = {}) => ({
  id: 'bank-1',
  bank: 'Bank of Ceylon',
  branch: 'Colombo',
  holderName: 'ShopDesk Pharmacy',
  accountNo: '1234567890',
  openingBalanceCents: 0,
  ...overrides,
});

describe('S-3.3.2 master data', () => {
  it('creates, reads, lists and updates a supplier', async () => {
    const supplier = {
      id: 'sup-1',
      name: 'Acme Pharma',
      contactPerson: 'Nimal',
      phone: '0771234567',
      email: 'a@b.lk',
      sinceYear: 2020,
      creditDays: 30,
      deliveryDays: 'Mon, Thu',
      active: true,
    };
    expect((await api.post('/suppliers', supplier)).status).toBe(201);
    expect((await api.get('/suppliers/sup-1')).body).toEqual(supplier);
    const updated = await api.put('/suppliers/sup-1', { ...supplier, creditDays: 45 });
    expect(updated.status).toBe(200);
    expect((await api.get('/suppliers')).body).toMatchObject({ total: 1, page: 1 });
  });

  it('refuses a duplicate SKU, ignoring case and spaces, with a clear code', async () => {
    await api.post('/products', product());
    const clash = await api.post('/products', product({ id: 'prod-2', sku: ' par-500 ' }));
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('duplicate_sku');
    expect((await api.post('/products', product({ id: 'prod-2', sku: 'OTHER' }))).status).toBe(201);
  });

  it('assigns an id to a new product and validates the fields like the UI', async () => {
    const created = await api.post('/products', product({ id: '', sku: 'NEW-1' }));
    expect(created.status).toBe(201);
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/);
    const bad = await api.post('/products', product({ id: 'p9', sku: 'X', name: '', priceCents: -1, stockOnHand: -5 }));
    expect(bad.status).toBe(400);
    const paths = bad.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'priceCents']));
  });

  it('refuses a duplicate bank + account number but allows the same number at another bank', async () => {
    await api.post('/bank-accounts', bank());
    const clash = await api.post('/bank-accounts', bank({ id: 'bank-2', accountNo: ' 1234567890' }));
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('duplicate_bank_account');
    const other = await api.post('/bank-accounts', bank({ id: 'bank-3', bank: "People's Bank" }));
    expect(other.status).toBe(201);
    expect((await api.post('/bank-accounts', bank({ id: 'b4', accountNo: '123' }))).status).toBe(400);
  });

  it('keeps users (no password field), customers and settings', async () => {
    const user = {
      id: 'usr-1',
      username: 'nimal',
      displayName: 'Nimal',
      initials: 'N',
      role: 'CASHIER',
      employeeId: null,
      status: 'ACTIVE',
      lastSignIn: '',
      password: 'must-not-be-kept',
    };
    const saved = await api.post('/users', user);
    expect(saved.status).toBe(201);
    expect(saved.body.password).toBeUndefined();
    expect((await api.post('/users', { ...user, id: 'usr-2', username: 'NIMAL' })).body.error.code).toBe(
      'duplicate_username'
    );
    expect((await api.post('/users', { ...user, id: 'usr-3', username: 'x', role: 'ROOT' })).status).toBe(400);
    expect((await api.post('/customers', { id: 'cus-1', name: 'Walk-in', isWalkIn: true })).status).toBe(201);

    expect((await api.get('/settings/app')).status).toBe(404);
    const settings = {
      shopName: 'ShopDesk',
      branchLabel: 'Main',
      registrationNo: '',
      address: '',
      phone: '',
      email: '',
      expiryAlertDays: 60,
      defaultReorderLevel: 10,
      lowFloatCents: 500000,
      showLowStockCountInSidebar: true,
      sellEarliestExpiringFirst: true,
      blockExpiredSales: true,
      posLineDiscountEnabled: true,
      posBillDiscountEnabled: true,
      posDefaultDiscountPercent: 0,
      posMaxDiscountPercent: 20,
      posHideSidebar: false,
    };
    expect((await api.put('/settings/app', settings)).status).toBe(201);
    expect((await api.put('/settings/app', { ...settings, posMaxDiscountPercent: 150 })).status).toBe(400);
    expect((await api.get('/settings/app')).body.shopName).toBe('ShopDesk');
  });

  it('deletes with a not-found for a missing record and requires the path id to match', async () => {
    expect((await api.del('/suppliers/none')).status).toBe(404);
    const mismatch = await api.put('/customers/other', { id: 'cus-1', name: 'A', isWalkIn: false });
    expect(mismatch.status).toBe(400);
  });
});

describe('S-3.3.3 stock ledger and stock-in', () => {
  it('derives current stock from the stored base plus ordered movements', async () => {
    await api.post('/products', product());
    await api.post('/stock-movements', { movements: [movement(), movement({ id: 'mov-2', qtyDelta: -3 })] });
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(95);
    const ledger = (await api.get('/stock-movements?productId=prod-1')).body.items;
    // The first row is the opening stock, recorded as an adjustment like the app does.
    expect(ledger.map((row: { id: string }) => row.id).slice(1)).toEqual(['mov-1', 'mov-2']);
    expect(ledger[1].seq).toBeLessThan(ledger[2].seq);
  });

  it('records a movement with an already-seen device id once', async () => {
    await api.post('/products', product());
    const first = await api.post('/stock-movements', { movements: [movement()] });
    expect(first.body).toMatchObject({ recorded: 1, duplicates: 0 });
    const again = await api.post('/stock-movements', { movements: [movement(), movement({ id: 'mov-9' })] });
    expect(again.body.results).toEqual([
      { id: 'mov-1', status: 'duplicate' },
      { id: 'mov-9', status: 'accepted' },
    ]);
    expect((await api.get('/stock/products/prod-1')).body.stockOnHand).toBe(100 - 2 - 2);
  });

  it('turns a product stock edit into an adjustment movement, and the same edit again into none', async () => {
    await api.post('/products', product());
    const edited = await api.put('/products/prod-1', product({ stockOnHand: 80 }));
    expect(edited.body.stockOnHand).toBe(80);
    await api.put('/products/prod-1', product({ stockOnHand: 80 }));
    const ledger = (await api.get('/stock-movements?productId=prod-1')).body.items;
    expect(ledger.map((row: { qtyDelta: number }) => row.qtyDelta)).toEqual([100, -20]);
    expect(ledger[1]).toMatchObject({ type: 'ADJUSTMENT', qtyDelta: -20 });
    expect((await api.put('/products/prod-1', product({ stockOnHand: -1 }))).status).toBe(400);
  });

  it('keeps stock per batch, earliest expiry first', async () => {
    const batches = [
      { id: 'b2', batchNo: 'B2', expiryDate: '2027-06-01', quantity: 40, costCents: 100 },
      { id: 'b1', batchNo: 'B1', expiryDate: '2026-12-01', quantity: 10, costCents: 100 },
    ];
    await api.post('/products', product({ trackBatches: true, batches, stockOnHand: 0 }));
    await api.post('/stock-movements', { movements: [movement({ batchId: 'b1', qtyDelta: -4 })] });
    const read = (await api.get('/products/prod-1')).body;
    expect(read.batches.map((batch: { id: string; quantity: number }) => [batch.id, batch.quantity])).toEqual([
      ['b1', 6],
      ['b2', 40],
    ]);
  });

  it('posts a GRN with its movements in one step and never twice', async () => {
    await api.post('/products', product());
    await api.post('/suppliers', {
      id: 'sup-1', name: 'Acme', contactPerson: '', phone: '', email: '', sinceYear: 2020,
      creditDays: 0, deliveryDays: '', active: true,
    });
    const grn = {
      id: 'grn-1',
      number: 'GRN-0001',
      receivedDate: '2026-11-23',
      supplierId: 'sup-1',
      invoiceNo: 'INV-9',
      invoiceDate: '2026-11-22',
      purchaseOrderNumber: null,
      receivedBy: 'Store',
      status: 'RECEIVED',
      paymentStatus: 'UNPAID',
      paymentMethod: 'CREDIT',
      paidCents: 0,
      dueDate: '2026-12-22',
      discountCents: 0,
      totalCents: 18000,
      lines: [
        { productId: 'prod-1', batchNo: '', expiryDate: null, receivedQuantity: 100, freeQuantity: 0, costCents: 180, priceCents: 250 },
      ],
      movements: [movement({ id: 'grn-mov-1', type: 'GRN', qtyDelta: 100, refId: 'grn-1' })],
    };
    const first = await api.post('/grns', grn);
    expect(first.status).toBe(201);
    expect(first.body.movements).toEqual({ recorded: 1, duplicates: 0 });
    const again = await api.post('/grns', grn);
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(again.body.movements).toEqual({ recorded: 0, duplicates: 1 });
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(200);
    expect((await api.post('/grns', { ...grn, id: 'grn-2', number: 'grn-0001' })).body.error.code).toBe(
      'duplicate_number'
    );
  });

  it('keeps purchase orders and refuses bad movements', async () => {
    const po = {
      id: 'po-1', number: 'PO-1', orderDate: '2026-11-23', expectedDate: '', supplierId: 'sup-1',
      status: 'DRAFT', notes: '', deliveryCents: 0, totalCents: 100,
      lines: [{ productId: 'prod-1', orderedQuantity: 5, receivedQuantity: 0, unitCostCents: 20 }],
    };
    expect((await api.post('/purchase-orders', po)).status).toBe(201);
    expect((await api.post('/stock-movements', { movements: [movement({ qtyDelta: 0 })] })).status).toBe(400);
    expect((await api.post('/stock-movements', { movements: [movement({ type: 'GIFT' })] })).status).toBe(400);
    expect((await api.post('/stock-movements', { movements: [] })).status).toBe(400);
  });
});
