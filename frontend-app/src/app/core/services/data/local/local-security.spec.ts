import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { freshLocalProviders } from '../../../../../testing/local-data-test.util';
import { testSale } from '../../../../../testing/pos-test.util';
import { AppUser } from '../../../models/domain/app-user.model';
import { StockMovementType } from '../../../models/enums/stock-movement-type.enum';
import { DuplicateSkuError } from '../duplicate-sku.error';
import { ProductDataService } from '../product-data.service';
import { SalesDataService } from '../sales-data.service';
import { SupplierDataService } from '../supplier-data.service';
import { UserDataService } from '../user-data.service';
import { LocalDatabaseProvider } from './local-database.provider';
import { LocalDbEvents } from './local-db-events.service';

const SECRET_FIELDS = ['password', 'passwordHash', 'hash', 'salt', 'token', 'secret'];

describe('local data security', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: freshLocalProviders() });
  });

  it('keeps no password on the device for the starting users', async () => {
    const db = await TestBed.inject(LocalDatabaseProvider).ready();
    const stored = await db.users.toArray();
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(SECRET_FIELDS.some(field => field in row)).toBeFalse();
    }
  });

  it('drops a password that is passed in with a user', async () => {
    const users = TestBed.inject(UserDataService);
    const first = (await firstValueFrom(users.getAll()))[0];
    const withSecrets = {
      ...first,
      password: 'plain-text',
      passwordHash: 'abc',
      token: 'tok',
    } as AppUser;
    const saved = await firstValueFrom(users.save(withSecrets));
    expect(SECRET_FIELDS.some(field => field in saved)).toBeFalse();
    const db = await TestBed.inject(LocalDatabaseProvider).ready();
    const row = await db.users.get(first.id);
    expect(SECRET_FIELDS.some(field => row !== undefined && field in row)).toBeFalse();
  });

  it('writes no business data to localStorage or sessionStorage', async () => {
    const localBefore = JSON.stringify({ ...localStorage });
    const sessionBefore = JSON.stringify({ ...sessionStorage });
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    await firstValueFrom(
      products.saveAll([{ ...product, stockOnHand: 5 }], { type: StockMovementType.ADJUSTMENT })
    );
    await firstValueFrom(TestBed.inject(SalesDataService).saveSale(testSale()));
    await firstValueFrom(TestBed.inject(UserDataService).getAll());
    expect(JSON.stringify({ ...localStorage })).toBe(localBefore);
    expect(JSON.stringify({ ...sessionStorage })).toBe(sessionBefore);
  });

  it('keeps business data out of the recorded events and error messages', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    await expectAsync(
      firstValueFrom(products.save({ ...product, id: '', name: 'Secret Name' }))
    ).toBeRejectedWithError(DuplicateSkuError, /already used/);
    const events = JSON.stringify(TestBed.inject(LocalDbEvents).list());
    expect(events).not.toContain('Secret Name');
    expect(events).not.toContain('Paracetamol');
  });

  it('refuses a record that cannot be stored instead of saving part of it', async () => {
    const suppliers = TestBed.inject(SupplierDataService);
    const first = (await firstValueFrom(suppliers.getAll()))[0];
    const before = await firstValueFrom(suppliers.getAll());
    const broken = { ...first, name: () => 'not data' } as unknown as typeof first;
    await expectAsync(firstValueFrom(suppliers.save(broken))).toBeRejected();
    expect(await firstValueFrom(suppliers.getAll())).toEqual(before);
  });

  it('gives every record created across many saves its own id', async () => {
    const products = TestBed.inject(ProductDataService);
    const template = (await firstValueFrom(products.getById('prod-010')))!;
    const ids = new Set<string>();
    for (let count = 0; count < 25; count++) {
      const saved = await firstValueFrom(
        products.save({ ...template, id: '', sku: `BULK-${count}`, stockOnHand: 0 })
      );
      ids.add(saved.id);
    }
    expect(ids.size).toBe(25);
  });
});
