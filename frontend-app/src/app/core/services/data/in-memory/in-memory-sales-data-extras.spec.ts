import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  TEST_TODAY,
  testBill,
  testCounterReport,
  testReturn,
  testSale,
} from '../../../../../testing/pos-test.util';
import { Quotation } from '../../../models/domain/quotation.model';
import { QuotationStatus } from '../../../models/enums/quotation-status.enum';
import { provideDataServices } from '../data-providers';
import { DayLockedError } from '../day-locked.error';
import { SalesDataService } from '../sales-data.service';

function quotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quo-001',
    quotationNo: 'QUO-0001',
    status: QuotationStatus.OPEN,
    bill: testBill(),
    customerId: 'cus-001',
    customerName: 'Walk-in Customer',
    itemCount: 1,
    totalCents: 1000,
    date: TEST_TODAY,
    createdAt: `${TEST_TODAY}T10:00:00`,
    createdByUserId: 'usr-004',
    createdByName: 'Ruwani Jayawardena',
    convertedInvoiceNo: null,
    ...overrides,
  };
}

describe('InMemorySalesDataService extras', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(SalesDataService);

  describe("Today's sales net of returns", () => {
    it('takes the returned value and its profit off the day', async () => {
      const before = await firstValueFrom(service().getTodaySummary());
      await firstValueFrom(service().saveSale(testSale()));
      const afterSale = await firstValueFrom(service().getTodaySummary());
      expect(afterSale.salesCents).toBe(before.salesCents + 1250);
      await firstValueFrom(service().saveReturn(testReturn()));
      const afterReturn = await firstValueFrom(service().getTodaySummary());
      expect(afterReturn.salesCents).toBe(afterSale.salesCents - 500);
      expect(afterReturn.profitCents).toBe(afterSale.profitCents - 300);
      expect(afterReturn.bills).toBe(afterSale.bills);
    });

    it('shows the same figure in the daily series', async () => {
      await firstValueFrom(service().saveSale(testSale()));
      await firstValueFrom(service().saveReturn(testReturn()));
      const today = (await firstValueFrom(service().getDailySales(7))).at(-1)!;
      const summary = await firstValueFrom(service().getTodaySummary());
      expect(today.salesCents).toBe(summary.salesCents);
    });
  });

  describe('records', () => {
    it('hands back copies, so changing one never changes the store', async () => {
      await firstValueFrom(service().saveReturn(testReturn()));
      const first = await firstValueFrom(service().getReturns());
      (first as unknown as { totalCents: number }[])[0].totalCents = 1;
      const second = await firstValueFrom(service().getReturns());
      expect(second[0].totalCents).toBe(500);
    });

    it('keeps a quotation until it is deleted and converts it only once', async () => {
      await firstValueFrom(service().saveQuotation(quotation()));
      const converted = await firstValueFrom(
        service().markQuotationConverted('quo-001', 'INV-0005')
      );
      expect(converted?.status).toBe(QuotationStatus.CONVERTED);
      expect(converted?.convertedInvoiceNo).toBe('INV-0005');
      expect(
        await firstValueFrom(service().markQuotationConverted('quo-001', 'INV-0006'))
      ).toBeNull();
      expect(await firstValueFrom(service().markQuotationConverted('nope', 'INV-0007'))).toBeNull();
      expect(await firstValueFrom(service().removeQuotation('quo-001'))).toBeTrue();
      expect(await firstValueFrom(service().getQuotations())).toEqual([]);
    });

    it('carries a few balances in from before the till for Due Amount', async () => {
      const dues = await firstValueFrom(service().getOpeningDues());
      expect(dues.length).toBeGreaterThan(0);
      expect(dues.every(due => due.owedCents > 0)).toBeTrue();
    });
  });

  describe('a locked day', () => {
    const opening = {
      date: TEST_TODAY,
      amountCents: 100,
      setByUserId: 'usr-001',
      setBy: 'Nimal Perera',
      setAt: `${TEST_TODAY}T08:00:00`,
      changeLog: [],
    };
    const report = testCounterReport();

    it('allows the opening balance until the report is saved, then refuses it', async () => {
      await firstValueFrom(service().saveDayOpening(opening));
      await firstValueFrom(service().saveCounterReport(report));
      let error: unknown = null;
      try {
        await firstValueFrom(service().saveDayOpening({ ...opening, amountCents: 5 }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DayLockedError);
      expect((await firstValueFrom(service().getDayOpening(TEST_TODAY)))?.amountCents).toBe(100);
    });

    it('refuses a second report for the same day', async () => {
      await firstValueFrom(service().saveCounterReport(report));
      let error: unknown = null;
      try {
        await firstValueFrom(service().saveCounterReport({ ...report, countedCents: 1 }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DayLockedError);
      expect((await firstValueFrom(service().getCounterReport(TEST_TODAY)))?.countedCents).toBe(
        100
      );
    });

    it('still takes an opening balance for a different day', async () => {
      await firstValueFrom(service().saveCounterReport(report));
      const other = await firstValueFrom(
        service().saveDayOpening({ ...opening, date: '2026-09-22' })
      );
      expect(other.date).toBe('2026-09-22');
    });
  });
});
