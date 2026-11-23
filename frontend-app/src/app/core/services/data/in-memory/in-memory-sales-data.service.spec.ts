import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Sale } from '../../../models/domain/sale.model';
import { SAMPLE_TODAY } from '../../clock.service';
import { describeSalesDataContract } from '../contract/sales-data.contract';
import { provideDataServices } from '../data-providers';
import { SalesDataService } from '../sales-data.service';

describeSalesDataContract('InMemorySalesDataService', () => [provideDataServices(true)]);

describe('InMemorySalesDataService (in-memory only)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(SalesDataService);

  it('does not change the seed history when a sale is saved', async () => {
    const sale = {
      id: 'sale-001',
      invoiceNo: 'INV-0001',
      date: SAMPLE_TODAY,
      createdAt: `${SAMPLE_TODAY}T10:00:00`,
      totalCents: 10_000,
      profitCents: 2500,
    } as Sale;
    await firstValueFrom(service().saveSale(sale));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect((await firstValueFrom(service().getTodaySummary())).salesCents).toBe(8_425_000);
  });

  it('numbers invoices in the plain INV-NNNN form', async () => {
    expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0001');
    expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0002');
  });
});
