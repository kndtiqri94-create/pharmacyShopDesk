import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel, testProduct } from '../../../testing/pos-test.util';
import {
  ProductSyncBatchResponse,
  ProductSyncFailure,
  ProductSyncProgress,
  ProductSyncServerRecord,
} from '../models/domain/product-sync.model';
import { Product } from '../models/domain/product.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { getStockOnHand } from '../utils/stock-status.util';
import { InMemoryProductSyncServer } from './data/in-memory/in-memory-product-sync-server';
import { ProductDataService } from './data/product-data.service';
import { ProductSyncServer } from './data/product-sync-server';
import { ProductSyncStateStore } from './data/product-sync-state.store';
import { SyncDataService } from './data/sync-data.service';
import {
  PosProductSyncService,
  ProductSyncResult,
  SYNC_BAD_KEYS_MESSAGE,
  SYNC_EMPTY_MESSAGE,
  SYNC_TOO_MANY_MESSAGE,
} from './pos-product-sync.service';

const PARACETAMOL = '4791000000011';

function expectFailure(result: ProductSyncResult) {
  if (result.ok) throw new Error('Expected the sync to fail.');
  return result;
}

function expectSyncFailure(result: ProductSyncResult): ProductSyncFailure {
  if (result.ok || !('succeededBatches' in result)) throw new Error('Expected a sync failure.');
  return result;
}

function expectSuccess(result: ProductSyncResult) {
  if (!result.ok) throw new Error(`Expected the sync to succeed: ${result.message}`);
  return result;
}

describe('PosProductSyncService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosProductSyncService);
  const server = () => TestBed.inject(ProductSyncServer) as InMemoryProductSyncServer;
  const data = () => TestBed.inject(ProductDataService);
  const allProducts = () => firstValueFrom(data().getAll());
  const byId = async (id: string) => (await firstValueFrom(data().getById(id)))!;

  async function addProducts(count: number): Promise<void> {
    for (let index = 0; index < count; index++) {
      const key = `T-${String(index).padStart(5, '0')}`;
      await firstValueFrom(
        data().save(testProduct({ id: '', sku: key, barcode: key, batches: [], stockOnHand: 5 }))
      );
    }
  }

  async function sell(productId: string, quantity: number): Promise<void> {
    const product = await byId(productId);
    const batches = product.batches.map((batch, index) =>
      index === 0 ? { ...batch, quantity: batch.quantity - quantity } : batch
    );
    await firstValueFrom(data().saveAll([{ ...product, batches }]));
  }

  describe('summary and batching', () => {
    it('reports total, batch count and status for every batch (AC-1)', async () => {
      await signInAs(UserRole.CASHIER);
      const result = expectSuccess(await service().sync());
      expect(result.totalProducts).toBe(10);
      expect(result.batchCount).toBe(1);
      expect(result.batches).toEqual([{ batchNumber: 1, productCount: 10, status: 'completed' }]);
      expect(result.message).toBe('Synced 10 products in 1 batch.');
    });

    it('uses one batch for 389 products (AC-2)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(379);
      const result = expectSuccess(await service().sync());
      expect(result.totalProducts).toBe(389);
      expect(result.batches.map(batch => batch.productCount)).toEqual([389]);
    });

    it('uses one batch for exactly 500 products (AC-4)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(490);
      expect(expectSuccess(await service().sync()).batchCount).toBe(1);
    });

    it('splits 501 products into two batches (AC-4)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(491);
      const result = expectSuccess(await service().sync());
      expect(result.totalProducts).toBe(501);
      expect(result.batches.map(batch => batch.productCount)).toEqual([500, 1]);
    });

    it('splits 1200 products into 500, 500 and 200 (AC-3)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(1190);
      const result = expectSuccess(await service().sync());
      expect(result.batches.map(batch => batch.productCount)).toEqual([500, 500, 200]);
      expect(result.batches.every(batch => batch.status === 'completed')).toBeTrue();
    });

    it('reports progress after each batch in order (AC-5)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(1190);
      const seen: ProductSyncProgress[] = [];
      await service().sync(progress => seen.push(progress));
      expect(seen.map(item => `${item.completedBatches}/${item.totalBatches}`)).toEqual([
        '1/3',
        '2/3',
        '3/3',
      ]);
      expect(seen.map(item => item.batch.batchNumber)).toEqual([1, 2, 3]);
      expect(seen.every(item => item.batch.status === 'completed')).toBeTrue();
    });
  });

  describe('merge rules', () => {
    it('lets the server win on every detail except stock (AC-6)', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      const amoxicillin = await byId('prod-002');
      expect(amoxicillin.name).toBe('Amoxicillin 500mg Capsule');
      expect(amoxicillin.category).toBe('Antibiotics');
      expect(amoxicillin.priceCents).toBe(1900);
      expect(amoxicillin.costCents).toBe(1300);
      expect((await byId('prod-003')).active).toBeFalse();
    });

    it('brings the server stock into the app (AC-6)', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      expect(getStockOnHand(await byId('prod-003'))).toBe(55);
    });

    it('sends a sale made since the last sync and ends on the server stock (AC-7)', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      await sell('prod-001', 10);
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3590);
      expect(getStockOnHand(await byId('prod-001'))).toBe(3590);
    });

    it('keeps a sale made while a batch is in flight (AC-7)', async () => {
      await signInAs(UserRole.CASHIER);
      const original = server().syncBatch.bind(server());
      spyOn(server(), 'syncBatch').and.callFake(request => {
        data()
          .getById('prod-001')
          .subscribe(product => {
            const batches = product!.batches.map((batch, index) =>
              index === 0 ? { ...batch, quantity: batch.quantity - 5 } : batch
            );
            data()
              .saveAll([{ ...product!, batches }])
              .subscribe();
          });
        return original(request);
      });
      expectSuccess(await service().sync());
      expect(getStockOnHand(await byId('prod-001'))).toBe(3595);
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3595);
    });

    it('sends app-only products and adds server-only products (AC-8)', async () => {
      await signInAs(UserRole.CASHIER);
      expect(server().getRecord('4791000000103')).toBeNull();
      expectSuccess(await service().sync());
      expect(server().getRecord('4791000000103')!.name).toBe('Digital Thermometer');
      const products = await allProducts();
      const added = products.find(product => product.barcode === '4791000009001');
      expect(added?.name).toBe('Sample Cough Syrup 100ml');
      expect(added?.id).toMatch(/^prod-\d+$/);
      expect(products).toHaveSize(12);
    });

    it('matches on the sku when the barcode is blank', async () => {
      await signInAs(UserRole.CASHIER);
      await firstValueFrom(
        data().save(testProduct({ id: '', sku: 'SKU-ONLY', barcode: '', batches: [] }))
      );
      expectSuccess(await service().sync());
      expect(server().getRecord('SKU-ONLY')).not.toBeNull();
    });
  });

  describe('failures', () => {
    it('stops at the failed batch and names succeeded and failed batches (AC-9)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(1190);
      server().simulateFailingBatch(2);
      const result = expectSyncFailure(await service().sync());
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('batch-failed');
      expect(result.succeededBatches).toEqual([1]);
      expect(result.failedBatch).toBe(2);
      expect(result.batches.map(batch => batch.status)).toEqual(['completed', 'failed', 'not-run']);
      expect(result.message).toContain('Synced batches: 1');
      expect(result.message).toContain('Failed batch: 2');
      expect((await byId('prod-002')).name).toBe('Amoxicillin 500mg Capsule');
      expect(await allProducts()).toHaveSize(1200);
    });

    it('changes nothing and says so when the server is unreachable (AC-10)', async () => {
      await signInAs(UserRole.CASHIER);
      const before = await allProducts();
      server().simulateUnreachable(true);
      const result = expectSyncFailure(await service().sync());
      expect(result.reason).toBe('unreachable');
      expect(result.message).toContain('could not be reached');
      expect(result.succeededBatches).toEqual([]);
      expect(await allProducts()).toEqual(before);
    });

    it('reports an unreachable server part-way through (AC-10)', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(590);
      const original = server().syncBatch.bind(server());
      spyOn(server(), 'syncBatch').and.callFake(request => {
        if (request.batchNumber === 2) server().simulateUnreachable(true);
        return original(request);
      });
      const result = expectSyncFailure(await service().sync());
      expect(result.reason).toBe('unreachable');
      expect(result.succeededBatches).toEqual([1]);
      expect(result.failedBatch).toBe(2);
    });

    it('returns a clear message and runs no batch for an empty list (AC-11)', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [...TEST_PROVIDERS, { provide: ProductDataService, useValue: stubProducts([]) }],
      });
      await signInAs(UserRole.CASHIER);
      const syncBatch = spyOn(server(), 'syncBatch').and.callThrough();
      const result = expectSyncFailure(await service().sync());
      expect(result.reason).toBe('empty');
      expect(result.message).toBe(SYNC_EMPTY_MESSAGE);
      expect(result.batchCount).toBe(0);
      expect(syncBatch).not.toHaveBeenCalled();
    });

    it('refuses an absurdly large list without calling the server', async () => {
      TestBed.resetTestingModule();
      const huge = Array.from({ length: 50_001 }, (_, index) =>
        testProduct({ id: `p-${index}`, barcode: `K${index}`, sku: `S${index}` })
      );
      TestBed.configureTestingModule({
        providers: [
          ...TEST_PROVIDERS,
          { provide: ProductDataService, useValue: stubProducts(huge) },
        ],
      });
      await signInAs(UserRole.CASHIER);
      const syncBatch = spyOn(server(), 'syncBatch').and.callThrough();
      const result = expectFailure(await service().sync());
      expect(result.message).toBe(SYNC_TOO_MANY_MESSAGE);
      expect(syncBatch).not.toHaveBeenCalled();
    });

    it('refuses products with a repeated barcode without calling the server', async () => {
      await signInAs(UserRole.CASHIER);
      await firstValueFrom(
        data().save(testProduct({ id: '', sku: 'DUP-1', barcode: PARACETAMOL, batches: [] }))
      );
      const syncBatch = spyOn(server(), 'syncBatch').and.callThrough();
      const result = expectFailure(await service().sync());
      expect(result.message).toBe(SYNC_BAD_KEYS_MESSAGE);
      expect(syncBatch).not.toHaveBeenCalled();
    });

    it('refuses products with no barcode and no sku', async () => {
      await signInAs(UserRole.CASHIER);
      await firstValueFrom(
        data().save(testProduct({ id: '', sku: '', barcode: '  ', batches: [] }))
      );
      expect(expectFailure(await service().sync()).message).toBe(SYNC_BAD_KEYS_MESSAGE);
    });

    const malformedReplies: [string, (keys: string[]) => ProductSyncBatchResponse][] = [
      ['a count mismatch', () => ({ batchNumber: 1, records: [], serverOnlyRecords: [] })],
      ['the wrong batch number', keys => reply(keys, {}, 9)],
      ['a negative price', keys => reply(keys, { priceCents: -5 })],
      ['a price that is not a number', keys => reply(keys, { priceCents: Number.NaN })],
      ['a fractional stock figure', keys => reply(keys, { stockOnHand: 2.5 })],
      ['an oversized text value', keys => reply(keys, { name: 'x'.repeat(5000) })],
      [
        'a missing server-only list',
        keys => ({ ...reply(keys), serverOnlyRecords: undefined as never }),
      ],
    ];

    for (const [label, build] of malformedReplies) {
      it('fails the batch and applies nothing for ' + label, async () => {
        await signInAs(UserRole.CASHIER);
        const before = await allProducts();
        const keys = before.map(product => product.barcode);
        spyOn(server(), 'syncBatch').and.returnValue(of(build(keys)));
        const result = expectSyncFailure(await service().sync());
        expect(result.reason).toBe('batch-failed');
        expect(result.succeededBatches).toEqual([]);
        expect(await allProducts()).toEqual(before);
      });
    }

    it('does not echo server internals or product data in the message', async () => {
      await signInAs(UserRole.CASHIER);
      spyOn(server(), 'syncBatch').and.returnValue(
        throwError(() => new Error('db password=secret cost 180'))
      );
      const result = expectFailure(await service().sync());
      expect(result.message).not.toContain('secret');
      expect(result.message).not.toContain('Paracetamol');
      expect(result.message).not.toMatch(/\d{3,}/);
    });

    it('applies nothing when a server-only product would clash with an existing code', async () => {
      await signInAs(UserRole.CASHIER);
      await firstValueFrom(
        data().save(testProduct({ id: '', sku: '4791000009001', barcode: 'Z-1', batches: [] }))
      );
      const result = expectFailure(await service().sync());
      expect(result.reason).toBe('batch-failed');
      expect((await byId('prod-002')).name).toBe('Amoxicillin 500mg');
    });
  });

  describe('re-running safely (AC-13)', () => {
    it('never applies a sale twice after a failure that happened after the server applied it', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      await sell('prod-001', 10);
      server().simulateFailureAfterApply(1);
      expect(expectFailure(await service().sync()).reason).toBe('batch-failed');
      server().simulateFailureAfterApply(null);
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3590);
      expect(getStockOnHand(await byId('prod-001'))).toBe(3590);
    });

    it('never applies a sale twice after a failure before the server applied it', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      await sell('prod-001', 10);
      server().simulateFailingBatch(1);
      expectFailure(await service().sync());
      server().simulateFailingBatch(null);
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3590);
    });

    it('applies nothing new when run again after a full success', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      await sell('prod-001', 10);
      expectSuccess(await service().sync());
      expectSuccess(await service().sync());
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3590);
      expect(getStockOnHand(await byId('prod-001'))).toBe(3590);
    });

    it('resumes after a mid-run failure and applies each batch once', async () => {
      await signInAs(UserRole.CASHIER);
      await addProducts(590);
      expectSuccess(await service().sync());
      await sell('prod-001', 10);
      server().simulateFailingBatch(2);
      expectFailure(await service().sync());
      server().simulateFailingBatch(null);
      expectSuccess(await service().sync());
      expect(server().getRecord(PARACETAMOL)!.stockOnHand).toBe(3590);
    });
  });

  describe('access (AC-12)', () => {
    for (const role of [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.PHARMACIST]) {
      it(`allows ${role}`, async () => {
        await signInAs(role);
        expect((await service().sync()).ok).toBeTrue();
      });
    }

    it('refuses a user who can only view the till and changes nothing', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      await expectNothingHappens();
    });

    it('refuses a user with no access to the till and changes nothing', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      await expectNothingHappens();
    });

    it('refuses a caller who is not signed in and changes nothing', async () => {
      await expectNothingHappens();
    });

    async function expectNothingHappens(): Promise<void> {
      const before = await allProducts();
      const recordsBefore = server().recordCount();
      const syncBatch = spyOn(server(), 'syncBatch').and.callThrough();
      const result = await service().sync();
      expect(result.ok).toBeFalse();
      expect(!result.ok && result.reason).toBe('denied');
      expect(syncBatch).not.toHaveBeenCalled();
      expect(await allProducts()).toEqual(before);
      expect(server().recordCount()).toBe(recordsBefore);
    }
  });

  describe('single run at a time', () => {
    it('refuses a second sync while one is running', async () => {
      await signInAs(UserRole.CASHIER);
      const first = service().sync();
      const second = await service().sync();
      expect(!second.ok && second.reason).toBe('busy');
      expectSuccess(await first);
      expectSuccess(await service().sync());
    });
  });

  describe('no leftovers (AC-14)', () => {
    it('keeps no history, storage or console output', async () => {
      await signInAs(UserRole.CASHIER);
      const keysBefore = [...Object.keys(localStorage), ...Object.keys(sessionStorage)].sort();
      const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
        spyOn(console, method)
      );
      expectSuccess(await service().sync());
      server().simulateUnreachable(true);
      expectFailure(await service().sync());
      const keysAfter = [...Object.keys(localStorage), ...Object.keys(sessionStorage)].sort();
      expect(keysAfter).toEqual(keysBefore);
      for (const consoleSpy of consoleSpies) expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('holds only the stock baseline and sequence per product', async () => {
      await signInAs(UserRole.CASHIER);
      expectSuccess(await service().sync());
      expect(TestBed.inject(ProductSyncStateStore).get(PARACETAMOL)).toEqual({
        lastSyncedStock: 3600,
        opSeq: 1,
      });
    });
  });

  function reply(
    keys: string[],
    overrides: Partial<ProductSyncServerRecord> = {},
    batchNumber = 1
  ): ProductSyncBatchResponse {
    const records = keys.map(matchKey => ({
      matchKey,
      name: 'Name',
      category: 'Cat',
      unit: 'tablet',
      priceCents: 100,
      costCents: 50,
      stockOnHand: 10,
      active: true,
      ...overrides,
    }));
    return { batchNumber, records, serverOnlyRecords: [] };
  }

  describe('exchange with the central record (S-3.4.2, OQ48)', () => {
    it('sends waiting changes and collects server changes before the first batch, and again after the last', async () => {
      await signInAs(UserRole.CASHIER);
      const order: string[] = [];
      spyOn(TestBed.inject(SyncDataService), 'exchangeBeforeProductUpdate').and.callFake(() => {
        order.push('exchange');
        return of(true);
      });
      const original = server().syncBatch.bind(server());
      spyOn(server(), 'syncBatch').and.callFake(request => {
        order.push('batch');
        return original(request);
      });
      expectSuccess(await service().sync());
      expect(order).toEqual(['exchange', 'batch', 'exchange']);
    });

    it('does not start when the exchange could not finish and says nothing was changed', async () => {
      await signInAs(UserRole.CASHIER);
      spyOn(TestBed.inject(SyncDataService), 'exchangeBeforeProductUpdate').and.returnValue(
        of(false)
      );
      const batch = spyOn(server(), 'syncBatch');
      const failure = expectSyncFailure(await service().sync());
      expect(failure.reason).toBe('unreachable');
      expect(failure.message).toContain('Nothing was changed');
      expect(batch).not.toHaveBeenCalled();
    });

    it('sends no stock difference when device stock already travels as movements', async () => {
      await signInAs(UserRole.CASHIER);
      const sync = TestBed.inject(SyncDataService) as { stockTravelsAsMovements: boolean };
      Object.defineProperty(sync, 'stockTravelsAsMovements', { value: true });
      await sell('prod-002', 2);
      const batch = spyOn(server(), 'syncBatch').and.callThrough();
      expectSuccess(await service().sync());
      expectSuccess(await service().sync());
      const deltas = batch.calls
        .allArgs()
        .flatMap(([request]) => request.records.map(record => record.stockDelta));
      expect(deltas.every(delta => delta === 0)).toBeTrue();
    });
  });

  function stubProducts(products: Product[]) {
    return {
      getAll: () => of(products),
      getById: () => of(null),
      save: () => throwError(() => new Error('not used')),
      saveAll: () => throwError(() => new Error('not used')),
    };
  }
});
