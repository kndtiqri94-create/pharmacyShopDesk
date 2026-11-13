import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import {
  TEST_TODAY,
  counterCloseInput,
  setPosLevel,
  testBill,
  testCounterReport,
} from '../../../testing/pos-test.util';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { ProductDataService } from './data/product-data.service';
import { CASH_PAYMENT_LOCKED_MESSAGE, CASH_REFUND_LOCKED_MESSAGE } from './pos-write-guard.service';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ClockService } from './clock.service';
import { DayLockedError } from './data/day-locked.error';
import { SalesDataService } from './data/sales-data.service';
import { PosCashService } from './pos-cash.service';
import { PosCounterService } from './pos-counter.service';
import { PosDueService } from './pos-due.service';
import { PosReturnService } from './pos-return.service';
import { PosSaleService } from './pos-sale.service';

describe('PosCashService and PosCounterService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const cash = () => TestBed.inject(PosCashService);
  const counter = () => TestBed.inject(PosCounterService);
  const sell = (overrides = {}) => TestBed.inject(PosSaleService).save(testBill(overrides));

  describe('opening balance', () => {
    it('saves an opening balance for today with the actor and time', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await cash().saveOpening('5000', false);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.opening.amountCents).toBe(500_000);
      expect(result.opening.setBy).toBe('Ruwani Jayawardena');
      expect(result.opening.date).toBe(TEST_TODAY);
    });

    it('refuses a negative, blank or non numeric opening balance', async () => {
      await signInAs(UserRole.CASHIER);
      for (const bad of ['-1', '', 'abc', '1.234', 'NaN']) {
        expect((await cash().saveOpening(bad, true)).ok)
          .withContext(bad)
          .toBeFalse();
      }
      expect((await cash().status(TEST_TODAY)).opening).toBeNull();
    });

    it('does not silently replace an existing balance and records a confirmed change', async () => {
      await signInAs(UserRole.CASHIER);
      await cash().saveOpening('5000', false);
      const silent = await cash().saveOpening('6000', false);
      expect(silent.ok).toBeFalse();
      expect((await cash().status(TEST_TODAY)).opening?.amountCents).toBe(500_000);
      const same = await cash().saveOpening('5000', true);
      expect(same.ok).toBeFalse();
      const changed = await cash().saveOpening('6000', true);
      expect(changed.ok).toBeTrue();
      const opening = (await cash().status(TEST_TODAY)).opening!;
      expect(opening.amountCents).toBe(600_000);
      expect(opening.changeLog).toHaveSize(1);
      expect(opening.changeLog[0].oldCents).toBe(500_000);
      expect(opening.changeLog[0].by).toBe('Ruwani Jayawardena');
    });

    it('refuses a user who can only view the till', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const result = await cash().saveOpening('100', false);
      expect(!result.ok && result.reason).toBe('denied');
    });
  });

  describe('cash book', () => {
    it('shows only the opening balance on a day with no movements', async () => {
      await signInAs(UserRole.CASHIER);
      await cash().saveOpening('1000', false);
      const view = await cash().view(TEST_TODAY);
      expect(view.book.openingCents).toBe(100_000);
      expect(view.book.rows).toEqual([]);
      expect(view.readOnly).toBeFalse();
    });

    it('shows the cash kept from a sale, ignores card, and shows refunds out and dues in', async () => {
      await signInAs(UserRole.CASHIER);
      await cash().saveOpening('1000', false);
      await sell({ payments: { ...testBill().payments, cash: '20' } });
      await sell({
        invoiceNo: 'INV-0002',
        payments: { ...testBill().payments, cash: '', card: '10' },
      });
      await TestBed.inject(PosReturnService).findInvoice('INV-0001');
      TestBed.inject(PosReturnService).setQuantity('prod-001', '2');
      await TestBed.inject(PosReturnService).complete();
      await TestBed.inject(PosDueService).takePayment('cus-002', '100', 'CASH', '');
      const view = await cash().view(TEST_TODAY);
      expect(view.book.rows.map(row => row.entry.direction)).toEqual(['IN', 'OUT', 'IN']);
      expect(view.book.rows[0].entry.amountCents).toBe(1000);
      expect(view.book.cashInCents).toBe(1000 + 10_000);
      expect(view.book.cashOutCents).toBe(500);
      expect(view.book.expectedCents).toBe(100_000 + 11_000 - 500);
    });

    it('gives the same cash figures over a range as the single day view', async () => {
      await signInAs(UserRole.CASHIER);
      await cash().saveOpening('1000', false);
      await sell({ payments: { ...testBill().payments, cash: '20' } });
      await sell({
        invoiceNo: 'INV-0002',
        payments: { ...testBill().payments, cash: '', card: '10' },
      });
      await TestBed.inject(PosDueService).takePayment('cus-002', '100', 'CASH', '');
      const range = await cash().cashRange('2026-09-19', TEST_TODAY);
      expect(range.openingCents).toBe(0);
      expect(range.cashInvoicesCents).toBe(1000);
      expect(range.cashDuesCents).toBe(10_000);
      expect(range.cashRefundsCents).toBe(0);
      expect(range.activeDates).toEqual([TEST_TODAY]);
      expect(range.sales).toHaveSize(2);
      const single = await cash().cashRange(TEST_TODAY, TEST_TODAY);
      expect(single.openingCents).toBe(100_000);
      expect(single.toDayLocked).toBeFalse();
    });

    it('shows an earlier date for viewing only', async () => {
      await signInAs(UserRole.CASHIER);
      const view = await cash().view('2026-09-20');
      expect(view.readOnly).toBeTrue();
      expect(view.book.rows).toEqual([]);
    });
  });

  describe('drawer', () => {
    it('ends once and warns the till afterwards', async () => {
      await signInAs(UserRole.CASHIER);
      expect((await cash().status(TEST_TODAY)).drawerEnded).toBeFalse();
      const result = await cash().endDrawer();
      expect(result.ok && result.session.endedBy).toBe('Ruwani Jayawardena');
      expect((await cash().status(TEST_TODAY)).drawerEnded).toBeTrue();
      expect((await cash().endDrawer()).ok).toBeFalse();
    });

    it('refuses a user who can only view the till', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const result = await cash().endDrawer();
      expect(!result.ok && result.reason).toBe('denied');
    });
  });

  describe('counter close', () => {
    async function prepareDay(): Promise<void> {
      await cash().saveOpening('1000', false);
      await sell({ payments: { ...testBill().payments, cash: '20' } });
    }

    it('previews the expected cash as opening plus cash in minus cash out', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const preview = await counter().preview();
      expect(preview.openingCents).toBe(100_000);
      expect(preview.cashInCents).toBe(1000);
      expect(preview.expectedCents).toBe(101_000);
      expect(preview.report).toBeNull();
    });

    it('closes with the difference, who and when, and locks the report', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const result = await counter().close(
        counterCloseInput('1005.00', { note: ' short by a coin ' })
      );
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.report.expectedCents).toBe(101_000);
      expect(result.report.countedCents).toBe(100_500);
      expect(result.report.differenceCents).toBe(-500);
      expect(result.report.note).toBe('short by a coin');
      expect(result.report.closedBy).toBe('Ruwani Jayawardena');
      expect(result.report.locked).toBeTrue();
      const preview = await counter().preview();
      expect(preview.report?.countedCents).toBe(100_500);
    });

    it('needs confirmation and a valid counted amount', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      expect(
        (await counter().close(counterCloseInput('1010', { confirmed: false }))).ok
      ).toBeFalse();
      for (const bad of ['-1', '', 'abc', '1.234', 'NaN']) {
        expect((await counter().close(counterCloseInput(bad))).ok)
          .withContext(bad)
          .toBeFalse();
      }
      expect((await counter().preview()).report).toBeNull();
    });

    it('cannot be closed twice, and refuses changes to the locked day', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      await counter().close(counterCloseInput('1010'));
      expect((await counter().close(counterCloseInput('2000'))).ok).toBeFalse();
      const opening = await cash().saveOpening('9999', true);
      expect(opening.ok).toBeFalse();
      expect((await cash().status(TEST_TODAY)).opening?.amountCents).toBe(100_000);
      expect((await counter().preview()).report?.countedCents).toBe(101_000);
    });

    it('refuses writes to a locked day at the data service itself, even for an Admin', async () => {
      await signInAs(UserRole.ADMIN);
      await prepareDay();
      await counter().close(counterCloseInput('1010'));
      const data = TestBed.inject(SalesDataService);
      const report = (await firstValueFrom(data.getCounterReport(TEST_TODAY)))!;
      let error: unknown = null;
      try {
        await firstValueFrom(data.saveCounterReport({ ...report, countedCents: 1 }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DayLockedError);
      error = null;
      try {
        const opening = (await firstValueFrom(data.getDayOpening(TEST_TODAY)))!;
        await firstValueFrom(data.saveDayOpening({ ...opening, amountCents: 1 }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DayLockedError);
    });

    it('keeps a later sale out of the locked report and warns about it', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const closed = await counter().close(counterCloseInput('1010'));
      if (!closed.ok) throw new Error('close failed');
      spyOn(TestBed.inject(ClockService), 'now').and.returnValue(`${TEST_TODAY}T23:59:59`);
      await sell({ invoiceNo: 'INV-0002' });
      const status = await cash().status(TEST_TODAY);
      expect(status.counterClosed).toBeTrue();
      const preview = await counter().preview();
      expect(preview.report?.expectedCents).toBe(closed.report.expectedCents);
      expect(preview.cashInCents).toBe(closed.report.cashInCents);
    });

    it('counts held bills without stopping the close', async () => {
      await signInAs(UserRole.CASHIER);
      await TestBed.inject(PosSaleService).hold(testBill());
      expect((await counter().preview()).heldBillCount).toBe(1);
      expect((await counter().close(counterCloseInput('0'))).ok).toBeTrue();
    });

    describe('cash refunds and cash payments on a closed day', () => {
      async function closeAfterSale(customerId: string): Promise<void> {
        await prepareDay();
        await sell({ invoiceNo: 'INV-0002', customerId });
        const closed = await counter().close(counterCloseInput('1010'));
        if (!closed.ok) throw new Error('close failed');
      }

      const stockOf = async () =>
        (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!.batches.map(
          batch => batch.quantity
        );

      it('refuses a cash refund and leaves stock and returns untouched', async () => {
        await signInAs(UserRole.CASHIER);
        await closeAfterSale('cus-002');
        const stockBefore = await stockOf();
        const returns = TestBed.inject(PosReturnService);
        await returns.findInvoice('INV-0002');
        returns.setQuantity('prod-001', '1');
        const result = await returns.complete();
        expect(result.ok).toBeFalse();
        expect(!result.ok && result.message).toBe(CASH_REFUND_LOCKED_MESSAGE);
        expect(await stockOf()).toEqual(stockBefore);
        expect(await firstValueFrom(TestBed.inject(SalesDataService).getReturns())).toEqual([]);
      });

      it('still allows a customer credit return that moves no cash', async () => {
        await signInAs(UserRole.CASHIER);
        await closeAfterSale('cus-002');
        const returns = TestBed.inject(PosReturnService);
        await returns.findInvoice('INV-0002');
        returns.setQuantity('prod-001', '1');
        returns.setSettlement(ReturnSettlement.CUSTOMER_CREDIT);
        expect((await returns.complete()).ok).toBeTrue();
      });

      it('refuses a cash due payment but allows a card payment', async () => {
        await signInAs(UserRole.CASHIER);
        await closeAfterSale('cus-001');
        const due = TestBed.inject(PosDueService);
        const cashPayment = await due.takePayment('cus-002', '100', 'CASH', '');
        expect(!cashPayment.ok && cashPayment.message).toBe(CASH_PAYMENT_LOCKED_MESSAGE);
        expect((await due.takePayment('cus-002', '100', 'CARD', '1234')).ok).toBeTrue();
      });

      it('refuses cash movements dated on the closed day at the data service, even for an Admin', async () => {
        await signInAs(UserRole.ADMIN);
        await closeAfterSale('cus-002');
        const data = TestBed.inject(SalesDataService);
        const returns = TestBed.inject(PosReturnService);
        await returns.findInvoice('INV-0002');
        returns.setQuantity('prod-001', '1');
        returns.setSettlement(ReturnSettlement.CUSTOMER_CREDIT);
        const credit = await returns.complete();
        if (!credit.ok) throw new Error('credit return failed');
        const attempt = async (save: () => Promise<unknown>): Promise<unknown> => {
          try {
            await save();
          } catch (caught) {
            return caught;
          }
          return null;
        };
        expect(
          await attempt(() =>
            firstValueFrom(
              data.saveReturn({
                ...credit.saleReturn,
                id: 'ret-x',
                settlement: ReturnSettlement.CASH_REFUND,
              })
            )
          )
        ).toBeInstanceOf(DayLockedError);
        const payment = {
          id: 'dpay-x',
          receiptNo: 'RCP-0099',
          customerId: 'cus-002',
          customerName: 'X',
          amountCents: 100,
          method: SalePaymentMethod.CASH,
          reference: '',
          createdAt: `${TEST_TODAY}T23:00:00`,
          takenByUserId: 'usr-001',
          takenBy: 'A',
        };
        expect(await attempt(() => firstValueFrom(data.saveDuePayment(payment)))).toBeInstanceOf(
          DayLockedError
        );
        expect(
          await attempt(() =>
            firstValueFrom(data.saveDuePayment({ ...payment, method: SalePaymentMethod.CARD }))
          )
        ).toBeNull();
      });
    });

    it('refuses a user who can only view the till', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const result = await counter().close(counterCloseInput('0'));
      expect(!result.ok && result.reason).toBe('denied');
    });
  });

  describe('shift start and brought forward', () => {
    const saveReport = (date: string, broughtForwardCents: number) =>
      firstValueFrom(
        TestBed.inject(SalesDataService).saveCounterReport(
          testCounterReport({ date, broughtForwardCents })
        )
      );

    it('has no first activity time on an empty day', async () => {
      await signInAs(UserRole.CASHIER);
      expect(await cash().firstActivityTime(TEST_TODAY)).toBeNull();
    });

    it('uses the opening balance time when it comes before any sale', async () => {
      await signInAs(UserRole.CASHIER);
      spyOn(TestBed.inject(ClockService), 'now').and.returnValue(`${TEST_TODAY}T07:30:00`);
      await cash().saveOpening('500', false);
      expect(await cash().firstActivityTime(TEST_TODAY)).toBe(`${TEST_TODAY}T07:30:00`);
    });

    it('uses the first sale time when there is no opening balance', async () => {
      await signInAs(UserRole.CASHIER);
      await sell();
      const first = await cash().firstActivityTime(TEST_TODAY);
      expect(first?.startsWith(TEST_TODAY)).toBeTrue();
    });

    it('has no brought forward balance before any counter was closed', async () => {
      await signInAs(UserRole.CASHIER);
      expect(await cash().broughtForwardFor(TEST_TODAY)).toBeNull();
    });

    it('returns the previous closed day balance and the day it came from', async () => {
      await signInAs(UserRole.CASHIER);
      await saveReport('2026-09-20', 25_000);
      expect(await cash().broughtForwardFor(TEST_TODAY)).toEqual({
        cents: 25_000,
        fromDate: '2026-09-20',
      });
    });

    it('skips days with no report and takes the latest earlier one', async () => {
      await signInAs(UserRole.CASHIER);
      await saveReport('2026-09-15', 11_100);
      await saveReport('2026-09-18', 22_200);
      expect(await cash().broughtForwardFor(TEST_TODAY)).toEqual({
        cents: 22_200,
        fromDate: '2026-09-18',
      });
    });

    it('does not use the report of the same day or a later day', async () => {
      await signInAs(UserRole.CASHIER);
      await saveReport(TEST_TODAY, 5_000);
      await saveReport('2026-09-25', 7_000);
      expect(await cash().broughtForwardFor(TEST_TODAY)).toBeNull();
    });

    it('does not change the closed day report when the next opening is saved', async () => {
      await signInAs(UserRole.CASHIER);
      await saveReport('2026-09-20', 25_000);
      await cash().saveOpening('250', false);
      const closed = await firstValueFrom(
        TestBed.inject(SalesDataService).getCounterReport('2026-09-20')
      );
      expect(closed?.broughtForwardCents).toBe(25_000);
    });

    it('gives nothing to a user without till access', async () => {
      await signInAs(UserRole.CASHIER);
      await saveReport('2026-09-20', 25_000);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      expect(await cash().broughtForwardFor(TEST_TODAY)).toBeNull();
    });
  });
});
