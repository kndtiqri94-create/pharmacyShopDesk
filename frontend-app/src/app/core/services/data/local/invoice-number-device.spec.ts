import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
} from '../../../../../testing/local-data-test.util';
import { testSale } from '../../../../../testing/pos-test.util';
import { isInvoiceNumber, parseInvoiceNumber } from '../../../utils/invoice-number.util';
import { SalesDataService } from '../sales-data.service';
import { LocalDatabaseProvider } from './local-database.provider';

describe('invoice numbers across devices', () => {
  let environment: LocalTestEnvironment;

  const sales = () => TestBed.inject(SalesDataService);
  const next = () => firstValueFrom(sales().nextInvoiceNumber());

  function startDevice(code: string): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: environment.providers() });
    return TestBed.inject(LocalDatabaseProvider).setDeviceCode(code);
  }

  beforeEach(() => {
    environment = createLocalTestEnvironment();
  });

  it('puts the device code in every invoice number and counts up on that device', async () => {
    await startDevice('K7M');
    expect(await next()).toBe('INV-K7M-0001');
    expect(await next()).toBe('INV-K7M-0002');
    expect(isInvoiceNumber('INV-K7M-0002')).toBeTrue();
  });

  it('keeps counting after a restart without reusing a number', async () => {
    await startDevice('K7M');
    await firstValueFrom(sales().saveSale(testSale({ invoiceNo: await next() })));
    await next();
    await startDevice('K7M');
    expect(await next()).toBe('INV-K7M-0003');
  });

  it('gives two separate devices different numbers even though both start from one', async () => {
    await startDevice('K7M');
    const first = [await next(), await next(), await next()];
    environment = createLocalTestEnvironment('shopdesk-other-till');
    await startDevice('T1');
    const other = [await next(), await next(), await next()];
    expect(new Set([...first, ...other]).size).toBe(6);
    expect(other.map(number => parseInvoiceNumber(number)?.deviceCode)).toEqual(['T1', 'T1', 'T1']);
    expect(other.map(number => parseInvoiceNumber(number)?.sequence)).toEqual([1, 2, 3]);
  });

  it('takes back the last unused number but not one that is in use', async () => {
    await startDevice('K7M');
    const first = await next();
    await firstValueFrom(sales().releaseInvoiceNumber(first));
    expect(await next()).toBe(first);
    await firstValueFrom(sales().saveSale(testSale({ invoiceNo: first })));
    await firstValueFrom(sales().releaseInvoiceNumber(first));
    expect(await next()).toBe('INV-K7M-0002');
  });

  it('continues after an older plain number already saved on the device', async () => {
    await startDevice('K7M');
    await firstValueFrom(sales().saveSale(testSale({ invoiceNo: 'INV-0007' })));
    expect(await next()).toBe('INV-K7M-0008');
  });
});
