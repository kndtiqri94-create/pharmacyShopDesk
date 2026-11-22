import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import {
  TEST_TODAY,
  closeOpenDialogs,
  setPosLevel,
  settle,
  testBill,
} from '../../../../../testing/pos-test.util';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosCashService } from '../../../../core/services/pos-cash.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { CashBookDialogComponent } from './cash-book-dialog.component';

describe('CashBookDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(role: UserRole = UserRole.CASHIER, prepare?: () => Promise<void>) {
    await signInAs(role);
    if (prepare) await prepare();
    const fixture = TestBed.createComponent(CashBookDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    const setDate = async (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const text = (testId: string) =>
      element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    return { fixture, element, button, setDate, text };
  }

  it('is titled Cash Book and shows Today by default', async () => {
    const { element } = await render();
    expect(element.querySelector('h2')?.textContent).toBe('Cash Book');
    expect((element.querySelector('#cash-book-from') as HTMLInputElement).value).toBe(TEST_TODAY);
    expect((element.querySelector('#cash-book-to') as HTMLInputElement).value).toBe(TEST_TODAY);
    expect(element.textContent).toContain('Created at');
  });

  it('lists the ledger rows in order and ends with Balance, Actual Balance and Difference', async () => {
    const { element } = await render();
    const labels = Array.from(element.querySelectorAll('[data-testid="cash-ledger"] tr'))
      .slice(1)
      .map(row => row.querySelector('th')?.textContent?.replace('Sample', '').trim());
    expect(labels).toEqual([
      'Opening Balance',
      'Total Expenses',
      'Advance Salary',
      'Employee Loan Settlement',
      'Incomes',
      'Invoices',
      'Previous Invoices',
      'Invoice Returns',
      'GRNs',
      'GRN Returns',
      'Cash back',
      'Adjustments',
      'Cashbook Bank Deposit',
      'Balance',
      'Actual Balance',
      'Difference',
    ]);
    const headers = Array.from(
      element.querySelectorAll('[data-testid="cash-ledger"] thead th')
    ).map(cell => cell.textContent?.trim());
    expect(headers).toEqual(['Description', 'Credit (Rs.)', 'Debit (Rs.)', 'Balance (Rs.)']);
  });

  it('shows the rows without a real module with sample figures', async () => {
    const { element } = await render();
    for (const key of ['ADVANCE_SALARY', 'EMPLOYEE_LOAN_SETTLEMENT', 'CASH_BACK', 'BANK_DEPOSIT']) {
      const row = element.querySelector(`[data-row="${key}"]`)!;
      expect(row.textContent).toContain('Sample');
      expect(row.textContent).not.toContain('Rs. 0.00 Rs. 0.00 Rs. 0.00');
    }
  });

  it('lists only Card and Online, and the five daily sales lines', async () => {
    const { element } = await render();
    const methods = Array.from(
      element.querySelectorAll('[data-testid="cash-other-payments"] tbody th')
    ).map(cell => cell.textContent?.trim());
    expect(methods).toEqual(['Card', 'Online']);
    const lines = Array.from(
      element.querySelectorAll('[data-testid="cash-daily-summary"] tbody th')
    ).map(cell => cell.textContent?.trim());
    expect(lines).toEqual([
      'Sale Invoices',
      'Invoice Returns',
      'Discount',
      'Tax',
      'Unpaid Invoices',
    ]);
  });

  it('never shows Reload, Utility or Provider TopUp', async () => {
    const { element } = await render(UserRole.ADMIN);
    const content = element.textContent ?? '';
    for (const word of ['Reload', 'Utility', 'Provider', 'TopUp']) {
      expect(content).not.toContain(word);
    }
  });

  it('still reflects cash sales and opening, and leaves card out of cash', async () => {
    const { element, text } = await render(UserRole.CASHIER, async () => {
      await TestBed.inject(PosCashService).saveOpening('2500', false);
      await TestBed.inject(PosSaleService).save(testBill());
      await TestBed.inject(PosSaleService).save(
        testBill({
          invoiceNo: 'INV-0002',
          payments: { ...testBill().payments, cash: '', card: '10' },
        })
      );
    });
    expect(text('cash-other-payments')).toContain('Card 1');
    expect(element.querySelector('[data-row="OPENING_BALANCE"]')?.textContent).toContain(
      '2,500.00'
    );
    expect(element.querySelector('[data-row="INVOICES"]')?.textContent).toContain('10.00');
  });

  it('shows zeros and no error for a range with no activity', async () => {
    const { fixture, element, button, setDate } = await render();
    await setDate('cash-book-from', '2026-09-01');
    await setDate('cash-book-to', '2026-09-02');
    button('Filter').click();
    await settle(fixture);
    expect(element.querySelector('[data-testid="cash-book-range-error"]')).toBeNull();
    expect(element.querySelector('[data-testid="cash-balance"]')?.textContent).toContain('0.00');
    expect(element.querySelector('[data-testid="cash-ledger"] caption')?.textContent).toContain(
      '1 Sep 2026'
    );
  });

  it('blocks a reversed range with a message and keeps the earlier figures', async () => {
    const { fixture, element, button, setDate, text } = await render();
    const before = text('cash-balance');
    await setDate('cash-book-from', '2026-09-21');
    await setDate('cash-book-to', '2026-09-10');
    button('Filter').click();
    await settle(fixture);
    expect(element.querySelector('[data-testid="cash-book-range-error"]')).not.toBeNull();
    expect(text('cash-balance')).toBe(before);
    expect(element.querySelector('[data-testid="cash-ledger"] caption')?.textContent).toContain(
      '21 Sep 2026'
    );
  });

  it('resets the dates to Today and refreshes the figures', async () => {
    const { fixture, element, button, setDate } = await render();
    await setDate('cash-book-from', '2026-09-01');
    await setDate('cash-book-to', '2026-09-02');
    button('Filter').click();
    await settle(fixture);
    button('Reset').click();
    await settle(fixture);
    expect((element.querySelector('#cash-book-from') as HTMLInputElement).value).toBe(TEST_TODAY);
    expect((element.querySelector('#cash-book-to') as HTMLInputElement).value).toBe(TEST_TODAY);
    expect(element.querySelector('[data-testid="cash-ledger"] caption')?.textContent).toContain(
      '21 Sep 2026'
    );
  });

  describe('permissions', () => {
    it('disables the three actions with a visible explanation for a non Admin, but keeps the rest working', async () => {
      const { fixture, element, button } = await render(UserRole.CASHIER);
      for (const label of ['Add Actual Balance', 'Adjustment', 'Add OB']) {
        expect(button(label).disabled).withContext(label).toBeTrue();
      }
      expect(element.querySelector('[data-testid="cash-book-admin-note"]')?.textContent).toContain(
        'Only an Admin'
      );
      for (const label of ['Filter', 'Reset', 'Export CSV', 'Export PDF']) {
        expect(button(label).disabled).withContext(label).toBeFalse();
      }
      button('Add Actual Balance').click();
      await settle(fixture);
      expect(document.querySelectorAll('dialog[open]')).toHaveSize(1);
    });

    it('keeps the actions off for an Admin who can only view the till', async () => {
      const { button } = await render(UserRole.ADMIN, () =>
        setPosLevel(UserRole.ADMIN, PermissionLevel.VIEW)
      );
      expect(button('Adjustment').disabled).toBeTrue();
    });

    it('enables the three actions for an Admin', async () => {
      const { element, button } = await render(UserRole.ADMIN);
      for (const label of ['Add Actual Balance', 'Adjustment', 'Add OB']) {
        expect(button(label).disabled).withContext(label).toBeFalse();
      }
      expect(element.querySelector('[data-testid="cash-book-admin-note"]')).toBeNull();
    });
  });

  describe('Admin actions', () => {
    it('records the counted cash and shows the difference', async () => {
      const { fixture, element, button } = await render(UserRole.ADMIN);
      button('Add Actual Balance').click();
      await settle(fixture);
      const input = element.querySelector('#actual-balance-amount') as HTMLInputElement;
      input.value = '1000';
      input.dispatchEvent(new Event('input'));
      button('Save actual balance').click();
      await settle(fixture, 120);
      expect(element.querySelector('[data-testid="cash-actual"]')?.textContent).toContain(
        '1,000.00'
      );
      expect(element.querySelector('[data-testid="cash-difference"]')?.textContent).toMatch(
        /\((Over|Short|Matches)\)/
      );
    });

    it('rejects an adjustment without a note and saves nothing', async () => {
      const { fixture, element, button, text } = await render(UserRole.ADMIN);
      const before = text('cash-balance');
      button('Adjustment').click();
      await settle(fixture);
      const amount = element.querySelector('#adjustment-amount') as HTMLInputElement;
      amount.value = '100';
      amount.dispatchEvent(new Event('input'));
      button('Save adjustment').click();
      await settle(fixture, 120);
      expect(element.querySelector('#adjustment-note-error')).not.toBeNull();
      expect(text('cash-balance')).toBe(before);
    });

    it('adds an adjustment that moves the Adjustments row and the Balance', async () => {
      const { fixture, element, button, text } = await render(UserRole.ADMIN);
      const before = text('cash-balance');
      button('Adjustment').click();
      await settle(fixture);
      const amount = element.querySelector('#adjustment-amount') as HTMLInputElement;
      amount.value = '100.50';
      amount.dispatchEvent(new Event('input'));
      const note = element.querySelector('#adjustment-note') as HTMLTextAreaElement;
      note.value = 'Found in drawer';
      note.dispatchEvent(new Event('input'));
      button('Save adjustment').click();
      await settle(fixture, 120);
      expect(element.querySelector('[data-row="ADJUSTMENTS"]')?.textContent).toContain('100.50');
      expect(text('cash-balance')).not.toBe(before);
    });
  });

  it('closes on Esc without touching anything else', async () => {
    const { fixture, element } = await render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(closed).toBe(1);
  });

  it('has only the two date fields in the filter bar', async () => {
    const { element } = await render();
    const outer = element.querySelector('dialog') as HTMLDialogElement;
    expect(outer.querySelectorAll('.cb-filter input')).toHaveSize(2);
  });
});
