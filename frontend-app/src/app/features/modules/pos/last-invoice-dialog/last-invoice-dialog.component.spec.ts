import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle, testBill } from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { PosReturnService } from '../../../../core/services/pos-return.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { LastInvoiceDialogComponent, LastInvoicePrint } from './last-invoice-dialog.component';

describe('LastInvoiceDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    clearBrowserStorage();
  });

  async function render(sales = 1) {
    await signInAs(UserRole.CASHIER);
    for (let index = 1; index <= sales; index += 1) {
      const invoiceNo = `INV-000${index}`;
      await TestBed.inject(PosSaleService).save(testBill({ invoiceNo }));
    }
    const fixture = TestBed.createComponent(LastInvoiceDialogComponent);
    const printed: LastInvoicePrint[] = [];
    fixture.componentInstance.printRequested.subscribe(item => printed.push(item));
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement, printed };
  }

  it('says there are no sales yet when none has been saved', async () => {
    const { element } = await render(0);
    expect(element.textContent).toContain('No sales yet');
    expect(element.querySelector('[data-testid="last-invoice"]')).toBeNull();
  });

  it('shows the most recently saved sale with its items, total and payments', async () => {
    const { element } = await render(2);
    const view = element.querySelector('[data-testid="last-invoice"]')!;
    expect(view.textContent).toContain('INV-0002');
    expect(view.textContent).toContain('Paracetamol 500mg');
    expect(view.textContent).toContain('Rs. 10');
    expect(view.textContent).toContain('Cash');
  });

  it('is for viewing and reprinting only', async () => {
    const { element } = await render();
    const labels = Array.from(element.querySelectorAll('button')).map(button =>
      button.textContent?.trim()
    );
    expect(labels).toContain('Print receipt');
    expect(element.querySelectorAll('input')).toHaveSize(0);
    expect(labels.some(label => /edit|delete|change/i.test(label ?? ''))).toBeFalse();
  });

  it('hands the sale over for printing', async () => {
    const { fixture, element, printed } = await render();
    const print = Array.from(element.querySelectorAll('button')).find(
      candidate => candidate.textContent?.trim() === 'Print receipt'
    )!;
    print.click();
    fixture.detectChanges();
    expect(printed).toHaveSize(1);
    expect(printed[0].sale.invoiceNo).toBe('INV-0001');
  });

  it('still shows the latest sale after a return and says a return was made', async () => {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosSaleService).save(testBill());
    await TestBed.inject(PosReturnService).findInvoice('INV-0001');
    TestBed.inject(PosReturnService).setQuantity('prod-001', '1');
    await TestBed.inject(PosReturnService).complete();
    const fixture = TestBed.createComponent(LastInvoiceDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('INV-0001');
    expect(text).toContain('RET-0001');
  });
});
