import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { HeldBill } from '../../../models/domain/held-bill.model';
import { Sale } from '../../../models/domain/sale.model';
import { SAMPLE_TODAY } from '../../clock.service';
import { provideDataServices } from '../data-providers';
import { SalesDataService } from '../sales-data.service';

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-001',
    invoiceNo: 'INV-0001',
    date: SAMPLE_TODAY,
    createdAt: `${SAMPLE_TODAY}T10:00:00`,
    cashierUserId: 'usr-004',
    cashierName: 'Ruwani Jayawardena',
    customerId: 'cus-001',
    customerName: 'Walk-in Customer',
    repId: null,
    repName: null,
    lines: [],
    payments: [],
    subTotalCents: 10_000,
    discountCents: 0,
    totalCents: 10_000,
    paidCents: 10_000,
    creditCents: 0,
    changeCents: 0,
    profitCents: 2500,
    discountApprovals: [],
    ...overrides,
  };
}

function held(id: string, invoiceNo: string): HeldBill {
  return {
    id,
    holdNo: 'H-001',
    heldAt: `${SAMPLE_TODAY}T10:00:00`,
    customerName: 'Walk-in Customer',
    itemCount: 1,
    totalCents: 500,
    bill: {
      invoiceNo,
      date: SAMPLE_TODAY,
      customerId: 'cus-001',
      repId: null,
      lines: [],
      billDiscount: { mode: 'PERCENT', percent: 0 },
      billDiscountApproval: null,
      payments: {
        cash: '',
        card: '',
        online: '',
        cardReference: '',
        onlineReference: '',
        creditSelected: false,
      },
    },
  };
}

describe('InMemorySalesDataService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(SalesDataService);

  it('gives the last 7 and 30 days ending today, oldest first', async () => {
    const week = await firstValueFrom(service().getDailySales(7));
    const month = await firstValueFrom(service().getDailySales(30));
    expect(week).toHaveSize(7);
    expect(month).toHaveSize(30);
    expect(week.at(-1)?.date).toBe(SAMPLE_TODAY);
    expect(month[0].date < month[1].date).toBeTrue();
  });

  it('never gives more than 30 days or fewer than one', async () => {
    expect(await firstValueFrom(service().getDailySales(500))).toHaveSize(30);
    expect(await firstValueFrom(service().getDailySales(0))).toHaveSize(1);
    expect(await firstValueFrom(service().getDailySales(Number.NaN))).toHaveSize(1);
  });

  it('summarizes today against the same day last week', async () => {
    const summary = await firstValueFrom(service().getTodaySummary());
    expect(summary.salesCents).toBe(8_425_000);
    expect(summary.profitCents).toBe(1_984_000);
    expect(summary.bills).toBe(63);
    expect(summary.comparedSalesCents).toBe(7_495_000);
  });

  it('lists best sellers with the best first', async () => {
    const sellers = await firstValueFrom(service().getBestSellers());
    expect(sellers[0].productName).toBe('Paracetamol 500mg');
    const units = sellers.map(seller => seller.unitsSold);
    expect(units).toEqual([...units].sort((first, second) => second - first));
  });

  it('returns copies that cannot change the sample data', async () => {
    const points = await firstValueFrom(service().getDailySales(7));
    points[0].salesCents = 0;
    expect((await firstValueFrom(service().getDailySales(7)))[0].salesCents).not.toBe(0);
  });

  describe('saved till sales', () => {
    it('adds sales saved today to Today sales, profit and bills', async () => {
      await firstValueFrom(service().saveSale(sale()));
      await firstValueFrom(
        service().saveSale(
          sale({ id: 'sale-002', invoiceNo: 'INV-0002', totalCents: 5000, profitCents: 1000 })
        )
      );
      const summary = await firstValueFrom(service().getTodaySummary());
      expect(summary.salesCents).toBe(8_425_000 + 15_000);
      expect(summary.profitCents).toBe(1_984_000 + 3500);
      expect(summary.bills).toBe(65);
    });

    it('keeps a sale dated on another day out of today and puts it on its own day', async () => {
      await firstValueFrom(service().saveSale(sale({ date: '2026-09-20' })));
      const summary = await firstValueFrom(service().getTodaySummary());
      expect(summary.salesCents).toBe(8_425_000);
      const week = await firstValueFrom(service().getDailySales(7));
      const yesterday = week.find(point => point.date === '2026-09-20')!;
      expect(yesterday.salesCents).toBe(5_950_000 + 10_000);
    });

    it('shows the day bar including saved sales', async () => {
      await firstValueFrom(service().saveSale(sale()));
      const week = await firstValueFrom(service().getDailySales(7));
      expect(week.at(-1)?.salesCents).toBe(8_425_000 + 10_000);
    });

    it('does not change the seed history when a sale is saved', async () => {
      await firstValueFrom(service().saveSale(sale()));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
      expect((await firstValueFrom(service().getTodaySummary())).salesCents).toBe(8_425_000);
    });

    it('lists saved sales as copies', async () => {
      await firstValueFrom(service().saveSale(sale()));
      const first = [...(await firstValueFrom(service().getSales()))];
      first[0].totalCents = 1;
      expect((await firstValueFrom(service().getSales()))[0].totalCents).toBe(10_000);
    });
  });

  describe('invoice numbers', () => {
    it('hands out a different, rising number every time', async () => {
      const first = await firstValueFrom(service().nextInvoiceNumber());
      const second = await firstValueFrom(service().nextInvoiceNumber());
      expect(first).toBe('INV-0001');
      expect(second).toBe('INV-0002');
    });

    it('takes back the last reserved number when it was never used, so the next one is not skipped', async () => {
      const first = await firstValueFrom(service().nextInvoiceNumber());
      await firstValueFrom(service().releaseInvoiceNumber(first));
      expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0001');
    });

    it('does not take back a number that is not the latest reserved, or one that is in use', async () => {
      const first = await firstValueFrom(service().nextInvoiceNumber());
      await firstValueFrom(service().nextInvoiceNumber());
      await firstValueFrom(service().releaseInvoiceNumber(first));
      expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0003');
      await firstValueFrom(service().saveSale(sale({ invoiceNo: 'INV-0003' })));
      await firstValueFrom(service().releaseInvoiceNumber('INV-0003'));
      expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0004');
    });

    it('goes after a saved sale and after a held bill', async () => {
      await firstValueFrom(service().saveSale(sale({ invoiceNo: 'INV-0007' })));
      expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0008');
      await firstValueFrom(service().saveHeldBill(held('held-001', 'INV-0020')));
      expect(await firstValueFrom(service().nextInvoiceNumber())).toBe('INV-0021');
    });
  });

  describe('held bills', () => {
    it('keeps, lists and removes held bills', async () => {
      await firstValueFrom(service().saveHeldBill(held('held-001', 'INV-0001')));
      expect(await firstValueFrom(service().getHeldBills())).toHaveSize(1);
      expect(await firstValueFrom(service().removeHeldBill('held-001'))).toBeTrue();
      expect(await firstValueFrom(service().getHeldBills())).toHaveSize(0);
      expect(await firstValueFrom(service().removeHeldBill('held-001'))).toBeFalse();
    });

    it('does not count a held bill in today sales', async () => {
      await firstValueFrom(service().saveHeldBill(held('held-001', 'INV-0001')));
      expect((await firstValueFrom(service().getTodaySummary())).salesCents).toBe(8_425_000);
    });
  });

  describe('customers and reps', () => {
    it('has a default Walk-in Customer first and named customers after it', async () => {
      const customers = await firstValueFrom(service().getCustomers());
      expect(customers[0]).toEqual({ id: 'cus-001', name: 'Walk-in Customer', isWalkIn: true });
      expect(customers.filter(customer => customer.isWalkIn)).toHaveSize(1);
      expect(customers.length).toBeGreaterThan(2);
    });

    it('has sample reps and hands out copies', async () => {
      const reps = [...(await firstValueFrom(service().getReps()))];
      expect(reps.length).toBeGreaterThan(1);
      reps[0].name = 'Changed';
      expect((await firstValueFrom(service().getReps()))[0].name).not.toBe('Changed');
    });
  });
});
