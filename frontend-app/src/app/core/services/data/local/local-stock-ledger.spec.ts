import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
} from '../../../../../testing/local-data-test.util';
import { Product } from '../../../models/domain/product.model';
import { StockMovement } from '../../../models/domain/stock-movement.model';
import { StockMovementType } from '../../../models/enums/stock-movement-type.enum';
import { ProductDataService } from '../product-data.service';
import { LocalDatabaseProvider } from './local-database.provider';
import { LocalStockLedgerService } from './local-stock-ledger.service';

function withBatchQuantity(product: Product, batchId: string, quantity: number): Product {
  const batches = product.batches.map(batch =>
    batch.id === batchId ? { ...batch, quantity } : { ...batch }
  );
  const total = batches.reduce((sum, batch) => sum + batch.quantity, 0);
  return { ...product, batches, stockOnHand: total };
}

describe('local stock ledger', () => {
  let environment: LocalTestEnvironment;

  const products = () => TestBed.inject(ProductDataService);
  const ledger = () => TestBed.inject(LocalStockLedgerService);
  const provider = () => TestBed.inject(LocalDatabaseProvider);
  const movements = () => provider().run(db => ledger().list(db));
  const product = async (id: string) => (await firstValueFrom(products().getById(id)))!;

  beforeEach(() => {
    environment = createLocalTestEnvironment();
    TestBed.configureTestingModule({ providers: environment.providers() });
  });

  it('starts with the sample stock and no movements', async () => {
    expect(await movements()).toEqual([]);
    expect((await product('prod-001')).batches.map(batch => batch.quantity)).toEqual([1200, 2400]);
  });

  it('writes exactly one sale movement for a sale and shows stock as batch quantity plus history', async () => {
    const before = await product('prod-001');
    await firstValueFrom(
      products().saveAll([withBatchQuantity(before, 'bat-001', 1196)], {
        type: StockMovementType.SALE,
        refId: 'INV-0001',
        userId: 'usr-004',
      })
    );
    const written = await movements();
    expect(written).toHaveSize(1);
    expect(written[0]).toEqual(
      jasmine.objectContaining({
        productId: 'prod-001',
        batchId: 'bat-001',
        type: StockMovementType.SALE,
        qtyDelta: -4,
        refId: 'INV-0001',
        userId: 'usr-004',
      })
    );
    expect((await product('prod-001')).batches.map(batch => batch.quantity)).toEqual([1196, 2400]);
  });

  it('never stores a replacement total in a movement', async () => {
    const before = await product('prod-001');
    await firstValueFrom(
      products().saveAll([withBatchQuantity(before, 'bat-001', 1100)], {
        type: StockMovementType.SALE,
      })
    );
    const [written] = await movements();
    expect(written.qtyDelta).toBe(-100);
    expect(Object.keys(written)).not.toContain('quantity');
  });

  it('writes one movement for each kind of stock change', async () => {
    const start = await product('prod-001');
    const sold = withBatchQuantity(start, 'bat-001', 1195);
    await firstValueFrom(products().saveAll([sold], { type: StockMovementType.SALE }));
    const returned = withBatchQuantity(await product('prod-001'), 'bat-001', 1197);
    await firstValueFrom(products().saveAll([returned], { type: StockMovementType.RETURN }));
    const received = withBatchQuantity(await product('prod-001'), 'bat-002', 2500);
    await firstValueFrom(products().save(received, { type: StockMovementType.GRN }));
    const adjusted = withBatchQuantity(await product('prod-001'), 'bat-001', 1190);
    await firstValueFrom(products().saveAll([adjusted]));

    const written = await movements();
    expect(written.map(movement => [movement.type, movement.qtyDelta])).toEqual([
      [StockMovementType.SALE, -5],
      [StockMovementType.RETURN, 2],
      [StockMovementType.GRN, 100],
      [StockMovementType.ADJUSTMENT, -7],
    ]);
    expect(written.map(movement => movement.seq)).toEqual([1, 2, 3, 4]);
    expect(new Set(written.map(movement => movement.id)).size).toBe(4);
    expect((await product('prod-001')).batches.map(batch => batch.quantity)).toEqual([1190, 2500]);
  });

  it('writes a movement for every batch that changed in one change and none for the rest', async () => {
    const before = await product('prod-001');
    const both = {
      ...before,
      batches: before.batches.map(batch => ({ ...batch, quantity: batch.quantity - 3 })),
      stockOnHand: before.stockOnHand - 6,
    };
    await firstValueFrom(products().saveAll([both], { type: StockMovementType.SALE }));
    const written = await movements();
    expect(written.map(movement => movement.batchId).sort()).toEqual(['bat-001', 'bat-002']);
    expect(written.every(movement => movement.qtyDelta === -3)).toBeTrue();
  });

  it('counts a repeated save of the same figures once, so a retry never deducts twice', async () => {
    const before = await product('prod-001');
    const sold = withBatchQuantity(before, 'bat-001', 1196);
    await firstValueFrom(products().saveAll([sold], { type: StockMovementType.SALE }));
    await firstValueFrom(products().saveAll([sold], { type: StockMovementType.SALE }));
    expect(await movements()).toHaveSize(1);
    expect((await product('prod-001')).batches[0].quantity).toBe(1196);
  });

  it('writes a movement for the stock of a product that does not use batches', async () => {
    const plain = await product('prod-010');
    expect(plain.trackBatches).toBeFalse();
    await firstValueFrom(
      products().saveAll([{ ...plain, stockOnHand: plain.stockOnHand - 2 }], {
        type: StockMovementType.SALE,
      })
    );
    const [written] = await movements();
    expect(written.qtyDelta).toBe(-2);
    expect(written.batchId).toBe('');
    expect((await product('prod-010')).stockOnHand).toBe(plain.stockOnHand - 2);
  });

  it('writes no movement when only the name or price changes', async () => {
    const before = await product('prod-001');
    await firstValueFrom(products().save({ ...before, name: 'Renamed', priceCents: 999 }));
    expect(await movements()).toEqual([]);
  });

  it('writes a movement for the opening stock of a new product', async () => {
    const template = await product('prod-010');
    const saved = await firstValueFrom(
      products().save({ ...template, id: '', sku: 'NEW-STOCK', stockOnHand: 30 })
    );
    const written = await movements();
    expect(written).toHaveSize(1);
    expect(written[0]).toEqual(
      jasmine.objectContaining({ productId: saved.id, qtyDelta: 30, type: 'ADJUSTMENT' })
    );
    expect((await product(saved.id)).stockOnHand).toBe(30);
  });

  it('changes neither stock nor history when a save in the same group fails', async () => {
    const before = await product('prod-001');
    const sold = withBatchQuantity(before, 'bat-001', 1196);
    await expectAsync(
      firstValueFrom(
        products().saveAll([sold, { ...before, id: 'prod-999' }], { type: StockMovementType.SALE })
      )
    ).toBeRejected();
    expect(await movements()).toEqual([]);
    expect((await product('prod-001')).batches[0].quantity).toBe(1200);
  });

  it('gives the earliest-expiring batch first, as before', async () => {
    const batches = (await product('prod-001')).batches;
    expect(batches.map(batch => batch.expiryDate)).toEqual(
      [...batches.map(b => b.expiryDate)].sort()
    );
  });

  it('counts both sales when two devices each sold the same item', async () => {
    const providerA = provider();
    await providerA.setDeviceCode('AAA');
    const start = await product('prod-001');
    await firstValueFrom(
      products().saveAll([withBatchQuantity(start, 'bat-001', 1199)], {
        type: StockMovementType.SALE,
        refId: 'INV-AAA-0001',
      })
    );
    const fromDeviceA: StockMovement[] = await movements();

    TestBed.resetTestingModule();
    const other = createLocalTestEnvironment('shopdesk-other-device');
    TestBed.configureTestingModule({ providers: other.providers() });
    await provider().setDeviceCode('BBB');
    await firstValueFrom(
      products().saveAll([withBatchQuantity(await product('prod-001'), 'bat-001', 1197)], {
        type: StockMovementType.SALE,
        refId: 'INV-BBB-0001',
      })
    );

    await provider().run(db => ledger().importMovements(db, fromDeviceA));
    expect(
      (await product('prod-001')).batches.find(batch => batch.id === 'bat-001')?.quantity
    ).toBe(1200 - 1 - 3);

    await provider().run(db => ledger().importMovements(db, fromDeviceA));
    expect(
      (await product('prod-001')).batches.find(batch => batch.id === 'bat-001')?.quantity
    ).toBe(1200 - 1 - 3);
    const merged = await movements();
    expect(merged).toHaveSize(2);
    expect(new Set(merged.map(movement => movement.deviceCode))).toEqual(new Set(['AAA', 'BBB']));
  });
});
