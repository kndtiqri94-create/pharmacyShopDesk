import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
} from '../../../../../testing/local-data-test.util';
import { currentDeviceCode } from '../../../utils/device-identity.util';
import { ProductDataService } from '../product-data.service';
import { SalesDataService } from '../sales-data.service';
import { LOCAL_SCHEMA_VERSIONS, LocalDatabase, SchemaVersion } from './local-database';
import { LOCAL_DATABASE_FACTORY, LocalDatabaseProvider } from './local-database.provider';
import { LocalDbEvents } from './local-db-events.service';
import { META_KEYS, readMeta } from './local-meta';
import { StorageQuotaExceededError } from './storage-quota-exceeded.error';

describe('LocalDatabase', () => {
  let environment: LocalTestEnvironment;

  function startApp(extra: object[] = []): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...environment.providers(), ...extra] });
  }

  beforeEach(() => {
    environment = createLocalTestEnvironment('shopdesk-test', { realBrowserStore: true });
    startApp();
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await environment.cleanup();
  });

  it('starts from the sample starting data on the first run', async () => {
    const products = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    expect(products).toHaveSize(10);
    const seededAt = await TestBed.inject(LocalDatabaseProvider).run(db =>
      readMeta<string>(db, META_KEYS.seededAt)
    );
    expect(seededAt).toBeDefined();
  });

  it('keeps recorded data after the page is reloaded or the app restarts', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-003')))!;
    await firstValueFrom(products.save({ ...product, name: 'Cetirizine 10mg (edited)' }));

    startApp();
    const again = TestBed.inject(ProductDataService);
    expect((await firstValueFrom(again.getById('prod-003')))?.name).toBe(
      'Cetirizine 10mg (edited)'
    );
    expect(await firstValueFrom(again.getAll())).toHaveSize(10);
  });

  it('does not load the starting data a second time', async () => {
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-001')))!;
    await firstValueFrom(products.save({ ...product, active: false }));
    startApp();
    startApp();
    expect(
      (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))?.active
    ).toBeFalse();
  });

  it('keeps the same device code after a restart', async () => {
    await TestBed.inject(LocalDatabaseProvider).ready();
    const first = currentDeviceCode();
    expect(first).not.toBeNull();
    startApp();
    await TestBed.inject(LocalDatabaseProvider).ready();
    expect(currentDeviceCode()).toBe(first);
  });

  it('lets the owner choose a readable device code that survives a restart', async () => {
    const provider = TestBed.inject(LocalDatabaseProvider);
    await provider.setDeviceCode('T1');
    expect(currentDeviceCode()).toBe('T1');
    startApp();
    await TestBed.inject(LocalDatabaseProvider).ready();
    expect(currentDeviceCode()).toBe('T1');
    await expectAsync(TestBed.inject(LocalDatabaseProvider).setDeviceCode('no way')).toBeRejected();
  });

  it('keeps every recorded value when a newer version of the app changes the stored layout', async () => {
    const sales = TestBed.inject(SalesDataService);
    const products = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(products.getById('prod-002')))!;
    await firstValueFrom(products.save({ ...product, name: 'Amoxicillin (edited)' }));
    const customersBefore = await firstValueFrom(sales.getCustomers());

    const versionThree: SchemaVersion = {
      version: 3,
      stores: { auditNotes: 'id' },
      upgrade: async transaction => {
        await transaction
          .table('products')
          .toCollection()
          .modify((row: { shelfLocation: string }) => {
            row.shelfLocation = `${row.shelfLocation} (v2)`;
          });
      },
    };
    startApp([
      {
        provide: LOCAL_DATABASE_FACTORY,
        useValue: () =>
          new LocalDatabase(environment.databaseName, environment.databaseOptions, [
            ...LOCAL_SCHEMA_VERSIONS,
            versionThree,
          ]),
      },
    ]);

    const upgraded = TestBed.inject(ProductDataService);
    const all = await firstValueFrom(upgraded.getAll());
    expect(all).toHaveSize(10);
    expect(all.find(item => item.id === 'prod-002')?.name).toBe('Amoxicillin (edited)');
    expect(all.every(item => item.shelfLocation.endsWith('(v2)'))).toBeTrue();
    expect(await firstValueFrom(TestBed.inject(SalesDataService).getCustomers())).toEqual(
      customersBefore
    );
    const events = TestBed.inject(LocalDbEvents).list();
    expect(
      events.some(event => event.code === 'local-db.upgrade' && event.detail === 3)
    ).toBeTrue();
  });

  it('tells the user clearly when the device is out of space, and records only a code', async () => {
    const provider = TestBed.inject(LocalDatabaseProvider);
    const failure = provider.run(() =>
      Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
    );
    await expectAsync(failure).toBeRejectedWithError(StorageQuotaExceededError);
    const events = TestBed.inject(LocalDbEvents).list();
    expect(events.filter(event => event.code === 'local-db.quota-exceeded')).toHaveSize(1);
    expect(JSON.stringify(events)).not.toContain('quota has been');
  });

  it('turns a full device into the clear error when a real write fails', async () => {
    const provider = TestBed.inject(LocalDatabaseProvider);
    const db = await provider.ready();
    const productService = TestBed.inject(ProductDataService);
    const product = (await firstValueFrom(productService.getById('prod-001')))!;
    spyOn(db.products, 'put').and.callFake(
      () => Promise.reject(new DOMException('full', 'QuotaExceededError')) as never
    );
    await expectAsync(
      firstValueFrom(productService.save({ ...product, name: 'No space' }))
    ).toBeRejectedWithError(StorageQuotaExceededError);
    expect((await firstValueFrom(productService.getById('prod-001')))?.name).toBe(
      'Paracetamol 500mg'
    );
  });
});
