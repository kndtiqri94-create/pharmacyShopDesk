import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
} from '../../../../../../testing/local-data-test.util';
import { testSale } from '../../../../../../testing/pos-test.util';
import { Product } from '../../../../models/domain/product.model';
import { Supplier } from '../../../../models/domain/supplier.model';
import { StockMovementType } from '../../../../models/enums/stock-movement-type.enum';
import { ProductDataService } from '../../product-data.service';
import { SalesDataService } from '../../sales-data.service';
import { SupplierDataService } from '../../supplier-data.service';
import { UserDataService } from '../../user-data.service';
import { LocalCollection } from '../local-collection';
import {
  LOCAL_SCHEMA_VERSIONS,
  LocalDatabase,
  OutboxScopeError,
  suppressOutbox,
} from '../local-database';
import { LocalDatabaseProvider } from '../local-database.provider';
import { OUTBOX_ENTITIES, UNSYNCED_TABLES } from './outbox-entities.const';
import { OutboxService } from './outbox.service';

const SUPPLIER: Supplier = {
  id: 'sup-test',
  name: 'Test Supplies',
  contactPerson: 'Kamal',
  phone: '0771234567',
  email: 'test@example.com',
  sinceYear: 2020,
  creditDays: 14,
  deliveryDays: 'Mon',
  active: true,
};

function withBatchQuantity(product: Product, quantity: number): Product {
  const batches = product.batches.map((batch, index) =>
    index === 0 ? { ...batch, quantity } : batch
  );
  return {
    ...product,
    batches,
    stockOnHand: batches.reduce((sum, batch) => sum + batch.quantity, 0),
  };
}

describe('outbox', () => {
  let environment: LocalTestEnvironment;

  const provider = () => TestBed.inject(LocalDatabaseProvider);
  const rows = () => provider().run(db => db.outbox.orderBy('seq').toArray());
  const suppliers = () => TestBed.inject(SupplierDataService);

  function startApp(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: environment.providers() });
  }

  beforeEach(() => {
    environment = createLocalTestEnvironment('shopdesk-outbox', { realBrowserStore: true });
    startApp();
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await environment.cleanup();
  });

  it('starts with an empty outbox: the starting data is never queued', async () => {
    await provider().ready();
    expect(await rows()).toEqual([]);
    expect((await provider().ready()).verno).toBe(2);
  });

  it('saves a change and its waiting entry together (AC-1)', async () => {
    await firstValueFrom(suppliers().save(SUPPLIER));
    const queued = await rows();
    expect(queued).toHaveSize(1);
    expect(queued[0]).toEqual(
      jasmine.objectContaining({
        entity: 'suppliers',
        id: 'sup-test',
        op: 'put',
        status: 'pending',
      })
    );
    expect(queued[0].changeId.length).toBeGreaterThan(8);
    expect((queued[0].data as Supplier).name).toBe('Test Supplies');
    expect(await firstValueFrom(suppliers().getById('sup-test'))).not.toBeNull();
  });

  it('never leaves a saved change without its entry, or an entry without its change (AC-1)', async () => {
    const db = await provider().ready();
    await expectAsync(
      db.transaction('rw', db.suppliers, db.outbox, async () => {
        await new LocalCollection<Supplier>(db.suppliers).upsert({
          ...SUPPLIER,
          id: 'sup-rollback',
        });
        throw new Error('write failed after the outbox row');
      })
    ).toBeRejected();
    expect(await db.suppliers.get('sup-rollback')).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it('refuses a local write that is outside a transaction holding the outbox', async () => {
    const db = await provider().ready();
    await expectAsync(
      db.transaction('rw', db.suppliers, () =>
        new LocalCollection<Supplier>(db.suppliers).upsert(SUPPLIER)
      )
    ).toBeRejectedWithError(OutboxScopeError);
    expect(await db.suppliers.get('sup-test')).toBeUndefined();
  });

  it('keeps changes in the order they were made, with a stable id per change (AC-3)', async () => {
    for (const name of ['One', 'Two', 'Three']) {
      await firstValueFrom(suppliers().save({ ...SUPPLIER, id: `sup-${name}`, name }));
    }
    const queued = await rows();
    expect(queued.map(row => row.id)).toEqual(['sup-One', 'sup-Two', 'sup-Three']);
    expect(new Set(queued.map(row => row.changeId)).size).toBe(3);
  });

  it('keeps waiting changes after the page is reloaded or the app restarts (AC-2)', async () => {
    await firstValueFrom(suppliers().save(SUPPLIER));
    const before = await rows();
    startApp();
    expect(await rows()).toEqual(before);
    expect((await TestBed.inject(OutboxService).counts()).pending).toBe(1);
  });

  it('queues a removal as a delete entry without data', async () => {
    const sales = TestBed.inject(SalesDataService);
    await firstValueFrom(sales.saveHeldBill({ id: 'hold-1' } as never));
    await firstValueFrom(sales.removeHeldBill('hold-1'));
    const queued = await rows();
    expect(queued.map(row => row.op)).toEqual(['put', 'delete']);
    expect(queued[1].data).toBeNull();
  });

  it('queues a sale and each stock movement as separate ordered entries (D1)', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    await firstValueFrom(
      products.saveAll([withBatchQuantity(product, product.batches[0].quantity - 2)], {
        type: StockMovementType.SALE,
        refId: 'sale-x',
      })
    );
    await firstValueFrom(TestBed.inject(SalesDataService).saveSale(testSale({ id: 'sale-x' })));
    const queued = await rows();
    const entities = queued.map(row => row.entity);
    expect(entities.filter(entity => entity === 'stockMovements')).toHaveSize(1);
    expect(entities.filter(entity => entity === 'sales')).toHaveSize(1);
    expect(entities.indexOf('stockMovements')).toBeLessThan(entities.indexOf('sales'));
    const entry = queued[entities.indexOf('stockMovements')];
    const movement = entry.data as { qtyDelta: number; id: string };
    expect(movement.qtyDelta).toBe(-2);
    expect(entry.id).toBe(movement.id);
  });

  it('does not queue a product save that changes nothing', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-002')))!;
    await firstValueFrom(products.save(product));
    expect(await rows()).toEqual([]);
    await firstValueFrom(products.save({ ...product, priceCents: product.priceCents + 5 }));
    expect((await rows()).map(row => row.entity)).toEqual(['products']);
  });

  it('stores the base row for a product, never the shown stock or private keys', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    const sold = withBatchQuantity(product, product.batches[0].quantity - 1);
    await firstValueFrom(products.saveAll([sold], { type: StockMovementType.SALE }));
    await firstValueFrom(products.save({ ...sold, name: 'Renamed' }));
    const productRow = (await rows()).filter(row => row.entity === 'products').at(-1)!;
    const data = productRow.data as Record<string, unknown>;
    const stored = (await provider().run(db => db.products.get('prod-001')))!;
    expect(data['_ord']).toBeUndefined();
    expect(data['skuKey']).toBeUndefined();
    expect(data['name']).toBe('Renamed');
    expect(data['batches']).toEqual(stored.batches);
    expect(data['batches']).not.toEqual(sold.batches);
  });

  it('never enqueues a password, hash or token', async () => {
    const db = await provider().ready();
    await db.transaction('rw', db.outbox, async () => {
      await db.enqueue('users', 'usr-x', 'put', {
        id: 'usr-x',
        password: 'secret',
        passwordHash: 'hash',
        token: 'tok',
        name: 'Kept',
      });
    });
    const data = (await rows())[0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['id', 'name']);
    const users = await firstValueFrom(TestBed.inject(UserDataService).getAll());
    expect(users.every(user => !('password' in user))).toBeTrue();
  });

  it('does not queue changes made while applying data from the central record', async () => {
    const db = await provider().ready();
    await db.transaction('rw', db.suppliers, db.outbox, async () => {
      suppressOutbox();
      await new LocalCollection<Supplier>(db.suppliers).upsert({ ...SUPPLIER, id: 'sup-remote' });
    });
    expect(await db.suppliers.get('sup-remote')).toBeDefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it('classifies every table: synced entities have an outbox row, the rest are bookkeeping', async () => {
    const db = await provider().ready();
    const names = db.tables.map(table => table.name);
    for (const name of names) {
      const known = OUTBOX_ENTITIES.includes(name) || UNSYNCED_TABLES.includes(name);
      expect(known).withContext(`table ${name} is not classified for sync`).toBeTrue();
    }
    for (const entity of OUTBOX_ENTITIES) expect(names).toContain(entity);
  });

  it('writes an outbox entry for every local write path (guard test, D1)', async () => {
    const db = await provider().ready();
    const sales = TestBed.inject(SalesDataService);
    await firstValueFrom(suppliers().save(SUPPLIER));
    await firstValueFrom(sales.saveSale(testSale({ id: 'sale-guard' })));
    await firstValueFrom(sales.saveHeldBill({ id: 'hold-guard' } as never));
    await firstValueFrom(sales.removeHeldBill('hold-guard'));
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    const received = withBatchQuantity(product, product.batches[0].quantity + 3);
    await firstValueFrom(products.save({ ...received, name: 'Guarded' }));
    expect(db.outboxViolations).toEqual([]);
    const entities = new Set((await rows()).map(row => row.entity));
    expect(entities).toEqual(
      new Set(['suppliers', 'sales', 'heldBills', 'products', 'stockMovements'])
    );
  });

  it('keeps every earlier row when an older install upgrades, queueing nothing for it', async () => {
    const legacyName = `${environment.databaseName}-legacy`;
    const legacy = new LocalDatabase(legacyName, environment.databaseOptions, [
      LOCAL_SCHEMA_VERSIONS[0],
    ]);
    await legacy.open();
    await legacy.suppliers.put({ ...SUPPLIER, _ord: 1 });
    legacy.close();
    const upgraded = new LocalDatabase(legacyName, environment.databaseOptions);
    await upgraded.open();
    expect((await upgraded.suppliers.get('sup-test'))?.name).toBe('Test Supplies');
    expect(await upgraded.outbox.count()).toBe(0);
    expect(upgraded.verno).toBe(2);
    upgraded.close();
    await indexedDB.deleteDatabase(legacyName);
  });
});
