import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs } from '../../../testing/auth-test.util';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
  localAuthProviders,
} from '../../../testing/local-data-test.util';
import { testBill } from '../../../testing/pos-test.util';
import { UserRole } from '../models/enums/user-role.enum';
import { ProductDataService } from './data/product-data.service';
import { LocalDatabaseProvider } from './data/local/local-database.provider';
import { LocalStockLedgerService } from './data/local/local-stock-ledger.service';
import { SalesDataService } from './data/sales-data.service';
import { PosSaleService } from './pos-sale.service';

const SOLD_QUANTITY = 4;
const SALE_TOTAL_CENTS = 1000;
const SEED_TODAY_SALES_CENTS = 8_425_000;
const SEED_TODAY_BILLS = 63;

describe('offline sale persistence (S-3.2.6, FR-OFF-2, FR-OFF-4)', () => {
  let environment: LocalTestEnvironment;
  let networkRequests: string[];

  function startApp(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: localAuthProviders(environment) });
  }

  const sales = () => firstValueFrom(TestBed.inject(SalesDataService).getSales());
  const today = () => firstValueFrom(TestBed.inject(SalesDataService).getTodaySummary());
  const stock = async () =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!.batches.map(
      batch => [batch.id, batch.quantity]
    );
  const movements = () =>
    TestBed.inject(LocalDatabaseProvider).run(db =>
      TestBed.inject(LocalStockLedgerService).list(db)
    );

  beforeEach(() => {
    clearBrowserStorage();
    networkRequests = [];
    environment = createLocalTestEnvironment('shopdesk-offline', { realBrowserStore: true });
    spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL) => {
      networkRequests.push(String(input));
      return Promise.reject(new TypeError('The network is off.'));
    });
    spyOn(XMLHttpRequest.prototype, 'open').and.callFake((_method: string, url: string | URL) => {
      networkRequests.push(String(url));
      throw new Error('The network is off.');
    });
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    startApp();
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await environment.cleanup();
    clearBrowserStorage();
  });

  async function sellWhileOffline(): Promise<string> {
    await signInAs(UserRole.CASHIER);
    const invoiceNo = await firstValueFrom(TestBed.inject(SalesDataService).nextInvoiceNumber());
    const result = await TestBed.inject(PosSaleService).save(testBill({ invoiceNo }));
    expect(result.ok).toBeTrue();
    return invoiceNo;
  }

  async function expectSaleCountedOnce(invoiceNo: string): Promise<void> {
    const saved = await sales();
    expect(saved.map(sale => sale.invoiceNo)).toEqual([invoiceNo]);
    expect(saved[0].totalCents).toBe(SALE_TOTAL_CENTS);
    const summary = await today();
    expect(summary.salesCents).toBe(SEED_TODAY_SALES_CENTS + SALE_TOTAL_CENTS);
    expect(summary.bills).toBe(SEED_TODAY_BILLS + 1);
    expect(await stock()).toEqual([
      ['bat-001', 1200 - SOLD_QUANTITY],
      ['bat-002', 2400],
    ]);
    const written = await movements();
    expect(written).toHaveSize(1);
    expect(written[0].qtyDelta).toBe(-SOLD_QUANTITY);
    expect(written[0].refId).toBe(invoiceNo);
  }

  it('completes a sale with the network off, using only this device', async () => {
    const invoiceNo = await sellWhileOffline();
    await expectSaleCountedOnce(invoiceNo);
    expect(networkRequests).toEqual([]);
  });

  it('still has the sale, its totals and the reduced stock after a page reload', async () => {
    const invoiceNo = await sellWhileOffline();
    startApp();
    await expectSaleCountedOnce(invoiceNo);
    expect(networkRequests).toEqual([]);
  });

  it('still has the sale, its totals and the reduced stock after the browser is restarted', async () => {
    const invoiceNo = await sellWhileOffline();
    startApp();
    startApp();
    await signInAs(UserRole.CASHIER);
    await expectSaleCountedOnce(invoiceNo);
    startApp();
    await expectSaleCountedOnce(invoiceNo);
    expect(networkRequests).toEqual([]);
  });

  it('gives the next sale after a restart a new invoice number and takes stock only once more', async () => {
    const first = await sellWhileOffline();
    startApp();
    const second = await sellWhileOffline();
    expect(second).not.toBe(first);
    expect(await sales()).toHaveSize(2);
    expect(await stock()).toEqual([
      ['bat-001', 1200 - 2 * SOLD_QUANTITY],
      ['bat-002', 2400],
    ]);
    expect(await movements()).toHaveSize(2);
  });
});
