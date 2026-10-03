import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DuplicateSkuError } from '../duplicate-sku.error';
import { ProductStatus } from '../../../models/enums/product-status.enum';
import { getProductStatus, getStockOnHand } from '../../../utils/stock-status.util';
import { SAMPLE_TODAY } from '../../clock.service';
import { ProductDataService } from '../product-data.service';
import { provideDataServices } from '../data-providers';

describe('InMemoryProductDataService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(ProductDataService);

  it('contains a product in every stock status', async () => {
    const products = await firstValueFrom(service().getAll());
    const statuses = new Set(products.map(product => getProductStatus(product, 60, SAMPLE_TODAY)));
    expect(statuses).toEqual(
      new Set([
        ProductStatus.IN_STOCK,
        ProductStatus.LOW_STOCK,
        ProductStatus.EXPIRING_SOON,
        ProductStatus.OUT_OF_STOCK,
      ])
    );
  });

  it('lists batches earliest-expiring first', async () => {
    const products = await firstValueFrom(service().getAll());
    for (const product of products) {
      const dates = product.batches.map(batch => batch.expiryDate);
      expect(dates).toEqual([...dates].sort());
    }
    const paracetamol = await firstValueFrom(service().getById('prod-001'));
    expect(paracetamol?.batches[0].batchNo).toBe('B2405');
  });

  it('holds a single stock figure and no batches when batch tracking is off', async () => {
    const products = await firstValueFrom(service().getAll());
    const untracked = products.filter(product => !product.trackBatches);
    expect(untracked.length).toBeGreaterThan(0);
    expect(untracked.every(product => product.batches.length === 0)).toBeTrue();
  });

  it('keeps saved changes for the session and resets in a new session', async () => {
    const product = (await firstValueFrom(service().getById('prod-003')))!;
    await firstValueFrom(service().save({ ...product, name: 'Cetirizine 10mg (edited)' }));
    expect((await firstValueFrom(service().getById('prod-003')))?.name).toContain('edited');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect((await firstValueFrom(service().getById('prod-003')))?.name).toBe('Cetirizine 10mg');
  });

  it('returns copies that cannot change the stored data', async () => {
    const product = (await firstValueFrom(service().getById('prod-001')))!;
    product.batches[0].quantity = 0;
    const again = (await firstValueFrom(service().getById('prod-001')))!;
    expect(again.batches[0].quantity).not.toBe(0);
  });

  it('returns null for an unknown product', async () => {
    expect(await firstValueFrom(service().getById('missing'))).toBeNull();
  });

  it('adds a new product with a new id and keeps it for the session', async () => {
    const template = (await firstValueFrom(service().getById('prod-010')))!;
    const saved = await firstValueFrom(
      service().save({ ...template, id: '', sku: 'NEW-001', name: 'Digital Scale' })
    );
    expect(saved.id).toBe('prod-011');
    expect((await firstValueFrom(service().getAll())).length).toBe(11);
  });

  it('keeps a new batch-tracked product without batches and uses its recorded stock', async () => {
    const template = (await firstValueFrom(service().getById('prod-001')))!;
    const saved = await firstValueFrom(
      service().save({ ...template, id: '', sku: 'NEW-002', stockOnHand: 30, batches: [] })
    );
    expect(saved.batches).toEqual([]);
    expect(getStockOnHand(saved)).toBe(30);
  });

  it('rejects a SKU that belongs to another product, ignoring case', async () => {
    const template = (await firstValueFrom(service().getById('prod-010')))!;
    await expectAsync(
      firstValueFrom(service().save({ ...template, id: '', sku: 'par-500' }))
    ).toBeRejectedWithError(DuplicateSkuError);
    expect((await firstValueFrom(service().getAll())).length).toBe(10);
  });

  it('lets a product keep its own SKU when it is edited', async () => {
    const product = (await firstValueFrom(service().getById('prod-001')))!;
    const saved = await firstValueFrom(service().save({ ...product, name: 'Paracetamol 500mg x' }));
    expect(saved.sku).toBe('PAR-500');
  });

  it('keeps an inactive product in the list', async () => {
    const product = (await firstValueFrom(service().getById('prod-001')))!;
    await firstValueFrom(service().save({ ...product, active: false }));
    const all = await firstValueFrom(service().getAll());
    expect(all.find(candidate => candidate.id === 'prod-001')?.active).toBeFalse();
    expect(all).toHaveSize(10);
  });
});
