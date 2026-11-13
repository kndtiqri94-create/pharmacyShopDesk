import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import {
  TEST_TODAY,
  counterCloseInput,
  setPosLevel,
  testBill,
} from '../../../testing/pos-test.util';
import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { AuthService } from './auth/auth.service';
import { CASH_BOOK_ADMIN_ONLY_MESSAGE, PosCashBookService } from './pos-cash-book.service';
import { PosCashService } from './pos-cash.service';
import { PosCounterService } from './pos-counter.service';
import { PosSaleService } from './pos-sale.service';
import { DAY_LOCKED_MESSAGE } from './pos-write-guard.service';

describe('PosCashBookService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosCashBookService);

  async function today(): Promise<CashBookReport> {
    const result = await service().loadRange(TEST_TODAY, TEST_TODAY);
    if (!result.ok) throw new Error(result.message);
    return result.report;
  }

  const row = (report: CashBookReport, key: string) =>
    report.ledger.rows.find(item => item.key === key)!;

  describe('viewing', () => {
    it('shows zeros for real rows on a day with no activity in the past', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().loadRange('2026-09-01', '2026-09-02');
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.report.ledger.balanceCents).toBe(0);
      expect(
        result.report.ledger.rows.some(item => item.isMock && item.debitCents > 0)
      ).toBeFalse();
    });

    it('keeps sample rows on today and counts only cash in the cash rows', async () => {
      await signInAs(UserRole.CASHIER);
      await TestBed.inject(PosCashService).saveOpening('2500', false);
      await TestBed.inject(PosSaleService).save(testBill());
      await TestBed.inject(PosSaleService).save(
        testBill({
          invoiceNo: 'INV-0002',
          payments: { ...testBill().payments, cash: '', card: '10' },
        })
      );
      const report = await today();
      expect(row(report, 'OPENING_BALANCE').creditCents).toBe(250_000);
      expect(row(report, 'INVOICES').creditCents).toBe(1_000);
      expect(row(report, 'TOTAL_EXPENSES').debitCents).toBeGreaterThan(0);
      expect(report.paymentInvoices[0]).toEqual({
        method: 'Card',
        invoiceCount: 1,
        amountCents: 1_000,
      });
      expect(report.dailySales[0].count).toBe(2);
    });

    it('refuses a reversed, future or too wide range', async () => {
      await signInAs(UserRole.CASHIER);
      for (const [from, to] of [
        ['2026-09-21', '2026-09-20'],
        ['2026-09-21', '2026-09-22'],
        ['2025-01-01', '2026-09-21'],
        ['x', 'y'],
      ]) {
        const result = await service().loadRange(from, to);
        expect(result.ok).withContext(`${from} ${to}`).toBeFalse();
      }
    });

    it('refuses an unauthenticated user and one without POS access', async () => {
      expect((await service().loadRange(TEST_TODAY, TEST_TODAY)).ok).toBeFalse();
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      const result = await service().loadRange(TEST_TODAY, TEST_TODAY);
      expect(result.ok ? '' : result.reason).toBe('denied');
    });
  });

  describe('Admin only writes', () => {
    it('lets an Admin record the counted cash and shows the difference', async () => {
      await signInAs(UserRole.ADMIN);
      expect(service().canRecord()).toBeTrue();
      const before = await today();
      expect(before.ledger.actualBalanceCents).toBeNull();
      expect((await service().saveActualBalance(TEST_TODAY, '1000.00')).ok).toBeTrue();
      const after = await today();
      expect(after.ledger.actualBalanceCents).toBe(100_000);
      expect(after.ledger.differenceCents).toBe(100_000 - after.ledger.balanceCents);
    });

    it('keeps the newest counted cash for the day', async () => {
      await signInAs(UserRole.ADMIN);
      await service().saveActualBalance(TEST_TODAY, '10');
      await service().saveActualBalance(TEST_TODAY, '20');
      expect((await today()).ledger.actualBalanceCents).toBe(2_000);
    });

    it('lets an Admin add signed adjustments that move the balance', async () => {
      await signInAs(UserRole.ADMIN);
      const before = (await today()).ledger.balanceCents;
      expect((await service().addAdjustment(TEST_TODAY, '300', 'Found cash')).ok).toBeTrue();
      expect((await service().addAdjustment(TEST_TODAY, '-50.50', 'Short')).ok).toBeTrue();
      const after = await today();
      expect(row(after, 'ADJUSTMENTS').creditCents).toBe(30_000);
      expect(row(after, 'ADJUSTMENTS').debitCents).toBe(5_050);
      expect(after.ledger.balanceCents).toBe(before + 24_950);
    });

    it('refuses every write for Manager, Pharmacist and Cashier', async () => {
      for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
        await signInAs(role);
        expect(service().canRecord()).withContext(role).toBeFalse();
        const actual = await service().saveActualBalance(TEST_TODAY, '10');
        const adjustment = await service().addAdjustment(TEST_TODAY, '10', 'note');
        const opening = await service().saveOpeningBalance('10', false);
        for (const result of [actual, adjustment, opening]) {
          expect(result.ok).withContext(role).toBeFalse();
          expect(result.ok ? '' : result.reason).toBe('denied');
        }
        await TestBed.inject(AuthService).signOut();
      }
      await signInAs(UserRole.ADMIN);
      const report = await today();
      expect(report.ledger.actualBalanceCents).toBeNull();
      expect(row(report, 'ADJUSTMENTS').creditCents).toBe(0);
    });

    it('refuses when nobody is signed in', async () => {
      const result = await service().saveActualBalance(TEST_TODAY, '10');
      expect(result.ok ? '' : result.message).toBe(CASH_BOOK_ADMIN_ONLY_MESSAGE);
    });

    it('refuses an Admin who can only view the till', async () => {
      await signInAs(UserRole.ADMIN);
      await setPosLevel(UserRole.ADMIN, PermissionLevel.VIEW);
      expect(service().canRecord()).toBeFalse();
      expect((await service().saveActualBalance(TEST_TODAY, '10')).ok).toBeFalse();
    });

    it('rejects bad amounts and a missing note without saving anything', async () => {
      await signInAs(UserRole.ADMIN);
      for (const bad of ['', '-1', 'abc', 'NaN', '1.234', '99999999999']) {
        expect((await service().saveActualBalance(TEST_TODAY, bad)).ok)
          .withContext(bad)
          .toBeFalse();
      }
      for (const bad of ['', '0', 'abc', '1.234']) {
        const result = await service().addAdjustment(TEST_TODAY, bad, 'note');
        expect(result.ok).withContext(bad).toBeFalse();
      }
      const noNote = await service().addAdjustment(TEST_TODAY, '10', '  ');
      expect(noNote.ok).toBeFalse();
      expect('field' in noNote ? noNote.field : null).toBe('note');
      const report = await today();
      expect(report.ledger.actualBalanceCents).toBeNull();
      expect(row(report, 'ADJUSTMENTS').creditCents).toBe(0);
    });

    it('refuses a future or malformed day', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().saveActualBalance('2030-01-01', '10')).ok).toBeFalse();
      expect((await service().addAdjustment('nope', '10', 'note')).ok).toBeFalse();
    });

    it('refuses writes to a closed and locked day', async () => {
      await signInAs(UserRole.ADMIN);
      await TestBed.inject(PosCounterService).close(counterCloseInput('0'));
      const actual = await service().saveActualBalance(TEST_TODAY, '10');
      const adjustment = await service().addAdjustment(TEST_TODAY, '10', 'note');
      expect(actual.ok ? '' : actual.message).toBe(DAY_LOCKED_MESSAGE);
      expect(adjustment.ok ? '' : adjustment.message).toBe(DAY_LOCKED_MESSAGE);
      expect((await today()).toDayLocked).toBeTrue();
    });

    it('refuses a second save while the first is still running', async () => {
      await signInAs(UserRole.ADMIN);
      const [first, second] = await Promise.all([
        service().saveActualBalance(TEST_TODAY, '10'),
        service().saveActualBalance(TEST_TODAY, '20'),
      ]);
      expect([first.ok, second.ok]).toEqual([true, false]);
      expect(second.ok ? '' : second.reason).toBe('busy');
    });

    it('lets an Admin set the opening balance through the cash book', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().saveOpeningBalance('4000', false)).ok).toBeTrue();
      expect(row(await today(), 'OPENING_BALANCE').creditCents).toBe(400_000);
    });
  });
});
