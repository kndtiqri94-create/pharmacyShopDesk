import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { getStockOnHand } from '../utils/stock-status.util';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PosProductUpdateService } from './pos-product-update.service';

describe('PosProductUpdateService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosProductUpdateService);
  const product = async () =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!;
  const adjustments = () =>
    firstValueFrom(TestBed.inject(SalesDataService).getProductAdjustments());

  it('finds a product by name, SKU or barcode', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().search('paracetamol')).map(item => item.id)).toContain('prod-001');
    expect((await service().search('PAR-500')).map(item => item.id)).toEqual(['prod-001']);
    expect((await service().search('4791000000011')).map(item => item.id)).toEqual(['prod-001']);
    expect(await service().search('   ')).toEqual([]);
  });

  it('changes the price and stock after confirmation and records old and new values', async () => {
    await signInAs(UserRole.CASHIER);
    const result = await service().save('prod-001', '275.50', '3000', true);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.adjustment.oldPriceCents).toBe(250);
    expect(result.adjustment.newPriceCents).toBe(27_550);
    expect(result.adjustment.oldStock).toBe(3600);
    expect(result.adjustment.newStock).toBe(3000);
    expect(result.adjustment.by).toBe('Ruwani Jayawardena');
    const stored = await product();
    expect(stored.priceCents).toBe(27_550);
    expect(getStockOnHand(stored)).toBe(3000);
    expect(await adjustments()).toHaveSize(1);
  });

  it('does nothing without confirmation or when nothing changed', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().save('prod-001', '300', '3600', false)).ok).toBeFalse();
    expect((await service().save('prod-001', '2.50', '3600', true)).ok).toBeFalse();
    expect((await product()).priceCents).toBe(250);
    expect(await adjustments()).toEqual([]);
  });

  it('refuses a bad price or stock figure and changes nothing', async () => {
    await signInAs(UserRole.CASHIER);
    const bad: [string, string][] = [
      ['-1', '10'],
      ['abc', '10'],
      ['', '10'],
      ['10', '-1'],
      ['10', '2.5'],
      ['10', 'abc'],
      ['10', ''],
      ['NaN', 'NaN'],
    ];
    for (const [price, stock] of bad) {
      const result = await service().save('prod-001', price, stock, true);
      expect(result.ok).withContext(`${price}/${stock}`).toBeFalse();
    }
    expect((await product()).priceCents).toBe(250);
    expect(getStockOnHand(await product())).toBe(3600);
    expect(await adjustments()).toEqual([]);
  });

  it('refuses an unknown product', async () => {
    await signInAs(UserRole.CASHIER);
    const result = await service().save('prod-999', '10', '10', true);
    expect(!result.ok && result.reason).toBe('not-found');
  });

  it('refuses a user who can only view the till', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    const result = await service().save('prod-001', '300', '10', true);
    expect(!result.ok && result.reason).toBe('denied');
    expect((await product()).priceCents).toBe(250);
  });
});
