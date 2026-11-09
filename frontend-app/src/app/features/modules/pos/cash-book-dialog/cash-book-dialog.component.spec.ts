import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle, testBill } from '../../../../../testing/pos-test.util';
import { SalePaymentMethod } from '../../../../core/models/enums/sale-payment-method.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
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
    clearBrowserStorage();
  });

  async function render() {
    await signInAs(UserRole.CASHIER);
    const fixture = TestBed.createComponent(CashBookDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the opening balance and a clear message on a day with no movements', async () => {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosCashService).saveOpening('2500', false);
    const fixture = TestBed.createComponent(CashBookDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="cash-opening"]')?.textContent).toContain('2,500');
    expect(element.textContent).toContain('No cash movements');
    expect(element.textContent).not.toContain('error');
  });

  it('lists cash sales with a running closing balance and leaves card sales out', async () => {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosSaleService).save(testBill());
    await TestBed.inject(PosSaleService).save(
      testBill({
        invoiceNo: 'INV-0002',
        payments: { ...testBill().payments, cash: '', card: '10' },
      })
    );
    const fixture = TestBed.createComponent(CashBookDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    expect(rows).toHaveSize(1);
    expect(rows[0].textContent).toContain('Sale INV-0001');
    expect(element.querySelector('[data-testid="cash-closing"]')?.textContent).toContain('10');
    expect(SalePaymentMethod.CARD).toBe('CARD');
  });

  it('shows an earlier day for viewing only', async () => {
    const { fixture, element } = await render();
    const date = element.querySelector('#cash-book-date') as HTMLInputElement;
    date.value = '2026-09-20';
    date.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(element.textContent).toContain('shown for viewing only');
  });

  it('does not accept a future day', async () => {
    const { fixture, element } = await render();
    const date = element.querySelector('#cash-book-date') as HTMLInputElement;
    date.value = '2030-01-01';
    date.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(date.value).toBe('2026-09-21');
  });

  it('has no editing controls except the day picker', async () => {
    const { element } = await render();
    expect(element.querySelectorAll('input')).toHaveSize(1);
  });
});
