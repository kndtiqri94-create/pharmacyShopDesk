import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describeProductDataContract } from '../contract/product-data.contract';
import { provideDataServices } from '../data-providers';
import { ProductDataService } from '../product-data.service';

describeProductDataContract('InMemoryProductDataService', () => [provideDataServices(true)]);

describe('InMemoryProductDataService (in-memory only)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(ProductDataService);

  it('keeps saved changes for the session and resets in a new session', async () => {
    const product = (await firstValueFrom(service().getById('prod-003')))!;
    await firstValueFrom(service().save({ ...product, name: 'Cetirizine 10mg (edited)' }));
    expect((await firstValueFrom(service().getById('prod-003')))?.name).toContain('edited');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect((await firstValueFrom(service().getById('prod-003')))?.name).toBe('Cetirizine 10mg');
  });

  it('numbers a new product after the highest sample product', async () => {
    const template = (await firstValueFrom(service().getById('prod-010')))!;
    const saved = await firstValueFrom(
      service().save({ ...template, id: '', sku: 'NEW-001', name: 'Digital Scale' })
    );
    expect(saved.id).toBe('prod-011');
  });
});
